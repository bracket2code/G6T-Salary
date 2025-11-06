import { utils as XLSXUtils, writeFile as writeXLSXFile } from "xlsx-js-style";
import { formatLocalDateKey } from "../../lib/timezone";
import type {
  Assignment,
  AssignmentTotalsContext,
  DayDescriptor,
} from "../../types/hoursRegistry";
import type { Worker } from "../../types/salary";

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
  const workerTotals: Array<{
    dataStartRow: number;
    dataEndRow: number;
    totalRow: number;
    separatorRow?: number;
  }> = [];

  sheetRows.push(["CONTROL HORARIO POR EMPRESA"]);
  sheetRows.push([`Del ${rangeLabel}`]);
  sheetRows.push([]);
  const tableHeaderRowNumber = sheetRows.length + 1;
  sheetRows.push(["EMPLEADO", "UBICACIÓN", "HORAS", "€/HORA", "IMPORTE €"]);

  const sortedWorkers = Array.from(workerAggregates.values()).sort((a, b) =>
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

  const worksheet = XLSXUtils.aoa_to_sheet(sheetRows);
  const ensureCell = (address: string) => {
    const cell = (worksheet[address] ?? {
      t: "s",
      v: "",
    }) as Record<string, unknown>;
    worksheet[address] = cell as any;
    return cell;
  };
  const setCellFormula = (address: string, formula: string) => {
    const cell = (worksheet[address] ?? {}) as Record<string, unknown>;
    cell.f = formula;
    delete cell.v;
    delete cell.w;
    worksheet[address] = cell as any;
  };
  const applyCurrencyFormat = (address: string) => {
    const cell = (worksheet[address] ?? {}) as Record<string, unknown>;
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      numFmt: '"€"#,##0.00',
    };
    worksheet[address] = cell as any;
  };
  const applyCenterAlignment = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    const existingAlignment =
      (existingStyle.alignment as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      alignment: {
        ...existingAlignment,
        horizontal: "center",
        vertical: "center",
      },
    };
  };
  const applyLeftAlignment = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    const existingAlignment =
      (existingStyle.alignment as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      alignment: {
        ...existingAlignment,
        horizontal: "left",
        vertical: "center",
      },
    };
  };
  const applyHeaderTheme = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    const existingFont =
      (existingStyle.font as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      font: {
        ...existingFont,
        color: { rgb: "FFFFFFFF" },
        bold: true,
      },
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FF4F81BD" },
        bgColor: { rgb: "FF4F81BD" },
      },
    };
  };
  const applySeparatorFill = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FFD9D9D9" },
        bgColor: { rgb: "FFD9D9D9" },
      },
    };
  };
  const applyTotalHighlight = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FFE3ECF8" },
        bgColor: { rgb: "FFE3ECF8" },
      },
    };
  };
  const applyWorkerNameFill = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    const existingFont =
      (existingStyle.font as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      font: {
        ...existingFont,
        bold: true,
      },
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FFE3ECF8" },
        bgColor: { rgb: "FFE3ECF8" },
      },
    };
  };
  const applyBoldStyle = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    const existingFont =
      (existingStyle.font as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      font: {
        ...existingFont,
        bold: true,
      },
    };
  };
  const buildRange = (column: string, startRow: number, endRow: number) =>
    `${column}${startRow}:${column}${endRow}`;
  const buildAbsoluteRange = (
    column: string,
    startRow: number,
    endRow: number
  ) => `$${column}$${startRow}:$${column}$${endRow}`;
  const merges = worksheet["!merges"] ?? [];

  workerTotals.forEach(
    ({ dataStartRow, dataEndRow, totalRow, separatorRow }, index) => {
      if (dataEndRow < dataStartRow) {
        return;
      }
      const hoursRange = buildRange("C", dataStartRow, dataEndRow);
      const rateRange = buildRange("D", dataStartRow, dataEndRow);
      const amountRange = buildRange("E", dataStartRow, dataEndRow);
      for (
        let rowIndex = dataStartRow;
        rowIndex <= dataEndRow;
        rowIndex += 1
      ) {
        setCellFormula(
          `E${rowIndex}`,
          `IF(OR(C${rowIndex}="",D${rowIndex}=""),"",C${rowIndex}*D${rowIndex})`
        );
        applyCurrencyFormat(`E${rowIndex}`);
        applyCenterAlignment(`C${rowIndex}`);
        applyCenterAlignment(`D${rowIndex}`);
      }
      const amountWithRateExpr = `SUMIFS(${amountRange},${rateRange},"<>")`;
      const hoursWithRateExpr = `SUMIFS(${hoursRange},${rateRange},"<>")`;

      setCellFormula(`C${totalRow}`, `SUM(${hoursRange})`);
      setCellFormula(
        `D${totalRow}`,
        `IF(${hoursWithRateExpr}=0,"",ROUND(${amountWithRateExpr}/${hoursWithRateExpr},2))`
      );
      setCellFormula(
        `E${totalRow}`,
        `IF(${amountWithRateExpr}=0,"",${amountWithRateExpr})`
      );
      applyCurrencyFormat(`E${totalRow}`);
      applyCenterAlignment(`C${totalRow}`);
      applyCenterAlignment(`D${totalRow}`);
      applyBoldStyle(`B${totalRow}`);
      ["A", "B", "C", "D", "E"].forEach((column) =>
        applyTotalHighlight(`${column}${totalRow}`)
      );
      if (totalRow > dataStartRow) {
        merges.push({
          s: { r: dataStartRow - 1, c: 0 },
          e: { r: totalRow - 1, c: 0 },
        });
        applyLeftAlignment(`A${dataStartRow}`);
        applyWorkerNameFill(`A${dataStartRow}`);
      }
      if (separatorRow && index < workerTotals.length - 1) {
        ["A", "B", "C", "D", "E"].forEach((column) =>
          applySeparatorFill(`${column}${separatorRow}`)
        );
      }
    }
  );

  const tableDataStartRow = tableHeaderRowNumber + 1;
  const tableDataEndRow = tableLastDataRowNumber;
  ["A", "B", "C", "D", "E"].forEach((column) =>
    applyHeaderTheme(`${column}${tableHeaderRowNumber}`)
  );
  applyLeftAlignment(`C${tableHeaderRowNumber}`);
  applyLeftAlignment(`D${tableHeaderRowNumber}`);
  if (tableDataEndRow >= tableDataStartRow) {
    const companyRangeAbs = buildAbsoluteRange(
      "B",
      tableDataStartRow,
      tableDataEndRow
    );
    const hoursRangeAbs = buildAbsoluteRange(
      "C",
      tableDataStartRow,
      tableDataEndRow
    );
    const rateRangeAbs = buildAbsoluteRange(
      "D",
      tableDataStartRow,
      tableDataEndRow
    );
    const amountRangeAbs = buildAbsoluteRange(
      "E",
      tableDataStartRow,
      tableDataEndRow
    );

    const summaryTitleRow = 4;
    const summaryHeaderRow = summaryTitleRow + 1;
    const summaryDataStartRow = summaryHeaderRow + 1;

    const summaryHeaderColumns = ["H", "I", "J", "K"] as const;
    summaryHeaderColumns.forEach((column) => {
      applyHeaderTheme(`${column}${summaryTitleRow}`);
      applyHeaderTheme(`${column}${summaryHeaderRow}`);
    });

    const summaryHeaders = [
      "UBICACIÓN",
      "TOTAL HORAS",
      "€/HORA MEDIO",
      "TOTAL IMPORTE €",
    ] as const;
    summaryHeaders.forEach((header, index) => {
      const column = summaryHeaderColumns[index];
      const headerCell = ensureCell(`${column}${summaryHeaderRow}`);
      headerCell.t = "s";
      headerCell.v = header;
      if (column === "I" || column === "J") {
        applyLeftAlignment(`${column}${summaryHeaderRow}`);
      } else {
        applyCenterAlignment(`${column}${summaryHeaderRow}`);
      }
    });

    const summaryTitleCell = ensureCell(`H${summaryTitleRow}`);
    summaryTitleCell.t = "s";
    summaryTitleCell.v = "RESUMEN GENERAL";
    const summaryTitleExistingStyle =
      (summaryTitleCell.s as Record<string, unknown> | undefined) ?? {};
    const summaryTitleFont =
      (summaryTitleExistingStyle.font as
        | Record<string, unknown>
        | undefined) ?? {};
    const summaryTitleAlignment =
      (summaryTitleExistingStyle.alignment as
        | Record<string, unknown>
        | undefined) ?? {};
    summaryTitleCell.s = {
      ...summaryTitleExistingStyle,
      font: {
        ...summaryTitleFont,
        bold: true,
        sz: 16,
      },
      alignment: {
        ...summaryTitleAlignment,
        horizontal: "center",
      },
    };
    merges.push({
      s: { r: summaryTitleRow - 1, c: 7 },
      e: { r: summaryTitleRow - 1, c: 10 },
    });
    worksheet["!merges"] = merges;

    summaryCompanies.forEach((companyName, index) => {
      const rowNumber = summaryDataStartRow + index;
      const escapedCompanyName = companyName.replace(/"/g, '""');
      const companyCell = ensureCell(`H${rowNumber}`);
      companyCell.t = "s";
      companyCell.v = companyName;

      const hoursSumExpr = `SUMIFS(${hoursRangeAbs},${companyRangeAbs},"${escapedCompanyName}")`;
      const amountSumExpr = `SUMIFS(${amountRangeAbs},${companyRangeAbs},"${escapedCompanyName}",${rateRangeAbs},"<>")`;
      const hoursWithRateExpr = `SUMIFS(${hoursRangeAbs},${companyRangeAbs},"${escapedCompanyName}",${rateRangeAbs},"<>")`;

      setCellFormula(`I${rowNumber}`, `${hoursSumExpr}`);
      setCellFormula(
        `J${rowNumber}`,
        `IF(${hoursWithRateExpr}=0,"",ROUND(${amountSumExpr}/${hoursWithRateExpr},2))`
      );
      setCellFormula(
        `K${rowNumber}`,
        `IF(${amountSumExpr}=0,"",${amountSumExpr})`
      );
      applyCenterAlignment(`I${rowNumber}`);
      applyCenterAlignment(`J${rowNumber}`);
      applyCurrencyFormat(`K${rowNumber}`);
    });

    const summaryTotalRow = summaryDataStartRow + summaryCompanies.length;
    const totalLabelCell = ensureCell(`H${summaryTotalRow}`);
    totalLabelCell.t = "s";
    totalLabelCell.v = "TOTAL GENERAL";
    applyBoldStyle(`H${summaryTotalRow}`);
    applyTotalHighlight(`H${summaryTotalRow}`);

    const totalHoursExpr = `SUMIFS(${hoursRangeAbs},${companyRangeAbs},"<>TOTAL",${companyRangeAbs},"<>")`;
    const totalAmountExpr = `SUMIFS(${amountRangeAbs},${rateRangeAbs},"<>")`;
    const totalHoursWithRateExpr = `SUMIFS(${hoursRangeAbs},${rateRangeAbs},"<>")`;

    setCellFormula(`I${summaryTotalRow}`, `${totalHoursExpr}`);
    setCellFormula(
      `J${summaryTotalRow}`,
      `IF(${totalHoursWithRateExpr}=0,"",ROUND(${totalAmountExpr}/${totalHoursWithRateExpr},2))`
    );
    setCellFormula(
      `K${summaryTotalRow}`,
      `IF(${totalAmountExpr}=0,"",${totalAmountExpr})`
    );
    ["I", "J", "K"].forEach((column) => {
      applyBoldStyle(`${column}${summaryTotalRow}`);
      applyCenterAlignment(`${column}${summaryTotalRow}`);
      applyTotalHighlight(`${column}${summaryTotalRow}`);
    });
    applyCurrencyFormat(`K${summaryTotalRow}`);
  }

  worksheet["!autofilter"] = {
    ref: `A${tableHeaderRowNumber}:E${tableLastDataRowNumber}`,
  };
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 2 },
    { wch: 2 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
  ];
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } });
  worksheet["!merges"] = merges;

  const titleStyle = {
    font: { sz: 24, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  } as const;
  ["A1", "B1", "C1", "D1", "E1"].forEach((cell) => {
    ensureCell(cell).s = { ...titleStyle };
  });

  const subtitleStyle = {
    font: { sz: 18 },
    alignment: { horizontal: "center", vertical: "center" },
  } as const;
  ["A2", "B2", "C2", "D2", "E2"].forEach((cell) => {
    ensureCell(cell).s = { ...subtitleStyle };
  });

  worksheet["!rows"] = worksheet["!rows"] ?? [];
  worksheet["!rows"][0] = { hpt: 36 };
  worksheet["!rows"][1] = { hpt: 28 };

  const workbook = XLSXUtils.book_new();
  XLSXUtils.book_append_sheet(workbook, worksheet, "Resumen");

  const fileName = `control-horario-${formatLocalDateKey(
    selectedRange.start
  )}-al-${formatLocalDateKey(selectedRange.end)}.xlsx`;

  writeXLSXFile(workbook, fileName, { cellStyles: true });
};
