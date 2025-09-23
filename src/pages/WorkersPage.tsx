import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { UserPlus, Search, Settings } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { CreateUserModal } from '../components/users/CreateUserModal';
import { UserDetailsModal } from '../components/users/UserDetailsModal';
import { supabase } from '../lib/supabase';
import { Worker } from '../types';

// Translation maps for display names
const skillDisplayNames: Record<string, string> = {
  electricidad: 'Electricidad',
  electronica: 'Electrónica',
  general: 'General',
  fontaneria: 'Fontanería',
  construccion: 'Construcción',
  tecnologia: 'Tecnología',
  cerrajeria: 'Cerrajería',
  cristaleria: 'Cristalería',
  limpieza: 'Limpieza',
  sonido: 'Sonido',
  luces: 'Luces'
};

const skillLevelDisplayNames: Record<string, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  experto: 'Experto'
};

export const WorkersPage: React.FC = () => {
  const [users, setUsers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Worker | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_users_with_skills');

      if (error) throw error;

      let filteredUsers = data;

      // Apply search filter
      if (searchQuery) {
        filteredUsers = filteredUsers.filter(user =>
          user.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.user_email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      const formattedUsers: Worker[] = filteredUsers.map((user) => ({
        id: user.user_id,
        name: user.user_name,
        email: user.user_email,
        role: user.user_role,
        phone: user.user_phone,
        avatarUrl: user.user_avatar_url,
        createdAt: user.user_created_at,
        updatedAt: user.user_updated_at,
        skills: user.skills || [],
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchQuery]);

  return (
    <div className="w-full max-w-full min-w-0">
      <PageHeader
        title="Usuarios"
        description="Gestión de usuarios del sistema"
        actionLabel="Nuevo Usuario"
        onAction={() => setShowCreateModal(true)}
        actionIcon={<UserPlus size={18} />}
      />

      <div className="mb-6 w-full max-w-full">
        <Input
          placeholder="Buscar usuarios..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search size={18} />}
          fullWidth
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No se encontraron usuarios
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery
                ? 'No hay usuarios que coincidan con tu búsqueda'
                : 'Comienza agregando usuarios al sistema'}
            </p>
            <Button 
              leftIcon={<UserPlus size={18} />}
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto"
            >
              Agregar Usuario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <Card key={user.id} className="hover:shadow-lg transition-shadow duration-200 cursor-pointer w-full max-w-full">
              <CardContent className="p-6" onClick={() => setSelectedUser(user)}>
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex items-center space-x-4">
                    <Avatar name={user.name} src={user.avatarUrl} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {user.role === 'admin' ? 'Administrador' :
                         user.role === 'supervisor' ? 'Supervisor' : 'Usuario'}
                      </p>
                      {user.phone && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {user.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(user);
                    }}
                    className="flex-shrink-0"
                  >
                    <Settings size={16} />
                  </Button>
                </div>
                
                {/* Mostrar especialidades */}
                {user.skills && user.skills.length > 0 && (
                  <div className="space-y-2 w-full max-w-full">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Especialidades:
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {user.skills.slice(0, 3).map((skill) => (
                        <span
                          key={skill.id}
                          className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs"
                        >
                          {skill.skill_type ? skillDisplayNames[skill.skill_type] || skill.skill_type : 'Sin definir'}
                        </span>
                      ))}
                      {user.skills.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full text-xs">
                          +{user.skills.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Mostrar locales asignados */}
                {user.locations && user.locations.length > 0 && (
                  <div className="space-y-2 mt-3 w-full max-w-full">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Locales:
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {user.locations.slice(0, 2).map((location) => (
                        <span
                          key={location.id}
                          className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs"
                        >
                          {location.location_name}
                        </span>
                      ))}
                      {user.locations.length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full text-xs">
                          +{user.locations.length - 2} más
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {(!user.skills || user.skills.length === 0) && (
                  (!user.locations || user.locations.length === 0) && (
                  <div className="text-center py-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Sin especialidades ni locales definidos
                    </p>
                  </div>
                  )
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchUsers();
        }}
      />
      
      <UserDetailsModal
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onUpdate={() => {
          fetchUsers();
        }}
      />
    </div>
  );
};