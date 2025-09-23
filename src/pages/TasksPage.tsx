import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { PlusIcon, Search, Filter, Calendar, Clock, Users, MapPin, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Task, Location } from '../types';
import { PageHeader } from '../components/layout/PageHeader';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { TaskDetailsModal } from '../components/tasks/TaskDetailsModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { MultiSelect } from '../components/ui/MultiSelect';
import { formatDate } from '../lib/utils';
import { formatTimeForDisplay } from '../lib/dateUtils';
import { getTaskStatuses, getStatusDisplayName, TaskStatus } from '../lib/taskStatuses';
import { getStatusIconWithColor } from '../lib/statusIcons';

export const TasksPage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<Array<{ value: string, label: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Initialize filters from URL parameters
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const filterParam = searchParams.get('filter');
    
    if (statusParam) {
      setStatusFilter([statusParam]);
    }
    
    if (filterParam === 'unassigned') {
      // We'll handle unassigned filter in the fetchTasks function
      setStatusFilter([]);
    }
  }, [searchParams]);
  
  const fetchEnums = async () => {
    try {
      // Fetch statuses from the new system
      const statusData = await getTaskStatuses();
      setStatuses(statusData);

      const { data: priorityData, error: priorityError } = await supabase
        .rpc('get_task_priorities');
      
      if (priorityError) throw priorityError;
      setPriorities(priorityData);
    } catch (error) {
      console.error('Error fetching enums:', error);
    }
  };

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

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      // Try to use the new function with recurrence first
      let { data, error } = await supabase
        .rpc('get_tasks_with_recurrence');
      
      // Fallback to the old function if the new one doesn't exist yet
      if (error && error.message?.includes('function get_tasks_with_recurrence')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .rpc('get_tasks_with_attachments');
        data = fallbackData;
        error = fallbackError;
      }
      
      if (error) throw error;
      
      let filteredTasks = data;
      
      // Apply filters
      if (searchQuery) {
        filteredTasks = filteredTasks.filter(task =>
          task.task_title.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      if (priorityFilter) {
        filteredTasks = filteredTasks.filter(task =>
          task.task_priority === priorityFilter
        );
      }
      
      if (locationFilter) {
        filteredTasks = filteredTasks.filter(task =>
          task.task_location_id === locationFilter
        );
      }
      
      // Apply status filter (multiple selection)
      if (statusFilter.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          statusFilter.includes(task.task_status)
        );
      }
      
      // Handle unassigned filter from URL
      const filterParam = searchParams.get('filter');
      
      const formattedTasks: Task[] = filteredTasks.map((task) => ({
        id: task.task_id,
        title: task.task_title,
        description: task.task_description,
        status: task.task_status,
        priority: task.task_priority,
        locationId: task.task_location_id,
        locationName: task.task_location_name,
        createdAt: task.task_created_at,
        updatedAt: task.task_updated_at,
        startDate: task.task_start_date,
        endDate: task.task_end_date,
        assignedWorkers: task.assigned_workers || [],
        attachments: task.attachments || [],
        recurrence: task.recurrence_config || undefined,
      }));
      
      setTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Fallback to original query if function fails
      let query = supabase
        .from('tasks')
        .select('*, locations(name)')
        .order('created_at', { ascending: false });
      
      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
      }
      
      if (priorityFilter) {
        query = query.eq('priority', priorityFilter);
      }
      
      if (locationFilter) {
        query = query.eq('location_id', locationFilter);
      }
      
      // Handle status filter from URL
      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }
      
      const { data: fallbackData, error: fallbackError } = await query;
      
      if (fallbackError) throw fallbackError;
      
      let formattedTasks: Task[] = fallbackData.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        locationId: task.location_id,
        locationName: task.locations?.name,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        startDate: task.start_date,
        endDate: task.end_date,
        assignedWorkers: [],
        attachments: [],
        recurrence: undefined,
      }));
      
      // Handle unassigned filter for fallback query
      const filterParam = searchParams.get('filter');
      
      setTasks(formattedTasks);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTasks();
    fetchLocations();
    fetchEnums();
  }, [searchQuery, statusFilter, priorityFilter, locationFilter, searchParams]);
  
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };
  
  const resetFilters = () => {
    setStatusFilter([]);
    setPriorityFilter('');
    setLocationFilter('');
    setSearchQuery('');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critica':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'alta':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10';
      case 'media':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'critica':
        return 'bg-red-500 text-white';
      case 'alta':
        return 'bg-orange-500 text-white';
      case 'media':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critica':
        return 'Crítica';
      case 'alta':
        return 'Alta';
      case 'media':
        return 'Media';
      default:
        return 'Baja';
    }
  };
  
  return (
    <div className="space-y-4 w-full max-w-full min-w-0">
      <PageHeader
        title="Tareas de Mantenimiento"
        description=""
        actionLabel="Nueva Tarea"
        onAction={() => setShowCreateModal(true)}
        actionIcon={<PlusIcon size={18} />}
      />
      
      <div className="space-y-4 w-full max-w-full min-w-0">
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Buscar tareas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            leftIcon={<Search size={18} />}
            fullWidth
          />
          <Button
            variant="outline"
            onClick={toggleFilters}
            leftIcon={<Filter size={18} />}
            className="w-full"
          >
            Filtros
          </Button>
        </div>
        
        {showFilters && (
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 w-full max-w-full min-w-0">
            <div className="space-y-4">
              <MultiSelect
                label="Estado"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  ...statuses
                ]}
                placeholder="Seleccionar estados"
                className="w-full"
                showSelectAll={true}
              />
              
              <Select
                label="Prioridad"
                value={priorityFilter}
                onChange={(value) => setPriorityFilter(value)}
                options={[
                  { value: '', label: 'Todas las prioridades' },
                  ...priorities
                ]}
                fullWidth
              />
              
              <Select
                label="Local"
                value={locationFilter}
                onChange={(value) => setLocationFilter(value)}
                options={[
                  { value: '', label: 'Todos los locales' },
                  ...locations.map(location => ({
                    value: location.id,
                    label: location.name
                  }))
                ]}
                fullWidth
              />
            </div>
            
            <div className="mt-4 flex justify-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetFilters}
                className="w-full"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 text-center border-0 w-full max-w-full min-w-0">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No se encontraron tareas</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery || statusFilter || priorityFilter
              ? 'No hay tareas que coincidan con los filtros actuales. Intenta ajustar los criterios de búsqueda.'
              : 'Comienza creando una tarea.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 w-full max-w-full min-w-0">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 ${getPriorityColor(task.priority)} w-full max-w-full`}
              onClick={() => setSelectedTask(task)}
            >
              <div className="p-4 w-full max-w-full min-w-0">
                <div className="flex flex-col gap-3 mb-3">
                  <div className="w-full max-w-full min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadgeColor(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 break-words">
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2 break-words">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 w-full max-w-full min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar size={14} />
                    <span className="truncate">{formatDate(task.startDate)} - {formatDate(task.endDate)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Clock size={14} />
                    <span className="truncate">
                      {formatTimeForDisplay(task.startDate)} - {formatTimeForDisplay(task.endDate)}
                    </span>
                  </div>

                  {task.locationName && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin size={14} />
                      <span className="truncate">{task.locationName}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {getStatusIconWithColor(task.status, 14)}
                    <span className="truncate">{getStatusDisplayName(task.status)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Users size={14} />
                    <span className="truncate">
                      {task.assignedWorkers && task.assignedWorkers.length > 0
                        ? `${task.assignedWorkers.length} técnico${task.assignedWorkers.length !== 1 ? 's' : ''} asignado${task.assignedWorkers.length !== 1 ? 's' : ''}`
                        : 'Sin asignar'
                      }
                    </span>
                  </div>

                  {task.status === 'sin_asignar' && (
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-xs">
                      <AlertTriangle size={14} />
                      <span>Sin asignar</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async () => {
          setShowCreateModal(false);
          fetchTasks();
        }}
      />
      
      <TaskDetailsModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => {
          setSelectedTask(null);
        }}
        onEdit={() => {
          setSelectedTask(null);
          fetchTasks();
        }}
        onDelete={() => {
          setSelectedTask(null);
          fetchTasks();
        }}
        onAssignmentChange={() => {
          fetchTasks();
          // Only refresh the task list, not the selected task details
          // The modal components will handle their own granular updates
        }}
      />
    </div>
  );
};