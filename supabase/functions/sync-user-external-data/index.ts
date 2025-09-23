import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface SyncUserDataRequest {
  external_jwt: string;
  user_email: string;
}

interface CompanyData {
  id: string;
  name: string;
  organizationId: string;
}

interface WorkerData {
  id: string;
  name: string;
  email: string;
  providerEmail: string;
  dni: string;
  direccion: string;
  phone: string;
  empresas: string;
  tipoEmpleado: string;
  fechaNacimiento: string;
  fechaAlta: string;
  estado: string;
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

async function fetchCompaniesFromAPI(externalJwt: string, apiBaseUrl: string): Promise<CompanyData[]> {
  try {
    console.log('🏢 Fetching companies from API...');
    const response = await fetch(`${apiBaseUrl}/Parameter/List?Types=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${externalJwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Companies API call failed:', response.status, response.statusText);
      return [];
    }

    const companies = await response.json();
    console.log('🏢 Companies fetched successfully:', companies?.length || 0);
    return companies || [];
  } catch (error) {
    console.error('Error fetching companies:', error);
    return [];
  }
}

async function fetchWorkerFromAPI(externalJwt: string, apiBaseUrl: string, workerIdRelation: string): Promise<WorkerData | null> {
  try {
    console.log('👤 Fetching worker data from API...');
    const response = await fetch(`${apiBaseUrl}/Parameter/List?Types=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${externalJwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Workers API call failed:', response.status, response.statusText);
      return null;
    }

    const workers = await response.json();
    const worker = workers.find((w: any) => w.id === workerIdRelation);
    
    if (worker) {
      console.log('✅ Worker found in API:', worker.name);
      return worker;
    } else {
      console.warn('⚠️ Worker not found in API for ID:', workerIdRelation);
      return null;
    }
  } catch (error) {
    console.error('Error fetching worker from API:', error);
    return null;
  }
}

function formatDate(dateString: string): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return null;
  }
}

