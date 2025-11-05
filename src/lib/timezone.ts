import { addMinutes, format, parseISO, subMinutes } from "date-fns";
import { es } from "date-fns/locale";

export const FIXED_TIMEZONE_OFFSET_MINUTES = -120;

const formatWithPattern = (
  value: string | Date | null | undefined,
  pattern: string,
  errorLabel: string
): string => {
  if (!value) {
    return "-";
  }

  try {
    const date =
      typeof value === "string"
        ? parseISO(value)
        : value instanceof Date
        ? new Date(value)
        : null;
    if (!date || Number.isNaN(date.getTime())) {
      return "-";
    }
    return format(date, pattern, { locale: es });
  } catch (error) {
    console.error(`Error formatting ${errorLabel}:`, error);
    return "-";
  }
};

export function formatDateLongGMT2(dateString: string | null | undefined): string {
  return formatWithPattern(dateString, "dd/MM/yyyy", "date");
}

export function formatDateTimeGMT2(dateString: string | null | undefined): string {
  return formatWithPattern(dateString, "dd/MM/yyyy HH:mm", "datetime");
}

export function formatTimeGMT2(dateString: string | null | undefined): string {
  return formatWithPattern(dateString, "HH:mm", "time");
}

export function toUtcFromLocal(date: Date): Date {
  return addMinutes(date, FIXED_TIMEZONE_OFFSET_MINUTES);
}

export function toLocalFromUtc(date: Date): Date {
  return subMinutes(date, FIXED_TIMEZONE_OFFSET_MINUTES);
}

export function formatLocalDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const formatDateToUtcString = (date: Date): string => {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+00:00`;
};

const buildUtcDateFromKey = (dateKey?: string | null): Date => {
  const today = new Date();
  const fallback = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0)
  );

  if (typeof dateKey !== "string") {
    return fallback;
  }

  const normalized = dateKey.trim();
  if (!normalized) {
    return fallback;
  }

  const [yearPart, monthPart, dayPart] = normalized.split("-");
  const parsedYear = Number(yearPart);
  const parsedMonth = Number(monthPart);
  const parsedDay = Number(dayPart);

  if (
    Number.isFinite(parsedYear) &&
    Number.isFinite(parsedMonth) &&
    Number.isFinite(parsedDay)
  ) {
    return new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay, 0, 0, 0));
  }

  return fallback;
};

export function formatDateKeyToApiDateTime(dateKey?: string | null): string {
  const baseDate = buildUtcDateFromKey(dateKey);
  const adjusted = toLocalFromUtc(baseDate); // ensures +2h when serializing
  return formatDateToUtcString(adjusted);
}
