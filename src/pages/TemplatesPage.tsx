import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
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
    companies: Array<{
      companyId?: string;
      name?: string;
      hours: number;
    }>;
  }>;
  companyTotals: WorkerHoursSummaryResult["companyTotals"];
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
}> = ({ template, context, preview = true }) => {
  const accentColor = template.accentColor || "#2563eb";
  const dimensions = pageDimensions[template.pageSize] ?? pageDimensions.A4;
  const { width, height } = dimensions[template.orientation];

  const containerStyle: React.CSSProperties = {
    width: `${width}px`,
    minHeight: `${height}px`,
    margin: preview ? "0 auto" : "0",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    padding: preview ? "48px" : "40px",
    boxShadow: preview ? "0 25px 60px rgba(15, 23, 42, 0.12)" : undefined,
    borderRadius: preview ? "18px" : "0",
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: `4px solid ${accentColor}`,
    paddingBottom: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
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
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
  };

  const sectionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
  };

  const textStyle: React.CSSProperties = {
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#1f2937",
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "14px",
  };

  const renderSections = (sections: TemplateSection[]) =>
    sections.map((section) => (
      <div key={section.id} style={sectionStyle}>
        {section.title ? (
          <h3 style={sectionTitleStyle}>
            {replaceTokens(section.title, context)}
          </h3>
        ) : null}
        <p style={textStyle}>{replaceTokens(section.body, context)}</p>
      </div>
    ));

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={badgeStyle}>
          <FileText size={14} />
          Plantilla PDF
        </div>
        <div>
          {template.header.title ? (
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              {replaceTokens(template.header.title, context)}
            </h1>
          ) : null}
          {template.header.subtitle ? (
            <p
              style={{
                fontSize: "16px",
                color: "#475569",
              }}
            >
              {replaceTokens(template.header.subtitle, context)}
            </p>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            color: "#1e293b",
            fontSize: "14px",
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
      </header>

      {renderSections(template.sections)}

      {template.includeCompanyTotals && context.companyTotals.length > 0 ? (
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Horas por empresa</h3>
          <table style={tableStyle}>
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
      ) : null}

      {template.includeDailyBreakdown && context.dailyEntries.length > 0 ? (
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Detalle diario</h3>
          <table style={tableStyle}>
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
                      color: "#1f2937",
                    }}
                  >
                    {entry.companies
                      .map(
                        (company) =>
                          `${company.name ?? ""} (${company.hours.toFixed(
                            2
                          )} h)`
                      )
                      .join(" · ") || "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      borderTop: "1px solid #e2e8f0",
                      color: "#1f2937",
                    }}
                  >
                    {entry.notes.length > 0 ? entry.notes.join(" | ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {template.footer?.text ? (
        <footer
          style={{
            borderTop: "1px solid #e2e8f0",
            paddingTop: "16px",
            marginTop: "16px",
            fontSize: "13px",
            color: "#64748b",
            textAlign: "center" as const,
          }}
        >
          {replaceTokens(template.footer.text, context)}
        </footer>
      ) : null}
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
        if (isActive) {
          setHoursSummary(summary);
        }
      })
      .catch((error) => {
        console.error("Error loading worker hours for templates:", error);
        if (isActive) {
          setHoursError(
            "No se pudieron cargar las horas del trabajador seleccionado."
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingHours(false);
        }
      });

    return () => {
      isActive = false;
    };
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

  useEffect(() => {
    if (!activeTemplateId && templates.length > 0) {
      setActiveTemplate(templates[0].id);
    }
  }, [activeTemplateId, setActiveTemplate, templates]);

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
        return {
          dateKey,
          dateLabel: date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "long",
          }),
          totalHours: summary.totalHours,
          notes: summary.notes,
          companies: summary.companies ?? [],
        };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [hoursSummary]);

  const totalNotes = useMemo(() => {
    return dailyEntries.reduce((acc, entry) => acc + entry.notes.length, 0);
  }, [dailyEntries]);

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

  const addSection = () => {
    if (!activeTemplate) {
      return;
    }

    const newSection: TemplateSection = {
      id: createGuid(),
      title: "Nueva sección",
      body: "Añade contenido personalizado usando tokens como {{worker.name}}",
      layout: "single",
    };

    updateTemplate(activeTemplate.id, {
      sections: [...activeTemplate.sections, newSection],
    });
  };

  const removeSection = (sectionId: string) => {
    if (!activeTemplate) {
      return;
    }

    const remaining = activeTemplate.sections.filter(
      (section) => section.id !== sectionId
    );

    updateTemplate(activeTemplate.id, { sections: remaining });
  };

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
        title="Plantillas PDF"
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
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Datos fuente
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Trabajador
                </label>
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
                  <Select
                    value={selectedWorkerId}
                    onChange={setSelectedWorkerId}
                    options={workers.map((worker) => ({
                      value: worker.id,
                      label: worker.name,
                    }))}
                    fullWidth
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

                    {activeTemplate.sections.map((section) => (
                      <div
                        key={section.id}
                        className="border border-gray-200 dark:border-dark-600 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Input
                            label="Título de la sección"
                            value={section.title ?? ""}
                            onChange={(e) =>
                              handleSectionChange(section.id, () => ({
                                title: e.target.value,
                              }))
                            }
                            fullWidth
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 mt-6"
                            onClick={() => removeSection(section.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                        <TextArea
                          label="Contenido"
                          value={section.body}
                          onChange={(e) =>
                            handleSectionChange(section.id, () => ({
                              body: e.target.value,
                            }))
                          }
                          rows={4}
                          fullWidth
                        />
                      </div>
                    ))}
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
                            onClick={() =>
                              navigator.clipboard.writeText(`{{${item.token}}}`)
                            }
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
                  <div className="overflow-auto">
                    <TemplateDocument
                      template={activeTemplate}
                      context={renderContext}
                      preview
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
