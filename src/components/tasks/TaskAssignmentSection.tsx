import React, { useState, useEffect } from 'react';
import { Users, Plus, X, UserCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Avatar } from '../ui/Avatar';
import { UserContactModal } from './UserContactModal';
import { Worker, Task } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

interface TaskAssignmentSectionProps {
  task: Task;
  onAssignmentChange?: () => void;
}

export const TaskAssignmentSection: React.FC<TaskAssignmentSectionProps> = ({
  task,
  onAssignmentChange,
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isLoadingUserContact, setIsLoadingUserContact] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('name');

      if (error) throw error;
      setWorkers(data);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const handleAssignWorker = async () => {
    if (!selectedWorkerId || !user) return;

    // Check if worker is already assigned
    const isAlreadyAssigned = task.assignedWorkers?.some(w => w.id === selectedWorkerId);
    if (isAlreadyAssigned) {
      alert('El trabajador ya está asignado a esta tarea');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_assignments')
        .insert([{
          task_id: task.id,
          worker_id: selectedWorkerId,
          assigned_by: user.id,
        }]);

      if (error) throw error;

      setSelectedWorkerId('');
      onAssignmentChange?.();
    } catch (error) {
      console.error('Error assigning worker:', error);
      
      // Handle specific error cases
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === '23505') {
          alert('El trabajador ya está asignado a esta tarea');
        } else {
          alert('Error al asignar el trabajador');
        }
      } else {
        alert('Error al asignar el trabajador');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignWorker = async (workerId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', task.id)
        .eq('worker_id', workerId);

      if (error) throw error;

      onAssignmentChange?.();
    } catch (error) {
      console.error('Error unassigning worker:', error);
      alert('Error al desasignar el trabajador');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignSelf = async () => {
    if (!user) return;

    // Check if user is already assigned
    if (isAssignedToCurrentUser) {
      alert('Ya estás asignado a esta tarea');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_assignments')
        .insert([{
          task_id: task.id,
          worker_id: user.id,
          assigned_by: user.id,
        }]);

      if (error) throw error;

      onAssignmentChange?.();
    } catch (error) {
      console.error('Error self-assigning:', error);
      
      // Handle specific error cases
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === '23505') {
          alert('Ya estás asignado a esta tarea');
        } else {
          alert('Error al auto-asignarse la tarea');
        }
      } else {
        alert('Error al auto-asignarse la tarea');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserClick = (worker: Worker) => {
    if (!worker.email) {
      console.warn('No email found for worker');
      return;
    }

    fetchUserContactFromAPI(worker.email);
  };

  const fetchUserContactFromAPI = async (userEmail: string) => {
    setIsLoadingUserContact(true);
    
    try {
      console.log('🔍 Fetching contact info for:', userEmail);
      
      // Primero obtener datos básicos de Supabase como fallback
      const { data: supabaseUser, error: supabaseError } = await supabase
        .from('workers')
        .select('*')
        .eq('email', userEmail)
        .single();
      
      if (supabaseError || !supabaseUser) {
        console.error('❌ Error fetching user from Supabase:', supabaseError);
        return;
      }
      
      // Datos base de Supabase
      let finalUserData = {
        id: supabaseUser.id,
        name: supabaseUser.name,
        email: supabaseUser.email,
        phone: supabaseUser.phone,
        role: supabaseUser.role,
        avatarUrl: supabaseUser.avatar_url,
        source: 'supabase_only'
      };
      
      // Intentar enriquecer con datos de la API externa
      try {
        const functionUrl = import.meta.env.DEV 
          ? '/supabase-functions/v1/get-user-contact-info'
          : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-contact-info`;
        
        console.log('🌐 Calling API for enhanced user data...');
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            user_email: userEmail
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.user) {
            finalUserData = result.user;
            console.log('✅ Enhanced user data fetched from API:', result.user.name);
          } else {
            console.warn('⚠️ API response OK but no user data returned');
          }
        } else {
          const errorText = await response.text();
          console.warn('⚠️ API call failed, using Supabase data only:', errorText);
        }
      } catch (apiError) {
        console.warn('⚠️ API call failed, using Supabase data only:', apiError);
      }
      
      // Mostrar los datos que se pudieron obtener
      console.log('📋 Final user data:', finalUserData);
      setSelectedUser(finalUserData);
      
    } catch (error) {
      console.error('❌ Error fetching user contact info:', error);
    } finally {
      setIsLoadingUserContact(false);
    }
  };

  const isAssignedToCurrentUser = task.assignedWorkers?.some(w => w.id === user?.id);
  const availableWorkers = workers.filter(w => 
    !task.assignedWorkers?.some(assigned => assigned.id === w.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
          <Users size={20} className="mr-2" />
          Asignaciones
        </h3>
        {!isAssignedToCurrentUser && (
          <Button
            size="sm"
            onClick={handleAssignSelf}
            isLoading={isLoading}
            leftIcon={<UserCheck size={16} />}
          >
            Asignarme
          </Button>
        )}
      </div>

      {/* Trabajadores asignados */}
      {task.assignedWorkers && task.assignedWorkers.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Trabajadores asignados:
          </h4>
          <div className="space-y-2">
            {task.assignedWorkers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Avatar name={worker.name} size="sm" />
                  <div>
                    <p 
                      className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      onClick={() => handleUserClick(worker)}
                      title="Ver información de contacto"
                    >
                      {worker.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {worker.role === 'admin' ? 'Administrador' :
                       worker.role === 'supervisor' ? 'Supervisor' : 'Técnico'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUnassignWorker(worker.id)}
                  isLoading={isLoading}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Users size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No hay trabajadores asignados a esta tarea
          </p>
        </div>
      )}

      {/* Asignar nuevo trabajador */}
      {availableWorkers.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Asignar trabajador:
          </h4>
          <div className="flex space-x-2">
            <Select
              value={selectedWorkerId}
              onChange={setSelectedWorkerId}
              options={[
                { value: '', label: 'Seleccionar trabajador' },
                ...availableWorkers.map(worker => ({
                  value: worker.id,
                  label: `${worker.name} (${worker.role === 'admin' ? 'Admin' : 
                                              worker.role === 'supervisor' ? 'Supervisor' : 'Técnico'})`
                }))
              ]}
              className="flex-1"
            />
            <Button
              onClick={handleAssignWorker}
              disabled={!selectedWorkerId}
              isLoading={isLoading}
              leftIcon={<Plus size={16} />}
            >
              Asignar
            </Button>
          </div>
        </div>
      )}
      
      {/* User Contact Modal */}
      <UserContactModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        user={selectedUser}
      />
    </div>
  );
};