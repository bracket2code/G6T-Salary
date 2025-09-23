import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check, CheckCheck, Filter, Calendar, Clock, AlertTriangle, User, FileText, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { formatDateTime } from '../lib/utils';

interface UserNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_task_id?: string;
  related_task_title?: string;
  metadata: any;
  created_at: string;
  read_at?: string;
}

interface NotificationCounts {
  total_count: number;
  unread_count: number;
  read_count: number;
}

export const NotificationsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({ total_count: 0, unread_count: 0, read_count: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<
    | { type: 'delete-single'; notificationId: string }
    | { type: 'delete-bulk'; notificationIds: string[]; count: number }
    | null
  >(null);
  const [isConfirmProcessing, setIsConfirmProcessing] = useState(false);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [readFilter, setReadFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchCounts();
    }
  }, [user, readFilter, typeFilter, dateFromFilter, dateToFilter, currentPage]);

  const fetchNotifications = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      
      // Prepare filter parameters
      const isReadParam = readFilter === 'all' ? null : readFilter === 'read';
      const typeParam = typeFilter === 'all' ? null : typeFilter;
      const fromDateParam = dateFromFilter ? new Date(dateFromFilter).toISOString() : null;
      const toDateParam = dateToFilter ? new Date(dateToFilter + 'T23:59:59').toISOString() : null;

      const { data, error } = await supabase
        .rpc('get_user_notifications', {
          p_user_id: user.id,
          p_limit: itemsPerPage + 1, // Get one extra to check if there are more
          p_offset: offset,
          p_is_read: isReadParam,
          p_type: typeParam,
          p_from_date: fromDateParam,
          p_to_date: toDateParam
        });

      if (error) throw error;

      // Check if there are more items
      const hasMoreItems = data.length > itemsPerPage;
      if (hasMoreItems) {
        data.pop(); // Remove the extra item
      }
      setHasMore(hasMoreItems);

      let filteredData = data;

      // Apply search filter on client side
      if (searchQuery.trim()) {
        filteredData = data.filter((notification: any) =>
          notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          notification.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (notification.related_task_title && notification.related_task_title.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }

      setNotifications(filteredData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCounts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_notification_counts', { p_user_id: user.id });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setCounts({
          total_count: parseInt(data[0].total_count) || 0,
          unread_count: parseInt(data[0].unread_count) || 0,
          read_count: parseInt(data[0].read_count) || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setCurrentPage(1);
    await Promise.all([fetchNotifications(), fetchCounts()]);
    setIsRefreshing(false);
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('mark_notification_read', {
          p_notification_id: notificationId,
          p_user_id: user.id
        });

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      
      // Update counts
      setCounts(prev => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
        read_count: prev.read_count + 1
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ 
          is_read: false, 
          read_at: null 
        })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: false, read_at: undefined }
            : n
        )
      );
      
      // Update counts
      setCounts(prev => ({
        ...prev,
        unread_count: prev.unread_count + 1,
        read_count: Math.max(0, prev.read_count - 1)
      }));
    } catch (error) {
      console.error('Error marking notification as unread:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || counts.unread_count === 0) return;
    
    try {
      const { data, error } = await supabase
        .rpc('mark_all_notifications_read', { p_user_id: user.id });

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      
      // Update counts
      setCounts(prev => ({
        ...prev,
        unread_count: 0,
        read_count: prev.total_count
      }));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update counts
      if (deletedNotification) {
        setCounts(prev => ({
          total_count: Math.max(0, prev.total_count - 1),
          unread_count: deletedNotification.is_read ? prev.unread_count : Math.max(0, prev.unread_count - 1),
          read_count: deletedNotification.is_read ? Math.max(0, prev.read_count - 1) : prev.read_count
        }));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const performBulkAction = async (action: 'read' | 'unread' | 'delete', ids: string[] = selectedNotifications) => {
    if (ids.length === 0) return;

    try {
      if (action === 'delete') {
        const { error } = await supabase
          .from('user_notifications')
          .delete()
          .in('id', ids)
          .eq('user_id', user.id);
          
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_notifications')
          .update({ 
            is_read: action === 'read',
            read_at: action === 'read' ? new Date().toISOString() : null
          })
          .in('id', ids)
          .eq('user_id', user.id);
          
        if (error) throw error;
      }

      setSelectedNotifications(prev => prev.filter(id => !ids.includes(id)));
      await Promise.all([fetchNotifications(), fetchCounts()]);
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
    }
  };

  const handleBulkAction = (action: 'read' | 'unread' | 'delete') => {
    if (selectedNotifications.length === 0) return;

    if (action === 'delete') {
      setConfirmState({
        type: 'delete-bulk',
        notificationIds: [...selectedNotifications],
        count: selectedNotifications.length,
      });
      return;
    }

    void performBulkAction(action);
  };

  const requestDeleteNotification = (notificationId: string) => {
    setConfirmState({ type: 'delete-single', notificationId });
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    setIsConfirmProcessing(true);

    try {
      if (confirmState.type === 'delete-single') {
        await deleteNotification(confirmState.notificationId);
      } else if (confirmState.type === 'delete-bulk') {
        await performBulkAction('delete', confirmState.notificationIds);
      }
    } finally {
      setIsConfirmProcessing(false);
      setConfirmState(null);
    }
  };

  const handleCancelConfirm = () => {
    if (isConfirmProcessing) return;
    setConfirmState(null);
  };

  const confirmedNotification = confirmState?.type === 'delete-single'
    ? notifications.find(notification => notification.id === confirmState.notificationId)
    : null;

  const confirmTitle = confirmState
    ? confirmState.type === 'delete-single'
      ? 'Eliminar notificación'
      : `Eliminar ${confirmState.count} notificación${confirmState.count === 1 ? '' : 'es'}`
    : '';

  const confirmDescription = confirmState
    ? confirmState.type === 'delete-single'
      ? (
          <>
            Esta acción eliminará la notificación
            {confirmedNotification?.title && (
              <span className="font-semibold"> “{confirmedNotification.title}”</span>
            )}
            . Esta acción no se puede deshacer.
          </>
        )
      : (
          <>
            Se eliminarán {confirmState.count} notificaciones seleccionadas. Esta acción no se puede deshacer.
          </>
        )
    : null;

  const resetFilters = () => {
    setReadFilter('all');
    setTypeFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <User size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'task_updated':
        return <FileText size={16} className="text-orange-600 dark:text-orange-400" />;
      case 'task_completed':
        return <Check size={16} className="text-green-600 dark:text-green-400" />;
      case 'task_overdue':
        return <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />;
      case 'system_alert':
        return <Bell size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'reminder':
        return <Clock size={16} className="text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Bell size={16} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return 'Tarea Asignada';
      case 'task_updated':
        return 'Tarea Actualizada';
      case 'task_completed':
        return 'Tarea Completada';
      case 'task_overdue':
        return 'Tarea Vencida';
      case 'system_alert':
        return 'Alerta del Sistema';
      case 'reminder':
        return 'Recordatorio';
      default:
        return 'Notificación';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'task_updated':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'task_completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'task_overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'system_alert':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'reminder':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Debes iniciar sesión para ver las notificaciones
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Notificaciones"
        description={`${counts.total_count} notificaciones totales • ${counts.unread_count} sin leer`}
        actionLabel="Actualizar"
        onAction={handleRefresh}
        actionIcon={<RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setReadFilter('all')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.total_count}</p>
              </div>
              <Bell size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setReadFilter('unread')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sin leer</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{counts.unread_count}</p>
              </div>
              <BellOff size={24} className="text-orange-600 dark:text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setReadFilter('read')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Leídas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.read_count}</p>
              </div>
              <CheckCheck size={24} className="text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar notificaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
            leftIcon={<Bell size={18} />}
          />
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<Filter size={18} />}
          >
            Filtros
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select
                  label="Estado"
                  value={readFilter}
                  onChange={setReadFilter}
                  options={[
                    { value: 'all', label: 'Todas' },
                    { value: 'unread', label: 'Sin leer' },
                    { value: 'read', label: 'Leídas' },
                  ]}
                />

                <Select
                  label="Tipo"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { value: 'all', label: 'Todos los tipos' },
                    { value: 'task_assigned', label: 'Tarea Asignada' },
                    { value: 'task_updated', label: 'Tarea Actualizada' },
                    { value: 'task_completed', label: 'Tarea Completada' },
                    { value: 'task_overdue', label: 'Tarea Vencida' },
                    { value: 'system_alert', label: 'Alerta del Sistema' },
                    { value: 'reminder', label: 'Recordatorio' },
                  ]}
                />

                <Input
                  type="date"
                  label="Desde"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                />

                <Input
                  type="date"
                  label="Hasta"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                />
              </div>
              
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                >
                  Limpiar filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedNotifications.length} notificación(es) seleccionada(s)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('read')}
                  leftIcon={<Check size={16} />}
                >
                  Marcar como leídas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('unread')}
                  leftIcon={<EyeOff size={16} />}
                >
                  Marcar como no leídas
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleBulkAction('delete')}
                  leftIcon={<Trash2 size={16} />}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {counts.unread_count > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={markAllAsRead}
            leftIcon={<CheckCheck size={18} />}
          >
            Marcar todas como leídas ({counts.unread_count})
          </Button>
        </div>
      )}

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery || readFilter !== 'all' || typeFilter !== 'all' || dateFromFilter || dateToFilter
                ? 'No se encontraron notificaciones'
                : 'No tienes notificaciones'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || readFilter !== 'all' || typeFilter !== 'all' || dateFromFilter || dateToFilter
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Las notificaciones aparecerán aquí cuando tengas actividad en el sistema'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`transition-all duration-200 hover:shadow-md ${
                !notification.is_read 
                  ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  {/* Selection checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedNotifications.includes(notification.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedNotifications(prev => [...prev, notification.id]);
                      } else {
                        setSelectedNotifications(prev => prev.filter(id => id !== notification.id));
                      }
                    }}
                    className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />

                  {/* Notification icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <h3 className={`text-sm font-medium ${
                          !notification.is_read 
                            ? 'text-gray-900 dark:text-white' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant="outline" 
                          className={getNotificationColor(notification.type)}
                        >
                          {getNotificationTypeLabel(notification.type)}
                        </Badge>
                      </div>
                    </div>

                    <p className={`text-sm mb-3 ${
                      !notification.is_read 
                        ? 'text-gray-800 dark:text-gray-200' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {notification.message}
                    </p>

                    {/* Related task link */}
                    {notification.related_task_title && (
                      <div className="mb-3">
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                          <FileText size={12} className="mr-1" />
                          Tarea: {notification.related_task_title}
                        </span>
                      </div>
                    )}

                    {/* Footer with timestamp and actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar size={12} />
                        <span>{formatDateTime(notification.created_at)}</span>
                        {notification.read_at && (
                          <>
                            <span>•</span>
                            <span>Leída: {formatDateTime(notification.read_at)}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        {!notification.is_read ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsRead(notification.id)}
                            title="Marcar como leída"
                          >
                            <Eye size={16} />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsUnread(notification.id)}
                            title="Marcar como no leída"
                          >
                            <EyeOff size={16} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => requestDeleteNotification(notification.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Eliminar notificación"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(currentPage > 1 || hasMore) && (
        <div className="flex justify-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          <span className="flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
            Página {currentPage}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={!hasMore}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
    <ConfirmDialog
      open={!!confirmState}
      title={confirmTitle}
      description={confirmDescription}
      confirmLabel="Eliminar"
      cancelLabel="Cancelar"
      confirmVariant="danger"
      isProcessing={isConfirmProcessing}
      onConfirm={() => { void handleConfirmAction(); }}
      onCancel={handleCancelConfirm}
    />
    </>
  );
};
