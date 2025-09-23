import React, { useState } from 'react';
import { X, MapPin, Calendar, Edit, Trash2, User, Repeat, Clock, CheckCircle } from 'lucide-react';
import { Task } from '../../types';
import { Button } from '../ui/Button';
import { formatDate } from '../../lib/utils';
import { formatDateTimeForDisplay } from '../../lib/dateUtils';
import { formatInGMT2 } from '../../lib/timezone';
import { getStatusDisplayName } from '../../lib/taskStatuses';
import { getStatusIconWithColor } from '../../lib/statusIcons';
import { TaskForm } from './TaskForm';
import { TaskAssignmentSection } from './TaskAssignmentSection';
import { TaskAttachments } from './TaskAttachments';
import { TaskConversations } from './TaskConversations';
import { TaskHistory } from './TaskHistory';
import { supabase } from '../../lib/supabase';
import { TaskConversation } from '../../types';

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

interface TaskDetailsModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onAssignmentChange?: () => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onAssignmentChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [taskSkills, setTaskSkills] = useState<string[]>([]);
  const [conversations, setConversations] = useState<TaskConversation[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<any[]>([]);

  // Fetch task skills when modal opens
  React.useEffect(() => {
    if (isOpen && task && task.id) {
      fetchTaskSkills();
      fetchConversations();
      setTaskAttachments(task.attachments || []);
    }
  }, [isOpen, task]);

  const fetchTaskSkills = async () => {
    try {
      // Get skills directly from task_skills table
      const { data: taskSkillsData, error } = await supabase
        .from('task_skills')
        .select('skill_type')
        .eq('task_id', task.id);

      if (error) throw error;

      // Extract skills from task_skills table
      const skills = taskSkillsData?.map(skill => skill.skill_type) || [];

      setTaskSkills(skills);
    } catch (error) {
      console.error('Error fetching task skills:', error);
      setTaskSkills([]);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('task_conversations')
        .select(`
          *,
          workers!task_conversations_user_id_fkey(
            id,
            name,
            email,
            role,
            avatar_url
          ),
          conversation_attachments(*)
        `)
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedConversations: TaskConversation[] = data.map((conv: any) => ({
        id: conv.id,
        taskId: conv.task_id,
        userId: conv.user_id,
        message: conv.message,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        user: conv.workers ? {
          id: conv.workers.id,
          name: conv.workers.name,
          email: conv.workers.email,
          role: conv.workers.role,
          avatarUrl: conv.workers.avatar_url,
        } : undefined,
        attachments: conv.conversation_attachments || [],
      }));

      setConversations(formattedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    }
  };

  const handleAttachmentsChange = (newAttachments: any[]) => {
    setTaskAttachments(newAttachments);
    // Only trigger a minimal refresh for history
    // Don't refresh the entire task data
  };

  if (!isOpen) return null;

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  const getPriorityLabel = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical':
        return 'Crítica';
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      case 'low':
        return 'Baja';
    }
  };

  const handleEdit = async (updatedTask: Partial<Task>) => {
    try {
      // First update the task
      const { error } = await supabase
        .from('tasks')
        .update({
          title: updatedTask.title,
          description: updatedTask.description,
          location_id: updatedTask.locationId,
          priority: updatedTask.priority,
          status: updatedTask.status,
          start_date: updatedTask.startDate,
          end_date: updatedTask.endDate,
        })
        .eq('id', task.id);

      if (error) throw error;

      // Handle required skills if they exist in the updated task
      if (updatedTask.requiredSkills !== undefined) {
        // First, delete existing skills for this task
        const { error: deleteError } = await supabase
          .from('task_skills')
          .delete()
          .eq('task_id', task.id);
          
        if (deleteError) {
          console.error('Error deleting existing task skills:', deleteError);
        }
        
        // Then, insert new skills if any
        if (updatedTask.requiredSkills && updatedTask.requiredSkills.length > 0) {
          const skillInserts = updatedTask.requiredSkills.map(skill => ({
            task_id: task.id,
            skill_type: skill
          }));
          
          const { error: insertError } = await supabase
            .from('task_skills')
            .insert(skillInserts);
            
          if (insertError) {
            console.error('Error inserting task skills:', insertError);
          }
        }
      }

      onEdit?.(updatedTask as Task);
      setIsEditing(false);
      
      // Refresh task skills after edit
      setTimeout(() => {
        fetchTaskSkills();
      }, 500);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDelete = async () => {
    if (confirm('¿Está seguro de que desea eliminar esta tarea?')) {
      try {
        // Use the database function to delete the task and all related data
        const { error } = await supabase
          .rpc('delete_task_complete', { p_task_id: task.id });

        if (error) {
          throw error;
        }

        onDelete?.(task);
        onClose();
      } catch (error) {
        console.error('Error al eliminar la tarea:', error);
        alert('Error al eliminar la tarea: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }
  };

  const handleCompleteTask = async () => {
    if (confirm('¿Está seguro de que desea marcar esta tarea como completada?')) {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ 
            status: 'completada',
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);

        if (error) throw error;

        // Update the local task object
        const updatedTask = { ...task, status: 'completada' as const };
        onEdit?.(updatedTask);
        
        // Close the modal after successful completion
        onClose();
      } catch (error) {
        console.error('Error al completar la tarea:', error);
        alert('Error al marcar la tarea como completada: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto md:overflow-hidden">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity md:block" 
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4 md:p-6">
        <div 
          className="relative w-full max-w-lg md:max-w-2xl max-h-[90vh] md:h-auto bg-white dark:bg-dark-800 rounded-xl shadow-xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Mobile Header */}
          <div className="md:hidden bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between p-4">
              <div className="w-8"></div> {/* Spacer for centering */}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate flex-1 text-center">
                {task.title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:block relative p-6 pb-2 pr-16 flex-shrink-0">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-500"
            >
              <X size={20} />
            </button>
            
            {/* Title and Priority badge */}
            <div className="flex flex-row items-center gap-4 mb-4">
              {/* Priority badge */}
              <span className={`
                px-3 py-1.5 text-sm font-semibold rounded-full inline-flex items-center whitespace-nowrap shrink-0
                ${task.priority === 'critica' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                  task.priority === 'alta' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                  task.priority === 'media' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}
              `}>
                {task.priority === 'critica' ? 'Crítica' :
                 task.priority === 'alta' ? 'Alta' :
                 task.priority === 'media' ? 'Media' : 'Baja'}
              </span>
              
              {/* Title */}
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {task.title}
              </h2>
            </div>
            
            {/* Description */}
            {task.description && (
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
                {task.description}
              </p>
            )}
          </div>

          {/* Scrollable Content Container */}
          <div className="flex-1 overflow-y-auto">
            {!isEditing ? (
              <>
                <div className="space-y-0">
                {/* Basic Information Section */}
                <div className="px-4 md:px-6 pb-6 space-y-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Mobile: Single column cards */}
                <div className="md:hidden space-y-4">
                  {/* Descripción - Separada y con espacio superior */}
                  {task.description && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mt-6">
                      <div className="text-gray-500 dark:text-gray-400 uppercase text-xs font-medium mb-3 tracking-wide">
                        DESCRIPCIÓN
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {task.description}
                      </p>
                    </div>
                  )}

                  <div className={`rounded-xl p-4 ${
                    task.priority === 'critica' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' :
                    task.priority === 'alta' ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700' :
                    task.priority === 'media' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700' :
                    'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="text-gray-500 dark:text-gray-400 uppercase text-xs font-medium tracking-wide">
                        PRIORIDAD
                      </div>
                      <div>
                        <span className={`
                          px-3 py-1.5 text-sm font-semibold rounded-full inline-flex items-center
                          ${task.priority === 'critica' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            task.priority === 'alta' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                            task.priority === 'media' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}
                        `}>
                          {task.priority === 'critica' ? 'Crítica' :
                           task.priority === 'alta' ? 'Alta' :
                           task.priority === 'media' ? 'Media' : 'Baja'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className="text-gray-500 dark:text-gray-400 uppercase text-xs font-medium mb-2 tracking-wide">
                      UBICACIÓN
                    </div>
                    <div className="flex items-center text-gray-900 dark:text-white">
                      <MapPin size={18} className="mr-3 text-gray-400" />
                      <span className="font-medium">{task.locationName || 'Sin ubicación'}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className="text-gray-500 dark:text-gray-400 uppercase text-xs font-medium mb-2 tracking-wide">
                      FECHA DE INICIO
                    </div>
                    <div className="flex items-center text-gray-900 dark:text-white">
                      <Calendar size={18} className="mr-3 text-gray-400" />
                      <span className="font-medium">{formatDateTimeForDisplay(task.startDate)}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className="text-gray-500 dark:text-gray-400 uppercase text-xs font-medium mb-2 tracking-wide">
                      FECHA LÍMITE
                    </div>
                    <div className="flex items-center text-gray-900 dark:text-white">
                      <Calendar size={18} className="mr-3 text-gray-400" />
                      <span className="font-medium">{formatDateTimeForDisplay(task.endDate)}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className="text-gray-500 dark:text-gray-400 uppercase text-xs font-medium mb-2 tracking-wide">
                      ESTADO
                    </div>
                    <div className="flex items-center text-gray-900 dark:text-white">
                      <div className="mr-3">
                        {getStatusIconWithColor(task.status, 18)}
                      </div>
                      <span className="font-medium">{getStatusDisplayName(task.status)}</span>
                    </div>
                  </div>
                </div>

                {/* Desktop: Original two-column layout */}
                <div className="hidden md:block space-y-4">
                  <div className="text-gray-500 dark:text-gray-400 uppercase text-sm font-medium">
                    Ubicación
                  </div>
                  <div className="flex items-center text-gray-900 dark:text-white">
                    <MapPin size={20} className="mr-2 text-gray-400" />
                    <span>{task.locationName || 'Sin ubicación'}</span>
                  </div>
                </div>
                
                <div className="hidden md:block space-y-4">
                  <div className="text-gray-500 dark:text-gray-400 uppercase text-sm font-medium">
                    Estado
                  </div>
                  <div className="flex items-center text-gray-900 dark:text-white">
                    <div className="mr-2">
                      {getStatusIconWithColor(task.status, 20)}
                    </div>
                    <span>{getStatusDisplayName(task.status)}</span>
                  </div>
                </div>

                <div className="hidden md:block space-y-4">
                  <div className="text-gray-500 dark:text-gray-400 uppercase text-sm font-medium">
                    Fecha de Inicio
                  </div>
                  <div className="flex items-center text-gray-900 dark:text-white">
                    <Calendar size={20} className="mr-2 text-gray-400" />
                    <span>{formatDateTimeForDisplay(task.startDate)}</span>
                  </div>
                </div>

                <div className="hidden md:block space-y-4">
                  <div className="text-gray-500 dark:text-gray-400 uppercase text-sm font-medium">
                    Fecha Límite
                  </div>
                  <div className="flex items-center text-gray-900 dark:text-white">
                    <Calendar size={20} className="mr-2 text-gray-400" />
                    <span>{formatDateTimeForDisplay(task.endDate)}</span>
                  </div>
                </div>
              </div>
              
              {/* Recurrence Information */}
              {task.recurrence && (
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-4">
                    <div className="text-gray-500 dark:text-gray-400 uppercase text-sm font-medium flex items-center">
                      <Repeat size={16} className="mr-2" />
                      Configuración de Repetición
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tipo</div>
                        <div className="text-gray-900 dark:text-white">
                          {task.recurrence.recurrenceType === 'daily' && 'Diaria'}
                          {task.recurrence.recurrenceType === 'weekly' && 'Semanal'}
                          {task.recurrence.recurrenceType === 'monthly' && 'Mensual'}
                          {task.recurrence.recurrenceType === 'yearly' && 'Anual'}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Intervalo</div>
                        <div className="text-gray-900 dark:text-white">
                          Cada {task.recurrence.intervalValue} {
                            task.recurrence.recurrenceType === 'daily' ? 'día(s)' :
                            task.recurrence.recurrenceType === 'weekly' ? 'semana(s)' :
                            task.recurrence.recurrenceType === 'monthly' ? 'mes(es)' :
                            'año(s)'
                          }
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Fin de repetición</div>
                        <div className="text-gray-900 dark:text-white flex items-center">
                          <Clock size={16} className="mr-2" />
                          {formatDate(task.recurrence.endDate)}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Estado</div>
                        <div className="text-gray-900 dark:text-white">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            task.recurrence.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            task.recurrence.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            task.recurrence.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {task.recurrence.status === 'active' && 'Activa'}
                            {task.recurrence.status === 'paused' && 'Pausada'}
                            {task.recurrence.status === 'completed' && 'Completada'}
                            {task.recurrence.status === 'cancelled' && 'Cancelada'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Additional details for weekly recurrence */}
                    {task.recurrence.recurrenceType === 'weekly' && task.recurrence.daysOfWeek && task.recurrence.daysOfWeek.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Días de la semana</div>
                        <div className="flex flex-wrap gap-1">
                          {task.recurrence.daysOfWeek.map(day => (
                            <span key={day} className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs">
                              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Additional details for monthly recurrence */}
                    {task.recurrence.recurrenceType === 'monthly' && task.recurrence.dayOfMonth && (
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Día del mes</div>
                        <div className="text-gray-900 dark:text-white">Día {task.recurrence.dayOfMonth}</div>
                      </div>
                    )}
                    
                    {/* Additional details for yearly recurrence */}
                    {task.recurrence.recurrenceType === 'yearly' && task.recurrence.monthOfYear && (
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Mes del año</div>
                        <div className="text-gray-900 dark:text-white">
                          {formatInGMT2(Date.UTC(2024, task.recurrence.monthOfYear - 1, 1), { month: 'long' })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Especialidades Requeridas - Solo mostrar si hay especialidades */}
              {taskSkills.length > 0 && (
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 md:block">
                  <div className="space-y-4">
                    {/* Mobile: Card design */}
                    <div className="md:hidden bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <div className="text-gray-500 dark:text-gray-400 uppercase text-xs font-medium mb-3 tracking-wide">
                        AREA(S)
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {taskSkills.map((skill) => (
                          <span
                            key={skill}
                            className="px-3 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm font-medium"
                          >
                            {skillDisplayNames[skill] || skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Desktop: Original design */}
                    <div className="hidden md:block text-gray-500 dark:text-gray-400 uppercase text-sm font-medium">
                      Area(s)
                    </div>
                    <div className="hidden md:flex flex-wrap gap-2">
                      {taskSkills.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm"
                        >
                          {skillDisplayNames[skill] || skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
                </div>

                {/* Sección de asignaciones */}
                <div className="px-4 md:px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="pt-6">
                    <TaskAssignmentSection
                      task={task}
                      onAssignmentChange={() => {
                        onAssignmentChange?.();
                        fetchTaskSkills(); // Refresh skills when assignments change
                      }}
                    />
                  </div>
                </div>

                {/* Sección de archivos adjuntos */}
                <div className="px-4 md:px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="pt-6">
                    <TaskAttachments
                      taskId={task.id}
                      attachments={taskAttachments}
                      onAttachmentsChange={handleAttachmentsChange}
                    />
                  </div>
                </div>

                {/* Sección de conversaciones */}
                <div className="px-4 md:px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="pt-6">
                    <TaskConversations
                      taskId={task.id}
                      conversations={conversations}
                      onConversationsChange={fetchConversations}
                    />
                  </div>
                </div>

                {/* Sección de historial de cambios */}
                <div className="px-4 md:px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="pt-6">
                    <TaskHistory 
                      taskId={task.id} 
                      key={`history-${taskAttachments.length}`} // Force refresh when attachments change
                    />
                  </div>
                </div>

                {/* Botones de acción después del historial */}
                <div className="px-4 md:px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="pt-6">
                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => setIsEditing(true)} 
                          leftIcon={<Edit size={18} />}
                          className="flex-1"
                        >
                          Editar
                        </Button>
                        <Button 
                          variant="danger" 
                          onClick={handleDelete} 
                          leftIcon={<Trash2 size={18} />}
                          className="flex-1"
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
            <div className="p-4 md:p-6">
              <TaskForm
                initialData={task}
                onSubmit={handleEdit}
                onClose={() => setIsEditing(false)}
                mode="edit"
              />
            </div>
          )}
          </div>

          {/* Footer */}
          <div className="bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 md:py-4 flex-shrink-0">
            {!isEditing ? (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
                      {/* Botón de completar tarea - solo mostrar si no está completada */}
                      {task.status !== 'completada' && (
                        <Button 
                          onClick={handleCompleteTask} 
                          variant="secondary"
                          leftIcon={<CheckCircle size={18} />}
                          className="bg-green-600 hover:bg-green-700 text-white w-full"
                        >
                          Marcar como Completada
                        </Button>
                      )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
