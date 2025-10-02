import { create } from "zustand";
import { persist } from "zustand/middleware";

const createId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10));

export type DocumentSize = "A4" | "A3" | "A5" | "letter" | "legal";
export type DocumentOrientation = "portrait" | "landscape";

export interface TemplateSection {
  id: string;
  title?: string;
  body: string;
  layout?: "single" | "two-column";
  pageBreakBefore?: boolean;
}

export interface PdfTemplate {
  id: string;
  name: string;
  description?: string;
  pageSize: DocumentSize;
  orientation: DocumentOrientation;
  accentColor: string;
  header: {
    title?: string;
    subtitle?: string;
    showWorkerInfo: boolean;
    showPeriodSummary: boolean;
  };
  sections: TemplateSection[];
  includeDailyBreakdown: boolean;
  includeCompanyTotals: boolean;
  companyTotalsPageBreak: boolean;
  dailyBreakdownPageBreak: boolean;
  includeDetailedEntries: boolean;
  detailedEntriesTitle?: string;
  detailedEntriesDescription?: string;
  detailedEntriesRowsPerPage: number;
  footer?: {
    text?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface TemplatesState {
  templates: PdfTemplate[];
  activeTemplateId: string | null;
  createTemplate: (template?: Partial<PdfTemplate>) => PdfTemplate;
  updateTemplate: (id: string, changes: Partial<PdfTemplate>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;
  setActiveTemplate: (id: string | null) => void;
}

const buildDefaultTemplate = (): PdfTemplate => {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name: "Nueva plantilla",
    description: "Diseña el PDF utilizando los datos de horas y trabajadores",
    pageSize: "A4",
    orientation: "portrait",
    accentColor: "#2563eb",
    header: {
      title: "Resumen mensual",
      subtitle: "Reporte automático generado por G6T-Salary",
      showWorkerInfo: true,
      showPeriodSummary: true,
    },
    sections: [
      {
        id: createId(),
        title: "Introducción",
        body:
          "Este documento resume las horas trabajadas durante {{period.monthName}} del {{period.year}}.",
        layout: "single",
        pageBreakBefore: false,
      },
    ],
    includeDailyBreakdown: true,
    includeCompanyTotals: true,
    companyTotalsPageBreak: false,
    dailyBreakdownPageBreak: false,
    includeDetailedEntries: false,
    detailedEntriesTitle: "Detalle de registros",
    detailedEntriesDescription: "Listado de registros horarios individuales.",
    detailedEntriesRowsPerPage: 18,
    footer: {
      text: "Documento generado automáticamente. Revisar antes de compartir.",
    },
    createdAt: now,
    updatedAt: now,
  };
};

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: [buildDefaultTemplate()],
      activeTemplateId: null,
      createTemplate: (template) => {
        const now = new Date().toISOString();
        const base = buildDefaultTemplate();
        const nextTemplate: PdfTemplate = {
          ...base,
          ...template,
          id: template?.id ?? createId(),
          createdAt: template?.createdAt ?? now,
          updatedAt: now,
          sections: template?.sections?.map((section) => ({
            ...section,
            id: section.id ?? createId(),
            pageBreakBefore: Boolean(section.pageBreakBefore),
          })) ?? base.sections,
          companyTotalsPageBreak:
            template?.companyTotalsPageBreak ?? base.companyTotalsPageBreak,
          dailyBreakdownPageBreak:
            template?.dailyBreakdownPageBreak ?? base.dailyBreakdownPageBreak,
          includeDetailedEntries:
            template?.includeDetailedEntries ?? base.includeDetailedEntries,
          detailedEntriesTitle:
            template?.detailedEntriesTitle ?? base.detailedEntriesTitle,
          detailedEntriesDescription:
            template?.detailedEntriesDescription ??
            base.detailedEntriesDescription,
          detailedEntriesRowsPerPage:
            template?.detailedEntriesRowsPerPage ??
            base.detailedEntriesRowsPerPage,
        };
        set((state) => ({
          templates: [...state.templates, nextTemplate],
          activeTemplateId: nextTemplate.id,
        }));
        return nextTemplate;
      },
      updateTemplate: (id, changes) => {
        set((state) => ({
          templates: state.templates.map((template) => {
            if (template.id !== id) {
              return template;
            }

            const updated: PdfTemplate = {
              ...template,
              ...changes,
              header: {
                ...template.header,
                ...changes.header,
              },
              footer: changes.footer
                ? {
                    ...template.footer,
                    ...changes.footer,
                  }
                : template.footer,
              sections: changes.sections
                ? changes.sections.map((section) => ({
                    ...section,
                    id: section.id ?? createId(),
                    pageBreakBefore: Boolean(section.pageBreakBefore),
                  }))
                : template.sections,
              updatedAt: new Date().toISOString(),
            };
            return updated;
          }),
        }));
      },
      deleteTemplate: (id) => {
        set((state) => {
          const remaining = state.templates.filter(
            (template) => template.id !== id
          );
          const nextActive =
            state.activeTemplateId === id
              ? remaining.length > 0
                ? remaining[0].id
                : null
              : state.activeTemplateId;
          return {
            templates: remaining,
            activeTemplateId: nextActive,
          };
        });
      },
      duplicateTemplate: (id) => {
        const template = get().templates.find((item) => item.id === id);
        if (!template) {
          return;
        }

        const now = new Date().toISOString();
        const clone: PdfTemplate = {
          ...template,
          id: createId(),
          name: `${template.name} (copia)`,
          createdAt: now,
          updatedAt: now,
          sections: template.sections.map((section) => ({
            ...section,
            id: createId(),
            pageBreakBefore: Boolean(section.pageBreakBefore),
          })),
        };

        set((state) => ({
          templates: [...state.templates, clone],
          activeTemplateId: clone.id,
        }));
      },
      setActiveTemplate: (id) => {
        set({ activeTemplateId: id });
      },
    }),
    {
      name: "g6t-salary-templates",
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState) {
          return persistedState as TemplatesState;
        }

        if (version >= 2) {
          return persistedState as TemplatesState;
        }

        const state = persistedState as Partial<TemplatesState> & {
          templates?: Array<Partial<PdfTemplate>>;
        };

        if (!state.templates) {
          return persistedState as TemplatesState;
        }

        const migratedTemplates = state.templates.map((template) => {
          const base = buildDefaultTemplate();
          const migratedSections = (template.sections ?? []).map((section) => ({
            ...section,
            id: section?.id ?? createId(),
            pageBreakBefore: Boolean(section?.pageBreakBefore),
          }));

          const detailedRowsPerPage =
            typeof template.detailedEntriesRowsPerPage === "number" &&
            Number.isFinite(template.detailedEntriesRowsPerPage)
              ? template.detailedEntriesRowsPerPage
              : base.detailedEntriesRowsPerPage;

          return {
            ...base,
            ...template,
            id: template.id ?? base.id,
            name: template.name ?? base.name,
            createdAt: template.createdAt ?? base.createdAt,
            updatedAt: template.updatedAt ?? base.updatedAt,
            sections:
              migratedSections.length > 0 ? migratedSections : base.sections,
            includeCompanyTotals:
              typeof template.includeCompanyTotals === "boolean"
                ? template.includeCompanyTotals
                : base.includeCompanyTotals,
            includeDailyBreakdown:
              typeof template.includeDailyBreakdown === "boolean"
                ? template.includeDailyBreakdown
                : base.includeDailyBreakdown,
            companyTotalsPageBreak:
              typeof template.companyTotalsPageBreak === "boolean"
                ? template.companyTotalsPageBreak
                : base.companyTotalsPageBreak,
            dailyBreakdownPageBreak:
              typeof template.dailyBreakdownPageBreak === "boolean"
                ? template.dailyBreakdownPageBreak
                : base.dailyBreakdownPageBreak,
            includeDetailedEntries:
              typeof template.includeDetailedEntries === "boolean"
                ? template.includeDetailedEntries
                : base.includeDetailedEntries,
            detailedEntriesTitle:
              template.detailedEntriesTitle ?? base.detailedEntriesTitle,
            detailedEntriesDescription:
              template.detailedEntriesDescription ??
              base.detailedEntriesDescription,
            detailedEntriesRowsPerPage: detailedRowsPerPage,
          } as PdfTemplate;
        });

        return {
          ...state,
          templates: migratedTemplates,
        } as TemplatesState;
      },
      partialize: (state) => ({
        templates: state.templates,
        activeTemplateId: state.activeTemplateId,
      }),
    }
  )
);
