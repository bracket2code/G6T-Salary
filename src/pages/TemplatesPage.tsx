import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Download,
  Calendar,
  Users,
  RefreshCw,
  Loader2,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  ChevronDown,
  Check,
  LayoutPanelLeft,
  Table,
  ListOrdered,
} from "lucide-react";
import { Page } from "@htmldocs/react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { TextArea } from "../components/ui/TextArea";
import { Worker } from "../types/salary";
import {
  useTemplatesStore,
  type PdfTemplate,
  type TemplateSection,
} from "../store/templatesStore";
import { useAuthStore } from "../store/authStore";
import {
  fetchWorkerHoursSummary,
  fetchWorkersData,
  type WorkerHoursSummaryResult,
} from "../lib/salaryData";
import ReactDOMServer from "react-dom/server";

const createGuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

interface TemplateRenderContext {
  worker: Worker | null;
  period: {
    month: number;
    monthName: string;
    year: number;
    label: string;
    start: Date;
    end: Date;
  };
  totals: {
    totalHours: number;
    totalTrackedDays: number;
    averageHours: number;
    noteCount: number;
  };
  dailyEntries: Array<{
    dateKey: string;
    dateLabel: string;
    totalHours: number;
    notes: string[];
    noteEntries?: Array<{
      id: string;
      text: string;
      origin?: string;
    }>;
    companies: Array<{
      companyId?: string;
      name?: string;
      hours: number;
    }>;
    entries: Array<{
      id: string;
      description?: string;
      hours: number;
      companyId?: string;
      companyName?: string;
      workShifts?: Array<{
        id?: string;
        startTime?: string;
        endTime?: string;
        hours?: number;
      }>;
    }>;
  }>;
  companyTotals: WorkerHoursSummaryResult["companyTotals"];
}

type TemplatePagePlanItem =
  | { type: "header"; label: string }
  | { type: "section"; label: string; sectionId: string }
  | { type: "companyTotals"; label: string }
  | { type: "dailyBreakdown"; label: string }
  | { type: "detailHeader"; label: string; detailPageIndex: number }
  | {
      type: "detailTable";
      label: string;
      detailPageIndex: number;
      rangeLabel: string;
    };

interface TemplatePagePlanPage {
  items: TemplatePagePlanItem[];
}

interface TemplatePagePlan {
  pages: TemplatePagePlanPage[];
  sectionToPageMap: Record<string, number>;
}

const pageDimensions = {
  A3: {
    portrait: { width: 1123, height: 1587 },
    landscape: { width: 1587, height: 1123 },
  },
  A4: {
    portrait: { width: 794, height: 1123 },
    landscape: { width: 1123, height: 794 },
  },
  A5: {
    portrait: { width: 559, height: 794 },
    landscape: { width: 794, height: 559 },
  },
  letter: {
    portrait: { width: 816, height: 1056 },
    landscape: { width: 1056, height: 816 },
  },
  legal: {
    portrait: { width: 816, height: 1344 },
    landscape: { width: 1344, height: 816 },
  },
} as const;

const clampZoom = (value: number) => Math.min(1.5, Math.max(0.6, value));
const zoomPresets = [0.75, 0.9, 1, 1.2] as const;

type RunningContentRenderer = (args: {
  currentPage: React.ReactNode;
  totalPages: React.ReactNode;
}) => React.ReactNode;

const cssFromProperties = (rules?: React.CSSProperties) =>
  rules
    ? Object.entries(rules)
        .filter(
          ([, value]) => value !== undefined && value !== null && value !== ""
        )
        .map(
          ([key, value]) =>
            `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${String(value)};`
        )
        .join("\n")
    : "";

interface PdfMarginBoxProps {
  children?: React.ReactNode;
  position: string;
  pageType?: "all" | "even" | "odd" | "blank";
  className?: string;
  style?: React.CSSProperties;
  marginBoxStyles?: React.CSSProperties;
  runningName: string;
}

const PdfMarginBox: React.FC<PdfMarginBoxProps> = ({
  children,
  position,
  pageType = "all",
  className,
  style,
  marginBoxStyles,
  runningName,
}) => {
  const css = `
    /* Set up running element */
    .${runningName} {
      position: running(${runningName});
    }

    /* Apply to specified margin box */
    @page {
      @${position} {
        content: element(${runningName});
        ${cssFromProperties(marginBoxStyles)}
      }
    }

    /* Page type specific styles */
    ${
      pageType === "even"
        ? `
      @page:odd {
        @${position} { content: none; }
      }
    `
        : pageType === "odd"
        ? `
      @page:even {
        @${position} { content: none; }
      }
    `
        : pageType === "blank"
        ? `
      @page:blank {
        @${position} { content: none; }
      }
    `
        : ""
    }

    /* Default alignments based on position */
    .${runningName} {
      ${
        position.includes("left")
          ? "text-align: left;"
          : position.includes("right")
          ? "text-align: right;"
          : "text-align: center;"
      }
      ${
        position.includes("top")
          ? "vertical-align: top;"
          : position.includes("bottom")
          ? "vertical-align: bottom;"
          : "vertical-align: middle;"
      }
      ${cssFromProperties(style)}
    }
  `;

  const combinedClassName = [runningName, className].filter(Boolean).join(" ");

  return (
    <>
      <style>{css}</style>
      <div className={combinedClassName || undefined}>{children}</div>
    </>
  );
};

interface PdfFooterProps {
  children?: React.ReactNode | RunningContentRenderer;
  position?: string;
  pageType?: "all" | "even" | "odd" | "blank";
  className?: string;
  style?: React.CSSProperties;
  marginBoxStyles?: React.CSSProperties;
}

const PdfFooter: React.FC<PdfFooterProps> = ({
  children = ({ currentPage, totalPages }) => (
    <span className="page-number">
      Página {currentPage} de {totalPages}
    </span>
  ),
  position = "bottom-center",
  pageType = "all",
  className,
  style,
  marginBoxStyles,
}) => {
  const footerCss = `
    ${cssFromProperties(style)}

    .page-counter::after {
      content: counter(page);
    }

    .pages-counter::after {
      content: counter(pages);
    }

    .page-number {
      display: ${typeof children === "function" ? "inline" : "none"};
    }
  `;

  const content =
    typeof children === "function"
      ? children({
          currentPage: <span className="page-counter" />,
          totalPages: <span className="pages-counter" />,
        })
      : children;

  return (
    <>
      <style>{footerCss}</style>
      <PdfMarginBox
        position={position}
        pageType={pageType}
        className={className}
        style={style}
        marginBoxStyles={marginBoxStyles}
        runningName="print-footer"
      >
        {content}
      </PdfMarginBox>
    </>
  );
};

interface PdfDocumentProps {
  size?: string;
  orientation: "portrait" | "landscape";
  margin?: string | number;
  children: React.ReactNode;
}

const pdfSizes = ["A3", "A4", "A5", "letter", "legal"];

const PdfDocument: React.FC<PdfDocumentProps> = ({
  size = "A4",
  orientation,
  margin,
  children,
}) => {
  const formatMargin = (value: PdfDocumentProps["margin"]) =>
    typeof value === "number" ? `${value}px` : value ?? "0.39in";

  const formatSize = (value: PdfDocumentProps["size"]) =>
    value && pdfSizes.includes(value) ? value : `${value ?? "A4"}`;

  const childrenArray = React.Children.toArray(children);
  const footerChild = childrenArray.find(
    (child) => React.isValidElement(child) && child.type === PdfFooter
  );
  const orderedChildren = footerChild
    ? [footerChild, ...childrenArray.filter((child) => child !== footerChild)]
    : childrenArray;

  const css = `
    @page {
      size: ${formatSize(size)} ${orientation};
      margin: ${formatMargin(margin)};
    }
  `;

  return (
    <div
      id="document"
      data-size={formatSize(size)}
      data-orientation={orientation}
    >
      <style>{css}</style>
      {orderedChildren}
    </div>
  );
};

const resolvePath = (path: string, context: TemplateRenderContext): unknown => {
  const parts = path
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  let current: any = context;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(part);
      current = Number.isNaN(index) ? undefined : current[index];
    } else {
      current = current[part];
    }
  }

  return current;
};

