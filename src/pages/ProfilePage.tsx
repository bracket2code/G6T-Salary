import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Phone, Mail, MapPin, User, Calendar, Clock, FileText, Briefcase, Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';

interface WorkerData {
  id: string;
  name: string;
  commercialName: string;
  email: string;
  providerEmail: string;
  dni: string;
  direccion: string;
  phone: string;
  empresas: string;
  category: string;
  subcategory: string;
  tipoEmpleado: string;
  fechaNacimiento: string;
  fechaAlta: string;
  notes: string;
  estado: string;
  tag: string;
}

interface CompanyData {
  id: string;
  name: string;
  organizationId: string;
}

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  avatarUrl?: string | null;
  // Datos adicionales de la API externa
  empresas?: string;
  direccion?: string;
  dni?: string;
  nombreCompleto?: string;
  fechaNacimiento?: string;
  tipoEmpleado?: string;
  fechaAlta?: string;
  estado?: string;
  source?: string;
}

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Sync local attachments with props
  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      // Obtener datos del usuario directamente desde las tablas
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (workerError || !workerData) {
        // Usar datos básicos del store como fallback
        setProfileData({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: null,
          role: user.role,
          avatarUrl: null,
          source: 'fallback'
        });
        setIsLoading(false);
        return;
      }

      console.log('[ProfilePage] Worker data from Supabase', workerData);
      
      // Datos externos no disponibles hasta que se apliquen las migraciones
      let finalExternalData = null;
      
      try {
        // Intentar obtener datos externos usando la nueva función
        const { data, error } = await supabase
          .rpc('get_user_complete_profile', { p_user_id: user.id });

        if (!error && data && data.length > 0) {
          const userData = data[0];
          if (userData.has_external_data) {
            finalExternalData = userData;
          }
          console.log('[ProfilePage] External profile RPC payload', data[0]);
        } else {
          console.warn('[ProfilePage] get_user_complete_profile returned no external data', { error, data });
        }
      } catch (error: any) {
        // Si la función no existe o hay error, intentar consulta directa
        try {
          const { data: externalData, error: externalError } = await supabase
            .from('user_external_data')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (!externalError) {
            finalExternalData = externalData;
          }
          console.log('[ProfilePage] Direct external data fallback', { externalData, externalError });
        } catch (directError: any) {
          // Ignorar mientras la tabla user_external_data no exista
          console.error('[ProfilePage] Error fetching external data directly', directError);
        }
      }
      
      const externalMetadata = finalExternalData && typeof finalExternalData.metadata === 'object'
        ? finalExternalData.metadata as Record<string, any>
        : {};

      const resolveEmpresasDisplay = (value: unknown): string | undefined => {
        if (!value) return undefined;
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
          return value
            .map((item: any) => {
              if (typeof item === 'string' || typeof item === 'number') {
                return item.toString();
              }
              if (item && typeof item === 'object') {
                return item.name || item.nombre || item.location_name || item.id || '';
              }
              return '';
            })
            .filter(Boolean)
            .join(' • ');
        }
        return undefined;
      };

      const empresasDisplay = resolveEmpresasDisplay(finalExternalData?.empresas)
        || resolveEmpresasDisplay(externalMetadata.empresasNombres)
        || resolveEmpresasDisplay(externalMetadata.empresas);
      
      // Formatear datos para la interfaz
      const finalProfileData: UserProfileData = {
        id: workerData.id,
        name: workerData.name,
        email: workerData.email,
        phone: workerData.phone || finalExternalData?.phone,
        role: workerData.role,
        avatarUrl: workerData.avatar_url,
        // Datos externos si están disponibles
        empresas: empresasDisplay || 'Sin empresas asignadas',
        direccion: finalExternalData?.direccion || externalMetadata.rawWorker?.direccion,
        dni: finalExternalData?.dni || externalMetadata.rawWorker?.dni,
        nombreCompleto: finalExternalData?.commercial_name
          || finalExternalData?.external_name
          || externalMetadata.rawWorker?.name
          || workerData.name,
        tipoEmpleado: finalExternalData?.movement_type
          || externalMetadata.tipoEmpleado
          || externalMetadata.rawWorker?.tipoEmpleado,
        fechaNacimiento: finalExternalData?.birth_date
          ? formatDate(finalExternalData.birth_date)
          : externalMetadata.rawWorker?.fechaNacimiento
            ? formatDate(externalMetadata.rawWorker.fechaNacimiento)
            : undefined,
        fechaAlta: finalExternalData?.created_at
          ? formatDate(finalExternalData.created_at)
          : externalMetadata.rawWorker?.fechaAlta
            ? formatDate(externalMetadata.rawWorker.fechaAlta)
            : undefined,
        estado: finalExternalData?.situation !== undefined
          ? (finalExternalData.situation === 0 ? 'Activo' : 'Inactivo')
          : externalMetadata.estado,
        source: finalExternalData ? 'supabase_with_external' : 'supabase_only'
      };

      console.log('[ProfilePage] Computed profile data', {
        empresasResolved: finalProfileData.empresas,
        metadata: externalMetadata,
        externalSource: finalExternalData?.source,
      });

      setProfileData(finalProfileData);

    } catch (error) {
      console.error('[ProfilePage] Error building profile data', error);
      // Como último recurso, usar datos básicos del store
      if (user) {
        setProfileData({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: null,
          role: user.role,
          avatarUrl: null,
          source: 'fallback'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'supervisor':
        return 'Supervisor';
      case 'tecnico':
        return 'Técnico';
      default:
        return 'Usuario';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No se pudieron cargar los datos del perfil
          </p>
          <Button
            onClick={() => navigate(-1)}
            className="mt-4"
          >
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Toast notification */}
      {copiedField && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Check size={16} />
          <span>
            {copiedField === 'phone' ? 'Teléfono copiado' : 'Email copiado'}
          </span>
        </div>
      )}
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 md:p-8">
          {/* Profile Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-32 h-32 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {getInitials(profileData.nombreCompleto || profileData.name)}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-900 dark:text-white">
              {profileData.nombreCompleto || profileData.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {getRoleDisplayName(profileData.role)}
            </p>
          </div>

          {/* Information Sections */}
          <div className="space-y-4">
            {/* Empresas */}
            {profileData.empresas && (
              <div className="flex items-start gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <Building2 className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Empresa(s)</p>
                  <p className="text-base font-medium break-words leading-relaxed text-gray-900 dark:text-white">
                    {profileData.empresas}
                  </p>
                </div>
              </div>
            )}

            {/* Teléfono */}
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <Phone className="h-6 w-6 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Teléfono</p>
                  <p 
                    className="font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-all"
                    onClick={() => profileData?.phone && copyToClipboard(profileData.phone, 'phone')}
                    title="Pulsa para copiar"
                  >
                    {profileData.phone || '-'}
                  </p>
                </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <Mail className="h-6 w-6 text-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                  <p 
                    className="font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors break-all select-all"
                    onClick={() => profileData?.email && copyToClipboard(profileData.email, 'email')}
                    title="Pulsa para copiar"
                  >
                    {profileData.email}
                  </p>
                </div>
            </div>

            {/* DNI */}
            {profileData.dni && (
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <div className="h-6 w-6 text-blue-500 flex items-center justify-center font-bold">D</div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">DNI</p>
                  <p className="font-medium text-gray-900 dark:text-white">{profileData.dni}</p>
                </div>
              </div>
            )}

            {/* Dirección */}
            {profileData.direccion && (
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <MapPin className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Dirección</p>
                  <p className="font-medium text-gray-900 dark:text-white">{profileData.direccion}</p>
                </div>
              </div>
            )}

            {/* Nombre Fiscal */}
            {profileData.nombreCompleto && profileData.nombreCompleto !== profileData.name && (
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <div className="h-6 w-6 text-blue-500 flex items-center justify-center font-bold">F</div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nombre Fiscal</p>
                  <p className="font-medium text-gray-900 dark:text-white">{profileData.nombreCompleto}</p>
                </div>
              </div>
            )}

            {/* Tipo de Empleado */}
            {profileData.tipoEmpleado && (
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <div className="h-6 w-6 text-blue-500 flex items-center justify-center font-bold">T</div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tipo de Empleado</p>
                  <p className="font-medium text-gray-900 dark:text-white">{profileData.tipoEmpleado}</p>
                </div>
              </div>
            )}

            {/* Fecha de Nacimiento */}
            {profileData.fechaNacimiento && (
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Fecha de Nacimiento</p>
                  <p className="font-medium text-gray-900 dark:text-white">{profileData.fechaNacimiento}</p>
                </div>
              </div>
            )}

            {/* Fecha de Alta */}
            {profileData.fechaAlta && (
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <Clock className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Fecha de Alta</p>
                  <p className="font-medium text-gray-900 dark:text-white">{profileData.fechaAlta}</p>
                </div>
              </div>
            )}

            {/* Estado */}
            {profileData.estado && (
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <div className="h-6 w-6 text-blue-500 flex items-center justify-center font-bold">E</div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Estado</p>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      profileData.estado.toLowerCase() === 'activo' || profileData.estado.toLowerCase() === 'completado'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {profileData.estado}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
