import { utils as XLSXUtils, writeFile as writeXLSXFile } from "xlsx-js-style";
import { formatLocalDateKey } from "../../lib/timezone";
import { extractShiftDescription } from "../../lib/segmentDescriptions";
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
    candidate = `${normalizedBase.slice(
      0,
      Math.max(maxBaseLength, 0)
    )}${suffixLabel}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

const buildCompanyIdentityKey = (
  companyId?: string | null,
  companyName?: string | null
) => {
  const normalizedId = companyId ? companyId.trim().toLowerCase() : "";
  const normalizedName = companyName ? companyName.trim().toLowerCase() : "";
  if (!normalizedId && !normalizedName) {
    return "__unknown__";
  }
  return `${normalizedId}::${normalizedName}`;
};

type WorkerHourlyRateLookup = Map<string, Map<string, number>>;

const ensureWorkerRateMap = (
  lookup: WorkerHourlyRateLookup,
  workerId: string
) => {
  if (!lookup.has(workerId)) {
    lookup.set(workerId, new Map());
  }
  return lookup.get(workerId)!;
};

const registerWorkerHourlyRate = (
  lookup: WorkerHourlyRateLookup,
  workerId: string,
  companyId?: string | null,
  companyName?: string | null,
  hourlyRate?: number | null
) => {
  if (hourlyRate === undefined || hourlyRate === null) {
    return;
  }
  if (!Number.isFinite(hourlyRate)) {
    return;
  }
  const rateMap = ensureWorkerRateMap(lookup, workerId);
  const keys = new Set<string>();
  keys.add(buildCompanyIdentityKey(companyId, companyName));
  if (companyId) {
    keys.add(buildCompanyIdentityKey(companyId, null));
  }
  if (companyName) {
    keys.add(buildCompanyIdentityKey(null, companyName));
  }
  keys.forEach((key) => rateMap.set(key, hourlyRate));
};

const resolveWorkerHourlyRate = (
  workerRateMap: Map<string, number> | undefined,
  companyId?: string | null,
  companyName?: string | null
): number | null => {
  if (!workerRateMap) {
    return null;
  }
  const candidates = [
    buildCompanyIdentityKey(companyId, companyName),
    companyId ? buildCompanyIdentityKey(companyId, null) : null,
    companyName ? buildCompanyIdentityKey(null, companyName) : null,
  ];
  for (const key of candidates) {
    if (!key) {
      continue;
    }
    const rate = workerRateMap.get(key);
    if (typeof rate === "number" && Number.isFinite(rate)) {
      return rate;
    }
  }
  return null;
};

const buildWorkerDailyRows = (
  workerId: string,
  visibleDays: DayDescriptor[],
  workerWeekData: AssignmentTotalsContext["workerWeekData"],
  roundToDecimals: RoundToDecimalsFn,
  workerHourlyRates: WorkerHourlyRateLookup
): WorkerDailyRow[] => {
  const dayRecords = workerWeekData[workerId]?.days ?? {};
  const dayRows = visibleDays.flatMap((day) => {
    const dayData = dayRecords[day.dateKey];
    const notes = collectDayNotes(dayData);
    const dateLabel = workerSheetDateFormatter.format(day.date).toUpperCase();
    const dayLabel = (day.label ?? "").toUpperCase();
    const toUpper = (value: string | null | undefined) =>
      value ? value.toUpperCase() : null;

    const rows: WorkerDailyRow[] = [];
    const workerRateMap = workerHourlyRates.get(workerId);
    const coveredCompanyKeys = new Set<string>();
    let pendingNotes = toUpper(notes);
    const takeNotesValue = () => {
      if (pendingNotes) {
        const value = pendingNotes;
        pendingNotes = null;
        return value;
      }
      return null;
    };

    const registerCompanyCoverage = (
      companyId?: string | null,
      companyName?: string | null
    ) => {
      coveredCompanyKeys.add(buildCompanyIdentityKey(companyId, companyName));
    };

    const pushRow = (params: {
      companyId?: string | null;
      companyName?: string | null;
      entryTime?: string | null;
      exitTime?: string | null;
      totalHours?: number | null;
      notes?: string | null;
      description?: string | null;
      isNotesOnly?: boolean;
    }) => {
      const resolvedNotes =
        params.notes !== undefined
          ? params.notes
          : rows.length === 0
          ? takeNotesValue()
          : null;
      const descriptionText = toUpper(params.description ?? null);
      const normalizedHours =
        typeof params.totalHours === "number" &&
        Number.isFinite(params.totalHours)
          ? roundToDecimals(params.totalHours)
          : null;
      const hourlyRate = resolveWorkerHourlyRate(
        workerRateMap,
        params.companyId,
        params.companyName
      );
      const amount =
        normalizedHours !== null && hourlyRate !== null
          ? roundToDecimals(normalizedHours * hourlyRate)
          : null;
      const combinedNotes = [resolvedNotes, descriptionText]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(" | ");

      rows.push({
        dateLabel,
        dayLabel,
        companyName: (params.companyName ?? "SIN EMPRESA").toUpperCase(),
        entryTime: toUpper(params.entryTime),
        exitTime: toUpper(params.exitTime),
        totalHours: normalizedHours,
        amount,
        notes: combinedNotes ? combinedNotes : null,
        isNotesOnly: Boolean(params.isNotesOnly),
      });
    };

    const buildShiftHours = (shift: {
      hours?: number | null;
      startTime?: string | null;
      endTime?: string | null;
    }): number | null => {
      if (typeof shift.hours === "number" && Number.isFinite(shift.hours)) {
        return roundToDecimals(shift.hours);
      }
      const startMinutes = parseTimeToMinutes(shift.startTime);
      const endMinutes = parseTimeToMinutes(shift.endTime);
      if (
        startMinutes !== null &&
        endMinutes !== null &&
        endMinutes >= startMinutes
      ) {
        return roundToDecimals((endMinutes - startMinutes) / 60);
      }
      return null;
    };

    const companyEntries = dayData?.entries ?? [];
    companyEntries.forEach((entry) => {
      registerCompanyCoverage(entry.companyId, entry.companyName);
      const companyLabel =
        entry.companyName ?? entry.companyId ?? "SIN EMPRESA";

      if (Array.isArray(entry.workShifts) && entry.workShifts.length > 0) {
        entry.workShifts.forEach((shift) => {
          pushRow({
            companyId: entry.companyId ?? null,
            companyName: companyLabel,
            entryTime: shift.startTime ?? null,
            exitTime: shift.endTime ?? null,
            totalHours: buildShiftHours(shift),
            description:
              extractShiftDescription(shift, entry.description ?? undefined) ??
              entry.description ??
              null,
          });
        });
        return;
      }

      pushRow({
        companyId: entry.companyId ?? null,
        companyName: companyLabel,
        entryTime: null,
        exitTime: null,
        totalHours:
          typeof entry.hours === "number" && Number.isFinite(entry.hours)
            ? roundToDecimals(entry.hours)
            : null,
        description: entry.description ?? null,
      });
    });

    const companyHourRecords = Object.values(dayData?.companyHours ?? {});
    const uniqueCompanyRecords = new Map<
      string,
      WorkerWeeklyDayData["companyHours"][string]
    >();
    companyHourRecords.forEach((record) => {
      const key = buildCompanyIdentityKey(record?.companyId, record?.name);
      if (!uniqueCompanyRecords.has(key)) {
        uniqueCompanyRecords.set(key, record);
      }
    });

    uniqueCompanyRecords.forEach((record, key) => {
      if (coveredCompanyKeys.has(key)) {
        return;
      }
      const hours =
        typeof record?.hours === "number" && Number.isFinite(record.hours)
          ? roundToDecimals(record.hours)
          : null;
      if (hours === null || hours === 0) {
        return;
      }
      const companyLabel = record?.name ?? record?.companyId ?? "SIN EMPRESA";
      pushRow({
        companyId: record?.companyId,
        companyName: companyLabel,
        entryTime: null,
        exitTime: null,
        totalHours: hours,
      });
      registerCompanyCoverage(record?.companyId, record?.name);
    });

    if (!rows.length && pendingNotes) {
      rows.push({
        dateLabel,
        dayLabel,
        companyName: "NOTAS",
        entryTime: null,
        exitTime: null,
        totalHours: null,
        amount: null,
        notes: pendingNotes,
        isNotesOnly: true,
      });
      pendingNotes = null;
    } else if (pendingNotes && rows.length > 0) {
      rows[0].notes = rows[0].notes ?? pendingNotes;
      pendingNotes = null;
    }

    return rows;
  });
  const parseSortableTime = (value?: string | null) => {
    if (!value) {
      return Number.MAX_SAFE_INTEGER;
    }
    const match = value.match(timeValuePattern);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      return hours * 60 + minutes;
    }
    return Number.MAX_SAFE_INTEGER;
  };
  const parseSortableDate = (value: string) => {
    const [day, month, year] = value.split("/");
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  };
  return dayRows.sort((a, b) => {
    const dateDiff =
      parseSortableDate(a.dateLabel) - parseSortableDate(b.dateLabel);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    const timeDiff =
      parseSortableTime(a.entryTime) - parseSortableTime(b.entryTime);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return (a.companyName ?? "").localeCompare(b.companyName ?? "", "es", {
      sensitivity: "base",
    });
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

  const workerHourlyRates: WorkerHourlyRateLookup = new Map();

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
    const totalHours = calculateRowTotal(
      assignment,
      totalsContext,
      visibleDays
    );

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

    registerWorkerHourlyRate(
      workerHourlyRates,
      assignment.workerId,
      assignment.companyId,
      assignment.companyName,
      hourlyRate
    );

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

  sheetRows.push(["INFORME CONTROL HORARIO"]);
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
    for (
      let index = sheetRows.length;
      index > tableHeaderRowNumber;
      index -= 1
    ) {
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
    .filter((company) => Math.abs(company.totalHours) >= hoursComparisonEpsilon)
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
  const summarySheetName = buildUniqueSheetName("RESUMEN", usedSheetNames);
  XLSXUtils.book_append_sheet(workbook, worksheet, summarySheetName);

  const workerWeekData = totalsContext.workerWeekData ?? {};
  sortedWorkers.forEach((worker) => {
    const dailyRows = buildWorkerDailyRows(
      worker.workerId,
      visibleDays,
      workerWeekData,
      roundToDecimals,
      workerHourlyRates
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
