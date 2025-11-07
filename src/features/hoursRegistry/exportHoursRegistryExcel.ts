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
  let companySummaryLastRow: number | null = null;
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
  const applyCompanySummaryTitleTheme = (address: string) => {
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
        sz: 16,
      },
      alignment: {
        horizontal: "center",
        vertical: "center",
      },
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FFB85450" },
        bgColor: { rgb: "FFB85450" },
      },
    };
  };
  const applyCompanySummaryHeaderTheme = (address: string) => {
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
      alignment: {
        horizontal: "center",
        vertical: "center",
      },
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FFC0504D" },
        bgColor: { rgb: "FFC0504D" },
      },
    };
  };
  const applyCompanySummaryRowFill = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FFF2DCDB" },
        bgColor: { rgb: "FFF2DCDB" },
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

    const companySummaryTitleRow = 4;
    const companySummaryHeaderRow = companySummaryTitleRow + 1;
    const companySummaryDataStartRow = companySummaryHeaderRow + 1;
    const companySummaryColumns = ["H", "I"] as const;

    companySummaryColumns.forEach((column) => {
      applyCompanySummaryHeaderTheme(`${column}${companySummaryHeaderRow}`);
    });

    companySummaryColumns.forEach((column, index) => {
      const headerCell = ensureCell(`${column}${companySummaryHeaderRow}`);
      headerCell.t = "s";
      headerCell.v = index === 0 ? "EMPRESAS" : "IMPORTES";
    });

    companySummaryColumns.forEach((column) => {
      applyCompanySummaryTitleTheme(`${column}${companySummaryTitleRow}`);
    });
    const companySummaryTitleCell = ensureCell(
      `${companySummaryColumns[0]}${companySummaryTitleRow}`
    );
    companySummaryTitleCell.t = "s";
    companySummaryTitleCell.v = "TOTAL POR EMPRESAS";
    merges.push({
      s: { r: companySummaryTitleRow - 1, c: 7 },
      e: { r: companySummaryTitleRow - 1, c: 8 },
    });

    summaryCompanies.forEach((companyName, index) => {
      const rowNumber = companySummaryDataStartRow + index;
      const escapedCompanyName = companyName.replace(/"/g, '""');
      const companyCell = ensureCell(`H${rowNumber}`);
      companyCell.t = "s";
      companyCell.v = companyName;
      applyCompanySummaryRowFill(`H${rowNumber}`);
      applyCompanySummaryRowFill(`I${rowNumber}`);
      applyLeftAlignment(`H${rowNumber}`);

      const amountSumExpr = `SUMIFS(${amountRangeAbs},${companyRangeAbs},"${escapedCompanyName}",${rateRangeAbs},"<>")`;
      setCellFormula(`I${rowNumber}`, `IF(${amountSumExpr}=0,"",${amountSumExpr})`);
      applyCurrencyFormat(`I${rowNumber}`);
    });

    const companySummaryTotalRow =
      companySummaryDataStartRow + summaryCompanies.length;
    const companyTotalLabelCell = ensureCell(`H${companySummaryTotalRow}`);
    companyTotalLabelCell.t = "s";
    companyTotalLabelCell.v = "TOTAL";
    applyBoldStyle(`H${companySummaryTotalRow}`);
    applyCompanySummaryRowFill(`H${companySummaryTotalRow}`);
    applyCompanySummaryRowFill(`I${companySummaryTotalRow}`);
    const companyAmountSummaryRange = buildRange(
      "I",
      companySummaryDataStartRow,
      Math.max(companySummaryDataStartRow, companySummaryTotalRow - 1)
    );
    setCellFormula(
      `I${companySummaryTotalRow}`,
      summaryCompanies.length === 0
        ? '""'
        : `IF(SUM(${companyAmountSummaryRange})=0,"",SUM(${companyAmountSummaryRange}))`
    );
    applyCurrencyFormat(`I${companySummaryTotalRow}`);
    applyBoldStyle(`I${companySummaryTotalRow}`);
    companySummaryLastRow = companySummaryTotalRow;
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

  const lastUsedRow =
    Math.max(tableLastDataRowNumber, companySummaryLastRow ?? 0) ||
    tableLastDataRowNumber;
  const lastUsedColumn = summaryCompanies.length > 0 ? 8 : 4;
  worksheet["!ref"] = XLSXUtils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(lastUsedRow - 1, 0), c: lastUsedColumn },
  });

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
