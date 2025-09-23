import { useEffect, useState } from 'react';
import { notificationService } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export const useNotifications = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    initializeNotifications();
    setupRealtimeSubscriptions();
  }, [user]);

  const initializeNotifications = async () => {
    const swInitialized = await notificationService.initializeServiceWorker();
    if (swInitialized) {
      setIsEnabled(notificationService.isNotificationEnabled());
      
      if (notificationService.isNotificationEnabled()) {
        notificationService.scheduleRecurringNotifications();
      }
    }
  };

  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    // Suscribirse a cambios en tareas asignadas al usuario
    const taskAssignmentsSubscription = supabase
      .channel('task-assignments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignments',
          filter: `worker_id=eq.${user.id}`
        },
        async (payload) => {
          // Obtener detalles de la tarea
          const { data: taskData } = await supabase
            .from('tasks')
            .select('title, priority')
            .eq('id', payload.new.task_id)
            .single();

          if (taskData) {
            await notificationService.notifyNewAssignment(
              taskData.title,
              taskData.priority
            );
            
            // También crear notificación en base de datos
            await notificationService.createDatabaseNotification(
              NEW.worker_id,
              'Nueva tarea asignada',
              `Se te ha asignado la tarea: ${taskData.title}`,
              'task_assigned',
              NEW.task_id,
              { priority: taskData.priority, assigned_by: payload.new.assigned_by }
            );
          }
        }
      )
      .subscribe();

    // Suscribirse a cambios de estado en tareas del usuario
    const taskUpdatesSubscription = supabase
      .channel('task-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          // Verificar si el usuario está asignado a esta tarea
          const { data: assignment } = await supabase
            .from('task_assignments')
            .select('id')
            .eq('task_id', payload.new.id)
            .eq('worker_id', user.id)
            .single();

          if (assignment && payload.old.status !== payload.new.status) {
            await notificationService.notifyTaskUpdate(
              payload.new.title,
              payload.new.status,
              payload.new.priority
            );
            
            // También crear notificación en base de datos
            await notificationService.createDatabaseNotification(
              user.id,
              'Estado de tarea actualizado',
              `La tarea "${payload.new.title}" cambió a: ${payload.new.status}`,
              'task_updated',
              payload.new.id,
              { old_status: payload.old.status, new_status: payload.new.status, priority: payload.new.priority }
            );
          }
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      taskAssignmentsSubscription.unsubscribe();
      taskUpdatesSubscription.unsubscribe();
    };
  };

  const requestPermission = async () => {
    const result = await notificationService.requestPermission();
    setIsEnabled(result.granted);
    return result;
  };

  const sendTestNotification = async () => {
    await notificationService.sendLocalNotification(
      '🧪 Notificación de prueba',
      {
        body: 'Las notificaciones están funcionando correctamente',
        tag: 'test-notification'
      }
    );
  };

  return {
    isEnabled,
    requestPermission,
    sendTestNotification,
    notificationService
  };
};