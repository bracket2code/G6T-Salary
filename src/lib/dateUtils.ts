// Utilidades para manejo de fechas con zona horaria fija GMT+2
import {
  formatDateTimeGMT2,
  formatTimeGMT2,
  formatForDateTimeInputGMT2,
  dateTimeInputToISOFromGMT2,
  addGMT2Offset,
} from './timezone';

/**
 * Convierte una fecha a formato datetime-local sin conversión de zona horaria
 */
export function formatDateTimeForInput(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  // Crear fecha directamente sin conversión de zona horaria
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  return formatForDateTimeInputGMT2(date);
}

/**
 * Convierte un valor de datetime-local a ISO string manteniendo la hora local
 */
export function formatInputDateTimeToISO(inputValue: string): string {
  if (!inputValue) return '';

  return dateTimeInputToISOFromGMT2(inputValue);
}

/**
 * Convierte una fecha ISO a hora local sin conversión automática
 */
export function parseISOToLocalDateTime(isoString: string | null | undefined): Date | null {
  if (!isoString) return null;
  
  // Parsear la fecha directamente como hora local
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  
  // Si la fecha viene con zona horaria, ajustar para mantener la hora original
  return addGMT2Offset(date);
}

/**
 * Formatea una fecha para mostrar en la interfaz manteniendo la hora original
 */
export function formatDateTimeForDisplay(dateString: string | null | undefined): string {
  return formatDateTimeGMT2(dateString);
}

/**
 * Formatea solo la hora para mostrar
 */
export function formatTimeForDisplay(dateString: string | null | undefined): string {
  return formatTimeGMT2(dateString);
}
