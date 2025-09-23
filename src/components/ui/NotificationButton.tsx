import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from './Button';
import { notificationService } from '../../lib/notifications';

export const NotificationButton: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<string>('default');

  useEffect(() => {
    checkNotificationStatus();
    initializeNotifications();
  }, []);

  const checkNotificationStatus = () => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      setIsEnabled(Notification.permission === 'granted');
    }
  };

  const initializeNotifications = async () => {
    await notificationService.initializeServiceWorker();
    if (notificationService.isNotificationEnabled()) {
      notificationService.scheduleRecurringNotifications();
    }
  };

  const handleToggleNotifications = async () => {
    setIsLoading(true);
    
    try {
      if (!isEnabled) {
        // Solicitar permisos
        const permissionResult = await notificationService.requestPermission();
        
        if (permissionResult.granted) {
          setIsEnabled(true);
          setPermission('granted');
          
          // Enviar notificación de prueba
          await notificationService.sendLocalNotification(
            '🎉 ¡Notificaciones activadas!',
            {
              body: 'Ahora recibirás notificaciones sobre tus tareas',
              tag: 'notification-enabled'
            }
          );
          
          // Inicializar notificaciones recurrentes
          notificationService.scheduleRecurringNotifications();
        } else if (permissionResult.denied) {
          setPermission('denied');
          alert('Las notificaciones han sido bloqueadas. Para habilitarlas, ve a la configuración de tu navegador y permite las notificaciones para este sitio.');
        }
      } else {
        // Las notificaciones ya están habilitadas
        await notificationService.sendLocalNotification(
          '📱 Notificaciones activas',
          {
            body: 'Las notificaciones están funcionando correctamente',
            tag: 'notification-test'
          }
        );
      }
    } catch (error) {
      console.error('Error manejando notificaciones:', error);
      alert('Error al configurar las notificaciones');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (permission === 'denied') return 'Bloqueadas';
    if (isEnabled) return 'Activas';
    return 'Activar';
  };

  const getButtonIcon = () => {
    if (permission === 'denied') return <BellOff size={16} />;
    if (isEnabled) return <Check size={16} />;
    return <Bell size={16} />;
  };

  const getButtonVariant = () => {
    if (permission === 'denied') return 'outline';
    if (isEnabled) return 'secondary';
    return 'primary';
  };

  return (
    <Button
      onClick={handleToggleNotifications}
      variant={getButtonVariant()}
      size="sm"
      isLoading={isLoading}
      leftIcon={getButtonIcon()}
      className={`
        ${permission === 'denied' ? 'text-red-600 border-red-300 hover:border-red-400' : ''}
        ${isEnabled ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300' : ''}
      `}
      disabled={permission === 'denied'}
    >
      {getButtonText()}
    </Button>
  );
};