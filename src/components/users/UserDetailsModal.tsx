import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Shield, Edit, DollarSign } from 'lucide-react';
import { Worker } from '../../types/salary';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Avatar } from '../ui/Avatar';

interface UserDetailsModalProps {
  user: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'tecnico',
    baseSalary: '',
    hourlyRate: '',
    contractType: 'full_time',
    department: '',
    position: ''
  });

  useEffect(() => {
    if (user) {
      setEditData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        baseSalary: user.baseSalary?.toString() || '',
        hourlyRate: user.hourlyRate?.toString() || '',
        contractType: user.contractType || 'full_time',
        department: user.department || '',
        position: user.position || ''
      });
    }
  }, [user]);

  const handleUpdateUser = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Simulate user update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Usuario actualizado exitosamente');
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error al actualizar el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white dark:bg-dark-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-600">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Detalles del Usuario
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* User Info */}
            <div className="flex items-center space-x-4">
              <Avatar name={user.name} src={user.avatarUrl} size="lg" />
              <div className="flex-1">
                {!isEditing ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                    {user.phone && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.phone}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {user.role === 'admin' ? 'Administrador' :
                       user.role === 'supervisor' ? 'Supervisor' : 'Usuario'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Input
                      label="Nombre"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      fullWidth
                    />
                    <Input
                      type="email"
                      label="Correo electrónico"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      fullWidth
                    />
                    <Input
                      type="tel"
                      label="Teléfono"
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      fullWidth
                    />
                    <Select
                      label="Rol"
                      value={editData.role}
                      onChange={(value) => setEditData({ ...editData, role: value })}
                      options={[
                        { value: 'tecnico', label: 'Usuario' },
                        { value: 'supervisor', label: 'Supervisor' },
                        { value: 'admin', label: 'Administrador' },
                      ]}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        type="number"
                        label="Sueldo Base (€)"
                        value={editData.baseSalary}
                        onChange={(e) => setEditData({ ...editData, baseSalary: e.target.value })}
                        placeholder="1500"
                        fullWidth
                      />
                      
                      <Input
                        type="number"
                        label="Tarifa por Hora (€)"
                        value={editData.hourlyRate}
                        onChange={(e) => setEditData({ ...editData, hourlyRate: e.target.value })}
                        placeholder="15"
                        fullWidth
                      />
                    </div>
                    
                    <Select
                      label="Tipo de Contrato"
                      value={editData.contractType}
                      onChange={(value) => setEditData({ ...editData, contractType: value })}
                      options={[
                        { value: 'full_time', label: 'Tiempo Completo' },
                        { value: 'part_time', label: 'Tiempo Parcial' },
                        { value: 'freelance', label: 'Freelance' }
                      ]}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Departamento"
                        value={editData.department}
                        onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                        placeholder="Recursos Humanos"
                        fullWidth
                      />
                      
                      <Input
                        label="Posición"
                        value={editData.position}
                        onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                        placeholder="Analista"
                        fullWidth
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    leftIcon={<Edit size={16} />}
                  >
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpdateUser}
                      isLoading={isLoading}
                    >
                      Guardar
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Salary Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Información Salarial
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.baseSalary && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <DollarSign size={16} className="text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-700 dark:text-green-300">Sueldo Base</span>
                    </div>
                    <p className="text-lg font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(user.baseSalary)}
                    </p>
                  </div>
                )}
                
                {user.hourlyRate && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock size={16} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-700 dark:text-blue-300">Tarifa/Hora</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(user.hourlyRate)}/h
                    </p>
                  </div>
                )}
              </div>
              
              {user.contractType && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tipo de Contrato</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.contractType === 'full_time' ? 'Tiempo Completo' :
                     user.contractType === 'part_time' ? 'Tiempo Parcial' : 'Freelance'}
                  </p>
                </div>
              )}
              
              {(user.department || user.position) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.department && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Departamento</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.department}
                      </p>
                    </div>
                  )}
                  
                  {user.position && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Posición</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.position}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};