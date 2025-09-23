import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getYear, setYear, setMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { Select } from '../components/ui/Select';
import { supabase } from '../lib/supabase';
import { Task } from '../types';

export const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const firstDayOfMonth = startOfMonth(currentDate).getDay();
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  const previousMonthDays = Array.from({ length: startDay }, (_, i) => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth(), -i);
    return date;
  }).reverse();

  const nextMonthDays = Array.from({ length: 42 - (days.length + startDay) }, (_, i) => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + 1, i + 1);
    return date;
  });

  const allDays = [...previousMonthDays, ...days, ...nextMonthDays];

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*, locations(name)')
        .gte('end_date', startDate.toISOString())
        .lte('end_date', endDate.toISOString());
      
      if (error) throw error;
      
      const formattedTasks: Task[] = data.map(task => ({
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
        completedAt: task.completed_at
      }));
      
      setTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  interface TaskStatusCount {
    pending: number;
    in_progress: number;
    completed: number;
  }

  useEffect(() => {
    fetchTasks();
  }, [currentDate]);

  const previousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleMonthChange = (monthStr: string) => {
    const month = parseInt(monthStr, 10);
    setCurrentDate(setMonth(currentDate, month));
  };

  const handleYearChange = (yearStr: string) => {
    const year = parseInt(yearStr, 10);
    setCurrentDate(setYear(currentDate, year));
  };

  const getTasksForDay = (date: Date) => {
    return tasks.filter(task => {
      if (!task.endDate) return false;
      const taskDate = new Date(task.endDate);
      return taskDate.getDate() === date.getDate() &&
             taskDate.getMonth() === date.getMonth() &&
             taskDate.getFullYear() === date.getFullYear();
    });
  };

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: format(setMonth(new Date(), i), 'MMMM', { locale: es })
  }));

  const currentYear = getYear(new Date());
  const years = Array.from({ length: 10 }, (_, i) => ({
    value: (currentYear - 5 + i).toString(),
    label: (currentYear - 5 + i).toString()
  }));

  const getTaskStatusCount = (date: Date): TaskStatusCount => {
    const dayTasks = getTasksForDay(date);
    return {
      pending: dayTasks.filter(task => task.status === 'pending').length,
      in_progress: dayTasks.filter(task => task.status === 'in_progress').length,
      completed: dayTasks.filter(task => task.status === 'completed').length
    };
  };

  return (
    <div className="h-full">
      <PageHeader
        title="Calendario"
        description="Calendario de tareas de mantenimiento"
        actionLabel="Nueva Tarea"
        onAction={() => setShowCreateModal(true)}
        actionIcon={<Plus size={18} />}
      />

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchTasks();
        }}
      />

      <div className="bg-white dark:bg-dark-800 rounded-lg shadow overflow-hidden">
        {/* Calendar Header */}
        <div className="bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between px-4 py-2">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <div className="text-xl font-semibold px-8 py-2 rounded-lg">
                {format(currentDate, 'MMMM', { locale: es })}
              </div>
              <div className="text-xl font-semibold px-8 py-2 rounded-lg">
                {format(currentDate, 'yyyy')}
              </div>
            </div>
            
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 text-sm">
          {/* Week days header */}
          {weekDays.map(day => (
            <div
              key={day}
              className="py-4 text-center font-medium text-gray-900 dark:text-gray-300 bg-gray-50 dark:bg-gray-800"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {allDays.map((day) => {
            const dayTasks = getTasksForDay(day);
            const statusCount = getTaskStatusCount(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const totalTasks = statusCount.pending + statusCount.in_progress + statusCount.completed;
            const isWeekend = [6, 0].includes(day.getDay());
            const dayNumber = format(day, 'd');

            return (
              <div
                key={day.toString()}
                className={`
                  relative min-h-[100px] p-4 border border-gray-100 dark:border-gray-700 
                  ${isCurrentDay ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}
                `}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className={`
                      text-2xl font-medium select-none
                      ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-white'}
                      ${isWeekend ? (isCurrentMonth ? 'text-red-500' : 'text-red-300') : 'text-gray-900 dark:text-white'}
                    `}
                  >
                    {dayNumber}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};