import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface GetUserContactRequest {
  user_email: string;
}

interface WorkerData {
  id: string;
  name: string;
  providerEmail: string;
  phone?: string;
  // Agregar otros campos según la estructura de la API
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWorkersFromAPI(apiBaseUrl: string): Promise<WorkerData[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/Parameter/List?Types=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('⚠️ API call failed:', response.status, response.statusText);
      return [];
    }

    const workers = await response.json();
    console.log('✅ Workers fetched from API:', workers?.length || 0);
    
    return workers || [];
  } catch (error) {
    console.warn('⚠️ API fetch error:', error);
    return [];
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

    const { user_email }: GetUserContactRequest = await req.json().catch(() => ({}));
    
    if (!user_email) {
      return jsonResponse({ error: "user_email es requerido" }, 400);
    }

    const userEmail = user_email.toLowerCase().trim();

    // 1. Buscar usuario en la base de datos de Supabase con sus empresas asignadas
    const { data: supabaseUser, error: supabaseError } = await admin
      .rpc('get_users_with_skills')
      .eq('user_email', userEmail)
      .single();

    // Si la función RPC falla, intentar consulta directa
    let finalSupabaseUser = supabaseUser;
    if (supabaseError) {
      console.warn('⚠️ RPC failed, trying direct query:', supabaseError.message);
      const { data: directUser, error: directError } = await admin
        .from('workers')
        .select(`
          *,
          user_locations(
            id,
            location_id,
            locations(
              id,
              name,
              company_name
            )
          )
        `)
        .eq('email', userEmail)
        .single();
        
      if (directError) {
        console.error('❌ Error fetching user from Supabase:', directError);
        return jsonResponse({ 
          error: "Usuario no encontrado en Supabase",
          details: directError.message,
          user: null,
          api_available: false
        }, 404);
      }
      
      finalSupabaseUser = {
        user_id: directUser.id,
        user_name: directUser.name,
        user_email: directUser.email,
        user_role: directUser.role,
        user_phone: directUser.phone,
        user_avatar_url: directUser.avatar_url,
        user_created_at: directUser.created_at,
        user_updated_at: directUser.updated_at,
        locations: directUser.user_locations?.map((ul: any) => ({
          id: ul.id,
          location_id: ul.location_id,
          location_name: ul.locations?.name || 'Sin nombre',
          company_name: ul.locations?.company_name
        })) || []
      };
    }
      .eq('email', userEmail)
      .single();

    if (!finalSupabaseUser) {
      console.warn('⚠️ Usuario no encontrado en Supabase');
      return jsonResponse({ 
        error: "Usuario no encontrado en Supabase",
        details: "No user data available",
        user: null,
        api_available: false
      }, 404);
    }

    // 2. Obtener todos los workers de la API externa
    const apiWorkers = await fetchWorkersFromAPI(API_BASE_URL);
    
    if (apiWorkers.length === 0) {
      console.warn('⚠️ No workers from external API, using Supabase only');
      // Devolver solo datos de Supabase si la API falla
      return jsonResponse({
        user: {
          id: finalSupabaseUser.user_id,
          name: finalSupabaseUser.user_name,
          email: finalSupabaseUser.user_email,
          phone: finalSupabaseUser.user_phone,
          role: finalSupabaseUser.user_role,
          avatarUrl: finalSupabaseUser.user_avatar_url,
          empresas: finalSupabaseUser.locations?.map((loc: any) => loc.location_name).join(' • ') || 'Sin empresas asignadas',
          source: 'supabase_only'
        },
        api_available: false
      });
    }

    // 3. Buscar el worker en la API que coincida con el email
    const matchingWorker = apiWorkers.find((worker: any) => 
      worker.providerEmail && worker.providerEmail.toLowerCase() === userEmail
    );

    if (!matchingWorker) {
      console.warn(`⚠️ No matching worker in API for email: ${userEmail}`);
      // Devolver solo datos de Supabase
      return jsonResponse({
        user: {
          id: finalSupabaseUser.user_id,
          name: finalSupabaseUser.user_name,
          email: finalSupabaseUser.user_email,
          phone: finalSupabaseUser.user_phone,
          role: finalSupabaseUser.user_role,
          avatarUrl: finalSupabaseUser.user_avatar_url,
          empresas: finalSupabaseUser.locations?.map((loc: any) => loc.location_name).join(' • ') || 'Sin empresas asignadas',
          source: 'supabase_only'
        },
        api_available: true,
        api_match_found: false
      });
    }

    // 4. Combinar datos de Supabase y API externa
    console.log('🔄 Combining data from Supabase and API');
    console.log('📊 API worker data:', matchingWorker);
    
    const combinedUserData = {
      id: finalSupabaseUser.user_id,
      name: matchingWorker.name || supabaseUser.name,
      nombreCompleto: matchingWorker.name,
      email: finalSupabaseUser.user_email,
      phone: matchingWorker.phone || supabaseUser.phone,
      role: finalSupabaseUser.user_role,
      avatarUrl: finalSupabaseUser.user_avatar_url,
      // Datos adicionales de la API externa
      empresas: matchingWorker.empresas || finalSupabaseUser.locations?.map((loc: any) => loc.location_name).join(' • ') || 'Sin empresas asignadas',
      direccion: matchingWorker.direccion,
      dni: matchingWorker.dni,
      tipoEmpleado: matchingWorker.tipoEmpleado,
      fechaNacimiento: matchingWorker.fechaNacimiento,
      fechaAlta: matchingWorker.fechaAlta,
      estado: matchingWorker.estado,
      source: 'combined'
    };

    console.log('✅ Usuario encontrado y datos combinados:', combinedUserData.name);

    return jsonResponse({
      user: combinedUserData,
      api_available: true,
      api_match_found: true
    });

  } catch (err: any) {
    console.error("❌ Unexpected error in get-user-contact-info:", err);
    return jsonResponse({ 
      error: "Error interno del servidor", 
      details: err?.message ?? String(err) 
    }, 500);
  }
});