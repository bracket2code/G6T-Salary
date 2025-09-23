import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { generateRandomPassword } from '../../lib/utils';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'tecnico',
  });

  const handleGeneratePassword = () => {
    const newPassword = generateRandomPassword(12);
    setFormData({ ...formData, password: newPassword });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Llamar a la función edge para crear usuario con autenticación
      const { data, error } = await supabase.functions.invoke('create-auth-user', {
        body: {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone || null,
          role: formData.role,
        }
      });

      if (error) throw error;

      alert(`Usuario creado exitosamente!\n\nCredenciales:\nEmail: ${formData.email}\nContraseña: ${formData.password}\n\nPor favor, comparte estas credenciales con el usuario de forma segura.`);

      onSuccess?.();
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'tecnico',
      });
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error al crear el usuario: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white dark:bg-dark-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-600">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Nuevo Usuario
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
            <Input
              label="Nombre"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />

            <Input
              type="email"
              label="Correo electrónico"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              fullWidth
            />

            <div className="space-y-2">
              <Input
                type="password"
                label="Contraseña"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                fullWidth
                placeholder="Mínimo 6 caracteres"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePassword}
                className="w-full"
              >
                Generar contraseña segura
              </Button>
            </div>

            <Input
              type="tel"
              label="Teléfono"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
            />

            <Select
              label="Rol"
              value={formData.role}
              onChange={(value) => setFormData({ ...formData, role: value })}
              options={[
                { value: 'tecnico', label: 'Usuario' },
                { value: 'supervisor', label: 'Supervisor' },
                { value: 'admin', label: 'Administrador' },
              ]}
            />

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full sm:w-auto"
              >
                Crear Usuario
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};