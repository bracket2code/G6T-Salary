import React from 'react';
import { X, User, Phone, Mail, MessageCircle, Building2, Calendar, MapPin, Clock, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { formatDate, formatDateTime } from '../../lib/utils';

interface UserContactInfo {
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

interface UserContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserContactInfo | null;
}

export const UserContactModal: React.FC<UserContactModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

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

  if (!isOpen || !user) return null;

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Toast notification */}
      {copiedField && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Check size={16} />
          <span>
            {copiedField === 'phone' ? 'Teléfono copiado' : 'Email copiado'}
          </span>
        </div>
      )}
      
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" 
        onClick={onClose}
      />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header con botón de cerrar */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shadow-sm"
            >
              <X size={20} />
            </button>
          </div>

          {/* Header con avatar y nombre */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 px-6 pt-8 pb-6 text-center">
            <div className="mb-4">
              <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                </span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              {user.nombreCompleto || user.name}
            </h2>
            <p className="text-blue-100 text-sm">
              {getRoleDisplayName(user.role)}
            </p>
          </div>

          {/* Contenido */}
          <div className="p-6 space-y-4">
            {/* Empresas */}
            {user.empresas && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Building2 size={16} className="text-blue-500" />
                  <span className="font-medium">Empresas</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-6">
                  {user.empresas}
                </p>
              </div>
            )}

            {/* Empresas */}
            {user.empresas && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Building2 size={16} className="text-blue-500" />
                  <span className="font-medium">Empresas</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-6">
                  {user.empresas}
                </p>
              </div>
            )}

            {/* Teléfono */}
            {user.phone ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Phone size={16} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Teléfono</p>
                    <p 
                      className="text-base font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-all"
                      onClick={() => copyToClipboard(user.phone!, 'phone')}
                      title="Pulsa para copiar"
                    >
                      {user.phone}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl opacity-50">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-lg">
                    <Phone size={16} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      No disponible
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Email */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
                  <p 
                    className="text-base font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors break-all select-all"
                    onClick={() => copyToClipboard(user.email, 'email')}
                    title="Pulsa para copiar"
                  >
                    {user.email}
                  </p>
                </div>
              </div>
            </div>


            {/* DNI */}
            {user.dni && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs">
                    D
                  </span>
                  <span className="font-medium">DNI</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 pl-6">
                  {user.dni}
                </p>
              </div>
            )}

            {/* Dirección */}
            {user.direccion && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <MapPin size={16} className="text-blue-500" />
                  <span className="font-medium">Dirección</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 pl-6">
                  {user.direccion}
                </p>
              </div>
            )}

            {/* Nombre Fiscal */}
            {user.nombreCompleto && user.nombreCompleto !== user.name && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs">
                    F
                  </span>
                  <span className="font-medium">Nombre Fiscal</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 pl-6">
                  {user.nombreCompleto}
                </p>
              </div>
            )}

            {/* Tipo de Empleado */}
            {user.tipoEmpleado && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs">
                    T
                  </span>
                  <span className="font-medium">Tipo de Empleado</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 pl-6">
                  {user.tipoEmpleado}
                </p>
              </div>
            )}

            {/* Fecha de Nacimiento */}
            {user.fechaNacimiento && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Calendar size={16} className="text-blue-500" />
                  <span className="font-medium">Fecha de Nacimiento</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 pl-6">
                  {formatDate(user.fechaNacimiento)}
                </p>
              </div>
            )}

            {/* Fecha de Alta */}
            {user.fechaAlta && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Clock size={16} className="text-blue-500" />
                  <span className="font-medium">Fecha de Alta</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 pl-6">
                  {formatDate(user.fechaAlta)}
                </p>
              </div>
            )}

            {/* Estado */}
            {user.estado && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs">
                    E
                  </span>
                  <span className="font-medium">Estado</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 pl-6">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.estado.toLowerCase() === 'activo' || user.estado.toLowerCase() === 'completado'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {user.estado}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
