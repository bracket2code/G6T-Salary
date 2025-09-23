import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface DebugRequest {
  user_email: string;
}

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

    const { user_email }: DebugRequest = await req.json().catch(() => ({}));
    
    if (!user_email) {
      return jsonResponse({ error: "user_email es requerido" }, 400);
    }

    const userEmail = user_email.toLowerCase().trim();

    // 1. Buscar usuario en workers
    const { data: worker, error: workerError } = await admin
      .from('workers')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (workerError) {
      return jsonResponse({ 
        error: "Usuario no encontrado",
        details: workerError.message 
      }, 404);
    }

    // 2. Obtener locales asignados al usuario
    const { data: userLocations, error: locationsError } = await admin
      .from('user_locations')
      .select(`
        id,
        location_id,
        created_at,
        locations(
          id,
          name,
          company_name,
          notes
        )
      `)
      .eq('user_id', worker.id);

    // 3. Obtener todos los locales disponibles
    const { data: allLocations, error: allLocationsError } = await admin
      .from('locations')
      .select('*')
      .order('name');

    // 4. Obtener especialidades del usuario
    const { data: userSkills, error: skillsError } = await admin
      .from('user_skills')
      .select('*')
      .eq('user_id', worker.id);

    // 5. Obtener tareas asignadas al usuario
    const { data: userTasks, error: tasksError } = await admin
      .from('task_assignments')
      .select(`
        id,
        task_id,
        assigned_at,
        tasks(
          id,
          title,
          status,
          priority,
          location_id,
          locations(name)
        )
      `)
      .eq('worker_id', worker.id);

    return jsonResponse({
      user_info: {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        role: worker.role,
        phone: worker.phone,
        created_at: worker.created_at,
        updated_at: worker.updated_at
      },
      assigned_locations: {
        count: userLocations?.length || 0,
        locations: userLocations || []
      },
      all_locations: {
        count: allLocations?.length || 0,
        locations: allLocations?.map(loc => ({
          id: loc.id,
          name: loc.name,
          company_name: loc.company_name,
          notes: loc.notes,
          created_at: loc.created_at
        })) || []
      },
      user_skills: {
        count: userSkills?.length || 0,
        skills: userSkills || []
      },
      assigned_tasks: {
        count: userTasks?.length || 0,
        tasks: userTasks || []
      },
      errors: {
        locations_error: locationsError?.message,
        all_locations_error: allLocationsError?.message,
        skills_error: skillsError?.message,
        tasks_error: tasksError?.message
      }
    });

  } catch (err: any) {
    console.error("❌ Error in debug-user-data:", err);
    return jsonResponse({ 
      error: "Error interno del servidor", 
      details: err?.message ?? String(err) 
    }, 500);
  }
});