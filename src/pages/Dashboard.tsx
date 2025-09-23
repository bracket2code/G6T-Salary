import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Task } from '../types';
import { TaskDetailsModal } from '../components/tasks/TaskDetailsModal';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { FileText, CheckCircle, Clock, AlertTriangle, PlusIcon, Calendar, Users, MapPin, TrendingUp } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { formatDate, formatDateTime } from '../lib/utils';
import { getStatusDisplayName } from '../lib/taskStatuses';
import { getStatusIconWithColor, getStatusBackgroundColor } from '../lib/statusIcons';

// Translation maps for display names
const skillDisplayNames: Record<string, string> = {
  electricidad: 'ELECTRICIDAD',
  electronica: 'ELECTRÓNICA',
  general: 'GENERAL',
  fontaneria: 'FONTANERÍA',
  construccion: 'CONSTRUCCIÓN',
  tecnologia: 'TECNOLOGÍA',
  cerrajeria: 'CERRAJERÍA',
  cristaleria: 'CRISTALERÍA',
  limpieza: 'LIMPIEZA',
  sonido: 'SONIDO',
  luces: 'LUCES'
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalTasks: 0,
    unassignedTasks: 0,
    pendingTasks: 0,
    completedTasks: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [locationDistribution, setLocationDistribution] = useState<Array<{location: string, count: number, percentage: number}>>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const handleNavigateToTasks = (filterType: string) => {
    const searchParams = new URLSearchParams();
    
    switch (filterType) {
      case 'unassigned':
        searchParams.set('status', 'sin_asignar');
        break;
      case 'pending':
        searchParams.set('status', 'pendiente');
        break;
      case 'in-progress':
        searchParams.set('status', 'en_progreso');
        break;
      case 'postponed':
        searchParams.set('status', 'aplazada');
        break;
      case 'cancelled':
        searchParams.set('status', 'cancelada');
        break;
      case 'completed':
        searchParams.set('status', 'completada');
        break;
      case 'archived':
        searchParams.set('status', 'archivada');
        break;
    }
    
    navigate(`/tasks?${searchParams.toString()}`);
  };
  
  const fetchDashboardStats = async () => {
    setIsLoading(true);
    try {
      // Fetch unassigned tasks count
      let { data: unassignedTasksData } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sin_asignar');
      
      const unassignedTasks = unassignedTasksData?.count || 0;
      
      // Fetch total counts
      const { count: totalTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true });
        
      const { count: pendingTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente');
        
      const { count: completedTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completada');
        
      // Fetch tasks for today
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      
      const { data: todayTasksData } = await supabase
        .rpc('get_tasks_with_recurrence')
        .not('task_status', 'in', '(archivada,completada,cancelada)');
      
      // Fetch recent tasks
      const { data: recentTasksData } = await supabase
        .rpc('get_tasks_with_recurrence')
        .limit(5);
        
      const formatTasks = (data: any[]): Task[] => {
        return data?.map((task) => ({
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
          completedAt: null,
          assignedWorkers: task.assigned_workers || [],
          attachments: task.attachments || [],
          recurrence: task.recurrence_config || undefined,
        })) || [];
      };

      const todayTasks = formatTasks(todayTasksData || []);
      const recentTasks = formatTasks(recentTasksData || []);
      
      // Filter and sort tasks for "Tareas para hoy"
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      
      // Filter tasks into categories
      const overdueUncompletedTasks = todayTasks.filter(task => {
        if (!task.endDate) return false;
        const taskEndDate = new Date(task.endDate);
        const isOverdueOrToday = taskEndDate <= todayEnd;
        const isUncompleted = ['sin_asignar', 'pendiente', 'en_progreso', 'aplazada'].includes(task.status);
        return isOverdueOrToday && isUncompleted;
      });
      
      const todaysStartingTasks = todayTasks.filter(task => {
        if (!task.startDate) return false;
        const taskStartDate = new Date(task.startDate);
        const isStartingToday = taskStartDate >= todayStart && taskStartDate <= todayEnd;
        const isNotCompleted = !['archivada', 'completada', 'cancelada'].includes(task.status);
        return isStartingToday && isNotCompleted;
      });
      
      // Combine and sort tasks
      const combinedTasks = [
        ...overdueUncompletedTasks.map(task => ({ ...task, category: 'overdue' })),
        ...todaysStartingTasks.map(task => ({ ...task, category: 'today' }))
      ];
      
      // Remove duplicates (tasks that might appear in both categories)
      const uniqueTasks = combinedTasks.filter((task, index, self) =>
        index === self.findIndex(t => t.id === task.id)
      );
      
      // Sort tasks: overdue first, then by start date (oldest first)
      const sortedTasks = uniqueTasks.sort((a, b) => {
        // First priority: overdue tasks come before today's tasks
        if (a.category === 'overdue' && b.category === 'today') return -1;
        if (a.category === 'today' && b.category === 'overdue') return 1;
        
        // Within same category, sort by start date (oldest first)
        const aDate = new Date(a.startDate || a.endDate || a.createdAt);
        const bDate = new Date(b.startDate || b.endDate || b.createdAt);
        return aDate.getTime() - bDate.getTime();
      });
      
      // Remove the category property before setting state
      const finalTasks = sortedTasks.map(({ category, ...task }) => task);
      
      // Calculate location distribution from tasks
      const locationCounts: Record<string, number> = {};
      let totalTasksForDistribution = 0;
      
      recentTasks.forEach(task => {
        if (task.locationName) {
          locationCounts[task.locationName] = (locationCounts[task.locationName] || 0) + 1;
          totalTasksForDistribution++;
        }
      });
      
      const locationDistribution = Object.entries(locationCounts)
        .map(([location, count]) => ({
          location,
          count,
          percentage: Math.round((count / Math.max(totalTasksForDistribution, 1)) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      
      setStats({
        totalTasks: totalTasks || 0,
        unassignedTasks: unassignedTasks,
        pendingTasks: pendingTasks || 0,
        completedTasks: completedTasks || 0,
      });
      setTodayTasks(finalTasks);
      setRecentTasks(recentTasks);
      setLocationDistribution(locationDistribution);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDashboardStats();
  }, []);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 pb-4">
      {/* Task Statistics */}
      {/* Mobile: Single row with icons only */}
      <div className="md:hidden pt-4">
        <div className="flex justify-between gap-2 px-2">
          <div 
            className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 p-4 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[80px]"
            onClick={() => handleNavigateToTasks('unassigned')}
          >
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg mb-2">
              {getStatusIconWithColor('sin_asignar', 24)}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unassignedTasks}</p>
          </div>

          <div 
            className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 p-4 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[80px]"
            onClick={() => handleNavigateToTasks('pending')}
          >
            <div className="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg mb-2">
              {getStatusIconWithColor('pendiente', 24)}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingTasks}</p>
          </div>

          <div 
            className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 p-4 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[80px]"
            onClick={() => handleNavigateToTasks('postponed')}
          >
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg mb-2">
              {getStatusIconWithColor('aplazada', 24)}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
          </div>

          <div 
            className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 p-4 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[80px]"
            onClick={() => handleNavigateToTasks('completed')}
          >
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mb-2">
              {getStatusIconWithColor('completada', 24)}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedTasks}</p>
          </div>
        </div>
      </div>

      {/* Desktop: Original grid layout */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-sm cursor-pointer"
          onClick={() => handleNavigateToTasks('unassigned')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Sin asignar</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.unassignedTasks}</p>
              </div>
              <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                {getStatusIconWithColor('sin_asignar', 20)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-sm cursor-pointer"
          onClick={() => handleNavigateToTasks('pending')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Pendientes</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingTasks}</p>
              </div>
              <div className="p-2 sm:p-3 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                {getStatusIconWithColor('pendiente', 20)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-sm cursor-pointer"
          onClick={() => handleNavigateToTasks('postponed')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Aplazadas</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">0</p>
              </div>
              <div className="p-2 sm:p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                {getStatusIconWithColor('aplazada', 20)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-sm cursor-pointer"
          onClick={() => handleNavigateToTasks('completed')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completadas</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.completedTasks}</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                {getStatusIconWithColor('completada', 20)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Tasks */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Tareas para hoy ({todayTasks.length})
                </h2>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayTasks.length === 0 ? (
              <div className="text-center py-6">
                <Calendar size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No hay tareas programadas para hoy</p>
              </div>
            ) : (
              todayTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`p-3 sm:p-4 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-all duration-200 ${getPriorityColor(task.priority)}`}
                >
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 text-sm sm:text-base">
                      {task.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full self-start ${getPriorityBadgeColor(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                  </div>
                  {task.locationName && (
                    <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      <MapPin size={14} />
                      <span className="truncate">{task.locationName}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Location Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Distribución por Locales
              </h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {locationDistribution.length === 0 ? (
              <div className="text-center py-6">
                <TrendingUp size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No hay datos de distribución disponibles</p>
              </div>
            ) : (
              <>
                {locationDistribution.map((item, index) => (
                  <div key={item.location} className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {item.location}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 ml-2">
                          {item.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {locationDistribution.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Local con más tareas: <span className="font-medium">{locationDistribution[0]?.location}</span> ({locationDistribution[0]?.count})
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Actividad Reciente</h2>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <div className="text-center py-6">
              <FileText size={40} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No hay tareas registradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTasks.slice(0, 5).map((task) => (
                <div 
                  key={task.id} 
                  onClick={() => setSelectedTask(task)} 
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-3 sm:p-4 rounded-lg transition-colors duration-200"
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`p-2 rounded-lg ${getStatusBackgroundColor(task.status)}`}>
                        {getStatusIconWithColor(task.status, 16)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                          {task.title}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 self-start">
                          Actualizado: {formatDate(task.updatedAt || task.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Estado: {getStatusDisplayName(task.status)}
                      </p>
                      {task.assignedWorkers && task.assignedWorkers.length > 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          Asignado a: {task.assignedWorkers.map(w => w.name).join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-orange-500 dark:text-orange-400">
                          Sin asignar
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <TaskDetailsModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={() => {
          setSelectedTask(null);
          fetchDashboardStats();
        }}
        onDelete={() => {
          setSelectedTask(null);
          fetchDashboardStats();
        }}
        onAssignmentChange={() => {
          fetchDashboardStats();
        }}
      />
    </div>
  );
};