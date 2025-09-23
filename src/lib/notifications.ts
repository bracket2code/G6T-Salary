// Utilidades para manejo de notificaciones push

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Inicializar Service Worker
  async initializeServiceWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || window.location.hostname.includes('stackblitz')) {
      console.info('Service Worker no disponible en este entorno');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      return true;
    } catch (error) {
      console.warn('Error registrando Service Worker:', error);
      return false;
    }
  }

  // Solicitar permisos de notificación
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Las notificaciones no son compatibles con este navegador');
      return { granted: false, denied: true, default: false };
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    return {
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default'
    };
  }

  // Verificar si las notificaciones están habilitadas
  isNotificationEnabled(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  // Enviar notificación local
  async sendLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!this.isNotificationEnabled()) {
      console.warn('Las notificaciones no están habilitadas');
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      ...options
    };

    new Notification(title, defaultOptions);
  }

  // Configurar notificaciones para tareas
  async notifyTaskUpdate(taskTitle: string, status: string, priority?: string): Promise<void> {
    const priorityEmoji = priority === 'critica' ? '🚨' : 
                         priority === 'alta' ? '⚠️' : 
                         priority === 'media' ? '📋' : '📝';

    const statusText = this.getStatusText(status);
    
    await this.sendLocalNotification(
      `${priorityEmoji} Tarea actualizada`,
      {
        body: `"${taskTitle}" - ${statusText}`,
        tag: 'task-update',
        requireInteraction: priority === 'critica',
        actions: [
          {
            action: 'view',
            title: 'Ver tarea'
          },
          {
            action: 'dismiss',
            title: 'Descartar'
          }
        ]
      }
    );
  }

  // Notificar nueva asignación
  async notifyNewAssignment(taskTitle: string, priority?: string): Promise<void> {
    const priorityEmoji = priority === 'critica' ? '🚨' : 
                         priority === 'alta' ? '⚠️' : '📋';

    await this.sendLocalNotification(
      `${priorityEmoji} Nueva tarea asignada`,
      {
        body: `Se te ha asignado: "${taskTitle}"`,
        tag: 'new-assignment',
        requireInteraction: priority === 'critica',
        actions: [
          {
            action: 'view',
            title: 'Ver tarea'
          },
          {
            action: 'dismiss',
            title: 'Más tarde'
          }
        ]
      }
    );
  }

  // Crear notificación en base de datos
  async createDatabaseNotification(
    userId: string,
    title: string,
    message: string,
    type: string = 'system_alert',
    relatedTaskId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_title: title,
        p_message: message,
        p_type: type,
        p_related_task_id: relatedTaskId || null,
        p_metadata: metadata || {}
      });

      if (error) {
        console.error('Error creating database notification:', error);
      }
    } catch (error) {
      console.error('Error in createDatabaseNotification:', error);
    }
  }

  // Enviar notificación completa (navegador + base de datos)
  async sendCompleteNotification(
    userId: string,
    title: string,
    message: string,
    type: string = 'system_alert',
    relatedTaskId?: string,
    metadata?: any,
    browserOptions?: NotificationOptions
  ): Promise<void> {
    // Crear en base de datos
    await this.createDatabaseNotification(userId, title, message, type, relatedTaskId, metadata);
    
    // Enviar notificación del navegador si está habilitado
    if (this.isNotificationEnabled()) {
      await this.sendLocalNotification(title, {
        body: message,
        tag: type,
        ...browserOptions
      });
    }
  }

  // Notificar tareas vencidas
  async notifyOverdueTasks(count: number): Promise<void> {
    if (count === 0) return;

    await this.sendLocalNotification(
      '⏰ Tareas vencidas',
      {
        body: `Tienes ${count} tarea${count > 1 ? 's' : ''} vencida${count > 1 ? 's' : ''}`,
        tag: 'overdue-tasks',
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'Ver tareas'
          },
          {
            action: 'dismiss',
            title: 'Recordar más tarde'
          }
        ]
      }
    );
  }

  // Programar notificaciones recurrentes
  scheduleRecurringNotifications(): void {
    // Verificar tareas vencidas cada hora
    setInterval(() => {
      this.checkOverdueTasks();
    }, 60 * 60 * 1000); // 1 hora

    // Verificar tareas del día cada mañana a las 9:00
    const now = new Date();
    const tomorrow9AM = new Date(now);
    tomorrow9AM.setDate(tomorrow9AM.getDate() + 1);
    tomorrow9AM.setHours(9, 0, 0, 0);

    const timeUntil9AM = tomorrow9AM.getTime() - now.getTime();

    setTimeout(() => {
      this.checkTodayTasks();
      // Luego repetir cada 24 horas
      setInterval(() => {
        this.checkTodayTasks();
      }, 24 * 60 * 60 * 1000);
    }, timeUntil9AM);
  }

  private async checkOverdueTasks(): Promise<void> {
    // Esta función se implementaría para verificar tareas vencidas
    // y enviar notificaciones según sea necesario
  }

  private async checkTodayTasks(): Promise<void> {
    // Esta función se implementaría para verificar tareas del día
    // y enviar recordatorios matutinos
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'sin_asignar':
        return 'Sin asignar';
      case 'pendiente':
        return 'Pendiente';
      case 'en_progreso':
        return 'En progreso';
      case 'aplazada':
        return 'Aplazada';
      case 'completada':
        return 'Completada';
      case 'cancelada':
        return 'Cancelada';
      case 'archivada':
        return 'Archivada';
      default:
        return status;
    }
  }
}

// Instancia singleton
export const notificationService = NotificationService.getInstance();
