import { create } from 'zustand';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { AuthError } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  externalJwt: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  syncExternalData: (externalJwt: string) => Promise<void>;
}

function parseJWT(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (_error) {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,
  externalJwt: null,
  
  syncExternalData: async (externalJwt: string) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      return;
    }

    try {
      // Decodificar JWT para extraer datos del usuario
      const jwtPayload = parseJWT(externalJwt);
      if (!jwtPayload) {
        throw new Error('JWT externo inválido');
      }
      
      // Guardar datos del JWT directamente en Supabase
      const { data, error } = await supabase
        .rpc('save_user_jwt_data', {
          p_user_id: user.id,
          p_jwt_data: jwtPayload
        });

      if (error) {
        throw new Error(`Error guardando datos del JWT: ${error.message}`);
      }

      console.log('[AuthStore] JWT payload parsed', {
        parameterRelationsCount: Array.isArray(jwtPayload?.parameterRelations) ? jwtPayload.parameterRelations.length : 0,
        empresasField: jwtPayload?.empresas,
        companiesFieldType: typeof jwtPayload?.companies,
      });

      // Parse company IDs from JWT
      let companyIds: string[] = [];
      try {
        if (jwtPayload.parameterRelations && Array.isArray(jwtPayload.parameterRelations)) {
          companyIds = jwtPayload.parameterRelations
            .filter((relation: any) => relation.type === 1 || relation.type === '1')
            .map((relation: any) => relation.id.toString());
        }
      } catch (_error) {
        // Ignore company parsing errors; fallback handles missing IDs
      }

      if (!companyIds.length) {
        try {
          if (typeof jwtPayload.companies === 'string') {
            const parsedCompanies = JSON.parse(jwtPayload.companies);
            if (Array.isArray(parsedCompanies)) {
              companyIds = parsedCompanies
                .map((id: unknown) => (typeof id === 'string' ? id : id?.toString?.() ?? ''))
                .filter(Boolean);
            }
          } else if (Array.isArray(jwtPayload.companies)) {
            companyIds = jwtPayload.companies
                .map((id: unknown) => (typeof id === 'string' ? id : id?.toString?.() ?? ''))
                .filter(Boolean);
          }
        } catch (_error) {
          // Ignore company parsing errors; fallback handles missing IDs
        }
      }

      if (!companyIds.length) {
        console.warn('[AuthStore] No company IDs resolved from JWT', jwtPayload);
      } else {
        console.log('[AuthStore] Company IDs resolved from JWT', companyIds);
      }

      // Parse worker ID relation from JWT
      let workerIdRelation = null;
      try {
        if (jwtPayload.parameterRelations && Array.isArray(jwtPayload.parameterRelations)) {
          const workerRelation = jwtPayload.parameterRelations.find((relation: any) => relation.type === 5 || relation.type === '5');
          if (workerRelation) {
            workerIdRelation = workerRelation.id;
          }
        }
      } catch (_error) {
        // Ignore worker relation parsing errors; we fall back to other fields
      }

      if (!workerIdRelation && jwtPayload.workerIdRelation) {
        const rawWorkerIdRelation = jwtPayload.workerIdRelation;
        workerIdRelation = typeof rawWorkerIdRelation === 'string'
          ? rawWorkerIdRelation
          : rawWorkerIdRelation?.toString?.();
      }

      console.log('[AuthStore] Worker relation resolved', workerIdRelation);

      // Obtener datos de empresas desde la API externa
      let companiesDataFromAPI = [];
      let companyNamesMap: Record<string, string> = {};
      let userCompanyNames = '';
      
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
        
        if (apiBaseUrl && companyIds.length > 0) {
          // Construir URL con los IDs específicos de las empresas del usuario
          const idsParams = companyIds.map(id => `Ids=${encodeURIComponent(id)}`).join('&');
          const companiesApiUrl = `${apiBaseUrl}/Parameter/GetByIds?${idsParams}`;
          
          const companiesResponse = await fetch(companiesApiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${externalJwt}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
          
          if (companiesResponse.ok) {
            companiesDataFromAPI = await companiesResponse.json();
            
            // Crear mapa de ID -> Nombre de empresa
            companiesDataFromAPI.forEach((company: any) => {
              companyNamesMap[company.id] = company.name;
            });
            
            // Crear string de nombres de empresas
            userCompanyNames = companiesDataFromAPI
              .map((company: any) => company.name)
              .filter(name => name)
              .join(' • ');

            console.log('[AuthStore] Company names resolved from external API', {
              companyIds,
              resolvedNames: userCompanyNames,
            });
            
          } else {
            const rawError = await companiesResponse.text();
            console.warn('[AuthStore] Companies API returned non-OK status', {
              status: companiesResponse.status,
              body: rawError,
            });
          }
        } else if (apiBaseUrl && companyIds.length === 0) {
          console.warn('[AuthStore] No company IDs found in JWT, skipping companies API call');
        }
      } catch (_apiError) {
        // Ignore API errors; the UI already handles missing external data
        console.error('[AuthStore] Error fetching companies from external API', _apiError);
      }
      
      // Obtener datos del worker desde la API externa
      let workerDataFromAPI = null;
      if (workerIdRelation) {
        try {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
          
          if (apiBaseUrl) {
            const workerApiUrl = `${apiBaseUrl}/Parameter/${workerIdRelation}`;
            
            const workerResponse = await fetch(workerApiUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${externalJwt}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
            });
            
            if (workerResponse.ok) {
              workerDataFromAPI = await workerResponse.json();
              
              if (workerDataFromAPI) {
                console.log('[AuthStore] Worker data matched from external API', workerDataFromAPI);
                try {
                  const normalizedWorkerUpdate: Record<string, any> = {
                    id: user.id,
                    name: workerDataFromAPI.name || jwtPayload.name || user.name,
                    email: user.email?.toLowerCase() || jwtPayload.email,
                    phone: workerDataFromAPI.phone || jwtPayload.phone || null,
                  };

                  if (workerDataFromAPI.avatarUrl || workerDataFromAPI.avatar_url) {
                    normalizedWorkerUpdate.avatar_url = workerDataFromAPI.avatarUrl || workerDataFromAPI.avatar_url;
                  }

                  if (workerDataFromAPI.role) {
                    normalizedWorkerUpdate.role = workerDataFromAPI.role;
                  }

                  const { error: workerUpsertError } = await supabase
                    .from('workers')
                    .upsert(normalizedWorkerUpdate, { onConflict: 'id' });

                  if (workerUpsertError) {
                    throw workerUpsertError;
                  }
                } catch (workerUpdateError) {
                  throw workerUpdateError;
                }
              } else {
                console.warn('[AuthStore] Worker relation not found in API response', {
                  workerIdRelation,
                  sample: workersData?.[0],
                });
              }
            } else {
              const body = await workerResponse.text();
              console.warn('[AuthStore] Worker API returned non-OK status', {
                status: workerResponse.status,
                body,
              });
            }
          }
        } catch (_apiError) {
          // Ignore API errors; the UI already handles missing external data
          console.error('[AuthStore] Error fetching worker data from external API', _apiError);
        }
      }
      
      // Combinar datos del JWT con datos de la API externa
      const baseMetadata = (jwtPayload.metadata && typeof jwtPayload.metadata === 'object')
        ? jwtPayload.metadata
        : {};

      const workerMetadata = (workerDataFromAPI?.metadata && typeof workerDataFromAPI.metadata === 'object')
        ? workerDataFromAPI.metadata
        : {};

      const empresasSourceValue = workerDataFromAPI?.empresas ?? jwtPayload.empresas;
      let empresasValueAsString: string | undefined;

      if (typeof empresasSourceValue === 'string') {
        empresasValueAsString = empresasSourceValue;
      } else if (Array.isArray(empresasSourceValue)) {
        empresasValueAsString = empresasSourceValue
          .map((item: any) => {
            if (typeof item === 'string' || typeof item === 'number') {
              return item.toString();
            }
            if (item && typeof item === 'object') {
              return item.name || item.nombre || item.id || '';
            }
            return '';
          })
          .filter(Boolean)
          .join(' • ');
      }

      const resolvedEmpresasNames = userCompanyNames || empresasValueAsString;

      const externalMetadata = workerDataFromAPI
        ? {
            empresas: empresasSourceValue,
            ...(resolvedEmpresasNames ? { empresasNombres: resolvedEmpresasNames } : {}),
            tipoEmpleado: workerDataFromAPI.tipoEmpleado ?? workerDataFromAPI.movementType,
            estado: workerDataFromAPI.estado,
            rawWorker: workerDataFromAPI,
          }
        : {
            empresas: empresasSourceValue,
            ...(resolvedEmpresasNames ? { empresasNombres: resolvedEmpresasNames } : {}),
          };

      const combinedData = {
        ...jwtPayload,
        // Agregar nombres de empresas obtenidos de la API
        empresasNombres: userCompanyNames
          || companyIds
            .map(id => companyNamesMap[id])
            .filter(name => name)
            .join(' • ')
          || resolvedEmpresasNames,
        companyIds: companyIds,
        // Sobrescribir con datos más completos de la API si están disponibles
        ...(workerDataFromAPI && {
          // Datos básicos
          name: workerDataFromAPI.name || jwtPayload.name,
          commercialName: workerDataFromAPI.commercialName || jwtPayload.commercialName,
          organizationId: workerDataFromAPI.organizationId || jwtPayload.organizationId,
          // Datos personales
          dni: workerDataFromAPI.dni || jwtPayload.dni,
          phone: workerDataFromAPI.phone || jwtPayload.phone,
          direccion: workerDataFromAPI.direccion || jwtPayload.direccion,
          iban: workerDataFromAPI.iban,
          providerEmail: workerDataFromAPI.providerEmail,
          providerDescription: workerDataFromAPI.providerDescription,
          descriptionControlSchedule: workerDataFromAPI.descriptionControlSchedule,
          socialSecurity: workerDataFromAPI.socialSecurity,
          birthDate: workerDataFromAPI.birthDate,
          situation: workerDataFromAPI.situation,
          subcategoryId: workerDataFromAPI.subcategoryId,
          color: workerDataFromAPI.color,
          tagId: workerDataFromAPI.tagId,
          files: workerDataFromAPI.files,
          // Datos laborales
          empresas: workerDataFromAPI.empresas,
          movementType: workerDataFromAPI.movementType ?? workerDataFromAPI.tipoEmpleado,
          tipoEmpleado: workerDataFromAPI.tipoEmpleado,
          fechaNacimiento: workerDataFromAPI.fechaNacimiento,
          fechaAlta: workerDataFromAPI.fechaAlta,
          estado: workerDataFromAPI.estado,
        }),
        metadata: {
          ...baseMetadata,
          ...workerMetadata,
          ...externalMetadata,
          ...(companyIds.length ? { companyIds } : {}),
          ...(resolvedEmpresasNames ? { empresasNombres: resolvedEmpresasNames } : {}),
        },
      };

      console.log('[AuthStore] Combined external data metadata preview', {
        empresasNombres: combinedData.empresasNombres,
        storedCompanyIds: combinedData.companyIds,
        metadataEmpresas: combinedData.metadata?.empresas,
        metadataEmpresasNombres: combinedData.metadata?.empresasNombres,
      });
      
      // Implementar retry mechanism para manejar violaciones de foreign key constraint
      const maxRetries = 5;
      let retryCount = 0;
      let lastError = null;
      
      while (retryCount < maxRetries) {
        const { data, error } = await supabase
          .rpc('save_user_jwt_data', {
            p_user_id: user.id,
            p_jwt_data: combinedData
          });

        if (!error) {
          console.log('[AuthStore] External data persisted successfully', { attempt: retryCount + 1, data });
          break;
        }
        
        // Si es un error de foreign key constraint (código 23503), reintentar
        if (error.code === '23503' && retryCount < maxRetries - 1) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
          lastError = error;
          console.warn('[AuthStore] Retrying external data persistence due to foreign key constraint', { retryCount, error });
          continue;
        }
        
        // Para otros errores o si se agotaron los reintentos
        throw new Error(`Error guardando datos del JWT: ${error.message}`);
      }
      
      // Si se agotaron todos los reintentos
      if (retryCount >= maxRetries && lastError) {
        throw new Error(`Error guardando datos del JWT después de ${maxRetries} intentos: ${lastError.message}`);
      }
      
      // Eliminar JWT de localStorage después de sincronizar
      localStorage.removeItem('external_jwt');
      
    } catch (error) {
      console.error('[AuthStore] syncExternalData failed', error);
      throw error;
    }
  },

  refreshSession: async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        // Si el refresh falla, limpiar la sesión
        set({ user: null, error: 'Sesión expirada', isLoading: false });
        return;
      }
      
      if (data.session) {
        // Verificar el usuario después del refresh
        await useAuthStore.getState().checkSession();
      }
    } catch (error) {
      set({ user: null, error: 'Error renovando sesión', isLoading: false });
    }
  },
  
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // Verificar si tenemos la URL de la API externa configurada
      const externalApiUrl = import.meta.env.VITE_API_BASE_URL;
      
      if (!externalApiUrl) {
        throw new Error('API externa no configurada. Configure VITE_API_BASE_URL en las variables de entorno.');
      }

      // --- Paso 1: Llamar a tu API externa para obtener su JWT ---
      const requestBody = { 
        username: email,
        password: password,
        appSource: 'g6t-tasker'
      };
      
      const externalApiResponse = await fetch(`${externalApiUrl}/User/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify(requestBody),
      });

      if (!externalApiResponse.ok) {
        const errorText = await externalApiResponse.text();
        throw new Error(`Credenciales incorrectas o error del servidor: ${externalApiResponse.status} - ${errorText}`);
      }

      const externalApiData = await externalApiResponse.json();

      // Buscar el JWT en la respuesta de la API externa
      const externalJwt = externalApiData.accessToken;

      if (!externalJwt) {
        throw new Error('Token de acceso no recibido de la API externa');
      }

      // Almacenar el JWT externo en el store
      set({ externalJwt });
      
      // También almacenar en localStorage para persistencia
      localStorage.setItem('external_jwt', externalJwt);

      // --- Paso 2: Intercambiar JWT externo por JWT de Supabase ---
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!import.meta.env.VITE_SUPABASE_URL || !supabaseAnonKey) {
        throw new Error('Variables de entorno de Supabase no configuradas');
      }

      // Use proxy in development, direct URL in production
      const exchangeTokenFunctionUrl = import.meta.env.DEV 
        ? '/supabase-functions/v1/exchange-external-token'
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-external-token`;
      
      const edgeRequestBody = { 
        external_jwt: externalJwt,
        email: email.toLowerCase()
      };
      
      const exchangeResponse = await fetch(exchangeTokenFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify(edgeRequestBody),
      });

      if (!exchangeResponse.ok) {
        const errorText = await exchangeResponse.text();
        throw new Error(`Error en función Edge: ${exchangeResponse.status} - ${errorText}`);
      }

      const exchangeData = await exchangeResponse.json();

      const accessToken = exchangeData.access_token;
      const refreshToken = exchangeData.refresh_token;

      if (!accessToken || !refreshToken) {
        throw new Error('Tokens de sesión no recibidos');
      }

      // --- Paso 3: Establecer la sesión de Supabase ---
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (sessionError) throw sessionError;

      // --- Paso 4: Verificar sesión y cargar perfil de usuario ---
      await useAuthStore.getState().checkSession();
      
      // --- Paso 5: Sincronizar datos externos ---
      try {
        await useAuthStore.getState().syncExternalData(externalJwt);
      } catch (_syncError) {
        // No fallar el login por error de sincronización
      }

    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Error durante el inicio de sesión',
        isLoading: false,
      });
    }
  },
  
  logout: async () => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !error.message?.includes('Session from session_id claim in JWT does not exist')) {
        throw error;
      }
      
      // Limpiar JWT externo de localStorage
      localStorage.removeItem('external_jwt');
      
      set({ user: null, externalJwt: null, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'An error occurred during logout',
        isLoading: false,
      });
    }
  },
  
  checkSession: async () => {
    set({ isLoading: true });
    try {
      const { data: { session }, error: getSessionError } = await supabase.auth.getSession();

      // Si hay error al obtener la sesión, intentar refresh
      if (getSessionError) {
        await useAuthStore.getState().refreshSession();
        return;
      }
      
      if (!session?.user) {
        set({ isLoading: false });
        return;
      }

      // Verificar si el token está próximo a expirar (menos de 5 minutos)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;
        
        // Si el token expira en menos de 5 minutos (300 segundos), renovarlo
        if (timeUntilExpiry < 300) {
          await useAuthStore.getState().refreshSession();
          return;
        }
      }

      const normalizedEmail = session.user.email?.toLowerCase() || null;

      // Obtener perfil del usuario desde la tabla workers
      const { data: workerProfileData, error: profileError } = await supabase
        .from('workers')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      let workerProfile = workerProfileData;

      // Intentar buscar por email si no se encontró por ID (posibles usuarios antiguos)
      if (!workerProfile && normalizedEmail) {
        const { data: workerProfileByEmail, error: workerByEmailError } = await supabase
          .from('workers')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (!workerByEmailError && workerProfileByEmail) {
          workerProfile = workerProfileByEmail;
        }
      }

      // Si no existe el worker profile, crearlo para evitar foreign key constraint violation
      if (!workerProfile && normalizedEmail) {
        const { data: newWorkerProfile, error: createError } = await supabase
          .from('workers')
          .upsert({
            id: session.user.id,
            email: normalizedEmail,
            name: session.user.user_metadata?.name || normalizedEmail.split('@')[0] || 'Usuario',
            role: 'tecnico',
            avatar_url: session.user.user_metadata?.avatar_url || null,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'id'
          })
          .select()
          .single();

        if (createError) {
          const isDuplicateEmail = createError.code === '23505' || createError.message?.includes('duplicate key value') || createError.message?.includes('workers_email_key');
          if (isDuplicateEmail) {
            const { data: workerProfileByEmail, error: workerByEmailError } = await supabase
              .from('workers')
              .select('*')
              .eq('email', normalizedEmail)
              .maybeSingle();

            if (!workerByEmailError && workerProfileByEmail) {
              workerProfile = workerProfileByEmail;
            }
          }
        } else {
          workerProfile = newWorkerProfile;
        }
      }

      const workerId = workerProfile?.id || session.user.id;

      const user: User = {
        id: workerId,
        authId: session.user.id,
        email: session.user.email!,
        name: workerProfile?.name || session.user.user_metadata?.name || 'Usuario',
        role: workerProfile?.role || 'tecnico',
        avatar_url: workerProfile?.avatar_url || session.user.user_metadata?.avatar_url,
        avatarUrl: workerProfile?.avatar_url || session.user.user_metadata?.avatar_url,
        created_at: workerProfile?.created_at || session.user.created_at,
        worker_profile: workerProfile || undefined,
      };

      set({ user, isLoading: false, error: null });

      // Intentar sincronizar datos externos si hay JWT almacenado
      const storedJwt = localStorage.getItem('external_jwt');
      if (storedJwt && workerProfile) {
        try {
          await useAuthStore.getState().syncExternalData(storedJwt);
        } catch (_syncError) {
          // Ignorar errores de sincronización en background
        }
      }

    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Error checking session',
        isLoading: false,
      });
    }
  },
}));
