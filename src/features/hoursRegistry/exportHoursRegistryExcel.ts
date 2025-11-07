import { utils as XLSXUtils, writeFile as writeXLSXFile } from "xlsx-js-style";
import { formatLocalDateKey } from "../../lib/timezone";
import type {
  Assignment,
  AssignmentTotalsContext,
  DayDescriptor,
  WorkerWeeklyDayData,
} from "../../types/hoursRegistry";
import type { Worker } from "../../types/salary";
import {
  buildDefaultHoursRegistryWorksheet,
  buildWorkerDailyWorksheet,
  type WorkerDailyRow,
  type WorkerTotalsRange,
} from "./templates/HoursRegistryTemplate";

type CalculateRowTotalFn = (
  assignment: Assignment,
  context: AssignmentTotalsContext,
  dayDescriptors: DayDescriptor[]
) => number;

type ResolveHourlyRateFromWorkerFn = (
  worker: Worker | undefined,
  assignment: Assignment,
  companyLookup: Record<string, string>
) => number | undefined;

type NormalizeKeyFn = (value?: string | null) => string | null;

type RoundToDecimalsFn = (value: number, decimals?: number) => number;

interface ExportDependencies {
  calculateRowTotal: CalculateRowTotalFn;
  resolveHourlyRateFromWorker: ResolveHourlyRateFromWorkerFn;
  normalizeKeyPart: NormalizeKeyFn;
  normalizeCompanyLabel: NormalizeKeyFn;
  roundToDecimals: RoundToDecimalsFn;
}

interface ExportHoursRegistryExcelParams {
  assignments: Assignment[];
  totalsContext: AssignmentTotalsContext;
  visibleDays: DayDescriptor[];
  workerLookupById: Record<string, Worker | undefined>;
  workerNameById: Record<string, string>;
  companyLookupMap: Record<string, string>;
  selectedRange: { start: Date; end: Date };
  rangeLabel: string;
  hoursComparisonEpsilon: number;
  dependencies: ExportDependencies;
}

const workerSheetDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeValuePattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const parseTimeToMinutes = (value?: string | null): number | null => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(timeValuePattern);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getHours() * 60 + parsed.getMinutes();
  }

  return null;
};