const formatTokenValue = (value: unknown): string => {
  if (value == null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatTokenValue(item)).join(", ");
  }

  if (value instanceof Date) {
    return value.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const replaceTokens = (text: string, context: TemplateRenderContext) => {
  return text.replace(/{{\s*([^}]+?)\s*}}/g, (_match, tokenPath: string) => {
    const resolved = resolvePath(tokenPath, context);
    return formatTokenValue(resolved);
  });
};

const TemplateDocument: React.FC<{
  template: PdfTemplate;
  context: TemplateRenderContext;
  preview?: boolean;
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  onPlanChange?: (plan: TemplatePagePlan) => void;
  zoom?: number;
}> = ({
  template,
  context,
  preview = true,
  selectedSectionId,
  onSelectSection,
  onPlanChange,
  zoom = 1,
}) => {
  const accentColor = template.accentColor || "#2563eb";
  const dimensions = pageDimensions[template.pageSize] ?? pageDimensions.A4;
  const { width, height } = dimensions[template.orientation];
  const safeZoom = preview ? Math.min(Math.max(zoom, 0.55), 1.6) : 1;
  const baseFontFamily =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  const pageContentStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    color: "#0f172a",
    fontFamily: baseFontFamily,
  };

  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "9999px",
    backgroundColor: `${accentColor}1A`,
    color: accentColor,
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  };

  const textStyle: React.CSSProperties = {
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#1f2937",
    margin: 0,
  };

  const renderSectionBody = (
    body: string,
    layout: TemplateSection["layout"] | undefined
  ) => {
    const replaced = replaceTokens(body, context);
    const paragraphs = replaced
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const renderLines = (value: string) =>
      value.split(/\n/).map((line, index, arr) => (
        <React.Fragment key={`${line}-${index}`}>
          {line}
          {index < arr.length - 1 ? <br /> : null}
        </React.Fragment>
      ));

    if (paragraphs.length === 0) {
      return (
        <p style={{ ...textStyle, color: "#94a3b8" }}>
          Añade contenido dinámico utilizando tokens como {"{{worker.name}}"}.
        </p>
      );
    }

    const wrapperStyle: React.CSSProperties =
      layout === "two-column"
        ? {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "18px",
          }
        : {
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          };

    return (
      <div style={wrapperStyle}>
        {paragraphs.map((paragraph, index) => (
          <p key={index} style={textStyle}>
            {renderLines(paragraph)}
          </p>
        ))}
      </div>
    );
  };

  const renderSection = (section: TemplateSection, index: number) => {
    const isSelected = preview && selectedSectionId === section.id;
    const interactive = preview && typeof onSelectSection === "function";

    const containerStyle: React.CSSProperties = preview
      ? {
          padding: "20px 24px",
          borderRadius: "18px",
          border: isSelected ? `2px solid ${accentColor}` : "1px solid #e2e8f0",
          backgroundColor: isSelected ? `${accentColor}16` : "#ffffff",
          boxShadow: isSelected
            ? "0 18px 46px rgba(37, 99, 235, 0.18)"
            : "0 10px 30px rgba(15, 23, 42, 0.1)",
          cursor: interactive ? "pointer" : "default",
          transition: "all 0.2s ease",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }
      : {
          margin: "6px 0",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        };

    const handleSelect = () => {
      if (interactive && onSelectSection) {
        onSelectSection(section.id);
      }
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (
      event
    ) => {
      if (!interactive) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelectSection?.(section.id);
      }
    };

    return (
      <div
        key={section.id}
        style={containerStyle}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
      >
        <div
          style={{
            fontSize: "12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          Sección {index + 1}
        </div>
        {section.title ? (
          <h3 style={sectionTitleStyle}>
            {replaceTokens(section.title, context)}
          </h3>
        ) : null}
        {renderSectionBody(section.body, section.layout)}
      </div>
    );
  };

  const headerBlock = (
    <header
      style={{
        borderBottom: `4px solid ${accentColor}`,
        paddingBottom: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div style={badgeStyle}>
        <FileText size={14} />
        Plantilla PDF
      </div>
      <div>
        {template.header.title ? (
          <h1 style={{ fontSize: "32px", fontWeight: 700, margin: 0 }}>
            {replaceTokens(template.header.title, context)}
          </h1>
        ) : null}
        {template.header.subtitle ? (
          <p style={{ fontSize: "16px", color: "#475569", margin: 0 }}>
            {replaceTokens(template.header.subtitle, context)}
          </p>
        ) : null}
      </div>
      {(template.header.showWorkerInfo && context.worker) ||
      template.header.showPeriodSummary ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {template.header.showWorkerInfo && context.worker ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: "#f8fafc",
              }}
            >
              <Users size={16} />
              <div>
                <div style={{ fontWeight: 600 }}>{context.worker.name}</div>
                <div style={{ color: "#64748b" }}>{context.worker.email}</div>
              </div>
            </div>
          ) : null}
          {template.header.showPeriodSummary ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: "#f8fafc",
              }}
            >
              <Calendar size={16} />
              <div>
                <div style={{ fontWeight: 600 }}>{context.period.label}</div>
                <div style={{ color: "#64748b" }}>
                  {context.totals.totalHours.toFixed(2)} h ·{" "}
                  {context.totals.totalTrackedDays} días
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );

  const baseStyles = `
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ${baseFontFamily}; color: #0f172a; background-color: #ffffff; }
    table { width: 100%; border-collapse: collapse; }
    h1, h2, h3, h4, h5, h6 { margin: 0; }
    p { margin: 0; }
  `;

  const companyTotalsSection =
    template.includeCompanyTotals && context.companyTotals.length > 0 ? (
      <section
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <h3 style={sectionTitleStyle}>Horas por empresa</h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "12px 16px",
                  color: "#475569",
                }}
              >
                Empresa
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "12px 16px",
                  color: "#475569",
                }}
              >
                Horas
              </th>
            </tr>
          </thead>
          <tbody>
            {context.companyTotals.map((company) => (
              <tr key={company.companyId ?? company.name}>
                <td
                  style={{
                    padding: "12px 16px",
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  {company.name ?? "Sin empresa"}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    borderTop: "1px solid #e2e8f0",
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {company.hours.toFixed(2)} h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ) : null;

  const dailyBreakdownSection =
    template.includeDailyBreakdown && context.dailyEntries.length > 0 ? (
      <section
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <h3 style={sectionTitleStyle}>Detalle diario</h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  color: "#475569",
                }}
              >
                Fecha
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "10px 14px",
                  color: "#475569",
                }}
              >
                Horas
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  color: "#475569",
                }}
              >
                Empresas
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  color: "#475569",
                }}
              >
                Notas
              </th>
            </tr>
          </thead>
          <tbody>
            {context.dailyEntries.map((entry) => (
              <tr key={entry.dateKey}>
                <td
                  style={{
                    padding: "10px 14px",
                    borderTop: "1px solid #e2e8f0",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.dateLabel}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderTop: "1px solid #e2e8f0",
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {entry.totalHours.toFixed(2)} h
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  {entry.companies.length > 0
                    ? entry.companies
                        .map(
                          (company) =>
                            `${
                              company.name ?? "Sin empresa"
                            } (${company.hours.toFixed(2)} h)`
                        )
                        .join(" · ")
                    : "—"}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  {entry.notes.length > 0 ? entry.notes.join(" | ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ) : null;

  type DetailedRow = {
    key: string;
    dateLabel: string;
    company: string;
    description: string;
    hours: number;
    notes: string;
  };

  const buildCompanyLabel = (
    companies: TemplateRenderContext["dailyEntries"][number]["companies"]
  ) => {
    if (!companies || companies.length === 0) {
      return "Sin empresa";
    }
    return companies
      .map((company) => company.name ?? "Sin empresa")
      .filter(Boolean)
      .join(" · ");
  };

  const detailedRows: DetailedRow[] = context.dailyEntries.flatMap((day) => {
    const noteText =
      day.notes.length > 0
        ? day.notes.join(" | ")
        : (day.noteEntries ?? [])
            .map((note) => note.text)
            .filter(Boolean)
            .join(" | ");

    if (day.entries && day.entries.length > 0) {
      return day.entries.map((entry, index) => {
        const fallbackCompany = buildCompanyLabel(day.companies);
        return {
          key: `${day.dateKey}-${entry.id ?? index}`,
          dateLabel: index === 0 ? day.dateLabel : "",
          company: entry.companyName ?? fallbackCompany,
          description: entry.description?.trim() || "Sin descripción",
          hours: entry.hours ?? 0,
          notes: index === 0 ? noteText : "",
        } satisfies DetailedRow;
      });
    }

    return [
      {
        key: `${day.dateKey}-summary`,
        dateLabel: day.dateLabel,
        company: buildCompanyLabel(day.companies),
        description: "Sin registros detallados",
        hours: day.totalHours,
        notes: noteText,
      } satisfies DetailedRow,
    ];
  });

  const rowsPerDetailPage = Math.max(
    5,
    Math.min(50, template.detailedEntriesRowsPerPage || 18)
  );

  const detailPageChunks = useMemo(() => {
    if (!template.includeDetailedEntries) {
      return [] as Array<{
        rows: DetailedRow[];
        startIndex: number;
        endIndex: number;
      }>;
    }

    const chunks: Array<{
      rows: DetailedRow[];
      startIndex: number;
      endIndex: number;
    }> = [];

    if (detailedRows.length === 0) {
      return chunks;
    }

    for (
      let start = 0;
      start < detailedRows.length;
      start += rowsPerDetailPage
    ) {
      const rows = detailedRows.slice(start, start + rowsPerDetailPage);
      chunks.push({
        rows,
        startIndex: start,
        endIndex: start + rows.length - 1,
      });
    }

    return chunks;
  }, [detailedRows, rowsPerDetailPage, template.includeDetailedEntries]);

  const { renderPages, planSummary } = useMemo(() => {
    type BuiltPage = {
      content: React.ReactNode[];
      items: TemplatePagePlanItem[];
    };

    const pages: BuiltPage[] = [];
    const sectionToPageMap: Record<string, number> = {};

    let currentContent: React.ReactNode[] = [];
    let currentItems: TemplatePagePlanItem[] = [];

    const finalizeCurrentPage = () => {
      if (currentContent.length === 0) {
        return;
      }
      pages.push({ content: currentContent, items: currentItems });
      currentContent = [];
      currentItems = [];
    };

    const headerLabel = template.header.title?.trim() || "Cabecera principal";
    currentContent.push(headerBlock);
    currentItems.push({ type: "header", label: headerLabel });

    template.sections.forEach((section, index) => {
      if (
        section.pageBreakBefore &&
        (currentContent.length > 0 || pages.length > 0)
      ) {
        finalizeCurrentPage();
      }

      const sectionNode = renderSection(section, index);
      currentContent.push(sectionNode);

      const sectionLabel = section.title?.trim() || `Sección ${index + 1}`;
      currentItems.push({
        type: "section",
        label: sectionLabel,
        sectionId: section.id,
      });
      sectionToPageMap[section.id] = pages.length;
    });

    if (companyTotalsSection) {
      if (template.companyTotalsPageBreak && currentContent.length > 0) {
        finalizeCurrentPage();
      }
      currentContent.push(companyTotalsSection);
      currentItems.push({
        type: "companyTotals",
        label: "Horas por empresa",
      });
    }

    if (dailyBreakdownSection) {
      if (template.dailyBreakdownPageBreak && currentContent.length > 0) {
        finalizeCurrentPage();
      }
      currentContent.push(dailyBreakdownSection);
      currentItems.push({
        type: "dailyBreakdown",
        label: "Detalle diario",
      });
    }

    finalizeCurrentPage();

    if (template.includeDetailedEntries && detailPageChunks.length > 0) {
      const detailTitle =
        template.detailedEntriesTitle?.trim() || "Detalle de registros";
      const detailDescription = template.detailedEntriesDescription?.trim();

      detailPageChunks.forEach((chunk, pageIndex) => {
        const detailContent: React.ReactNode[] = [];
        const detailItems: TemplatePagePlanItem[] = [];

        detailContent.push(
          <section
            key={`detail-header-${pageIndex}`}
            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
          >
            <div style={badgeStyle}>Registros diarios</div>
            <h2 style={{ ...sectionTitleStyle, fontSize: "20px" }}>
              {pageIndex === 0 ? detailTitle : `${detailTitle} (continuación)`}
            </h2>
            {pageIndex === 0 && detailDescription ? (
              <p style={textStyle}>{detailDescription}</p>
            ) : null}
          </section>
        );

        detailItems.push({
          type: "detailHeader",
          label:
            pageIndex === 0 ? detailTitle : `${detailTitle} (continuación)`,
          detailPageIndex: pageIndex + 1,
        });

        detailContent.push(
          <table
            key={`detail-table-${pageIndex}`}
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    color: "#475569",
                    width: "18%",
                  }}
                >
                  Fecha
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    color: "#475569",
                    width: "22%",
                  }}
                >
                  Empresa
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    color: "#475569",
                  }}
                >
                  Descripción
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 12px",
                    color: "#475569",
                    width: "10%",
                  }}
                >
                  Horas
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    color: "#475569",
                    width: "20%",
                  }}
                >
                  Notas del día
                </th>
              </tr>
            </thead>
            <tbody>
              {chunk.rows.map((row) => (
                <tr key={row.key}>
                  <td
                    style={{
                      padding: "8px 12px",
                      borderTop: "1px solid #e2e8f0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.dateLabel || ""}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    {row.company}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    {row.description}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      borderTop: "1px solid #e2e8f0",
                      textAlign: "right",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.hours.toFixed(2)} h
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    {row.notes || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

        const rangeLabel = `Registros ${chunk.startIndex + 1} – ${
          chunk.endIndex + 1
        }`;
        detailItems.push({
          type: "detailTable",
          label: "Tabla de registros",
          detailPageIndex: pageIndex + 1,
          rangeLabel,
        });

        pages.push({ content: detailContent, items: detailItems });
      });
    }

    if (pages.length === 0) {
      const fallbackLabel =
        template.header.title?.trim() || "Cabecera principal";
      pages.push({
        content: [headerBlock],
        items: [{ type: "header", label: fallbackLabel }],
      });
    }

    return {
      renderPages: pages.map((page) => page.content),
      planSummary: {
        pages: pages.map((page) => ({ items: page.items })),
        sectionToPageMap,
      } satisfies TemplatePagePlan,
    };
  }, [
    badgeStyle,
    companyTotalsSection,
    dailyBreakdownSection,
    detailPageChunks,
    headerBlock,
    renderSection,
    sectionTitleStyle,
    template.companyTotalsPageBreak,
    template.dailyBreakdownPageBreak,
    template.detailedEntriesDescription,
    template.detailedEntriesTitle,
    template.header.title,
    template.includeDetailedEntries,
    template.sections,
    textStyle,
  ]);

  const planSummaryKey = useMemo(
    () => JSON.stringify(planSummary),
    [planSummary]
  );
  const planSummaryRef = useRef(planSummary);

  useEffect(() => {
    planSummaryRef.current = planSummary;
  }, [planSummary]);

  useEffect(() => {
    if (!onPlanChange) {
      return;
    }
    onPlanChange(planSummaryRef.current);
  }, [onPlanChange, planSummaryKey]);

  const documentContent = (
    <PdfDocument
      size={template.pageSize}
      orientation={template.orientation}
      margin="0.75in"
    >
      <style>{baseStyles}</style>
      {renderPages.map((content, index) => (
        <Page key={`page-${index}`} style={pageContentStyle}>
          {content}
        </Page>
      ))}
      {template.footer?.text ? (
        <PdfFooter
          position="bottom-center"
          style={{ color: "#64748b", fontSize: "12px" }}
        >
          {({ currentPage, totalPages }) => (
            <span>
              {replaceTokens(template.footer?.text ?? "", context)} · Página{" "}
              {currentPage} de {totalPages}
            </span>
          )}
        </PdfFooter>
      ) : null}
    </PdfDocument>
  );

  if (!preview) {
    return documentContent;
  }

  const scaledWidth = width * safeZoom;
  const scaledHeight = height * safeZoom;

  return (
    <div
      style={{
        width: `${Math.max(scaledWidth + 96, width + 96)}px`,
        minHeight: `${scaledHeight + 96}px`,
        margin: "0 auto",
        padding: "40px 32px",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        borderRadius: "32px",
        boxShadow: "0 40px 90px rgba(15, 23, 42, 0.16)",
        transition: "all 0.3s ease",
      }}
    >
      <div
        style={{
          transform: `scale(${safeZoom})`,
          transformOrigin: "top center",
          width: `${width}px`,
          minHeight: `${height}px`,
          margin: "0 auto",
        }}
      >
        {documentContent}
      </div>
    </div>
  );
};

interface WorkerSearchSelectProps {
  workers: Worker[];
  selectedWorkerId: string;
  onWorkerSelect: (workerId: string) => void;
  placeholder?: string;
}

const WorkerSearchSelect: React.FC<WorkerSearchSelectProps> = ({
  workers,
  selectedWorkerId,
  onWorkerSelect,
  placeholder = "Buscar trabajador...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const selectedWorker = useMemo(
    () => workers.find((worker) => worker.id === selectedWorkerId) ?? null,
    [workers, selectedWorkerId]
  );

  const filteredWorkers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [...workers].sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
    }

    return workers
      .filter((worker) => {
        const lowerName = worker.name?.toLowerCase() ?? "";
        const lowerEmail = worker.email?.toLowerCase() ?? "";
        const lowerPhone = worker.phone?.toLowerCase() ?? "";
        const lowerDepartment = worker.department?.toLowerCase() ?? "";
        const lowerPosition = worker.position?.toLowerCase() ?? "";
        const companies = worker.companyNames ?? [];
        return (
          lowerName.includes(query) ||
          lowerEmail.includes(query) ||
          lowerPhone.includes(query) ||
          lowerDepartment.includes(query) ||
          lowerPosition.includes(query) ||
          companies.some((company) => company.toLowerCase().includes(query))
        );
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
  }, [workers, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        if (selectedWorker) {
          setInputValue(selectedWorker.name);
        } else {
          setInputValue("");
        }
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedWorker]);

  useEffect(() => {
    if (selectedWorker) {
      setInputValue(selectedWorker.name);
    } else {
      setInputValue("");
    }
  }, [selectedWorker]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, filteredWorkers.length);
  }, [filteredWorkers.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (filteredWorkers.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    if (highlightedIndex === -1) {
      setHighlightedIndex(0);
    } else if (highlightedIndex >= filteredWorkers.length) {
      setHighlightedIndex(filteredWorkers.length - 1);
    }
  }, [filteredWorkers, isOpen, highlightedIndex]);

  useEffect(() => {
    if (highlightedIndex >= 0) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleWorkerSelect = (worker: Worker) => {
    onWorkerSelect(worker.id);
    setInputValue(worker.name);
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onWorkerSelect("");
    setInputValue("");
    setSearchQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    setSearchQuery(value);
    setIsOpen(true);
    setHighlightedIndex(-1);

    if (value === "") {
      onWorkerSelect("");
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (selectedWorker) {
      setInputValue("");
      setSearchQuery("");
    }
    if (filteredWorkers.length > 0) {
      setHighlightedIndex(0);
    }
  };

  const handleInputClick = () => {
    setIsOpen(true);
    if (filteredWorkers.length > 0 && highlightedIndex === -1) {
      setHighlightedIndex(0);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (selectedWorker) {
        setInputValue(selectedWorker.name);
      }
      return;
    }

    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
    }

    if (!filteredWorkers.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= filteredWorkers.length || prev === -1) {
          return 0;
        }
        return nextIndex;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev <= 0) {
          return filteredWorkers.length - 1;
        }
        return prev - 1;
      });
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < filteredWorkers.length) {
        event.preventDefault();
        handleWorkerSelect(filteredWorkers[highlightedIndex]);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Trabajador
      </label>

      <div
        className={`
          min-h-[42px] w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
          rounded-md flex items-center overflow-hidden
          hover:border-gray-400 dark:hover:border-gray-500
          ${isOpen ? "border-blue-500 ring-1 ring-blue-500" : ""}
        `}
      >
        <div className="flex-1 flex items-center px-3 py-2">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClick={handleInputClick}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex items-stretch">
          {(selectedWorker || inputValue) && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center justify-center h-full px-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Limpiar selección"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center justify-center h-full w-10 border-l border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
            aria-label={
              isOpen
                ? "Cerrar lista de trabajadores"
                : "Abrir lista de trabajadores"
            }
          >
            <ChevronDown
              size={16}
              className={`text-blue-500 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filteredWorkers.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery
                  ? `No se encontraron trabajadores con "${searchQuery}"`
                  : "Escribe para buscar trabajadores"}
              </div>
            ) : (
              <>
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                  {searchQuery
                    ? `${filteredWorkers.length} de ${workers.length} trabajadores`
                    : `${workers.length} trabajadores disponibles`}
                </div>

                {filteredWorkers.map((worker, index) => {
                  const isHighlighted = highlightedIndex === index;
                  const isSelected = selectedWorkerId === worker.id;
                  const baseClasses = `px-3 py-3 cursor-pointer flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700`;
                  const highlightClass = isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : isHighlighted
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "";

                  return (
                    <div
                      key={`${worker.id}-${index}`}
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      className={`${baseClasses} ${highlightClass}`}
                      onClick={() => handleWorkerSelect(worker)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {worker.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {worker.companyNames && worker.companyNames.length > 0
                            ? worker.companyNames.join(", ")
                            : "Sin empresas asignadas"}
                        </p>
                        {(worker.department || worker.position) && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {[worker.department, worker.position]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        )}
                      </div>
                      {selectedWorkerId === worker.id && (
                        <Check
                          size={16}
                          className="text-blue-600 dark:text-blue-400 ml-2"
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const availableTokens = [
  {
    category: "Trabajador",
    items: [
      { token: "worker.name", description: "Nombre completo" },
      { token: "worker.email", description: "Correo principal" },
      { token: "worker.secondaryEmail", description: "Correo secundario" },
      { token: "worker.phone", description: "Teléfono" },
      { token: "worker.department", description: "Departamento" },
      { token: "worker.position", description: "Puesto" },
    ],
  },
  {
    category: "Periodo",
    items: [
      { token: "period.monthName", description: "Nombre del mes" },
      { token: "period.year", description: "Año" },
      { token: "period.label", description: "Mes y año formateado" },
      { token: "period.start", description: "Fecha inicial" },
      { token: "period.end", description: "Fecha final" },
    ],
  },
  {
    category: "Totales",
    items: [
      { token: "totals.totalHours", description: "Horas totales" },
      { token: "totals.totalTrackedDays", description: "Días con horas" },
      { token: "totals.averageHours", description: "Promedio diario" },
      { token: "totals.noteCount", description: "Número de notas" },
    ],
  },
  {
    category: "Empresas (resumen)",
    items: [
      {
        token: "companyTotals.length",
        description: "Cantidad de empresas con horas",
      },
      {
        token: "companyTotals[0].name",
        description: "Nombre de la primera empresa (ejemplo)",
      },
      {
        token: "companyTotals[0].hours",
        description: "Horas de la primera empresa (ejemplo)",
      },
    ],
  },
  {
    category: "Detalle diario",
    items: [
      {
        token: "dailyEntries.length",
        description: "Número de días con registro",
      },
      {
        token: "dailyEntries[0].dateLabel",
        description: "Fecha de ejemplo",
      },
      {
        token: "dailyEntries[0].totalHours",
        description: "Horas del día (ejemplo)",
      },
      {
        token: "dailyEntries[0].companies[0].name",
        description: "Empresa asociada al día (ejemplo)",
      },
      {
        token: "dailyEntries[0].entries.length",
        description: "Cantidad de registros en el día (ejemplo)",
      },
      {
        token: "dailyEntries[0].entries[0].description",
        description: "Descripción del registro (ejemplo)",
      },
      {
        token: "dailyEntries[0].noteEntries[0].text",
        description: "Nota asociada al día (ejemplo)",
      },
    ],
  },
];

const monthLabel = (date: Date) =>
  date.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

const TemplatesPage: React.FC = () => {
  const {
    templates,
    activeTemplateId,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    setActiveTemplate,
  } = useTemplatesStore();
  const { externalJwt } = useAuthStore();

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [companyLookup, setCompanyLookup] = useState<Record<string, string>>(
    {}
  );
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [workersError, setWorkersError] = useState<string | null>(null);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [hoursSummary, setHoursSummary] =
    useState<WorkerHoursSummaryResult | null>(null);
  const [isLoadingHours, setIsLoadingHours] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null
  );
  const [zoom, setZoom] = useState(0.9);
  const [pagePlan, setPagePlan] = useState<TemplatePagePlan | null>(null);

  const copyToken = useCallback((value: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(value).catch(() => undefined);
    }
  }, []);

  const apiUrl = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    if (!externalJwt || !apiUrl) {
      return;
    }

    let isActive = true;
    setIsLoadingWorkers(true);
    setWorkersError(null);

    fetchWorkersData({ apiUrl, token: externalJwt })
      .then(({ workers: fetchedWorkers, companyLookup: lookup }) => {
        if (!isActive) {
          return;
        }
        setWorkers(fetchedWorkers);
        setCompanyLookup(lookup);
        if (fetchedWorkers.length > 0) {
          setSelectedWorkerId((current) =>
            current && fetchedWorkers.some((worker) => worker.id === current)
              ? current
              : fetchedWorkers[0].id
          );
        }
      })
      .catch((error) => {
        console.error("Error loading workers for templates:", error);
        if (isActive) {
          setWorkersError(
            "No se pudieron cargar los trabajadores. Intenta recargar la página."
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingWorkers(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [apiUrl, externalJwt]);

  useEffect(() => {
    if (!externalJwt || !apiUrl || !selectedWorkerId) {
      setHoursSummary(null);
      return;
    }

    let isActive = true;
    const load = async () => {
      setIsLoadingHours(true);
      setHoursError(null);

      try {
        const summary = await fetchWorkerHoursSummary({
          apiUrl,
          token: externalJwt,
          workerId: selectedWorkerId,
          month: selectedMonth,
          companyLookup,
        });
        if (isActive) {
          setHoursSummary(summary);
          setLastFetchTime(new Date());
        }
      } catch (error) {
        console.error("Error loading worker hours for templates:", error);
        if (isActive) {
          setHoursError(
            "No se pudieron cargar las horas del trabajador seleccionado."
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingHours(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [apiUrl, companyLookup, externalJwt, selectedMonth, selectedWorkerId]);

  const handleRefreshHours = useCallback(() => {
    if (!selectedWorkerId || !externalJwt || !apiUrl) {
      return;
    }

    setIsLoadingHours(true);
    setHoursError(null);

    fetchWorkerHoursSummary({
      apiUrl,
      token: externalJwt,
      workerId: selectedWorkerId,
      month: selectedMonth,
      companyLookup,
    })
      .then((summary) => {
        setHoursSummary(summary);
        setLastFetchTime(new Date());
      })
      .catch((error) => {
        console.error("Error refreshing worker hours for templates:", error);
        setHoursError(
          "No se pudieron cargar las horas del trabajador seleccionado."
        );
      })
      .finally(() => {
        setIsLoadingHours(false);
      });
  }, [apiUrl, companyLookup, externalJwt, selectedMonth, selectedWorkerId]);

  const activeTemplate = useMemo(() => {
    if (!templates.length) {
      return null;
    }
    if (!activeTemplateId) {
      return templates[0];
    }
    return (
      templates.find((template) => template.id === activeTemplateId) ?? null
    );
  }, [activeTemplateId, templates]);

  const defaultZoom = useMemo(() => {
    if (!activeTemplate) {
      return 0.9;
    }
    return activeTemplate.orientation === "landscape" ? 0.75 : 0.9;
  }, [activeTemplate]);

  useEffect(() => {
    setZoom((current) => {
      const next = clampZoom(defaultZoom);
      return Math.abs(current - next) < 0.001 ? current : next;
    });
  }, [defaultZoom]);

  useEffect(() => {
    if (!activeTemplateId && templates.length > 0) {
      setActiveTemplate(templates[0].id);
    }
  }, [activeTemplateId, setActiveTemplate, templates]);

  useEffect(() => {
    if (!activeTemplate || activeTemplate.sections.length === 0) {
      setSelectedSectionId(null);
      return;
    }

    setSelectedSectionId((current) =>
      current &&
      activeTemplate.sections.some((section) => section.id === current)
        ? current
        : activeTemplate.sections[0].id
    );
  }, [activeTemplate]);

  const applyZoom = useCallback((value: number) => {
    setZoom(clampZoom(value));
  }, []);

  const increaseZoom = useCallback(() => {
    setZoom((current) => clampZoom(current + 0.1));
  }, []);

  const decreaseZoom = useCallback(() => {
    setZoom((current) => clampZoom(current - 0.1));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom((current) => {
      const next = clampZoom(defaultZoom);
      return Math.abs(current - next) < 0.001 ? current : next;
    });
  }, [defaultZoom]);

  const zoomPercentage = Math.round(zoom * 100);

  const previewMetrics = useMemo(() => {
    if (!activeTemplate) {
      return null;
    }
    const dimensions =
      pageDimensions[activeTemplate.pageSize] ?? pageDimensions.A4;
    const { width, height } = dimensions[activeTemplate.orientation];
    return {
      width,
      height,
      scaledWidth: Math.round(width * zoom),
      scaledHeight: Math.round(height * zoom),
    };
  }, [activeTemplate, zoom]);

  const selectedWorker = useMemo(
    () => workers.find((worker) => worker.id === selectedWorkerId) ?? null,
    [selectedWorkerId, workers]
  );

  const dailyEntries = useMemo(() => {
    if (!hoursSummary) {
      return [] as TemplateRenderContext["dailyEntries"];
    }

    return Object.entries(hoursSummary.hoursByDate)
      .map(([dateKey, summary]) => {
        const [year, month, day] = dateKey.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        const noteEntries = summary.noteEntries ?? [];
        const entries = summary.entries ?? [];
        return {
          dateKey,
          dateLabel: date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "long",
          }),
          totalHours: summary.totalHours,
          notes: summary.notes ?? [],
          noteEntries,
          companies: summary.companies ?? [],
          entries: entries.map((entry, index) => ({
            id: entry.id ?? `${dateKey}-entry-${index}`,
            description: entry.description,
            hours: entry.hours ?? 0,
            companyId: entry.companyId,
            companyName:
              entry.companyName ??
              (entry.companyId ? companyLookup[entry.companyId] : undefined),
            workShifts: entry.workShifts ?? [],
          })),
        } satisfies TemplateRenderContext["dailyEntries"][number];
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [companyLookup, hoursSummary]);

  const totalNotes = useMemo(() => {
    return dailyEntries.reduce((acc, entry) => acc + entry.notes.length, 0);
  }, [dailyEntries]);

  const planItemIcon = (item: TemplatePagePlanItem) => {
    const iconClass = "text-blue-500";
    switch (item.type) {
      case "header":
        return <FileText size={14} className={iconClass} />;
      case "section":
        return <LayoutPanelLeft size={14} className={iconClass} />;
      case "companyTotals":
        return <Table size={14} className={iconClass} />;
      case "dailyBreakdown":
        return <ListOrdered size={14} className={iconClass} />;
      case "detailHeader":
        return <FileText size={14} className={iconClass} />;
      case "detailTable":
        return <ListOrdered size={14} className={iconClass} />;
      default:
        return <FileText size={14} className={iconClass} />;
    }
  };

  const renderContext: TemplateRenderContext = useMemo(() => {
    const firstDay = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth(),
      1
    );
    const lastDay = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      0
    );

    return {
      worker: selectedWorker,
      period: {
        month: selectedMonth.getMonth() + 1,
        monthName: firstDay.toLocaleDateString("es-ES", { month: "long" }),
        year: selectedMonth.getFullYear(),
        label: monthLabel(selectedMonth),
        start: firstDay,
        end: lastDay,
      },
      totals: {
        totalHours: hoursSummary?.totalHours ?? 0,
        totalTrackedDays: hoursSummary?.totalTrackedDays ?? 0,
        averageHours:
          hoursSummary && hoursSummary.totalTrackedDays > 0
            ? hoursSummary.totalHours / hoursSummary.totalTrackedDays
            : 0,
        noteCount: totalNotes,
      },
      dailyEntries,
      companyTotals: hoursSummary?.companyTotals ?? [],
    };
  }, [dailyEntries, hoursSummary, selectedMonth, selectedWorker, totalNotes]);

  const selectedSection = useMemo(() => {
    if (!activeTemplate || !selectedSectionId) {
      return null;
    }
    return (
      activeTemplate.sections.find(
        (section) => section.id === selectedSectionId
      ) ?? null
    );
  }, [activeTemplate, selectedSectionId]);

  useEffect(() => {
    setPagePlan(null);
  }, [activeTemplate?.id]);

  const handleTemplateChange = (
    updater: (template: PdfTemplate) => Partial<PdfTemplate>
  ) => {
    if (!activeTemplate) {
      return;
    }

    const changes = updater(activeTemplate);
    updateTemplate(activeTemplate.id, changes);
  };

  const handleSectionChange = (
    sectionId: string,
    updater: (section: TemplateSection) => Partial<TemplateSection>
  ) => {
    if (!activeTemplate) {
      return;
    }

    const nextSections = activeTemplate.sections.map((section) =>
      section.id === sectionId ? { ...section, ...updater(section) } : section
    );

    updateTemplate(activeTemplate.id, { sections: nextSections });
  };

  const addSection = useCallback(() => {
    if (!activeTemplate) {
      return;
    }

    const newSection: TemplateSection = {
      id: createGuid(),
      title: "Nueva sección",
      body: "Añade contenido personalizado usando tokens como {{worker.name}}",
      layout: "single",
      pageBreakBefore: false,
    };

    updateTemplate(activeTemplate.id, {
      sections: [...activeTemplate.sections, newSection],
    });
    setSelectedSectionId(newSection.id);
  }, [activeTemplate, updateTemplate]);

  const removeSection = useCallback(
    (sectionId: string) => {
      if (!activeTemplate) {
        return;
      }

      const index = activeTemplate.sections.findIndex(
        (section) => section.id === sectionId
      );
      if (index === -1) {
        return;
      }

      const remaining = activeTemplate.sections.filter(
        (section) => section.id !== sectionId
      );

      updateTemplate(activeTemplate.id, { sections: remaining });

      if (remaining.length === 0) {
        setSelectedSectionId(null);
      } else {
        const nextIndex = Math.min(index, remaining.length - 1);
        setSelectedSectionId(remaining[nextIndex].id);
      }
    },
    [activeTemplate, updateTemplate]
  );

  const moveSection = useCallback(
    (sectionId: string, direction: -1 | 1) => {
      if (!activeTemplate) {
        return;
      }

      const index = activeTemplate.sections.findIndex(
        (section) => section.id === sectionId
      );
      if (index === -1) {
        return;
      }

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= activeTemplate.sections.length) {
        return;
      }

      const reordered = [...activeTemplate.sections];
      const [removed] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, removed);

      updateTemplate(activeTemplate.id, { sections: reordered });
      setSelectedSectionId(removed.id);
    },
    [activeTemplate, updateTemplate]
  );

  const duplicateSection = useCallback(
    (sectionId: string) => {
      if (!activeTemplate) {
        return;
      }

      const index = activeTemplate.sections.findIndex(
        (section) => section.id === sectionId
      );
      if (index === -1) {
        return;
      }

      const section = activeTemplate.sections[index];
      const clone: TemplateSection = {
        ...section,
        id: createGuid(),
        title: section.title ? `${section.title} (copia)` : section.title,
      };

      const nextSections = [...activeTemplate.sections];
      nextSections.splice(index + 1, 0, clone);

      updateTemplate(activeTemplate.id, { sections: nextSections });
      setSelectedSectionId(clone.id);
    },
    [activeTemplate, updateTemplate]
  );

  const handleDownloadPdf = () => {
    if (!activeTemplate) {
      return;
    }

    const markup = ReactDOMServer.renderToString(
      <TemplateDocument
        template={activeTemplate}
        context={renderContext}
        preview={false}
      />
    );

    const docHtml = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charSet="utf-8" />
    <title>${activeTemplate.name}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <style>
      @page { size: ${activeTemplate.pageSize} ${activeTemplate.orientation}; margin: 20mm; }
      body { margin: 0; background: #f1f5f9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    </style>
  </head>
  <body>
    ${markup}
  </body>
</html>`;

    const blob = new Blob([docHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const previewWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (previewWindow) {
      previewWindow.onload = () => {
        previewWindow.focus();
      };
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      URL.revokeObjectURL(url);
    }
  };

  const monthValue = `${selectedMonth.getFullYear()}-${String(
    selectedMonth.getMonth() + 1
  ).padStart(2, "0")}`;

  const handleMonthChange = (value: string) => {
    const [yearStr, monthStr] = value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isNaN(year) && !Number.isNaN(month)) {
      setSelectedMonth(new Date(year, month - 1, 1));
    }
  };

  const hasAuth = Boolean(externalJwt && apiUrl);

  return (
    <div className="w-full min-w-0 pb-10">
      <PageHeader
        title="Plantillas"
        description="Crea, edita y genera plantillas en PDF utilizando tus datos reales de trabajadores y horas."
        actionLabel="Nueva plantilla"
        onAction={() => createTemplate()}
        actionIcon={<Plus size={18} />}
      />

      {!hasAuth ? (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 text-amber-700">
              <RefreshCw className="mt-1" size={18} />
              <div>
                <h3 className="font-semibold mb-1">Configura tu conexión</h3>
                <p className="text-sm text-amber-600">
                  Debes iniciar sesión y configurar la variable{" "}
                  <code>VITE_API_BASE_URL</code> para poder cargar trabajadores
                  y horas reales.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <FileText size={16} />
                Plantillas
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => createTemplate()}
              >
                <Plus size={14} className="mr-2" />
                Nueva
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.map((template) => {
                const isActive = activeTemplate?.id === template.id;
                return (
                  <div
                    key={template.id}
                    className={`border rounded-xl px-4 py-3 transition-all ${
                      isActive
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                        : "border-gray-200 dark:border-dark-600 hover:border-blue-500"
                    }`}
                  >
                    <button
                      onClick={() => setActiveTemplate(template.id)}
                      className="flex w-full items-start justify-between text-left"
                    >
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {template.name}
                        </div>
                        {template.description ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {template.description}
                          </p>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateTemplate(template.id)}
                      >
                        <Copy size={14} className="mr-2" />
                        Duplicar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 size={14} className="mr-2" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Datos fuente
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={handleRefreshHours}
                  disabled={
                    isLoadingHours ||
                    isLoadingWorkers ||
                    !selectedWorkerId ||
                    !externalJwt ||
                    !apiUrl
                  }
                >
                  <RefreshCw
                    size={14}
                    className={isLoadingHours ? "animate-spin mr-1" : "mr-1"}
                  />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {isLoadingWorkers ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="animate-spin" size={16} /> Cargando
                    trabajadores...
                  </div>
                ) : workersError ? (
                  <div className="text-sm text-red-500">{workersError}</div>
                ) : workers.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    No hay trabajadores disponibles en la organización.
                  </div>
                ) : (
                  <WorkerSearchSelect
                    workers={workers}
                    selectedWorkerIds={
                      selectedWorkerId ? [selectedWorkerId] : []
                    }
                    onSelectionChange={(ids) =>
                      setSelectedWorkerId(ids[0] ?? "")
                    }
                    placeholder="Buscar y seleccionar trabajador..."
                    multiSelect={false}
                  />
                )}
              </div>

              <Input
                type="month"
                label="Mes"
                value={monthValue}
                onChange={(e) => handleMonthChange(e.target.value)}
                fullWidth
              />

              {isLoadingHours ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="animate-spin" size={16} /> Calculando
                  horas...
                </div>
              ) : hoursError ? (
                <div className="text-sm text-red-500">{hoursError}</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                    <div className="text-xs text-blue-600 dark:text-blue-300 uppercase tracking-wide">
                      Horas totales
                    </div>
                    <div className="text-lg font-semibold text-blue-700 dark:text-blue-200">
                      {(hoursSummary?.totalHours ?? 0).toFixed(2)} h
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                    <div className="text-xs text-emerald-600 dark:text-emerald-300 uppercase tracking-wide">
                      Días trabajados
                    </div>
                    <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">
                      {hoursSummary?.totalTrackedDays ?? 0}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {activeTemplate ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Configuración de la plantilla
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Personaliza el documento y usa tokens para inyectar
                        datos dinámicos.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadPdf}
                    >
                      <Download size={14} className="mr-2" />
                      Vista previa PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Nombre"
                      value={activeTemplate.name}
                      onChange={(e) =>
                        handleTemplateChange(() => ({ name: e.target.value }))
                      }
                      fullWidth
                    />
                    <Input
                      label="Color principal"
                      type="color"
                      value={activeTemplate.accentColor}
                      onChange={(e) =>
                        handleTemplateChange(() => ({
                          accentColor: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <TextArea
                    label="Descripción"
                    value={activeTemplate.description ?? ""}
                    onChange={(e) =>
                      handleTemplateChange(() => ({
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Tamaño"
                      value={activeTemplate.pageSize}
                      onChange={(value) =>
                        handleTemplateChange(() => ({
                          pageSize: value as PdfTemplate["pageSize"],
                        }))
                      }
                      options={["A3", "A4", "A5", "letter", "legal"].map(
                        (size) => ({
                          value: size,
                          label: size.toUpperCase(),
                        })
                      )}
                    />
                    <Select
                      label="Orientación"
                      value={activeTemplate.orientation}
                      onChange={(value) =>
                        handleTemplateChange(() => ({
                          orientation: value as PdfTemplate["orientation"],
                        }))
                      }
                      options={[
                        { value: "portrait", label: "Vertical" },
                        { value: "landscape", label: "Horizontal" },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Título"
                      value={activeTemplate.header.title ?? ""}
                      onChange={(e) =>
                        handleTemplateChange(() => ({
                          header: {
                            ...activeTemplate.header,
                            title: e.target.value,
                          },
                        }))
                      }
                      fullWidth
                    />
                    <Input
                      label="Subtítulo"
                      value={activeTemplate.header.subtitle ?? ""}
                      onChange={(e) =>
                        handleTemplateChange(() => ({
                          header: {
                            ...activeTemplate.header,
                            subtitle: e.target.value,
                          },
                        }))
                      }
                      fullWidth
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={activeTemplate.header.showWorkerInfo}
                        onChange={(e) =>
                          handleTemplateChange(() => ({
                            header: {
                              ...activeTemplate.header,
                              showWorkerInfo: e.target.checked,
                            },
                          }))
                        }
                      />
                      Mostrar datos del trabajador
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={activeTemplate.header.showPeriodSummary}
                        onChange={(e) =>
                          handleTemplateChange(() => ({
                            header: {
                              ...activeTemplate.header,
                              showPeriodSummary: e.target.checked,
                            },
                          }))
                        }
                      />
                      Mostrar resumen del periodo
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          Secciones
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Usa tokens para inyectar datos dinámicos. Ej:{" "}
                          {"{{worker.name}}"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={addSection}>
                        <Plus size={14} className="mr-2" />
                        Agregar sección
                      </Button>
                    </div>

                    {activeTemplate.sections.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-dark-600 bg-white/60 dark:bg-dark-700/40 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No hay secciones. Añade una nueva para comenzar a
                        diseñar el contenido.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeTemplate.sections.map((section, index) => {
                          const isActiveSection =
                            selectedSectionId === section.id;
                          const canMoveUp = index > 0;
                          const canMoveDown =
                            index < activeTemplate.sections.length - 1;
                          const sectionPage =
                            pagePlan?.sectionToPageMap?.[section.id];

                          const containerClasses = isActiveSection
                            ? "border-blue-500 bg-blue-50/80 dark:bg-blue-500/10 shadow-md"
                            : "border-gray-200 dark:border-dark-600 hover:border-blue-400 dark:hover:border-blue-400/60";

                          const handleAction = (
                            action: () => void,
                            event: React.MouseEvent<HTMLButtonElement>
                          ) => {
                            event.stopPropagation();
                            action();
                          };

                          return (
                            <div
                              key={section.id}
                              className={`rounded-2xl border transition-all ${containerClasses}`}
                              onClick={() => setSelectedSectionId(section.id)}
                            >
                              <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
                                  <span>Sección {index + 1}</span>
                                  <div className="flex items-center gap-2">
                                    {typeof sectionPage === "number" ? (
                                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-slate-600 dark:bg-dark-600 dark:text-slate-300">
                                        Página {sectionPage + 1}
                                      </span>
                                    ) : null}
                                    {isActiveSection ? (
                                      <span className="text-blue-600 dark:text-blue-300 font-semibold tracking-normal">
                                        Editando
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <Input
                                    label="Título de la sección"
                                    value={section.title ?? ""}
                                    onChange={(e) =>
                                      handleSectionChange(section.id, () => ({
                                        title: e.target.value,
                                      }))
                                    }
                                    onFocus={() =>
                                      setSelectedSectionId(section.id)
                                    }
                                    fullWidth
                                  />
                                  <div className="flex flex-col gap-2 md:items-end md:justify-between md:min-w-[220px]">
                                    <Select
                                      label="Diseño"
                                      value={section.layout ?? "single"}
                                      onChange={(value) =>
                                        handleSectionChange(section.id, () => ({
                                          layout:
                                            value as TemplateSection["layout"],
                                        }))
                                      }
                                      options={[
                                        { value: "single", label: "Bloque" },
                                        {
                                          value: "two-column",
                                          label: "Dos columnas",
                                        },
                                      ]}
                                      className="md:w-52"
                                    />
                                    <label
                                      className={`flex items-center gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-300 ${
                                        index === 0 ? "opacity-60" : ""
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={Boolean(
                                          section.pageBreakBefore
                                        )}
                                        onChange={(e) =>
                                          handleSectionChange(
                                            section.id,
                                            () => ({
                                              pageBreakBefore: e.target.checked,
                                            })
                                          )
                                        }
                                        disabled={index === 0}
                                        title={
                                          index === 0
                                            ? "La primera sección siempre aparece en la página inicial"
                                            : undefined
                                        }
                                      />
                                      Iniciar en nueva página
                                    </label>
                                    <div className="flex items-center gap-1 md:justify-end">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="px-2 py-2"
                                        disabled={!canMoveUp}
                                        aria-label="Mover sección hacia arriba"
                                        onClick={(event) =>
                                          handleAction(
                                            () => moveSection(section.id, -1),
                                            event
                                          )
                                        }
                                      >
                                        <ArrowUp size={16} />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="px-2 py-2"
                                        disabled={!canMoveDown}
                                        aria-label="Mover sección hacia abajo"
                                        onClick={(event) =>
                                          handleAction(
                                            () => moveSection(section.id, 1),
                                            event
                                          )
                                        }
                                      >
                                        <ArrowDown size={16} />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="px-2 py-2"
                                        aria-label="Duplicar sección"
                                        onClick={(event) =>
                                          handleAction(
                                            () => duplicateSection(section.id),
                                            event
                                          )
                                        }
                                      >
                                        <Copy size={16} />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="px-2 py-2 text-red-600 hover:text-red-700"
                                        aria-label="Eliminar sección"
                                        onClick={(event) =>
                                          handleAction(
                                            () => removeSection(section.id),
                                            event
                                          )
                                        }
                                      >
                                        <Trash2 size={16} />
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                <TextArea
                                  label="Contenido"
                                  value={section.body}
                                  onChange={(e) =>
                                    handleSectionChange(section.id, () => ({
                                      body: e.target.value,
                                    }))
                                  }
                                  onFocus={() =>
                                    setSelectedSectionId(section.id)
                                  }
                                  rows={6}
                                  fullWidth
                                />
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                  <span className="uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                                    Tokens rápidos
                                  </span>
                                  {[
                                    "{{worker.name}}",
                                    "{{period.label}}",
                                    "{{totals.totalHours}}",
                                  ].map((token) => (
                                    <button
                                      key={token}
                                      type="button"
                                      className="rounded-full border border-dashed border-gray-300 px-2 py-1 font-mono text-[11px] text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:border-dark-600 dark:text-blue-300 dark:hover:bg-blue-500/10"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        copyToken(token);
                                      }}
                                    >
                                      {token}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={activeTemplate.includeCompanyTotals}
                        onChange={(e) =>
                          handleTemplateChange(() => ({
                            includeCompanyTotals: e.target.checked,
                          }))
                        }
                      />
                      Mostrar tabla por empresa
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={activeTemplate.includeDailyBreakdown}
                        onChange={(e) =>
                          handleTemplateChange(() => ({
                            includeDailyBreakdown: e.target.checked,
                          }))
                        }
                      />
                      Mostrar detalle diario
                    </label>
                  </div>

                  {activeTemplate.includeCompanyTotals ? (
                    <label className="ml-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={activeTemplate.companyTotalsPageBreak}
                        onChange={(e) =>
                          handleTemplateChange(() => ({
                            companyTotalsPageBreak: e.target.checked,
                          }))
                        }
                      />
                      Mostrar tabla por empresa en una página separada
                    </label>
                  ) : null}

                  {activeTemplate.includeDailyBreakdown ? (
                    <label className="ml-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={activeTemplate.dailyBreakdownPageBreak}
                        onChange={(e) =>
                          handleTemplateChange(() => ({
                            dailyBreakdownPageBreak: e.target.checked,
                          }))
                        }
                      />
                      Mover el detalle diario a una nueva página
                    </label>
                  ) : null}

                  <div className="pt-3 mt-3 border-t border-dashed border-gray-200 dark:border-dark-600">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={activeTemplate.includeDetailedEntries}
                        onChange={(e) =>
                          handleTemplateChange(() => ({
                            includeDetailedEntries: e.target.checked,
                          }))
                        }
                      />
                      Incluir páginas con el detalle de registros individuales
                    </label>

                    {activeTemplate.includeDetailedEntries ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Input
                          label="Título del detalle"
                          value={activeTemplate.detailedEntriesTitle ?? ""}
                          onChange={(e) =>
                            handleTemplateChange(() => ({
                              detailedEntriesTitle: e.target.value,
                            }))
                          }
                          fullWidth
                        />
                        <Input
                          type="number"
                          min={5}
                          max={50}
                          label="Filas por página"
                          value={activeTemplate.detailedEntriesRowsPerPage}
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            handleTemplateChange(() => ({
                              detailedEntriesRowsPerPage: Number.isFinite(
                                parsed
                              )
                                ? Math.min(50, Math.max(5, parsed))
                                : activeTemplate.detailedEntriesRowsPerPage,
                            }));
                          }}
                        />
                        <TextArea
                          label="Descripción opcional"
                          value={
                            activeTemplate.detailedEntriesDescription ?? ""
                          }
                          onChange={(e) =>
                            handleTemplateChange(() => ({
                              detailedEntriesDescription: e.target.value,
                            }))
                          }
                          rows={3}
                          fullWidth
                          className="md:col-span-2"
                        />
                      </div>
                    ) : null}
                  </div>

                  <TextArea
                    label="Pie de página"
                    value={activeTemplate.footer?.text ?? ""}
                    onChange={(e) =>
                      handleTemplateChange(() => ({
                        footer: {
                          ...activeTemplate.footer,
                          text: e.target.value,
                        },
                      }))
                    }
                    rows={3}
                    fullWidth
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Tokens disponibles
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Copia cualquiera de los siguientes tokens y pégalo dentro
                    del contenido de tus secciones.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {availableTokens.map((group) => (
                    <div key={group.category}>
                      <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {group.category}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {group.items.map((item) => (
                          <button
                            key={item.token}
                            onClick={() => copyToken(`{{${item.token}}}`)}
                            className="text-left text-xs border border-dashed border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 hover:border-blue-500 hover:bg-blue-50/70 dark:hover:bg-blue-500/10"
                            title="Copiar token"
                          >
                            <span className="font-mono text-sm text-blue-600 dark:text-blue-300">
                              {`{{${item.token}}}`}
                            </span>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {item.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {pagePlan ? (
                <Card>
                  <CardHeader>
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Mapa de páginas
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Consulta dónde se renderiza cada bloque y salta rápido a
                      las secciones.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pagePlan.pages.map((page, pageIndex) => {
                      const containsSelected = page.items.some(
                        (item) =>
                          item.type === "section" &&
                          item.sectionId === selectedSectionId
                      );

                      return (
                        <div
                          key={`page-plan-${pageIndex}`}
                          className={`rounded-xl border bg-white/80 p-4 shadow-sm transition-all dark:bg-dark-700 ${
                            containsSelected
                              ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-500/30"
                              : "border-gray-200 dark:border-dark-600"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                            <span>Página {pageIndex + 1}</span>
                            <span className="tracking-normal text-[10px] text-gray-400 dark:text-gray-500">
                              {page.items.length} bloque
                              {page.items.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                            {page.items.map((item, itemIndex) => {
                              const icon = planItemIcon(item);
                              const isSectionItem = item.type === "section";
                              const isSelected =
                                isSectionItem &&
                                item.sectionId === selectedSectionId;

                              const baseClasses =
                                "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left";
                              const inactiveClasses =
                                "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 dark:border-dark-600 dark:bg-dark-700 dark:hover:border-blue-400/60";
                              const selectedClasses =
                                "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-200";

                              const content = (
                                <span className="flex items-center gap-3">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                                    {icon}
                                  </span>
                                  <span className="flex flex-col">
                                    <span className="font-medium leading-snug">
                                      {item.label}
                                    </span>
                                    {item.type === "detailTable" ? (
                                      <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                        {item.rangeLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                              );

                              if (isSectionItem) {
                                return (
                                  <li
                                    key={`${item.type}-${item.sectionId}-${itemIndex}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedSectionId(item.sectionId)
                                      }
                                      className={`${baseClasses} ${
                                        isSelected
                                          ? selectedClasses
                                          : inactiveClasses
                                      }`}
                                    >
                                      {content}
                                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-300">
                                        Ir
                                      </span>
                                    </button>
                                  </li>
                                );
                              }

                              return (
                                <li key={`${item.type}-${itemIndex}`}>
                                  <div
                                    className={`${baseClasses} ${inactiveClasses}`}
                                  >
                                    {content}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Mapa de páginas
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Selecciona una plantilla y un periodo para generar la
                      estructura del documento.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-dark-600 dark:text-gray-400">
                      La vista previa actualizará automáticamente esta sección
                      cuando existan datos disponibles.
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Vista previa
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedWorker
                        ? selectedWorker.name
                        : "Selecciona un trabajador"}
                      {" · "}
                      {monthLabel(selectedMonth)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 font-semibold tracking-wide text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                        {zoomPercentage}%
                      </span>
                      {previewMetrics ? (
                        <span className="hidden sm:inline-flex items-center gap-1">
                          <span>
                            {activeTemplate.pageSize.toUpperCase()} ·{" "}
                            {previewMetrics.width}×{previewMetrics.height}px
                          </span>
                        </span>
                      ) : null}
                      {previewMetrics ? (
                        <span className="hidden lg:inline-flex">
                          Vista: {previewMetrics.scaledWidth}×
                          {previewMetrics.scaledHeight}px
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1 py-1 shadow-sm dark:border-dark-600 dark:bg-dark-700">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 py-1"
                          onClick={decreaseZoom}
                          aria-label="Reducir zoom"
                        >
                          <ZoomOut size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 py-1"
                          onClick={increaseZoom}
                          aria-label="Aumentar zoom"
                        >
                          <ZoomIn size={14} />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-3 py-1"
                        onClick={resetZoom}
                      >
                        <RefreshCw size={14} className="mr-2" /> Ajustar
                      </Button>
                      <div className="hidden md:flex items-center gap-1">
                        {zoomPresets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => applyZoom(preset)}
                            className={`rounded-full border px-2 py-1 text-xs font-semibold transition-all ${
                              Math.abs(zoom - preset) < 0.01
                                ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-300"
                                : "border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-dark-600 dark:text-gray-300"
                            }`}
                          >
                            {Math.round(preset * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-auto">
                    <TemplateDocument
                      template={activeTemplate}
                      context={renderContext}
                      preview
                      zoom={zoom}
                      selectedSectionId={selectedSectionId}
                      onSelectSection={setSelectedSectionId}
                      onPlanChange={setPagePlan}
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                Crea tu primera plantilla para comenzar a diseñar documentos PDF
                personalizados.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatesPage;
