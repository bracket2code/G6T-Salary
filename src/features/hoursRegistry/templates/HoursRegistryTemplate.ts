import { utils as XLSXUtils } from "xlsx-js-style";

export interface WorkerDailyRow {
  dateLabel: string;
  dayLabel: string;
  companyName: string;
  entryTime: string | null;
  exitTime: string | null;
  totalHours: number | null;
  amount: number | null;
  notes: string | null;
}

interface BuildWorkerDailyWorksheetParams {
  workerName: string;
  rangeLabel: string;
  rows: WorkerDailyRow[];
}

export interface WorkerTotalsRange {
  dataStartRow: number;
  dataEndRow: number;
  totalRow: number;
  separatorRow?: number;
}

interface BuildHoursRegistryWorksheetParams {
  sheetRows: Array<Array<string | number | null>>;
  workerTotals: WorkerTotalsRange[];
  tableHeaderRowNumber: number;
  tableLastDataRowNumber: number;
  summaryCompanies: string[];
}

export const buildDefaultHoursRegistryWorksheet = ({
  sheetRows,
  workerTotals,
  tableHeaderRowNumber,
  tableLastDataRowNumber,
  summaryCompanies,
}: BuildHoursRegistryWorksheetParams) => {
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
      numFmt: '#,##0.00 "€"',
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
      setCellFormula(
        `I${rowNumber}`,
        `IF(${amountSumExpr}=0,"",${amountSumExpr})`
      );
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

  const companySummaryRowsEnd = summaryCompanies.length
    ? 4 + 1 + summaryCompanies.length + 1
    : 0;
  const lastUsedRow =
    Math.max(tableLastDataRowNumber, companySummaryRowsEnd) ||
    tableLastDataRowNumber;
  const lastUsedColumn = summaryCompanies.length > 0 ? 8 : 4;
  worksheet["!ref"] = XLSXUtils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(lastUsedRow - 1, 0), c: lastUsedColumn },
  });

  return worksheet;
};

export const buildWorkerDailyWorksheet = ({
  workerName,
  rangeLabel,
  rows,
}: BuildWorkerDailyWorksheetParams) => {
  const workerNameUpper = workerName.toUpperCase();
  const rangeLabelUpper = rangeLabel.toUpperCase();
  const headerRows = [
    [`REGISTRO DIARIO - ${workerNameUpper}`],
    [`DEL ${rangeLabelUpper}`],
    [],
    [
      "DÍA",
      "FECHA",
      "EMPRESA",
      "HORA ENTRADA",
      "HORA SALIDA",
      "HORAS",
      "IMPORTE €",
      "NOTAS",
    ],
  ];

  const dataRows = rows.map((row) => [
    row.dayLabel,
    row.dateLabel,
    row.companyName,
    row.entryTime ?? "",
    row.exitTime ?? "",
    row.totalHours,
    row.amount,
    row.notes ?? "",
  ]);

  const totalHours = rows.reduce(
    (acc, row) => acc + (row.totalHours ?? 0),
    0
  );
  const totalAmount = rows.reduce(
    (acc, row) => acc + (row.amount ?? 0),
    0
  );
  const totalsRow =
    rows.length > 0
      ? ["TOTAL", "", "", "", "", totalHours, totalAmount, ""]
      : null;

  const sheetRows = [
    ...headerRows,
    ...dataRows,
    ...(totalsRow ? [totalsRow] : []),
  ];

  const worksheet = XLSXUtils.aoa_to_sheet(sheetRows);

  const ensureCell = (address: string) => {
    const cell = (worksheet[address] ?? {
      t: "s",
      v: "",
    }) as Record<string, unknown>;
    worksheet[address] = cell as any;
    return cell;
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
      alignment: {
        horizontal: "center",
        vertical: "center",
      },
    };
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
        wrapText: true,
      },
    };
  };
  const applyNumberFormat = (address: string, format: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      numFmt: format,
    };
  };
  const applyCurrencyFormatCell = (address: string) => {
    const cell = ensureCell(address);
    const existingStyle =
      (cell.s as Record<string, unknown> | undefined) ?? {};
    cell.s = {
      ...existingStyle,
      numFmt: '#,##0.00 "€"',
    };
  };

  const applyTotalsRowTheme = (address: string) => {
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
        color: { rgb: "FF1F497D" },
      },
      fill: {
        patternType: "solid",
        fgColor: { rgb: "FFE3ECF8" },
        bgColor: { rgb: "FFE3ECF8" },
      },
    };
  };

  const headerRowNumber = 4;
  ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((column) => {
    applyHeaderTheme(`${column}${headerRowNumber}`);
  });

  const titleStyle = {
    font: { sz: 20, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
  } as const;
  const subtitleStyle = {
    font: { sz: 14 },
    alignment: { horizontal: "center", vertical: "center" },
  } as const;

  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];

  ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"].forEach((address) => {
    ensureCell(address).s = { ...titleStyle };
  });
  ["A2", "B2", "C2", "D2", "E2", "F2", "G2", "H2"].forEach((address) => {
    ensureCell(address).s = { ...subtitleStyle };
  });

  worksheet["!rows"] = worksheet["!rows"] ?? [];
  worksheet["!rows"][0] = { hpt: 30 };
  worksheet["!rows"][1] = { hpt: 22 };

  const totalRows = sheetRows.length;
  const dataStartRow = headerRowNumber + 1;
  const dataEndRow = rows.length
    ? headerRowNumber + rows.length
    : headerRowNumber;
  for (let rowIndex = dataStartRow; rowIndex <= totalRows; rowIndex++) {
    applyLeftAlignment(`A${rowIndex}`);
    applyCenterAlignment(`B${rowIndex}`);
    applyLeftAlignment(`C${rowIndex}`);
    ["D", "E"].forEach((column) => applyCenterAlignment(`${column}${rowIndex}`));
    applyCenterAlignment(`F${rowIndex}`);
    applyNumberFormat(`F${rowIndex}`, "0.00");
    applyCurrencyFormatCell(`G${rowIndex}`);
    applyLeftAlignment(`H${rowIndex}`);
  }
  if (totalsRow) {
    const totalsRowNumber = headerRowNumber + rows.length + 1;
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((column) =>
      applyTotalsRowTheme(`${column}${totalsRowNumber}`)
    );
  }

  worksheet["!cols"] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 48 },
  ];

  worksheet["!autofilter"] = {
    ref: `A${headerRowNumber}:H${Math.max(headerRowNumber, dataEndRow)}`,
  };

  worksheet["!ref"] = XLSXUtils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(totalRows - 1, headerRowNumber - 1), c: 7 },
  });

  return worksheet;
};