const formatMinutesToTime = (minutes: number): string => {
  const normalized = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const resolveShiftBoundaries = (
  dayData?: WorkerWeeklyDayData
): { firstStart: string | null; lastEnd: string | null } => {
  if (!dayData?.entries?.length) {
    return { firstStart: null, lastEnd: null };
  }

  let earliest: number | null = null;
  let latest: number | null = null;

  dayData.entries.forEach((entry) => {
    entry.workShifts?.forEach((shift) => {
      const startMinutes = parseTimeToMinutes(shift.startTime);
      const endMinutes = parseTimeToMinutes(shift.endTime);
      if (startMinutes !== null) {
        earliest =
          earliest === null ? startMinutes : Math.min(earliest, startMinutes);
      }
      if (endMinutes !== null) {
        latest = latest === null ? endMinutes : Math.max(latest, endMinutes);
      }
    });
  });

  return {
    firstStart: earliest !== null ? formatMinutesToTime(earliest) : null,
    lastEnd: latest !== null ? formatMinutesToTime(latest) : null,
  };
};

const collectDayNotes = (dayData?: WorkerWeeklyDayData): string | null => {
  if (!dayData?.noteEntries?.length) {
    return null;
  }
  const texts = dayData.noteEntries
    .map((note) => note.text?.trim())
    .filter((text): text is string => Boolean(text && text.length > 0));
  if (!texts.length) {
    return null;
  }
  const uniqueTexts = Array.from(new Set(texts));
  return uniqueTexts.join(" | ");
};

const sanitizeSheetName = (value: string): string => {
  const restrictedChars = /[\\/?*[\]:]/g;
  const trimmed = value.replace(restrictedChars, " ").trim();
  return trimmed.slice(0, 31);
};

const buildUniqueSheetName = (
  baseName: string,
  usedNames: Set<string>
): string => {
  const fallback = "Trabajador";
  const sanitizedBase = sanitizeSheetName(baseName) || fallback;
  const normalizedBase = sanitizedBase || fallback;
  let candidate = normalizedBase.slice(0, 31);
  let suffix = 1;
  while (usedNames.has(candidate)) {
    const suffixLabel = ` (${suffix})`;
    const maxBaseLength = 31 - suffixLabel.length;
    candidate = `${normalizedBase.slice(0, Math.max(maxBaseLength, 0))}${suffixLabel}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

const buildWorkerDailyRows = (
  workerId: string,
  visibleDays: DayDescriptor[],
  workerWeekData: AssignmentTotalsContext["workerWeekData"],
  roundToDecimals: RoundToDecimalsFn
): WorkerDailyRow[] => {
  const dayRecords = workerWeekData[workerId]?.days ?? {};
  return visibleDays.map((day) => {
    const dayData = dayRecords[day.dateKey];
    const { firstStart, lastEnd } = resolveShiftBoundaries(dayData);
    const notes = collectDayNotes(dayData);
    const totalHours =
      dayData && Number.isFinite(dayData.totalHours)
        ? roundToDecimals(dayData.totalHours)
        : null;

    const toUpper = (value: string | null) =>
      value ? value.toUpperCase() : value;

    return {
      dateLabel: workerSheetDateFormatter.format(day.date).toUpperCase(),
      dayLabel: toUpper(day.label) ?? "",
      entryTime: toUpper(firstStart),
      exitTime: toUpper(lastEnd),
      totalHours,
      notes: toUpper(notes),
    };
  });
};
export const exportHoursRegistryExcel = ({
  assignments,
  totalsContext,
  visibleDays,
  workerLookupById,
  workerNameById,
  companyLookupMap,
  selectedRange,
  rangeLabel,
  hoursComparisonEpsilon,
  dependencies,
}: ExportHoursRegistryExcelParams) => {
  const {
    calculateRowTotal,
    resolveHourlyRateFromWorker,
    normalizeKeyPart,
    normalizeCompanyLabel,
    roundToDecimals,
  } = dependencies;

  const workerAggregates = new Map<
    string,
    {
      workerName: string;
      rows: Array<{
        companyName: string;
        hours: number;
        hourlyRate?: number;
        amount?: number;
      }>;
      totalHours: number;
      totalAmount: number;
      hoursWithRate: number;
    }
  >();

  const companyAggregates = new Map<
    string,
    {
      companyName: string;
      totalHours: number;
      totalAmount: number;
      hoursWithRate: number;
    }
  >();

  assignments.forEach((assignment) => {
    const workerName =
      workerNameById[assignment.workerId] ?? assignment.workerName;
    const totalHours = calculateRowTotal(assignment, totalsContext, visibleDays);

    const hourlyRate = resolveHourlyRateFromWorker(
      workerLookupById[assignment.workerId],
      assignment,
      companyLookupMap
    );

    const amount =
      hourlyRate !== undefined ? totalHours * hourlyRate : undefined;

    if (!workerAggregates.has(assignment.workerId)) {
      workerAggregates.set(assignment.workerId, {
        workerName,
        rows: [],
        totalHours: 0,
        totalAmount: 0,
        hoursWithRate: 0,
      });
    }

    const workerEntry = workerAggregates.get(assignment.workerId)!;
    workerEntry.rows.push({
      companyName: assignment.companyName,
      hours: totalHours,
      hourlyRate,
      amount,
    });
    workerEntry.totalHours += totalHours;
    if (amount !== undefined && hourlyRate !== undefined) {
      workerEntry.totalAmount += amount;
      workerEntry.hoursWithRate += totalHours;
    }

    const companyKey =
      normalizeKeyPart(assignment.companyId) ??
      normalizeCompanyLabel(assignment.companyName) ??
      assignment.companyName;

    if (!companyAggregates.has(companyKey)) {
      companyAggregates.set(companyKey, {
        companyName: assignment.companyName,
        totalHours: 0,
        totalAmount: 0,
        hoursWithRate: 0,
      });
    }

    const companyEntry = companyAggregates.get(companyKey)!;
    if (!companyEntry.companyName && assignment.companyName) {
      companyEntry.companyName = assignment.companyName;
    }
    companyEntry.totalHours += totalHours;
    if (amount !== undefined && hourlyRate !== undefined) {
      companyEntry.totalAmount += amount;
      companyEntry.hoursWithRate += totalHours;
    }
  });

  if (workerAggregates.size === 0) {
    throw new Error("No hay datos para exportar en el rango seleccionado.");
  }

  const sheetRows: Array<Array<string | number | null>> = [];
  const workerTotals: WorkerTotalsRange[] = [];

  sheetRows.push(["CONTROL HORARIO POR EMPRESA"]);
  sheetRows.push([`Del ${rangeLabel}`]);
  sheetRows.push([]);
  const tableHeaderRowNumber = sheetRows.length + 1;
  sheetRows.push(["EMPLEADO", "UBICACIÓN", "HORAS", "€/HORA", "IMPORTE €"]);

  const sortedWorkers = Array.from(workerAggregates.entries())
    .map(([workerId, aggregate]) => ({
      workerId,
      ...aggregate,
    }))
    .sort((a, b) =>
      a.workerName.localeCompare(b.workerName, "es", {
        sensitivity: "base",
      })
    );

  sortedWorkers.forEach((worker) => {
    const rowsWithHours = worker.rows
      .filter((row) => Math.abs(row.hours) >= hoursComparisonEpsilon)
      .sort((a, b) =>
        a.companyName.localeCompare(b.companyName, "es", {
          sensitivity: "base",
        })
      );

    if (rowsWithHours.length === 0) {
      return;
    }

    const workerDataStartRow = sheetRows.length + 1;

    rowsWithHours.forEach((row, index) => {
      sheetRows.push([
        index === 0 ? worker.workerName : "",
        row.companyName,
        roundToDecimals(row.hours),
        row.hourlyRate !== undefined ? roundToDecimals(row.hourlyRate) : null,
        null,
      ]);
    });

    const workerDataEndRow = sheetRows.length;
    const workerTotalRow = sheetRows.length + 1;

    sheetRows.push(["", "TOTAL", null, null, null]);
    sheetRows.push([]);
    const separatorRowNumber = sheetRows.length;

    workerTotals.push({
      dataStartRow: workerDataStartRow,
      dataEndRow: workerDataEndRow,
      totalRow: workerTotalRow,
      separatorRow: separatorRowNumber,
    });
  });

  const tableLastDataRowNumber = (() => {
    for (let index = sheetRows.length; index > tableHeaderRowNumber; index -= 1) {
      const row = sheetRows[index - 1];
      const hasValue = row.some((value) => {
        if (value === null || value === undefined) {
          return false;
        }
        if (typeof value === "number") {
          return true;
        }
        return String(value).trim().length > 0;
      });
      if (hasValue) {
        return index;
      }
    }
    return tableHeaderRowNumber;
  })();

  const sortedCompanies = Array.from(companyAggregates.values())
    .filter(
      (company) => Math.abs(company.totalHours) >= hoursComparisonEpsilon
    )
    .sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "es", {
        sensitivity: "base",
      })
    );

  const summaryCompanies = sortedCompanies.map(
    (company) => company.companyName
  );

  const worksheet = buildDefaultHoursRegistryWorksheet({
    sheetRows,
    workerTotals,
    tableHeaderRowNumber,
    tableLastDataRowNumber,
    summaryCompanies,
  });

  const workbook = XLSXUtils.book_new();
  const usedSheetNames = new Set<string>();
  const summarySheetName = buildUniqueSheetName("Resumen", usedSheetNames);
  XLSXUtils.book_append_sheet(workbook, worksheet, summarySheetName);

  const workerWeekData = totalsContext.workerWeekData ?? {};
  sortedWorkers.forEach((worker) => {
    const dailyRows = buildWorkerDailyRows(
      worker.workerId,
      visibleDays,
      workerWeekData,
      roundToDecimals
    );
    const hasTrackedHours = dailyRows.some(
      (row) =>
        typeof row.totalHours === "number" &&
        Math.abs(row.totalHours) >= hoursComparisonEpsilon
    );
    const hasNotes = dailyRows.some(
      (row) => typeof row.notes === "string" && row.notes.trim().length > 0
    );
    if (!hasTrackedHours && !hasNotes) {
      return;
    }
    const workerWorksheet = buildWorkerDailyWorksheet({
      workerName: worker.workerName,
      rangeLabel,
      rows: dailyRows,
    });
    const sheetName = buildUniqueSheetName(worker.workerName, usedSheetNames);
    XLSXUtils.book_append_sheet(workbook, workerWorksheet, sheetName);
  });

  const fileName = `control-horario-${formatLocalDateKey(
    selectedRange.start
  )}-al-${formatLocalDateKey(selectedRange.end)}.xlsx`;

  writeXLSXFile(workbook, fileName, { cellStyles: true });
};
