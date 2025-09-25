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
      },
    ],
    includeDailyBreakdown: true,
    includeCompanyTotals: true,
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
          })) ?? base.sections,
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
      partialize: (state) => ({
        templates: state.templates,
        activeTemplateId: state.activeTemplateId,
      }),
    }
  )
);
