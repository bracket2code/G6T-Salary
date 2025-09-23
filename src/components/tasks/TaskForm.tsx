import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Task, Location } from '../../types';
import { supabase } from '../../lib/supabase';
import { TaskAttachments } from './TaskAttachments';
import { TaskFormBasicFields } from './TaskFormBasicFields';
import { TaskFormSkillSuggestions } from './TaskFormSkillSuggestions';
import { TaskFormSkillsSection } from './TaskFormSkillsSection';
import { TaskFormWorkersSection } from './TaskFormWorkersSection';
import { TaskFormRecurrenceSection } from './TaskFormRecurrenceSection';
import { analyzeDescriptionForSkills } from './TaskFormAIUtils';
import { getTaskStatuses, TaskStatus } from '../../lib/taskStatuses';

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

interface TaskFormProps {
  initialData?: Partial<Task>;
  onSubmit: (data: Partial<Task>, selectedWorkers?: string[]) => void;
  onClose: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
  onWorkersSelected?: (workerIds: string[]) => void;
  tempTaskId?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  initialData = {},
  onSubmit,
  onClose,
  isLoading = false,
  mode = 'create',
  onWorkersSelected,
  tempTaskId,
}: TaskFormProps) => {
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<Array<{ value: string, label: string }>>([]);
  const [skillTypes, setSkillTypes] = useState<Array<{ value: string, label: string }>>([]);
  const [recurrenceTypes, setRecurrenceTypes] = useState<Array<{ value: string, label: string }>>([]);
  const [formData, setFormData] = useState<Partial<Task>>(() => {
    const today = new Date().toISOString().split('T')[0];
    const baseData: Partial<Task> = {
      title: '',
      description: '',
      locationId: '',
      priority: '',
      status: 'sin_asignar',
      ...initialData,
    };

    return {
      ...baseData,
      startDate: baseData.startDate || (mode === 'create' ? today : ''),
      endDate: baseData.endDate || (mode === 'create' ? today : ''),
    };
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [availableWorkers, setAvailableWorkers] = useState<any[]>([]);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState<Partial<TaskRecurrence>>({
    patternType: 'weekly',
    intervalValue: 1,
    status: 'active'
  });
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // Initialize required skills from initial data if in edit mode
  useEffect(() => {
    if (mode === 'edit' && initialData?.id) {
      fetchTaskSkills();
    }
  }, [mode, initialData?.id]);

  const fetchTaskSkills = async () => {
    if (!initialData?.id) return;
    
    try {
      // Get skills directly from task_skills table
      const { data: taskSkills, error } = await supabase
        .from('task_skills')
        .select('skill_type')
        .eq('task_id', initialData.id);

      if (error) throw error;

      // Extract skills from task_skills table
      const skills = taskSkills?.map(skill => skill.skill_type) || [];

      setRequiredSkills(skills);
    } catch (error) {
      console.error('Error fetching task skills:', error);
    }
  };

  // Use the provided tempTaskId or generate one for edit mode
  const taskId = tempTaskId || (mode === 'edit' && initialData?.id) || '';

  // Fetch attachments when taskId changes
  useEffect(() => {
    if (taskId) {
      fetchAttachments();
    }
  }, [taskId]);

  const fetchAttachments = async () => {
    if (!taskId) return;
    
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleAttachmentsChange = () => {
    fetchAttachments();
  };

  const handleSelectChange = (name: string) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-detect location from title
  useEffect(() => {
    if (formData.title && locations.length > 0) {
      const titleLower = formData.title.toLowerCase();
      
      // Find location that matches in the title
      const matchedLocation = locations.find(location => {
        const locationNameLower = location.name.toLowerCase();
        return titleLower.includes(locationNameLower);
      });
      
      // Only auto-select if no location is currently selected
      if (matchedLocation && !formData.locationId) {
        setFormData(prev => ({ ...prev, locationId: matchedLocation.id }));
      }
    }
  }, [formData.title, locations]);

  // AI skill suggestion when description or title changes
  useEffect(() => {
    if ((formData.description || formData.title) && skillTypes.length > 0) {
      const suggestions = analyzeDescriptionForSkills(
        formData.description || '', 
        formData.title || ''
      );
      
      // Filter out already selected skills
      const newSuggestions = suggestions.filter(skill => 
        !requiredSkills.includes(skill) && 
        skillTypes.some(st => st.value === skill)
      );
      
      setSuggestedSkills(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setSuggestedSkills([]);
      setShowSuggestions(false);
    }
  }, [formData.description, formData.title, requiredSkills, skillTypes]);

  const fetchEnums = async () => {
    try {
      // Fetch statuses from the new system
      const statusData = await getTaskStatuses();
      setStatuses(statusData);

      const { data: priorityData, error: priorityError } = await supabase
        .rpc('get_task_priorities');
      
      if (priorityError) throw priorityError;
      setPriorities([
        { value: '', label: 'Seleccionar prioridad' },
        ...priorityData
      ]);

      const { data: skillTypesData, error: skillTypesError } = await supabase
        .rpc('get_skill_types');
      
      if (skillTypesError) throw skillTypesError;
      const mappedSkillTypes = skillTypesData.map((item: any) => ({
        value: item.value,
        label: skillDisplayNames[item.value] || item.label
      }));
      setSkillTypes(mappedSkillTypes);

      const { data: recurrenceTypesData, error: recurrenceTypesError } = await supabase
        .rpc('get_recurrence_types');
      
      if (recurrenceTypesError) throw recurrenceTypesError;
      setRecurrenceTypes(recurrenceTypesData);
    } catch (error) {
      console.error('Error fetching enums:', error);
    }
  };

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .order('name');

        if (error) throw error;
        setLocations(data);
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    fetchLocations();
    fetchEnums();
  }, []);

  // Fetch workers when required skills change
  useEffect(() => {
    if (requiredSkills.length > 0 || formData.locationId) {
      fetchWorkersWithSkills();
    } else {
      setAvailableWorkers([]);
    }
  }, [requiredSkills, formData.locationId]);

  const fetchWorkersWithSkills = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_users_with_skills');

      if (error) throw error;

      // Filter workers based on skills and/or location
      let filteredWorkers = data;

      // Filter by required skills if any
      if (requiredSkills.length > 0) {
        filteredWorkers = filteredWorkers.filter((worker: any) => {
          const workerSkills = worker.skills || [];
          return requiredSkills.some(requiredSkill =>
            workerSkills.some((skill: any) => skill.skill_type === requiredSkill)
          );
        });
      }

      // Filter by location if selected
      if (formData.locationId) {
        filteredWorkers = filteredWorkers.filter((worker: any) => {
          const workerLocations = worker.locations || [];
          return workerLocations.some((location: any) => location.location_id === formData.locationId);
        });
      }

      // If both skills and location are specified, show workers that match either criteria
      if (requiredSkills.length > 0 && formData.locationId) {
        const skillMatches = data.filter((worker: any) => {
          const workerSkills = worker.skills || [];
          return requiredSkills.some(requiredSkill =>
            workerSkills.some((skill: any) => skill.skill_type === requiredSkill)
          );
        });

        const locationMatches = data.filter((worker: any) => {
          const workerLocations = worker.locations || [];
          return workerLocations.some((location: any) => location.location_id === formData.locationId);
        });

        // Combine and deduplicate
        const combinedWorkers = [...skillMatches, ...locationMatches];
        filteredWorkers = combinedWorkers.filter((worker, index, self) =>
          index === self.findIndex(w => w.user_id === worker.user_id)
        );
      }

      setAvailableWorkers(filteredWorkers);
    } catch (error) {
      console.error('Error fetching workers with skills:', error);
    }
  };

  const handleAddSkill = () => {
    if (newSkill && !requiredSkills.includes(newSkill)) {
      setRequiredSkills([...requiredSkills, newSkill]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setRequiredSkills(requiredSkills.filter(skill => skill !== skillToRemove));
  };

  const handleAddSuggestedSkill = (skill: string) => {
    if (!requiredSkills.includes(skill)) {
      setRequiredSkills([...requiredSkills, skill]);
      setSuggestedSkills(suggestedSkills.filter(s => s !== skill));
    }
  };

  const handleAddAllSuggestions = () => {
    const newSkills = suggestedSkills.filter(skill => !requiredSkills.includes(skill));
    setRequiredSkills([...requiredSkills, ...newSkills]);
    setSuggestedSkills([]);
    setShowSuggestions(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === 'startDate') {
        const updated = { ...prev, [name]: value };
        if (!prev.endDate || (value && new Date(prev.endDate) < new Date(value))) {
          updated.endDate = value;
        }
        return updated;
      }

      return { ...prev, [name]: value };
    });
    // This will be called when attachments are added/removed
    // We don't need to do anything special here since attachments
    // are handled directly by the TaskAttachments component
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title) {
      alert('El título es obligatorio');
      return;
    }

    if (!formData.priority) {
      alert('La prioridad es obligatoria');
      return;
    }

    if (!formData.locationId) {
      alert('El local es obligatorio');
      return;
    }

    if (!formData.startDate) {
      alert('La fecha de inicio es obligatoria');
      return;
    }

    if (!formData.endDate) {
      alert('La fecha de fin es obligatoria');
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      alert('La fecha de fin debe ser posterior o igual a la fecha de inicio');
      return;
    }

    // Validate recurrence fields if recurring is enabled
    if (isRecurring) {
      if (!recurrenceEndDate) {
        alert('La fecha de fin de repetición es obligatoria para tareas repetitivas');
        return;
      }
      if (!recurrenceData.patternType) {
        alert('Debe seleccionar un tipo de repetición');
        return;
      }
      if (!formData.startDate) {
        alert('La fecha de inicio es obligatoria para tareas repetitivas');
        return;
      }
      if (!formData.endDate) {
        alert('La fecha de fin es obligatoria para tareas repetitivas');
        return;
      }
      if (recurrenceData.patternType === 'weekly' && (!recurrenceData.daysOfWeek || recurrenceData.daysOfWeek.length === 0)) {
        alert('Debe seleccionar al menos un día de la semana para repetición semanal');
        return;
      }
      if (recurrenceData.patternType === 'custom_days' && (!recurrenceData.customDays || recurrenceData.customDays.length === 0)) {
        alert('Debe seleccionar al menos un día del mes para días personalizados');
        return;
      }
      if (recurrenceData.patternType === 'nth_weekday' && (!recurrenceData.nthOccurrence || !recurrenceData.weekdayType)) {
        alert('Debe configurar la ocurrencia y el día de la semana');
        return;
      }
      
      // Validate that recurrence end date is after task end date
      const taskEndDate = new Date(formData.endDate);
      const recEndDate = new Date(recurrenceEndDate);
      if (recEndDate <= taskEndDate) {
        alert('La fecha de fin de repetición debe ser posterior a la fecha de fin de la tarea');
        return;
      }
    }
    
    // Prepare task data with recurrence information
    const taskData = {
      ...formData,
      requiredSkills, // Include required skills in task data
      ...(isRecurring ? {
        recurrence: {
          ...recurrenceData,
          startDate: formData.startDate || '',
          endDate: recurrenceEndDate,
        }
      } : {})
    };
    
    // Pass selected workers and task data
    if (selectedWorkers.length > 0) {
      onSubmit(taskData, selectedWorkers);
    } else {
      onSubmit(taskData);
    }
  };

  // Notify parent component when workers are selected
  useEffect(() => {
    if (onWorkersSelected) {
      onWorkersSelected(selectedWorkers);
    }
  }, [selectedWorkers, onWorkersSelected]);

  const handleWorkerSelection = (workerId: string) => {
    setSelectedWorkers(prev => {
      if (prev.includes(workerId)) {
        return prev.filter(id => id !== workerId);
      } else {
        return [...prev, workerId];
      }
    });
  };

  const handleSelectAllWorkers = () => {
    const allWorkerIds = availableWorkers.map(worker => worker.user_id);
    setSelectedWorkers(allWorkerIds);
  };

  const handleDeselectAllWorkers = () => {
    setSelectedWorkers([]);
  };

  const availableSkillTypes = skillTypes.filter(skillType => 
    !requiredSkills.includes(skillType.value)
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <TaskFormBasicFields
          formData={formData}
          locations={locations}
          statuses={statuses}
          priorities={priorities}
          mode={mode}
          onChange={handleChange}
          onSelectChange={handleSelectChange}
        />

        <TaskFormSkillSuggestions
          suggestedSkills={suggestedSkills}
          showSuggestions={showSuggestions}
          onAddSuggestedSkill={handleAddSuggestedSkill}
          onAddAllSuggestions={handleAddAllSuggestions}
          onDismissSuggestions={() => setShowSuggestions(false)}
        />

        <TaskFormSkillsSection
          requiredSkills={requiredSkills}
          availableSkillTypes={availableSkillTypes}
          newSkill={newSkill}
          onNewSkillChange={setNewSkill}
          onAddSkill={handleAddSkill}
          onRemoveSkill={handleRemoveSkill}
        />

        {/* Workers Section - Moved here after skills */}
        <TaskFormWorkersSection
          availableWorkers={availableWorkers}
          selectedWorkers={selectedWorkers}
          requiredSkills={requiredSkills}
          formData={formData}
          onWorkerSelection={handleWorkerSelection}
          onSelectAllWorkers={handleSelectAllWorkers}
          onDeselectAllWorkers={handleDeselectAllWorkers}
        />

        {/* Recurrence Section - Only show in create mode */}
        {mode === 'create' && (
          <TaskFormRecurrenceSection
            isRecurring={isRecurring}
            onRecurringChange={setIsRecurring}
            recurrenceData={recurrenceData}
            onRecurrenceChange={setRecurrenceData}
            recurrenceTypes={recurrenceTypes}
            endDate={recurrenceEndDate}
            onEndDateChange={setRecurrenceEndDate}
          />
        )}

        {/* Attachments Section - Only show if we have a task ID */}
        {taskId && (
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <TaskAttachments
              taskId={taskId}
              attachments={attachments}
              onAttachmentsChange={handleAttachmentsChange}
            />
          </div>
        )}

        {/* Form buttons moved to the end */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {mode === 'edit' ? 'Actualizar Tarea' : 'Crear Tarea'}
          </Button>
        </div>
      </form>
    </div>
  );
};
