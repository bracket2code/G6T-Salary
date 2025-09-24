import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDateLongGMT2(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    return format(date, 'dd/MM/yyyy', { locale: es });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
}

export function formatDateTimeGMT2(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '-';
  }
}

export function formatTimeGMT2(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    return format(date, 'HH:mm', { locale: es });
  } catch (error) {
    console.error('Error formatting time:', error);
    return '-';
  }
}