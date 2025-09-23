import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Save, Bell, Shield, MoreHorizontal, Users, Building2, Wrench, RotateCcw, Trash2, LogOut } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { WorkersPage } from './WorkersPage';
import { LocationsManagement } from '../components/settings/LocationsManagement';
import { SkillsManagement } from '../components/settings/SkillsManagement';
import { TaskStatusesManagement } from '../components/settings/TaskStatusesManagement';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState('general');

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      await logout();
      navigate('/login');
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Shield },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'locations', label: 'Locales', icon: Building2 },
    { id: 'skills', label: 'Especialidades', icon: Wrench },
    { id: 'statuses', label: 'Estados', icon: MoreHorizontal },
  ];

  return (
    <div className="w-full max-w-full min-w-0 h-full flex flex-col">
      <PageHeader
        title="Configuración"
        description="Ajustes y preferencias del sistema"
      />

      {/* Mobile-optimized Tabs */}
      <div className="mb-6 w-full max-w-full">
        <div className="border-b border-gray-200 dark:border-gray-700">
          {/* Mobile: Horizontal scrollable tabs */}
          <div className="sm:hidden">
            <nav className="flex overflow-x-auto scrollbar-hide space-x-1 px-4 pb-px">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 transition-colors duration-200 flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Desktop: Regular tabs */}
          <div className="hidden sm:block">
            <nav className="-mb-px flex space-x-8 px-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Tab Content - Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6 w-full max-w-full min-w-0 pb-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Bell className="text-blue-500 flex-shrink-0" size={20} />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notificaciones
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 w-full max-w-full min-w-0">
                  <Select
                    label="Notificaciones por correo"
                    options={[
                      { value: 'all', label: 'Todas las actualizaciones' },
                      { value: 'important', label: 'Solo importantes' },
                      { value: 'none', label: 'Ninguna' },
                    ]}
                    value="important"
                    onChange={() => {}}
                    fullWidth
                  />
                  <Select
                    label="Notificaciones en la aplicación"
                    options={[
                      { value: 'all', label: 'Todas las actualizaciones' },
                      { value: 'important', label: 'Solo importantes' },
                      { value: 'none', label: 'Ninguna' },
                    ]}
                    value="all"
                    onChange={() => {}}
                    fullWidth
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Shield className="text-green-500 flex-shrink-0" size={20} />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Seguridad
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 w-full max-w-full min-w-0">
                  <form className="space-y-4 w-full max-w-full min-w-0" autoComplete="on">
                    <input
                      type="email"
                      name="username"
                      autoComplete="username"
                      style={{ display: 'none' }}
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <Input
                      type="password"
                      label="Contraseña actual"
                      placeholder="••••••••"
                      fullWidth
                      autoComplete="current-password"
                    />
                    <Input
                      type="password"
                      label="Nueva contraseña"
                      placeholder="••••••••"
                      fullWidth
                      autoComplete="new-password"
                    />
                    <Input
                      type="password"
                      label="Confirmar nueva contraseña"
                      placeholder="••••••••"
                      fullWidth
                      autoComplete="new-password"
                    />
                    <Button 
                      type="submit"
                      fullWidth
                      className="w-full"
                    >
                      Cambiar contraseña
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <MoreHorizontal className="text-purple-500 flex-shrink-0" size={20} />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Otros
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 w-full max-w-full min-w-0">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      if (confirm('¿Estás seguro de que quieres recargar la aplicación? Se perderán los cambios no guardados.')) {
                        window.location.reload();
                      }
                    }}
                    className="w-full justify-start min-w-0"
                    leftIcon={<RotateCcw size={16} />}
                    fullWidth
                  >
                    <span className="truncate">Recargar aplicación</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      if (confirm('¿Estás seguro de que quieres borrar todos los datos locales? Esta acción no se puede deshacer.')) {
                        // Clear localStorage
                        localStorage.clear();
                        // Clear sessionStorage
                        sessionStorage.clear();
                        // Clear IndexedDB if exists
                        if ('indexedDB' in window) {
                          indexedDB.databases().then(databases => {
                            databases.forEach(db => {
                              if (db.name) {
                                indexedDB.deleteDatabase(db.name);
                              }
                            });
                          });
                        }
                        // Clear service worker cache if exists
                        if ('caches' in window) {
                          caches.keys().then(names => {
                            names.forEach(name => {
                              caches.delete(name);
                            });
                          });
                        }
                        alert('Datos locales eliminados. La aplicación se recargará.');
                        window.location.reload();
                      }
                    }}
                    className="text-red-600 hover:text-red-700 w-full justify-start min-w-0"
                    leftIcon={<Trash2 size={16} />}
                    fullWidth
                  >
                    <span className="truncate">Borrar datos locales</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleLogout}
                    className="text-red-600 hover:text-red-700 w-full justify-start min-w-0"
                    leftIcon={<LogOut size={16} />}
                    fullWidth
                  >
                    <span className="truncate">Cerrar sesión</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="w-full max-w-full min-w-0 pb-6">
            <WorkersPage />
          </div>
        )}
        
        {/* Locations Tab */}
        {activeTab === 'locations' && (
          <div className="w-full max-w-full min-w-0 pb-6">
            <LocationsManagement />
          </div>
        )}
        
        {/* Skills Tab */}
        {activeTab === 'skills' && (
          <div className="w-full max-w-full min-w-0 pb-6">
            <SkillsManagement />
          </div>
        )}
        
        {/* Task Statuses Tab */}
        {activeTab === 'statuses' && (
          <div className="w-full max-w-full min-w-0 pb-6">
            <TaskStatusesManagement />
          </div>
        )}
      </div>
    </div>
  );
};