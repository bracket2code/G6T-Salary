import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return jsonResponse({ error: "Faltan variables de entorno de Supabase" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { action } = await req.json().catch(() => ({}));
    
    if (action === "analyze") {
      // Analizar duplicados
      const { data: duplicates, error: duplicatesError } = await admin
        .rpc('analyze_location_duplicates');

      if (duplicatesError) {
        console.error('Error analyzing duplicates:', duplicatesError);
      }

      // Obtener estadísticas generales
      const { data: allLocations, error: locationsError } = await admin
        .from('locations')
        .select('id, name, company_name, notes, created_at')
        .order('name');

      const { data: userLocationCounts, error: userLocError } = await admin
        .from('user_locations')
        .select('location_id, locations(name)')
        .order('location_id');

      // Agrupar por nombre para identificar duplicados
      const locationsByName: Record<string, any[]> = {};
      allLocations?.forEach(loc => {
        if (!locationsByName[loc.name]) {
          locationsByName[loc.name] = [];
        }
        locationsByName[loc.name].push(loc);
      });

      const duplicatedNames = Object.entries(locationsByName)
        .filter(([name, locations]) => locations.length > 1)
        .map(([name, locations]) => ({
          name,
          count: locations.length,
          locations: locations.map(loc => ({
            id: loc.id,
            company_name: loc.company_name,
            notes: loc.notes,
            created_at: loc.created_at
          }))
        }));

      return jsonResponse({
        total_locations: allLocations?.length || 0,
        duplicated_names: duplicatedNames.length,
        duplicates_detail: duplicatedNames,
        user_location_assignments: userLocationCounts?.length || 0,
        analysis: {
          locations_from_api: allLocations?.filter(loc => 
            loc.notes?.includes('API externa') || 
            loc.notes?.includes('Organization:')
          ).length || 0,
          locations_manual: allLocations?.filter(loc => 
            !loc.notes?.includes('API externa') && 
            !loc.notes?.includes('Organization:')
          ).length || 0
        }
      });
    }

    if (action === "cleanup") {
      console.log('🧹 Iniciando limpieza de locales...');
      
      // 1. Eliminar todas las asignaciones de usuarios a locales
      const { error: userLocError } = await admin
        .from('user_locations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (userLocError) {
        console.error('Error eliminando user_locations:', userLocError);
        return jsonResponse({ 
          error: "Error eliminando asignaciones de usuarios", 
          details: userLocError.message 
        }, 500);
      }

      console.log('✅ Asignaciones de usuarios eliminadas');

      // 2. Actualizar tareas para desvincular locales
      const { error: tasksError } = await admin
        .from('tasks')
        .update({ location_id: null })
        .not('location_id', 'is', null);

      if (tasksError) {
        console.error('Error desvinculando tareas:', tasksError);
        return jsonResponse({ 
          error: "Error desvinculando tareas de locales", 
          details: tasksError.message 
        }, 500);
      }

      console.log('✅ Tareas desvinculadas de locales');

      // 3. Eliminar todos los locales
      const { error: locationsError } = await admin
        .from('locations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (locationsError) {
        console.error('Error eliminando locales:', locationsError);
        return jsonResponse({ 
          error: "Error eliminando locales", 
          details: locationsError.message 
        }, 500);
      }

      console.log('✅ Todos los locales eliminados');

      return jsonResponse({
        success: true,
        message: "Limpieza completada exitosamente",
        actions_performed: [
          "Eliminadas todas las asignaciones de usuarios a locales",
          "Desvinculadas todas las tareas de locales",
          "Eliminados todos los locales"
        ],
        next_steps: [
          "Los locales se volverán a crear automáticamente en el próximo login",
          "Solo se crearán los locales que correspondan según el JWT de cada usuario"
        ]
      });
    }

    return jsonResponse({ 
      error: "Acción no válida. Use 'analyze' o 'cleanup'" 
    }, 400);

  } catch (err: any) {
    console.error("❌ Error in cleanup-locations:", err);
    return jsonResponse({ 
      error: "Error interno del servidor", 
      details: err?.message ?? String(err) 
    }, 500);
  }
});