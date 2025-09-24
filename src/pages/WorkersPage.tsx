import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { UserPlus, Search, Settings, DollarSign, Phone, Mail } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { CreateUserModal } from '../components/users/CreateUserModal';
import { UserDetailsModal } from '../components/users/UserDetailsModal';
import { Worker } from '../types/salary';

// Mock workers data
const mockWorkers: Worker[] = [
  {
    id: '1',
    name: 'Juan Pérez',
    email: 'juan@example.com',
    role: 'tecnico',
    phone: '+34 600 123 456',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    avatarUrl: null,
    baseSalary: 1800,
    hourlyRate: 12,
    contractType: 'full_time',
    department: 'Mantenimiento',
    position: 'Técnico Senior'
  },
  {
    id: '2',
    name: 'María García',
    email: 'maria@example.com',
    role: 'supervisor',
    phone: '+34 600 789 012',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: null,
    avatarUrl: null,
    baseSalary: 2200,
    hourlyRate: 15,
    contractType: 'full_time',
    department: 'Recursos Humanos',
    position: 'Supervisora'
  },
  {
    id: '3',
    name: 'Carlos López',
    email: 'carlos@example.com',
    role: 'admin',
    phone: '+34 600 345 678',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: null,
    avatarUrl: null,
    baseSalary: 2800,
    hourlyRate: 18,
    contractType: 'full_time',
    department: 'Administración',
    position: 'Administrador'
  }
];

export const WorkersPage: React.FC = () => {
  const [users, setUsers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Worker | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter workers based on search query
      let filteredWorkers = mockWorkers;
      if (searchQuery) {
        filteredWorkers = mockWorkers.filter(worker =>
          worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          worker.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      setUsers(filteredWorkers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchQuery]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

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
                
                {/* Contact Information */}
                <div className="space-y-2 w-full max-w-full">
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <Mail size={12} />
                    <span className="truncate">{user.email}</span>
                  </div>
                  
                  {user.phone && (
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <Phone size={12} />
                      <span className="truncate">{user.phone}</span>
                    </div>
                  )}
                  
                  {user.baseSalary && (
                    <div className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400">
                      <DollarSign size={12} />
                      <span>
                        {formatCurrency(user.baseSalary)}
                      </span>
                    </div>
                  )}
                </div>
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