import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface DebugJWTRequest {
  external_jwt: string;
  email: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJWT(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

async function fetchCompaniesFromAPI(externalJwt: string, apiBaseUrl: string) {
  try {
    const response = await fetch(`${apiBaseUrl}/Parameter/List?Types=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${externalJwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`,
        data: null
      };
    }

    const companies = await response.json();
    return {
      success: true,
      error: null,
      data: companies || []
    };
  } catch (error) {
    return {
      success: false,
      error: `Network Error: ${error.message}`,
      data: null
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

    const { external_jwt, email }: DebugJWTRequest = await req.json().catch(() => ({}));
    
    if (!external_jwt || !email) {
      return jsonResponse({ error: "JWT externo y email son requeridos" }, 400);
    }

    const userEmail = email.toLowerCase().trim();

    // 1. Parsear el JWT externo
    const jwtPayload = parseJWT(external_jwt);
    if (!jwtPayload) {
      return jsonResponse({ error: "JWT externo inválido" }, 400);
    }

    console.log('🔍 JWT Payload completo:', JSON.stringify(jwtPayload, null, 2));

    // 2. Extraer datos del JWT
    const organization = jwtPayload.organization;
    const companiesString = jwtPayload.companies;
    const workerIdRelation = jwtPayload.workerIdRelation;

    // 3. Parsear companies del JWT
    let userCompanyIds: string[] = [];
    let companiesParseError = null;
    
    try {
      if (companiesString && typeof companiesString === 'string') {
        try {
          userCompanyIds = JSON.parse(companiesString);
        } catch (parseError) {
          userCompanyIds = companiesString.split(',').map(id => id.trim()).filter(id => id);
        }
      } else if (Array.isArray(companiesString)) {
        userCompanyIds = companiesString;
      } else if (companiesString && typeof companiesString === 'object') {
        if (Array.isArray(companiesString.ids)) {
          userCompanyIds = companiesString.ids;
        } else if (Array.isArray(companiesString.companies)) {
          userCompanyIds = companiesString.companies;
        }
      }
    } catch (error) {
      companiesParseError = error.message;
    }

    // 4. Obtener empresas de la API externa
    const apiResult = await fetchCompaniesFromAPI(external_jwt, API_BASE_URL);

    // 5. Buscar usuario en la base de datos
    const { data: worker, error: workerError } = await admin
      .from('workers')
      .select('*')
      .eq('email', userEmail)
      .single();

    // 6. Obtener locales actuales del usuario
    let userLocations = [];
    if (worker) {
      const { data: userLocsData, error: userLocsError } = await admin
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
      
      userLocations = userLocsData || [];
    }

    // 7. Obtener todos los locales disponibles
    const { data: allLocations, error: allLocsError } = await admin
      .from('locations')
      .select('*')
      .order('name');

    // 8. Análisis de matching
    let matchingAnalysis = [];
    if (apiResult.success && apiResult.data) {
      matchingAnalysis = userCompanyIds.map(companyId => {
        const apiCompany = apiResult.data.find(c => c.id === companyId);
        const dbLocation = allLocations?.find(loc => 
          loc.name === apiCompany?.name || 
          loc.notes?.includes(`Company ID: ${companyId}`)
        );
        
        return {
          jwt_company_id: companyId,
          api_company: apiCompany ? {
            id: apiCompany.id,
            name: apiCompany.name,
            organizationId: apiCompany.organizationId
          } : null,
          db_location: dbLocation ? {
            id: dbLocation.id,
            name: dbLocation.name,
            company_name: dbLocation.company_name,
            notes: dbLocation.notes
          } : null,
          organization_match: apiCompany?.organizationId === organization,
          should_be_assigned: apiCompany?.organizationId === organization
        };
      });
    }

    return jsonResponse({
      debug_info: {
        user_email: userEmail,
        user_found: !!worker,
        user_id: worker?.id,
        api_base_url: API_BASE_URL,
        jwt_data: {
          organization: organization,
          companies_raw: companiesString,
          companies_type: typeof companiesString,
          companies_parsed: userCompanyIds,
          companies_count: userCompanyIds.length,
          worker_id_relation: workerIdRelation,
          companies_parse_error: companiesParseError
        },
        api_data: {
          success: apiResult.success,
          error: apiResult.error,
          companies_count: apiResult.data?.length || 0,
          companies_sample: apiResult.data?.slice(0, 5).map(c => ({
            id: c.id,
            name: c.name,
            organizationId: c.organizationId
          })) || []
        },
        current_user_locations: {
          count: userLocations.length,
          locations: userLocations
        },
        all_db_locations: {
          count: allLocations?.length || 0,
          locations: allLocations?.slice(0, 10).map(loc => ({
            id: loc.id,
            name: loc.name,
            company_name: loc.company_name,
            notes: loc.notes?.substring(0, 100) + (loc.notes?.length > 100 ? '...' : '')
          })) || []
        },
        matching_analysis: matchingAnalysis,
        expected_assignments: matchingAnalysis.filter(m => m.should_be_assigned).length,
        problems_detected: {
          no_jwt_companies: userCompanyIds.length === 0,
          api_call_failed: !apiResult.success,
          no_api_companies: apiResult.success && apiResult.data?.length === 0,
          no_organization: !organization,
          no_matching_companies: matchingAnalysis.filter(m => m.should_be_assigned).length === 0
        }
      }
    });

  } catch (err: any) {
    console.error("❌ Error in debug-jwt-data:", err);
    return jsonResponse({ 
      error: "Error interno del servidor", 
      details: err?.message ?? String(err) 
    }, 500);
  }
});