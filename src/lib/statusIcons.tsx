import React from 'react';
import { 
  UserX, 
  Clock, 
  Play, 
  Pause, 
  CheckCircle, 
  X, 
  Archive 
} from 'lucide-react';

// Centralized status icon mapping to ensure consistency
export const getStatusIcon = (status: string, size: number = 16, className?: string) => {
  const iconProps = { size, className };
  
  switch (status) {
    case 'sin_asignar':
      return <UserX {...iconProps} />;
    case 'pendiente':
      return <Clock {...iconProps} />;
    case 'en_progreso':
      return <Play {...iconProps} />;
    case 'aplazada':
      return <Pause {...iconProps} />;
    case 'completada':
      return <CheckCircle {...iconProps} />;
    case 'cancelada':
      return <X {...iconProps} />;
    case 'archivada':
      return <Archive {...iconProps} />;
    default:
      return <Clock {...iconProps} />;
  }
};

// Get status icon with consistent colors
export const getStatusIconWithColor = (status: string, size: number = 16) => {
  const getColorClass = (status: string) => {
    switch (status) {
      case 'sin_asignar':
        return 'text-orange-600 dark:text-orange-400';
      case 'pendiente':
        return 'text-gray-600 dark:text-gray-400';
      case 'en_progreso':
        return 'text-blue-600 dark:text-blue-400';
      case 'aplazada':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'completada':
        return 'text-green-600 dark:text-green-400';
      case 'cancelada':
        return 'text-red-600 dark:text-red-400';
      case 'archivada':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return getStatusIcon(status, size, getColorClass(status));
};

// Get background color class for status containers
export const getStatusBackgroundColor = (status: string) => {
  switch (status) {
    case 'sin_asignar':
      return 'bg-orange-100 dark:bg-orange-900/30';
    case 'pendiente':
      return 'bg-gray-100 dark:bg-gray-900/30';
    case 'en_progreso':
      return 'bg-blue-100 dark:bg-blue-900/30';
    case 'aplazada':
      return 'bg-yellow-100 dark:bg-yellow-900/30';
    case 'completada':
      return 'bg-green-100 dark:bg-green-900/30';
    case 'cancelada':
      return 'bg-red-100 dark:bg-red-900/30';
    case 'archivada':
      return 'bg-gray-100 dark:bg-gray-900/30';
    default:
      return 'bg-gray-100 dark:bg-gray-900/30';
  }
};