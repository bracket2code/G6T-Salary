import type { HourSegment } from "../types/hourSegment";

export const hoursFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const parseTimeToMinutes = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23) {
    return null;
  }

  if (minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

export const calculateSegmentsTotalMinutes = (
  segments: HourSegment[]
): number =>
  segments.reduce((total, segment) => {
    const start = parseTimeToMinutes(segment.start);
    const end = parseTimeToMinutes(segment.end);

    if (start === null || end === null || end <= start) {
      return total;
    }

    return total + (end - start);
  }, 0);

export const formatMinutesToHoursLabel = (totalMinutes: number): string => {
  if (totalMinutes <= 0) {
    return "0";
  }

  const hours = totalMinutes / 60;
  return hoursFormatter.format(hours);
};

export const toInputNumberString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return hoursFormatter.format(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
};

