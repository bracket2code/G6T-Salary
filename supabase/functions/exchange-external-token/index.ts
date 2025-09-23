import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface ExchangeTokenRequest {
  external_jwt: string;
  email: string;
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
  // Agregar otros campos según la estructura de la API
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
    const response = await fetch(`${apiBaseUrl}/Parameter/List?Types=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${externalJwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Error fetching companies:', response.status, response.statusText);
      return [];
    }

    const companies = await response.json();
    console.log('📊 Companies fetched from API:', companies.length);
    
    return companies || [];
  } catch (error) {
    console.error('Error fetching companies from API:', error);
    return [];
  }
}

async function fetchWorkerFromAPI(externalJwt: string, apiBaseUrl: string, workerIdRelation: string): Promise<WorkerData | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/Parameter/List?Types=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${externalJwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Error fetching workers:', response.status, response.statusText);
      return null;
    }

    const workers = await response.json();
    console.log('👥 Workers fetched from API:', workers.length);
    
    // Buscar el worker que coincida con workerIdRelation
    const worker = workers.find((w: any) => w.id === workerIdRelation);
    
    if (worker) {
      console.log('✅ Worker found:', worker.name);
      return worker;
    } else {
      console.log('⚠️ Worker not found for ID:', workerIdRelation);
      return null;
    }
  } catch (error) {
    console.error('Error fetching worker from API:', error);
    return null;
  }
}

function extractFullName(jwtPayload: any, workerData?: WorkerData | null): string {
  // Si tenemos datos del worker de la API, usar ese nombre
  if (workerData?.name && typeof workerData.name === 'string' && workerData.name.trim()) {
    console.log('👤 Using worker name from API:', workerData.name);
    return workerData.name.trim();
  }

  // Fallback: extraer del JWT
  const possibleNameFields = [
    'name',
    'full_name', 
    'fullName',
    'displayName',
    'display_name',
    'nombre',
    'apellidos',
    'nombre_completo'
  ];

  console.log('🔍 Available JWT fields:', Object.keys(jwtPayload));

  // Buscar nombre completo directo
  for (const field of ['name', 'full_name', 'fullName', 'displayName', 'display_name', 'nombre_completo']) {
    if (jwtPayload[field] && typeof jwtPayload[field] === 'string' && jwtPayload[field].trim()) {
      console.log(`👤 Found full name in field '${field}':`, jwtPayload[field]);
      return jwtPayload[field].trim();
    }
  }

  // Construir nombre completo desde partes
  let fullName = '';
  
  // Nombre
  const firstName = jwtPayload.given_name || jwtPayload.first_name || jwtPayload.nombre || '';
  if (firstName && typeof firstName === 'string') {
    fullName += firstName.trim();
    console.log('👤 Found first name:', firstName);
  }

  // Apellidos
  const lastName = jwtPayload.family_name || jwtPayload.last_name || jwtPayload.apellidos || '';
  if (lastName && typeof lastName === 'string') {
    if (fullName) fullName += ' ';
    fullName += lastName.trim();
    console.log('👤 Found last name:', lastName);
  }

  // Si tenemos nombre construido, devolverlo
  if (fullName.trim()) {
    console.log('👤 Constructed full name:', fullName.trim());
    return fullName.trim();
  }

  // Fallback: usar email sin dominio
  const email = jwtPayload.email || jwtPayload.sub || '';
  if (email && typeof email === 'string') {
    const fallbackName = email.split('@')[0];
    console.log('👤 Using email fallback:', fallbackName);
    return fallbackName;
  }

  console.log('👤 Using default fallback name');
  return 'Usuario';
}

async function syncUserCompanies(
  supabaseAdmin: any,
  userId: string,
  userCompanyIds: string[],
  allCompanies: CompanyData[],
  organization: string
) {
  try {
    console.log(`🔍 Iniciando sincronización para usuario ${userId}`);
    console.log(`🔍 Company IDs del usuario: [${userCompanyIds.join(', ')}]`);
    console.log(`🔍 Total empresas de la API: ${allCompanies.length}`);
    console.log(`🔍 Organización: ${organization}`);

    // Mostrar todas las empresas de la API para debugging
    console.log(`🔍 Todas las empresas de la API:`, allCompanies.map(c => ({ 
      id: c.id, 
      name: c.name, 
      org: c.organizationId,
      matches_user: userCompanyIds.includes(c.id),
      matches_org: c.organizationId === organization
    })));

    // Filtrar empresas que coincidan con la organización y estén en la lista del usuario
    const userCompanies = allCompanies.filter(company => 
      userCompanyIds.includes(company.id) && 
      company.organizationId === organization
    );

    console.log(`🏢 Empresas filtradas para el usuario:`, userCompanies.map(c => ({ 
      id: c.id, 
      name: c.name, 
      org: c.organizationId 
    })));

    console.log(`🏢 User has access to ${userCompanies.length} companies in organization ${organization}`);
    
    if (userCompanies.length === 0) {
      console.warn(`⚠️ No se encontraron empresas válidas para el usuario`);
      console.warn(`⚠️ Verificar que las empresas del JWT coincidan con la organización`);
      
      // Mostrar detalles para debugging
      console.log(`🔍 Empresas del usuario en JWT:`, userCompanyIds);
      console.log(`🔍 Empresas disponibles en API:`, allCompanies.map(c => ({ id: c.id, name: c.name, org: c.organizationId })));
      
      // Verificar si hay empresas del usuario que no están en la API
      const missingInAPI = userCompanyIds.filter(id => !allCompanies.some(c => c.id === id));
      if (missingInAPI.length > 0) {
        console.error(`❌ Empresas del JWT que NO están en la API:`, missingInAPI);
      }
      
      // Verificar si hay empresas del usuario con organización diferente
      const wrongOrg = allCompanies.filter(c => 
        userCompanyIds.includes(c.id) && c.organizationId !== organization
      );
      if (wrongOrg.length > 0) {
        console.error(`❌ Empresas del usuario con organización diferente:`, wrongOrg.map(c => ({ 
          id: c.id, 
          name: c.name, 
          expected_org: organization, 
          actual_org: c.organizationId 
        })));
      }
      
      return [];
    }

    // Primero, eliminar todas las asignaciones existentes del usuario
    const { error: deleteError } = await supabaseAdmin
      .from('user_locations')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting existing user locations:', deleteError);
    }
    else {
      console.log('✅ Asignaciones existentes eliminadas');
    }

    // Sincronizar empresas con la tabla locations de Supabase
    for (const company of userCompanies) {
      console.log(`🏢 Procesando empresa: ${company.name} (ID: ${company.id})`);
      
      // Verificar si la empresa ya existe en locations
      const { data: existingLocation, error: selectError } = await supabaseAdmin
        .from('locations')
        .select('id')
        .eq('name', company.name)
        .single();

      let locationId: string;

      if (selectError && selectError.code === 'PGRST116') {
        // La empresa no existe, crearla
        console.log(`➕ Creando nueva ubicación: ${company.name}`);
        const { data: newLocation, error: insertError } = await supabaseAdmin
          .from('locations')
          .insert({
            name: company.name,
            company_name: company.name,
            // Agregar el ID de la organización como referencia
            notes: `Empresa sincronizada desde API externa. Organization: ${organization}. Company ID: ${company.id}`
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`Error creating location for company ${company.name}:`, insertError);
          continue;
        }

        locationId = newLocation.id;
        console.log(`✅ Created new location: ${company.name}`);
      } else if (selectError) {
        console.error(`Error checking location for company ${company.name}:`, selectError);
        continue;
      } else {
        locationId = existingLocation.id;
        console.log(`✅ Found existing location: ${company.name}`);
        
        // Actualizar la ubicación existente con información adicional si es necesario
        const { error: updateError } = await supabaseAdmin
          .from('locations')
          .update({
            company_name: company.name,
            notes: `Empresa sincronizada desde API externa. Organization: ${organization}. Company ID: ${company.id}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', locationId);

        if (updateError) {
          console.warn('⚠️ Error updating location info:', updateError);
        }
        else {
          console.log(`✅ Updated location info: ${company.name}`);
        }
      }

      // Asignar la empresa al usuario
      console.log(`🔗 Asignando ubicación ${company.name} al usuario ${userId}`);
      const { error: assignError } = await supabaseAdmin
        .from('user_locations')
        .insert({
          user_id: userId,
          location_id: locationId,
        });

      if (assignError && assignError.code !== '23505') { // Ignorar duplicados
        console.error(`Error assigning location ${company.name} to user:`, assignError);
      } else {
        console.log(`✅ Assigned location ${company.name} to user`);
      }
    }

    return userCompanies;
  } catch (error) {
    console.error('Error syncing user companies:', error);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const API_BASE_URL = Deno.env.get("VITE_API_BASE_URL") ?? Deno.env.get("API_BASE_URL") ?? "";
    
    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return jsonResponse({ error: "Faltan variables de entorno de Supabase" }, 500);
    }

    if (!API_BASE_URL) {
      return jsonResponse({ 
        error: "API_BASE_URL no configurada. Configure VITE_API_BASE_URL o API_BASE_URL en las variables de entorno.",
        available_env_vars: Object.keys(Deno.env.toObject()).filter(key => key.includes('API'))
      }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { external_jwt, email }: ExchangeTokenRequest = await req.json().catch(() => ({}));
    
    if (!external_jwt || !email) {
      return jsonResponse({ error: "JWT externo y email son requeridos" }, 400);
    }

    const userEmail = email.toLowerCase().trim();

    // Parsear el JWT externo para extraer información del usuario
    const jwtPayload = parseJWT(external_jwt);
    if (!jwtPayload) {
      return jsonResponse({ error: "JWT externo inválido" }, 400);
    }

    console.log('🔍 JWT Payload:', JSON.stringify(jwtPayload, null, 2));

    // Extraer datos del JWT
    const organization = jwtPayload.organization;
    const companiesString = jwtPayload.companies;
    const workerIdRelation = jwtPayload.workerIdRelation;

    console.log('🏢 Organization:', organization);
    console.log('🏢 Companies string:', companiesString);
    console.log('🏢 Companies string type:', typeof companiesString);
    console.log('🏢 Companies string value:', JSON.stringify(companiesString));
    console.log('👤 Worker ID Relation:', workerIdRelation);

    // Parsear la lista de empresas del JWT
    let userCompanyIds: string[] = [];
    try {
      if (companiesString && typeof companiesString === 'string') {
        // Intentar parsear como JSON
        try {
          userCompanyIds = JSON.parse(companiesString);
        } catch (parseError) {
          console.warn('⚠️ No se pudo parsear companies como JSON, intentando split por comas');
          // Si no es JSON válido, intentar split por comas
          userCompanyIds = companiesString.split(',').map(id => id.trim()).filter(id => id);
        }
      }
      else if (Array.isArray(companiesString)) {
        userCompanyIds = companiesString;
      }
      else if (companiesString && typeof companiesString === 'object') {
        // Si es un objeto, intentar extraer IDs
        console.log('🔍 Companies es un objeto:', companiesString);
        if (Array.isArray(companiesString.ids)) {
          userCompanyIds = companiesString.ids;
        } else if (Array.isArray(companiesString.companies)) {
          userCompanyIds = companiesString.companies;
        } else {
          console.warn('⚠️ No se pudo extraer IDs del objeto companies');
        }
      }
      else {
        console.warn('⚠️ Companies data is not in expected format:', typeof companiesString, companiesString);
      }
    } catch (error) {
      console.error('Error parsing companies from JWT:', error);
      console.error('Companies string value:', companiesString);
    }

    console.log('🏢 User company IDs:', userCompanyIds);
    console.log('🏢 User company IDs length:', userCompanyIds.length);
    console.log('🏢 User company IDs type check:', userCompanyIds.map(id => ({ id, type: typeof id })));
    
    if (userCompanyIds.length === 0) {
      console.warn('⚠️ No se encontraron company IDs en el JWT');
      console.warn('⚠️ Valor de companies en JWT:', companiesString);
      console.warn('⚠️ Estructura completa del JWT:', Object.keys(jwtPayload));
    }

    // Obtener datos del worker de la API si está disponible workerIdRelation
    let workerData: WorkerData | null = null;
    if (workerIdRelation) {
      workerData = await fetchWorkerFromAPI(external_jwt, API_BASE_URL, workerIdRelation);
    } else {
      console.warn('⚠️ No se encontró workerIdRelation en el JWT');
    }

    // Extraer nombre completo (priorizar datos del worker de la API)
    const fullName = extractFullName(jwtPayload, workerData);
    console.log('👤 Final full name:', fullName);

    // Obtener lista de todas las empresas de la API externa
    const allCompanies = await fetchCompaniesFromAPI(external_jwt, API_BASE_URL);
    console.log('🏢 Total companies from API:', allCompanies.length);
    console.log('🏢 Sample companies from API:', allCompanies.slice(0, 3).map(c => ({ id: c.id, name: c.name, org: c.organizationId })));
    
    if (allCompanies.length === 0) {
      console.warn('⚠️ No se obtuvieron empresas de la API externa');
      console.warn('⚠️ Verificar conectividad y permisos de la API');
      return jsonResponse({ 
        error: "No se pudieron obtener empresas de la API externa",
        debug_info: {
          api_url: API_BASE_URL,
          jwt_companies: userCompanyIds,
          organization: organization
        }
      }, 500);
    }

    // Buscar usuario existente por email
    let userId: string | null = null;
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Error listando usuarios: ${listError.message}`);
    }

    const existingUser = existingUsers.users.find(u => u.email?.toLowerCase() === userEmail);

    if (existingUser) {
      userId = existingUser.id;
      console.log('👤 Usuario existente encontrado:', userId);
      
      // Actualizar metadatos del usuario con el nombre completo y datos de la API externa
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: { 
          name: fullName, 
          role: "tecnico",
          organization: organization,
          workerIdRelation: workerIdRelation,
          lastSync: new Date().toISOString(),
          external_jwt_data: {
            original_name: fullName,
            organization: organization,
            companies_count: userCompanyIds.length,
            worker_id_relation: workerIdRelation
          }
        }
      });
      
      if (updateError) {
        console.warn('⚠️ Error actualizando metadatos del usuario:', updateError);
      } else {
        console.log('✅ Metadatos del usuario actualizados');
      }

      // Actualizar también el perfil en la tabla workers
      const { error: workerUpdateError } = await admin
        .from('workers')
        .update({
          name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (workerUpdateError) {
        console.warn('⚠️ Error actualizando perfil de worker:', workerUpdateError);
      } else {
        console.log('✅ Perfil de worker actualizado');
      }
    } else {
      // Crear nuevo usuario con nombre completo
      const tempPassword = "TempPass123!@#";
      
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: userEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { 
          name: fullName, 
          role: "tecnico",
          organization: organization,
          workerIdRelation: workerIdRelation,
          lastSync: new Date().toISOString(),
          external_jwt_data: {
            original_name: fullName,
            organization: organization,
            companies_count: userCompanyIds.length,
            worker_id_relation: workerIdRelation
          }
        }
      });

      if (createError) {
        throw new Error(`Error creando usuario: ${createError.message}`);
      }

      userId = newUser.user.id;
      console.log('✅ Nuevo usuario creado:', fullName);
    }

    // Asegurar que existe un perfil de worker antes de cualquier operación que dependa de la FK
    console.log('🔄 Asegurando que existe perfil de worker...');
    const { error: workerUpsertError } = await admin
      .from('workers')
      .upsert({
        id: userId,
        name: fullName,
        email: userEmail,
        role: 'tecnico',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (workerUpsertError) {
      console.error('❌ Error creando/actualizando perfil de worker:', workerUpsertError);
      throw new Error(`Error creando perfil de worker: ${workerUpsertError.message}`);
    } else {
      console.log('✅ Perfil de worker asegurado para userId:', userId);
      
      // Verificar que el worker fue creado correctamente
      const { data: verifyWorker, error: verifyError } = await admin
        .from('workers')
        .select('id, name, email')
        .eq('id', userId)
        .single();
      
      if (verifyError) {
        console.error('❌ Error verificando worker creado:', verifyError);
        throw new Error(`Worker no pudo ser verificado: ${verifyError.message}`);
      } else {
        console.log('✅ Worker verificado exitosamente:', {
          id: verifyWorker.id,
          name: verifyWorker.name,
          email: verifyWorker.email
        });
      }
    }

    // Sincronizar empresas asignadas al usuario
    const syncedCompanies = await syncUserCompanies(
      admin,
      userId,
      userCompanyIds,
      allCompanies,
      organization
    );

    console.log(`✅ Sincronización completada:`);
    console.log(`   - Usuario: ${fullName}`);
    console.log(`   - Organización: ${organization}`);
    console.log(`   - Empresas disponibles en API: ${allCompanies.length}`);
    console.log(`   - Empresas del usuario en JWT: ${userCompanyIds.length}`);
    console.log(`   - Empresas sincronizadas: ${syncedCompanies.length}`);
    console.log(`   - Worker ID Relation: ${workerIdRelation || 'N/A'}`);
    
    // Debugging adicional si no se sincronizaron empresas
    if (syncedCompanies.length === 0) {
      console.error('❌ PROBLEMA: No se sincronizaron empresas');
      console.error('❌ Posibles causas:');
      console.error('   1. Las empresas del JWT no coinciden con las de la API');
      console.error('   2. La organización no coincide');
      console.error('   3. Error en la API externa');
      console.error('   4. Formato incorrecto de datos en JWT');
      
      // Mostrar datos para debugging
      console.error('🔍 Datos para debugging:');
      console.error('   - JWT companies:', userCompanyIds);
      console.error('   - API companies:', allCompanies.map(c => ({ id: c.id, name: c.name, org: c.organizationId })));
      console.error('   - Organization:', organization);
      
      // Retornar error con información de debugging
      return jsonResponse({
        error: "No se pudieron sincronizar empresas",
        debug_info: {
          jwt_companies: userCompanyIds,
          jwt_companies_count: userCompanyIds.length,
          api_companies_count: allCompanies.length,
          api_companies_sample: allCompanies.slice(0, 5).map(c => ({ id: c.id, name: c.name, org: c.organizationId })),
          organization: organization,
          worker_id_relation: workerIdRelation,
          user_email: userEmail,
          user_name: fullName
        }
      }, 400);
    }
    
    // Intentar hacer login con contraseña temporal
    const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({
      email: userEmail,
      password: "TempPass123!@#"
    });

    if (signInError) {
      throw new Error(`Error en signInWithPassword: ${signInError.message}`);
    }

    if (!sessionData?.session) {
      throw new Error('No se pudo crear la sesión');
    }

    console.log('✅ Sesión creada exitosamente');
    console.log(`✅ Usuario sincronizado con ${syncedCompanies.length} empresas`);

    return jsonResponse({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: { 
        id: userId, 
        email: userEmail, 
        name: fullName,
        role: "tecnico",
        organization: organization,
        companies_count: syncedCompanies.length,
        worker_id_relation: workerIdRelation
      }
    });

  } catch (err: any) {
    console.error("❌ Error in exchange-external-token:", err);
    return jsonResponse({ 
      error: "Error interno del servidor", 
      details: err?.message ?? String(err) 
    }, 500);
  }
});