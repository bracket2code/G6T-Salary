import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface ForceSyncRequest {
  user_email: string;
  company_ids: string[];
  organization: string;
  force_recreate?: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function syncUserCompaniesManual(
  supabaseAdmin: any,
  userId: string,
  companyIds: string[],
  organization: string,
  forceRecreate: boolean = false
) {
  try {
    console.log(`🔄 Iniciando sincronización manual para usuario ${userId}`);
    console.log(`🔄 Company IDs: [${companyIds.join(', ')}]`);
    console.log(`🔄 Organización: ${organization}`);
    console.log(`🔄 Forzar recreación: ${forceRecreate}`);

    // Si se fuerza recreación, eliminar asignaciones existentes
    if (forceRecreate) {
      const { error: deleteError } = await supabaseAdmin
        .from('user_locations')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error eliminando asignaciones existentes:', deleteError);
      } else {
        console.log('✅ Asignaciones existentes eliminadas');
      }
    }

    let syncedCount = 0;
    const results = [];

    // Procesar cada company ID
    for (const companyId of companyIds) {
      console.log(`🏢 Procesando company ID: ${companyId}`);
      
      // Crear nombre del local basado en el ID (temporal)
      const locationName = `Empresa ${companyId}`;
      
      // Verificar si el local ya existe
      const { data: existingLocation, error: selectError } = await supabaseAdmin
        .from('locations')
        .select('id, name')
        .eq('name', locationName)
        .single();

      let locationId: string;

      if (selectError && selectError.code === 'PGRST116') {
        // El local no existe, crearlo
        console.log(`➕ Creando nuevo local: ${locationName}`);
        const { data: newLocation, error: insertError } = await supabaseAdmin
          .from('locations')
          .insert({
            name: locationName,
            company_name: locationName,
            notes: `Local sincronizado manualmente. Organization: ${organization}. Company ID: ${companyId}. Fecha: ${new Date().toISOString()}`
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`Error creando local ${locationName}:`, insertError);
          results.push({
            company_id: companyId,
            location_name: locationName,
            status: 'error',
            error: insertError.message
          });
          continue;
        }

        locationId = newLocation.id;
        console.log(`✅ Local creado: ${locationName}`);
      } else if (selectError) {
        console.error(`Error verificando local ${locationName}:`, selectError);
        results.push({
          company_id: companyId,
          location_name: locationName,
          status: 'error',
          error: selectError.message
        });
        continue;
      } else {
        locationId = existingLocation.id;
        console.log(`✅ Local existente encontrado: ${locationName}`);
      }

      // Verificar si ya está asignado
      const { data: existingAssignment } = await supabaseAdmin
        .from('user_locations')
        .select('id')
        .eq('user_id', userId)
        .eq('location_id', locationId)
        .single();

      if (!existingAssignment) {
        // Asignar el local al usuario
        console.log(`🔗 Asignando local ${locationName} al usuario`);
        const { error: assignError } = await supabaseAdmin
          .from('user_locations')
          .insert({
            user_id: userId,
            location_id: locationId,
          });

        if (assignError) {
          console.error(`Error asignando local ${locationName}:`, assignError);
          results.push({
            company_id: companyId,
            location_name: locationName,
            status: 'error',
            error: assignError.message
          });
        } else {
          console.log(`✅ Local ${locationName} asignado exitosamente`);
          syncedCount++;
          results.push({
            company_id: companyId,
            location_name: locationName,
            status: 'success',
            action: 'assigned'
          });
        }
      } else {
        console.log(`ℹ️ Local ${locationName} ya estaba asignado`);
        results.push({
          company_id: companyId,
          location_name: locationName,
          status: 'skipped',
          action: 'already_assigned'
        });
      }
    }

    return {
      success: true,
      synced_count: syncedCount,
      total_companies: companyIds.length,
      results: results
    };

  } catch (error) {
    console.error('Error en sincronización manual:', error);
    return {
      success: false,
      error: error.message,
      synced_count: 0,
      total_companies: companyIds.length,
      results: []
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const API_BASE_URL = Deno.env.get("VITE_API_BASE_URL") ?? Deno.env.get("API_BASE_URL") ?? "";
    
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return jsonResponse({ error: "Faltan variables de entorno de Supabase" }, 500);
    }

    if (!API_BASE_URL) {
      return jsonResponse({ 
        error: "API_BASE_URL no configurada",
        available_env_vars: Object.keys(Deno.env.toObject()).filter(key => key.includes('API'))
      }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { user_email, company_ids, organization, force_recreate }: ForceSyncRequest = await req.json().catch(() => ({}));
    
    if (!user_email) {
      return jsonResponse({ error: "user_email es requerido" }, 400);
    }

    const userEmail = user_email.toLowerCase().trim();

    // Buscar usuario
    const { data: worker, error: workerError } = await admin
      .from('workers')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (workerError || !worker) {
      return jsonResponse({ 
        error: "Usuario no encontrado",
        details: workerError?.message 
      }, 404);
    }

    // Si no se proporcionan company_ids, intentar obtenerlos del último JWT
    let finalCompanyIds = company_ids;
    let finalOrganization = organization;

    if (!finalCompanyIds || finalCompanyIds.length === 0) {
      return jsonResponse({
        error: "Se requieren company_ids para la sincronización manual",
        help: "Proporciona los IDs de las empresas que quieres asignar al usuario"
      }, 400);
    }

    if (!finalOrganization) {
      return jsonResponse({
        error: "Se requiere organization para la sincronización manual",
        help: "Proporciona la organización del usuario"
      }, 400);
    }

    // Realizar sincronización manual
    const syncResult = await syncUserCompaniesManual(
      admin,
      worker.id,
      finalCompanyIds,
      finalOrganization,
      force_recreate
    );

    return jsonResponse({
      message: "Sincronización manual completada",
      user: {
        id: worker.id,
        name: worker.name,
        email: worker.email
      },
      sync_result: syncResult,
      instructions: {
        next_steps: [
          "Revisa los resultados de la sincronización",
          "Verifica que los locales se hayan asignado correctamente",
          "Prueba hacer login nuevamente para confirmar que funciona"
        ]
      }
    });

  } catch (err: any) {
    console.error("❌ Error in force-user-sync:", err);
    return jsonResponse({ 
      error: "Error interno del servidor", 
      details: err?.message ?? String(err) 
    }, 500);
  }
});