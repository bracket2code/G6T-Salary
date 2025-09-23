import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TaskForm } from './TaskForm';
import { Task, TaskRecurrence } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [tempTaskId, setTempTaskId] = useState<string>('');

  // Generate a temporary task ID for file uploads during creation
  useEffect(() => {
    if (isOpen) {
      setTempTaskId(crypto.randomUUID());
    }
  }, [isOpen]);
  
  const handleSubmit = async (formData: Partial<Task>, workerIds?: string[]) => {
    const { user } = useAuthStore.getState();
    setIsLoading(true);

    try {
      // Ensure all required fields are present
      if (!formData.title) {
        throw new Error('El título es obligatorio');
      }

      // Create the main task first
      const { data: taskData, error } = await supabase.from('tasks').insert([
        {
          title: formData.title,
          description: formData.description,
          location_id: formData.locationId,
          priority: formData.priority,
          status: 'pendiente',
          start_date: formData.startDate || null,
          end_date: formData.endDate || null,
        },
      ]).select().single();

      if (error) throw error;
      
      // If there are required skills, save them to task_skills table
      if (formData.requiredSkills && formData.requiredSkills.length > 0) {
        const skillInserts = formData.requiredSkills.map(skill => ({
          task_id: taskData.id,
          skill_type: skill
        }));
        
        const { error: skillsError } = await supabase
          .from('task_skills')
          .insert(skillInserts);
          
        if (skillsError) {
          console.error('Error saving task skills:', skillsError);
        }
      }
      
      // If this is a recurring task, create the recurrence configuration
      if (formData.recurrence) {
        const { error: recurrenceError } = await supabase
          .from('task_recurrence')
          .insert([{
            task_id: taskData.id,
            recurrence_type: formData.recurrence.patternType || 'weekly',
            pattern_type: formData.recurrence.patternType,
            interval_value: formData.recurrence.intervalValue || 1,
            days_of_week: formData.recurrence.daysOfWeek || null,
            custom_days: formData.recurrence.customDays || null,
            day_of_month: formData.recurrence.dayOfMonth || null,
            month_of_year: formData.recurrence.monthOfYear || null,
            nth_occurrence: formData.recurrence.nthOccurrence || null,
            weekday_type: formData.recurrence.weekdayType || null,
            skip_holidays: formData.recurrence.skipHolidays || false,
            max_instances: formData.recurrence.maxInstances || null,
            start_date: formData.recurrence.startDate,
            end_date: formData.recurrence.endDate,
            status: 'active'
          }]);

        if (recurrenceError) {
          console.error('Error creating recurrence:', recurrenceError);
          // Don't fail the entire operation, just log the error
        }
      }

      // Update any temporary attachments with the real task ID
      if (tempTaskId) {
        const { error: attachmentError } = await supabase
          .from('task_attachments')
          .update({ task_id: taskData.id })
          .eq('task_id', tempTaskId);
        
        if (attachmentError) {
          console.warn('Error updating attachment task IDs:', attachmentError);
        }
      }
      
      // If workers were selected, assign them to the task
      if (workerIds && workerIds.length > 0 && taskData) {
        const assignments = workerIds.map(workerId => ({
          task_id: taskData.id,
          worker_id: workerId,
          assigned_by: user?.id || null,
        }));
        
        const { error: assignmentError } = await supabase
          .from('task_assignments')
          .insert(assignments);
          
        if (assignmentError) {
          console.error('Error assigning workers:', assignmentError);
          // Don't throw here, task was created successfully
        }
      }

      // Only close and trigger success if no error
      onSuccess?.();
      onClose();
      setSelectedWorkers([]);
      setTempTaskId('');
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Error al crear la tarea: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Clean up any temporary attachments when closing without saving
    if (tempTaskId) {
      supabase
        .from('task_attachments')
        .delete()
        .eq('task_id', tempTaskId)
        .then(() => {
          console.log('Cleaned up temporary attachments');
        })
        .catch((error) => {
          console.warn('Error cleaning up temporary attachments:', error);
        });
    }
    
    setSelectedWorkers([]);
    setTempTaskId('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-dark-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-600">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Nueva Tarea
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <div className="p-6">
            <TaskForm
              onSubmit={(formData, workerIds) => handleSubmit(formData, workerIds)}
              onClose={handleClose}
              isLoading={isLoading}
              mode="create"
              onWorkersSelected={setSelectedWorkers}
              tempTaskId={tempTaskId}
            />
          </div>
        </div>
      </div>
    </div>
  );
};