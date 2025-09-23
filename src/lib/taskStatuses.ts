import { supabase } from './supabase';

export interface TaskStatus {
  value: string;
  label: string;
  description?: string;
  color?: string;
  order_index: number;
}

// Cache for task statuses
let statusesCache: TaskStatus[] | null = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getTaskStatuses = async (): Promise<TaskStatus[]> => {
  const now = Date.now();
  
  // Return cached data if it's still fresh
  if (statusesCache && (now - lastFetch) < CACHE_DURATION) {
    return statusesCache;
  }
  
  try {
    const { data, error } = await supabase.rpc('get_task_statuses');
    
    if (error) {
      console.warn('Error fetching task statuses from database:', error);
      return getDefaultTaskStatuses();
    }
    
    if (!data || data.length === 0) {
      console.warn('No task statuses found in database, using defaults');
      return getDefaultTaskStatuses();
    }
    
    statusesCache = data;
    lastFetch = now;
    
    return data;
  } catch (error) {
    console.error('Failed to fetch task statuses:', error);
    return getDefaultTaskStatuses();
  }
};

// Fallback default statuses
const getDefaultTaskStatuses = (): TaskStatus[] => [
  { value: 'sin_asignar', label: 'Sin Asignar', color: '#f97316', order_index: 1 },
  { value: 'pendiente', label: 'Pendiente', color: '#6b7280', order_index: 2 },
  { value: 'en_progreso', label: 'En Proceso', color: '#3b82f6', order_index: 3 },
  { value: 'aplazada', label: 'Aplazada', color: '#f59e0b', order_index: 4 },
  { value: 'completada', label: 'Completada', color: '#10b981', order_index: 5 },
  { value: 'cancelada', label: 'Cancelada', color: '#ef4444', order_index: 6 },
  { value: 'archivada', label: 'Archivada', color: '#9ca3af', order_index: 7 },
];

// Get status display name
export const getStatusDisplayName = (statusValue: string): string => {
  if (!statusesCache) {
    const defaultStatus = getDefaultTaskStatuses().find(s => s.value === statusValue);
    return defaultStatus?.label || statusValue;
  }
  
  const status = statusesCache.find(s => s.value === statusValue);
  return status?.label || statusValue;
};

// Get status color
export const getStatusColor = (statusValue: string): string => {
  if (!statusesCache) {
    const defaultStatus = getDefaultTaskStatuses().find(s => s.value === statusValue);
    return defaultStatus?.color || '#6b7280';
  }
  
  const status = statusesCache.find(s => s.value === statusValue);
  return status?.color || '#6b7280';
};

// Clear cache (useful for admin operations)
export const clearTaskStatusesCache = (): void => {
  statusesCache = null;
  lastFetch = 0;
};