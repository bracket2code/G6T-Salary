import { Task } from '../types';
import { formatDateLongGMT2, formatDateTimeGMT2, formatTimeGMT2 } from './timezone';

export function formatDate(dateString: string | null | undefined): string {
  return formatDateLongGMT2(dateString);
}

export function formatDateTime(dateString: string | null | undefined): string {
  return formatDateTimeGMT2(dateString);
}

export function formatTime(dateString: string | null | undefined): string {
  return formatTimeGMT2(dateString);
}

export const getPriorityColor = (priority: Task['priority']): string => {
  switch (priority) {
    case 'baja':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'media':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'alta':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'critica':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const getStatusColor = (status: Task['status']): string => {
  switch (status) {
    case 'sin_asignar':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'pendiente':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    case 'en_proceso':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'aplazada':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'cancelada':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'completada':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'archivada':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const getAreaIcon = (area: Task['area']): string => {
  switch (area) {
    case 'mechanical':
      return '🔧';
    case 'electrical':
      return '⚡';
    case 'plumbing':
      return '🚿';
    case 'hvac':
      return '❄️';
    case 'general':
      return '🔨';
    default:
      return '🔨';
  }
};

export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
