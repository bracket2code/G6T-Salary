const LOCALE = 'es-ES';
const FIXED_TIMEZONE = 'Etc/GMT-2'; // GMT+2 independent of DST
export const GMT2_OFFSET_MINUTES = 120;

type DateInput = string | number | Date | null | undefined;

function parseDate(input: DateInput): Date | null {
  if (input === null || input === undefined) return null;
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatInGMT2(input: DateInput, options: Intl.DateTimeFormatOptions): string {
  const date = parseDate(input);
  if (!date) return 'N/A';

  try {
    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: FIXED_TIMEZONE,
      ...options,
    }).format(date);
  } catch (error) {
    console.error('Error formatting date with GMT+2:', error);
    return 'Fecha inválida';
  }
}

export function formatDateGMT2(input: DateInput): string {
  return formatInGMT2(input, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateLongGMT2(input: DateInput): string {
  return formatInGMT2(input, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTimeGMT2(input: DateInput): string {
  return formatInGMT2(input, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTimeGMT2(input: DateInput): string {
  return formatInGMT2(input, {
    hour: '2-digit',
    minute: '2-digit',
    second: undefined,
    hour12: false,
  });
}

export function formatTimeWithSecondsGMT2(input: DateInput): string {
  return formatInGMT2(input, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function addGMT2Offset(date: Date): Date {
  return new Date(date.getTime() + GMT2_OFFSET_MINUTES * 60 * 1000);
}

export function formatForDateTimeInputGMT2(input: DateInput): string {
  const date = parseDate(input);
  if (!date) return '';

  const adjusted = addGMT2Offset(date);

  const year = adjusted.getUTCFullYear();
  const month = String(adjusted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getUTCDate()).padStart(2, '0');
  const hours = String(adjusted.getUTCHours()).padStart(2, '0');
  const minutes = String(adjusted.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function dateTimeInputToISOFromGMT2(inputValue: string): string {
  if (!inputValue) return '';

  const [datePart, timePart] = inputValue.split('T');
  if (!datePart || !timePart) return '';

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return '';
  }

  const utcMillis = Date.UTC(year, month - 1, day, hour - (GMT2_OFFSET_MINUTES / 60), minute);
  return new Date(utcMillis).toISOString();
}