function getCompanyNames(companyIds: string[], companies: CompanyData[]): string {
  if (!companyIds || companyIds.length === 0) return '';
  
  const names = companyIds
    .map(id => {
      const company = companies.find(c => c.id === id);
      return company ? company.name : id;
    })
    .filter(name => name);
  
  return names.join(' • ');
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

    const { external_jwt, user_email }: SyncUserDataRequest = await req.json().catch(() => ({}));
    
    if (!external_jwt || !user_email) {
      return jsonResponse({ error: "JWT externo y email son requeridos" }, 400);
    }

    const userEmail = user_email.toLowerCase().trim();

    // 1. Parsear JWT externo
    const jwtPayload = parseJWT(external_jwt);
    if (!jwtPayload) {
      return jsonResponse({ error: "JWT externo inválido" }, 400);
    }

    console.log('🔍 Iniciando sincronización para:', userEmail);

    // 2. Buscar usuario en workers
    const { data: worker, error: workerError } = await admin
      .from('workers')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (workerError || !worker) {
      return jsonResponse({ 
        error: "Usuario no encontrado en Supabase",
        details: workerError?.message 
      }, 404);
    }

    // 3. Extraer datos del JWT
    const organization = jwtPayload.organization;
    const companiesString = jwtPayload.companies;
    const workerIdRelation = jwtPayload.workerIdRelation;

    // Parsear company IDs
    let userCompanyIds: string[] = [];
    try {
      if (companiesString && typeof companiesString === 'string') {
        try {
          userCompanyIds = JSON.parse(companiesString);
        } catch {
          userCompanyIds = companiesString.split(',').map(id => id.trim()).filter(id => id);
        }
      } else if (Array.isArray(companiesString)) {
        userCompanyIds = companiesString;
      }
    } catch (error) {
      console.error('Error parsing companies from JWT:', error);
    }

    // 4. Obtener datos de la API externa
    const [companies, workerData] = await Promise.all([
      fetchCompaniesFromAPI(external_jwt, API_BASE_URL),
      workerIdRelation ? fetchWorkerFromAPI(external_jwt, API_BASE_URL, workerIdRelation) : Promise.resolve(null)
    ]);

    // 5. Procesar nombres de empresas
    const empresasText = getCompanyNames(userCompanyIds, companies);

    // 6. Preparar datos externos para almacenar
    const externalData = {
      user_id: worker.id,
      worker_id_relation: workerIdRelation,
      full_name: workerData?.name || jwtPayload.name || worker.name,
      dni: workerData?.dni || jwtPayload.dni,
      direccion: workerData?.direccion || jwtPayload.direccion,
      phone: workerData?.phone || jwtPayload.phone,
      empresas: empresasText,
      company_ids: userCompanyIds,
      tipo_empleado: workerData?.tipoEmpleado || jwtPayload.tipoEmpleado,
      fecha_nacimiento: formatDate(workerData?.fechaNacimiento || jwtPayload.fechaNacimiento),
      fecha_alta: formatDate(workerData?.fechaAlta || jwtPayload.fechaAlta),
      estado: workerData?.estado || jwtPayload.estado,
      organization: organization,
      last_sync_at: new Date().toISOString()
    };

    // 7. Verificar si existen datos externos previos
    const { data: existingData, error: existingError } = await admin
      .from('user_external_data')
      .select('*')
      .eq('user_id', worker.id)
      .single();

    let hasChanges = false;
    let changeDetails: string[] = [];

    if (existingError && existingError.code === 'PGRST116') {
      // No existen datos previos, insertar nuevos
      console.log('📝 Insertando nuevos datos externos para:', userEmail);
      
      const { error: insertError } = await admin
        .from('user_external_data')
        .insert(externalData);

      if (insertError) {
        throw new Error(`Error insertando datos externos: ${insertError.message}`);
      }

      hasChanges = true;
      changeDetails.push('Datos externos creados por primera vez');
    } else if (existingError) {
      throw new Error(`Error verificando datos existentes: ${existingError.message}`);
    } else {
      // Comparar datos existentes con nuevos datos
      console.log('🔍 Comparando datos existentes con nuevos datos...');
      
      const fieldsToCompare = [
        'worker_id_relation',
        'full_name',
        'dni',
        'direccion',
        'phone',
        'empresas',
        'tipo_empleado',
        'fecha_nacimiento',
        'fecha_alta',
        'estado',
        'organization'
      ];

      for (const field of fieldsToCompare) {
        const oldValue = existingData[field];
        const newValue = externalData[field];
        
        // Comparar arrays de company_ids por separado
        if (field === 'company_ids') {
          const oldIds = existingData.company_ids || [];
          const newIds = userCompanyIds || [];
          
          if (JSON.stringify(oldIds.sort()) !== JSON.stringify(newIds.sort())) {
            hasChanges = true;
            changeDetails.push(`${field}: [${oldIds.join(', ')}] → [${newIds.join(', ')}]`);
          }
        } else if (oldValue !== newValue) {
          hasChanges = true;
          changeDetails.push(`${field}: "${oldValue}" → "${newValue}"`);
        }
      }

      // Actualizar si hay cambios
      if (hasChanges) {
        console.log('🔄 Actualizando datos externos. Cambios detectados:', changeDetails.length);
        
        const { error: updateError } = await admin
          .from('user_external_data')
          .update({
            ...externalData,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', worker.id);

        if (updateError) {
          throw new Error(`Error actualizando datos externos: ${updateError.message}`);
        }
      } else {
        console.log('✅ No hay cambios en los datos externos');
        
        // Actualizar solo last_sync_at
        const { error: syncUpdateError } = await admin
          .from('user_external_data')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('user_id', worker.id);

        if (syncUpdateError) {
          console.warn('⚠️ Error actualizando last_sync_at:', syncUpdateError);
        }
      }
    }

    // 8. Actualizar datos básicos del worker si es necesario
    const workerUpdates: any = {};
    let workerHasChanges = false;

    if (externalData.full_name && worker.name !== externalData.full_name) {
      workerUpdates.name = externalData.full_name;
      workerHasChanges = true;
      changeDetails.push(`worker.name: "${worker.name}" → "${externalData.full_name}"`);
    }

    if (externalData.phone && worker.phone !== externalData.phone) {
      workerUpdates.phone = externalData.phone;
      workerHasChanges = true;
      changeDetails.push(`worker.phone: "${worker.phone}" → "${externalData.phone}"`);
    }

    if (workerHasChanges) {
      console.log('🔄 Actualizando datos básicos del worker...');
      
      const { error: workerUpdateError } = await admin
        .from('workers')
        .update({
          ...workerUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('id', worker.id);

      if (workerUpdateError) {
        console.warn('⚠️ Error actualizando worker:', workerUpdateError);
      }
    }

    console.log('✅ Sincronización completada para:', userEmail);

    return jsonResponse({
      success: true,
      user_id: worker.id,
      has_changes: hasChanges || workerHasChanges,
      change_details: changeDetails,
      companies_processed: companies.length,
      user_companies: userCompanyIds.length,
      empresas_text: empresasText,
      message: hasChanges || workerHasChanges 
        ? `Datos sincronizados con ${changeDetails.length} cambios`
        : 'Datos ya estaban actualizados'
    });

  } catch (err: any) {
    console.error("❌ Error in sync-user-external-data:", err);
    return jsonResponse({ 
      error: "Error interno del servidor", 
      details: err?.message ?? String(err) 
    }, 500);
  }
});