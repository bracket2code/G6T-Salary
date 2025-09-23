import React, { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronUp, Clock, User, FileText, Users, AlertCircle, CheckCircle, MessageSquare, Paperclip, Plus, Trash2, Edit, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';

interface TaskHistoryEntry {
  id: string;
  action_type: string;
  old_value?: string;
  new_value?: string;
  description: string;
  created_at: string;
  user_name?: string;
  user_role?: string;
}

interface TaskHistoryProps {
  taskId: string;
  refreshTrigger?: any; // Optional prop to trigger refresh
}

export const TaskHistory: React.FC<TaskHistoryProps> = ({ taskId, refreshTrigger }) => {
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (taskId) {
      fetchHistory();
    }
  }, [taskId, refreshTrigger]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_task_history', { p_task_id: taskId });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching task history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return <Plus size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'status_change':
        return <AlertCircle size={16} className="text-orange-600 dark:text-orange-400" />;
      case 'priority_change':
        return <AlertCircle size={16} className="text-red-600 dark:text-red-400" />;
      case 'description_change':
        return <Edit size={16} className="text-gray-600 dark:text-gray-400" />;
      case 'assignment_added':
        return <UserPlus size={16} className="text-green-600 dark:text-green-400" />;
      case 'assignment_removed':
        return <UserMinus size={16} className="text-red-600 dark:text-red-400" />;
      case 'attachment_added':
        return <Paperclip size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'attachment_removed':
        return <Trash2 size={16} className="text-red-600 dark:text-red-400" />;
      case 'comment_added':
        return <MessageSquare size={16} className="text-indigo-600 dark:text-indigo-400" />;
      case 'updated':
        return <CheckCircle size={16} className="text-green-600 dark:text-green-400" />;
      default:
        return <Clock size={16} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10';
      case 'status_change':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10';
      case 'priority_change':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'description_change':
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10';
      case 'assignment_added':
        return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
      case 'assignment_removed':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'attachment_added':
        return 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/10';
      case 'attachment_removed':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'comment_added':
        return 'border-l-indigo-500 bg-indigo-50 dark:bg-indigo-900/10';
      case 'updated':
        return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10';
    }
  };

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'supervisor':
        return 'Supervisor';
      case 'tecnico':
        return 'Técnico';
      default:
        return 'Usuario';
    }
  };

  const getActionDisplayName = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return 'Tarea creada';
      case 'status_change':
        return 'Estado cambiado';
      case 'priority_change':
        return 'Prioridad cambiada';
      case 'description_change':
        return 'Descripción actualizada';
      case 'assignment_added':
        return 'Usuario asignado';
      case 'assignment_removed':
        return 'Usuario desasignado';
      case 'attachment_added':
        return 'Archivo adjunto agregado';
      case 'attachment_removed':
        return 'Archivo adjunto eliminado';
      case 'comment_added':
        return 'Comentario agregado';
      case 'updated':
        return 'Tarea actualizada';
      default:
        return 'Acción realizada';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <History size={20} className="mr-2" />
            Historial de Cambios
          </h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div 
          className="flex items-center space-x-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <History size={20} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Historial de Cambios ({history.length})
          </h3>
          <div className="ml-2">
            {isCollapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2"
        >
          {isCollapsed ? 'Mostrar' : 'Ocultar'}
        </Button>
      </div>

      {!isCollapsed && (
        <>
          {history.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <History size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No hay cambios registrados para esta tarea
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border-l-4 ${getActionColor(entry.action_type)} transition-all duration-200`}
                >
                  {/* Header con acción y fecha */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getActionIcon(entry.action_type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {getActionDisplayName(entry.action_type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {entry.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      <Clock size={12} className="mr-1" />
                      {formatDateTime(entry.created_at)}
                    </div>
                  </div>

                  {/* Información del usuario */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {entry.user_name ? (
                        <>
                          <Avatar name={entry.user_name} size="sm" />
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {entry.user_name}
                            </span>
                            <span className="ml-1">
                              ({getRoleDisplayName(entry.user_role)})
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <User size={12} />
                          <span>Sistema</span>
                        </div>
                      )}
                    </div>

                    {/* Mostrar valores antiguos y nuevos si existen */}
                    {(entry.old_value || entry.new_value) && (
                      <div className="text-xs">
                        {entry.old_value && (
                          <div className="text-red-600 dark:text-red-400">
                            <span className="font-medium">Anterior:</span> {entry.old_value}
                          </div>
                        )}
                        {entry.new_value && (
                          <div className="text-green-600 dark:text-green-400">
                            <span className="font-medium">Nuevo:</span> {entry.new_value}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};