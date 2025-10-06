import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Save,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  CalendarClock,
  Plus,
  Trash2,
  NotebookPen,
  X,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import type {
  DayScheduleEntry,
  DayNoteEntry,
} from "../components/WorkerHoursCalendar";
import { Worker, WorkerCompanyStats } from "../types/salary";
import { formatDate } from "../lib/utils";
import { fetchWorkerHoursSummary, fetchWorkersData } from "../lib/salaryData";
import type { WorkerHoursSummaryResult } from "../lib/salaryData";
import { formatLocalDateKey } from "../lib/timezone";
import { useAuthStore } from "../store/authStore";
import {
  CompanySearchSelect,
  GroupSearchSelect,
  WorkerGroupOption,
  WorkerSearchSelect,
} from "../components/worker/GroupSelectors";
import { createGroupId, fetchWorkerGroupsData } from "../lib/workerGroups";

const weekDays = [
  { key: "monday", label: "Lunes", shortLabel: "Lun" },
  { key: "tuesday", label: "Martes", shortLabel: "Mar" },
  { key: "wednesday", label: "Miércoles", shortLabel: "Mié" },
  { key: "thursday", label: "Jueves", shortLabel: "Jue" },
  { key: "friday", label: "Viernes", shortLabel: "Vie" },
  { key: "saturday", label: "Sábado", shortLabel: "Sáb" },
  { key: "sunday", label: "Domingo", shortLabel: "Dom" },
] as const;

type WeekDayKey = (typeof weekDays)[number]["key"];

interface Assignment {
  id: string;
  workerId: string;
  workerName: string;
  companyId: string;
  companyName: string;
  hours: Record<WeekDayKey, string>;
}

interface ControlScheduleSavePayload {
  id: string;
  dateTime: string;
  parameterId: string;
  controlScheduleType: number;
  value?: string;
  companyId?: string;
  workShifts?: Array<{
    id: string;
    workStart: string;
    workEnd: string;
    observations: string;
  }>;
}

const UNASSIGNED_COMPANY_ID = "sin-empresa";
const UNASSIGNED_COMPANY_LABEL = "Sin empresa asignada";

const CONTROL_SCHEDULE_TYPE_MANUAL = 1;
const CONTROL_SCHEDULE_SAVE_PATH = "/controlSchedule/save";

const UNASSIGNED_COMPANY_NAME_VARIANTS = new Set([
  "sin empresa",
  "sin empresa asignada",
  "sin empresa asignado",
  "sin empresa (sin asignar)",
  "sin asignar empresa",
  "sin asignación de empresa",
  "sin asignacion de empresa",
]);

const trimToNull = (value?: string | null): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isUnassignedCompanyIdValue = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized === UNASSIGNED_COMPANY_ID ||
    normalized.startsWith(`${UNASSIGNED_COMPANY_ID}-`) ||
    normalized === "0" ||
    normalized === "null" ||
    normalized === "undefined"
  );
};

const isUnassignedCompanyNameValue = (value: string): boolean =>
  UNASSIGNED_COMPANY_NAME_VARIANTS.has(value.toLowerCase());

const isUnassignedCompany = (
  companyId?: string | null,
  companyName?: string | null
): boolean => {
  const normalizedId = trimToNull(companyId);
  const normalizedName = trimToNull(companyName);

  const idLooksUnassigned =
    normalizedId === null || isUnassignedCompanyIdValue(normalizedId);
  const nameLooksUnassigned =
    normalizedName === null || isUnassignedCompanyNameValue(normalizedName);

  return idLooksUnassigned && nameLooksUnassigned;
};

const buildCompanyIdentity = (
  companyId?: string | null,
  companyName?: string | null
): { id: string; name: string } => {
  if (isUnassignedCompany(companyId, companyName)) {
    return { id: UNASSIGNED_COMPANY_ID, name: UNASSIGNED_COMPANY_LABEL };
  }

  const normalizedId = trimToNull(companyId);
  const normalizedName = trimToNull(companyName);

  if (normalizedId && normalizedName) {
    return { id: normalizedId, name: normalizedName };
  }

  if (normalizedId) {
    return { id: normalizedId, name: normalizedName ?? normalizedId };
  }

  if (normalizedName) {
    return { id: createGroupId(normalizedName), name: normalizedName };
  }

  return { id: UNASSIGNED_COMPANY_ID, name: UNASSIGNED_COMPANY_LABEL };
};

const withNormalizedCompany = <
  T extends { companyId: string; companyName: string }
>(
  item: T
): T => {
  const identity = buildCompanyIdentity(item.companyId, item.companyName);
  return {
    ...item,
    companyId: identity.id,
    companyName: identity.name,
  };
};

const normalizeCompanyLookupMap = (
  lookup: Record<string, string>
): Record<string, string> => {
  const normalized: Record<string, string> = {};

  Object.entries(lookup).forEach(([rawId, rawName]) => {
    const identity = buildCompanyIdentity(rawId, rawName);
    normalized[identity.id] = identity.name;
  });

  if (!normalized[UNASSIGNED_COMPANY_ID]) {
    normalized[UNASSIGNED_COMPANY_ID] = UNASSIGNED_COMPANY_LABEL;
  }

  return normalized;
};

const createDefaultCompanyLookupMap = () => normalizeCompanyLookupMap({});

const formatDateKeyToApiDateTime = (dateKey: string): string => {
  if (typeof dateKey === "string") {
    const normalized = dateKey.trim();
    if (normalized.length > 0) {
      const [yearPart, monthPart, dayPart] = normalized.split("-");
      const parsedYear = Number(yearPart);
      const parsedMonth = Number(monthPart);
      const parsedDay = Number(dayPart);

      if (
        Number.isFinite(parsedYear) &&
        Number.isFinite(parsedMonth) &&
        Number.isFinite(parsedDay)
      ) {
        const year = String(parsedYear).padStart(4, "0");
        const month = String(parsedMonth).padStart(2, "0");
        const day = String(parsedDay).padStart(2, "0");
        return `${year}-${month}-${day}T00:00:00+00:00`;
      }
    }
  }

  const today = new Date();
  const year = String(today.getUTCFullYear()).padStart(4, "0");
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  const day = String(today.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00+00:00`;
};

const buildApiEndpoint = (baseUrl: string, path: string): string => {
  const trimmedBase = baseUrl.trim().replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (/\/api(\/|$)/i.test(trimmedBase)) {
    return `${trimmedBase}${normalizedPath}`;
  }
  return `${trimmedBase}/api${normalizedPath}`;
};

const generateUuid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16;
    const value = char === "x" ? Math.floor(random) : (Math.floor(random) & 0x3) | 0x8;
    return value.toString(16);
  });
};

interface DayNotesModalProps {
  isOpen: boolean;
  workerName: string;
  companyName: string;
  dayLabel: string;
  dateLabel?: string;
  notes: DayNoteEntry[];
  onClose: () => void;
}

const DayNotesModal: React.FC<DayNotesModalProps> = ({
  isOpen,
  workerName,
  companyName,
  dayLabel,
  dateLabel,
  notes,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[104] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-300">
              <NotebookPen size={16} />
              Notas del día
            </div>
            <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {workerName}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {companyName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {dayLabel}
              {dateLabel ? ` · ${dateLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Cerrar notas"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {notes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No hay notas disponibles para este día.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {note.text}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-gray-200 px-5 py-3 dark:border-gray-800">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};

const sanitizeTelHref = (phone: string) => {
  const sanitized = phone.replace(/[^+\d]/g, "");
  return sanitized.length > 0 ? `tel:${sanitized}` : null;
};

const buildWhatsAppLink = (phone: string) => {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly ? `https://wa.me/${digitsOnly}` : null;
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.error("Clipboard API write failed:", error);
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const selectedRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textarea.select();
    const copied = document.execCommand("copy");

    document.body.removeChild(textarea);

    if (selectedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }

    return copied;
  } catch (error) {
    console.error("Fallback clipboard copy failed:", error);
    return false;
  }
};

interface WorkerInfoModalProps {
  state: WorkerInfoModalState;
  onClose: () => void;
}

const WorkerInfoModal: React.FC<WorkerInfoModalProps> = ({ state, onClose }) => {
  if (!state.isOpen) {
    return null;
  }

  const [copyFeedback, setCopyFeedback] = useState<
    | {
        type: "email" | "phone";
        message: string;
        target?: string;
      }
    | null
  >(null);

  const phoneHref = state.data?.phone ? sanitizeTelHref(state.data.phone) : null;
  const whatsappHref = state.data?.phone
    ? buildWhatsAppLink(state.data.phone)
    : null;
  const emailHref = state.data?.email ? `mailto:${state.data.email}` : null;

  useEffect(() => {
    if (!copyFeedback) {
      return;
    }
    const timer = window.setTimeout(() => setCopyFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  const handleCopy = useCallback(
    async (type: "email" | "phone", value?: string | null) => {
      const trimmed = trimToNull(value);
      if (!trimmed) {
        return;
      }

      const success = await copyTextToClipboard(trimmed);
      setCopyFeedback({
        type,
        message: success ? "Copiado al portapapeles" : "No se pudo copiar",
        target: trimmed,
      });
    },
    []
  );

  const handleOpenEmail = useCallback(() => {
    if (emailHref) {
      window.open(emailHref, "_self");
    }
  }, [emailHref]);

  const handleOpenPhone = useCallback(() => {
    if (phoneHref) {
      window.open(phoneHref, "_self");
    }
  }, [phoneHref]);

  const handleOpenWhatsApp = useCallback(() => {
    if (whatsappHref) {
      window.open(whatsappHref, "_blank", "noopener,noreferrer");
    }
  }, [whatsappHref]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {state.data?.name ?? state.workerName}
            </h3>
            {state.isLoading ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Cargando información...
              </p>
            ) : state.error ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            ) : (
              <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    Email:
                  </span>{" "}
                  {state.data?.email ? (
                    <a
                      href={emailHref ?? "#"}
                      onClick={(event) => {
                        event.preventDefault();
                        void handleCopy("email", state.data?.email);
                      }}
                      className="text-blue-600 transition hover:underline dark:text-blue-400"
                    >
                      {state.data.email}
                    </a>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      No disponible
                    </span>
                  )}
                  {copyFeedback?.type === "email" && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-300">
                      {copyFeedback.message}
                    </span>
                  )}
                </div>
                {state.data?.secondaryEmail && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      Email 2:
                    </span>{" "}
                    <a
                      href={emailHref ?? "#"}
                      onClick={(event) => {
                        event.preventDefault();
                        void handleCopy("email", state.data?.secondaryEmail);
                      }}
                      className="text-blue-600 transition hover:underline dark:text-blue-400"
                    >
                      {state.data.secondaryEmail}
                    </a>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    Teléfono:
                  </span>{" "}
                  {state.data?.phone ? (
                    <a
                      href={phoneHref ?? "#"}
                      onClick={(event) => {
                        event.preventDefault();
                        void handleCopy("phone", state.data?.phone);
                      }}
                      className="text-blue-600 transition hover:underline dark:text-blue-400"
                    >
                      {state.data.phone}
                    </a>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      No disponible
                    </span>
                  )}
                  {copyFeedback?.type === "phone" && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-300">
                      {copyFeedback.message}
                    </span>
                  )}
                </div>
                {state.data?.companies && state.data.companies.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium text-gray-700 dark:text-gray-200">
                      Empresas asignadas:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {state.data.companies.map((company) => (
                        <span
                          key={company.id}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                        >
                          {company.name}
                          <span className="rounded-full bg-blue-200 px-1.5 text-[10px] text-blue-700 dark:bg-blue-800/70 dark:text-blue-100">
                            {company.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Cerrar información de trabajador"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!emailHref || state.isLoading || Boolean(state.error)}
            onClick={handleOpenEmail}
            leftIcon={<Mail size={16} />}
          >
            Enviar email
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!phoneHref || state.isLoading || Boolean(state.error)}
            onClick={handleOpenPhone}
            leftIcon={<Phone size={16} />}
          >
            Llamar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!whatsappHref || state.isLoading || Boolean(state.error)}
            onClick={handleOpenWhatsApp}
            leftIcon={<MessageCircle size={16} />}
          >
            WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
};

interface HourSegment {
  id: string;
  start: string;
  end: string;
  total?: string;
  description?: string;
}

interface SegmentsModalTarget {
  assignmentId: string;
  workerName: string;
  companyName: string;
  dayKey: WeekDayKey;
  dayLabel: string;
  existingEntries: DayScheduleEntry[];
}

interface NotesModalTarget {
  workerName: string;
  companyName: string;
  dayLabel: string;
  dateLabel?: string;
  notes: DayNoteEntry[];
}

interface WorkerInfoData {
  id: string;
  name: string;
  email?: string;
  secondaryEmail?: string;
  phone?: string;
  companies: Array<{ id: string; name: string; count: number }>;
}

interface WorkerInfoModalState {
  workerId: string;
  workerName: string;
  isOpen: boolean;
  isLoading: boolean;
  error?: string | null;
  data?: WorkerInfoData | null;
}

interface GroupView {
  id: string;
  name: string;
  assignments: Assignment[];
  totals: Record<WeekDayKey, number>;
}

interface WorkerWeeklyDayData {
  totalHours: number;
  companyHours: Record<
    string,
    {
      companyId?: string;
      name?: string;
      hours: number;
    }
  >;
  entries?: DayScheduleEntry[];
}

interface WorkerWeeklyData {
  days: Record<string, WorkerWeeklyDayData>;
}

const hoursFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const parseTimeToMinutes = (value: string): number | null => {
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

const calculateSegmentsTotalMinutes = (segments: HourSegment[]): number =>
  segments.reduce((total, segment) => {
    const start = parseTimeToMinutes(segment.start);
    const end = parseTimeToMinutes(segment.end);

    if (start === null || end === null || end <= start) {
      return total;
    }

    return total + (end - start);
  }, 0);

const formatMinutesToHoursLabel = (totalMinutes: number): string => {
  if (totalMinutes <= 0) {
    return "0";
  }

  const hours = totalMinutes / 60;
  return hoursFormatter.format(hours);
};

const toInputNumberString = (value: unknown): string | undefined => {
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

const DOUBLE_CLICK_TIMEOUT = 400;

const createEmptyHours = (): Record<WeekDayKey, string> => ({
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
  saturday: "",
  sunday: "",
});

const initialAssignments: Assignment[] = [
  {
    id: "c1-w1",
    workerId: "w1",
    workerName: "Luis Martínez",
    companyId: "c1",
    companyName: "Mombassa",
    hours: {
      monday: "5",
      tuesday: "3",
      wednesday: "2",
      thursday: "7",
      friday: "1,5",
      saturday: "4",
      sunday: "3",
    },
  },
  {
    id: "c1-w2",
    workerId: "w2",
    workerName: "Pablo Ortega",
    companyId: "c1",
    companyName: "Mombassa",
    hours: {
      monday: "1",
      tuesday: "1,5",
      wednesday: "3",
      thursday: "1",
      friday: "2,5",
      saturday: "2",
      sunday: "2",
    },
  },
  {
    id: "c1-w3",
    workerId: "w3",
    workerName: "Juan Álvarez",
    companyId: "c1",
    companyName: "Mombassa",
    hours: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  },
  {
    id: "c1-w4",
    workerId: "w4",
    workerName: "Jose Miguel",
    companyId: "c1",
    companyName: "Mombassa",
    hours: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  },
  {
    id: "c1-w5",
    workerId: "w5",
    workerName: "Álvaro Jiménez",
    companyId: "c1",
    companyName: "Mombassa",
    hours: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  },
  {
    id: "c1-w6",
    workerId: "w6",
    workerName: "Marcos Díaz",
    companyId: "c1",
    companyName: "Mombassa",
    hours: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  },
  {
    id: "c1-w7",
    workerId: "w7",
    workerName: "Jorge Torres",
    companyId: "c1",
    companyName: "Mombassa",
    hours: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  },
  {
    id: "c2-w1",
    workerId: "w1",
    workerName: "Luis Martínez",
    companyId: "c2",
    companyName: "Tetería",
    hours: {
      monday: "1",
      tuesday: "6",
      wednesday: "2",
      thursday: "3",
      friday: "4",
      saturday: "1,5",
      sunday: "1",
    },
  },
  {
    id: "c2-w3",
    workerId: "w3",
    workerName: "Juan Álvarez",
    companyId: "c2",
    companyName: "Tetería",
    hours: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  },
  {
    id: "c3-w2",
    workerId: "w2",
    workerName: "Pablo Ortega",
    companyId: "c3",
    companyName: "Cafetería Central",
    hours: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  },
];

const initialAssignmentWorkerIds = Array.from(
  new Set(initialAssignments.map((assignment) => assignment.workerId))
);

const generateAssignmentsFromWorkers = (
  workers: Worker[],
  companyLookup: Record<string, string>
): Assignment[] => {
  const assignments: Assignment[] = [];

  workers.forEach((worker) => {
    const resolveCompanyName = (
      ...keys: Array<string | undefined | null>
    ): string | undefined => {
      for (const key of keys) {
        if (!key) {
          continue;
        }
        const trimmed = String(key).trim();
        if (!trimmed) {
          continue;
        }
        const mapped = companyLookup[trimmed];
        if (mapped && mapped.trim().length > 0) {
          return mapped.trim();
        }
      }
      return undefined;
    };

    const relations = worker.companyRelations ?? [];
    if (relations.length > 0) {
      relations.forEach((relation, index) => {
        const rawCompanyId = relation.companyId
          ? String(relation.companyId).trim()
          : undefined;
        const rawRelationId = relation.relationId
          ? String(relation.relationId).trim()
          : undefined;
        const trimmedName = relation.companyName?.trim() ?? "";
        const resolvedName =
          trimmedName || resolveCompanyName(rawRelationId, rawCompanyId);

        const displayName =
          resolvedName ||
          trimmedName ||
          rawCompanyId ||
          rawRelationId ||
          UNASSIGNED_COMPANY_LABEL;
        const companyKey =
          rawCompanyId || rawRelationId || createGroupId(displayName);
        const assignmentId = `${companyKey}-${worker.id}-${index}`;

        assignments.push({
          id: assignmentId,
          workerId: worker.id,
          workerName: worker.name,
          companyId: companyKey,
          companyName: displayName,
          hours: createEmptyHours(),
        });
      });
      return;
    }

    const companiesEntries = worker.companyContracts
      ? Object.entries(worker.companyContracts)
      : [];

    if (companiesEntries.length > 0) {
      companiesEntries.forEach(([companyName, contracts]) => {
        const trimmedName = companyName?.trim() ?? "";
        const contract = Array.isArray(contracts) ? contracts[0] : undefined;
        const contractCompanyId = contract?.companyId;
        const resolvedName =
          resolveCompanyName(contractCompanyId) || trimmedName || undefined;
        const displayName =
          resolvedName ||
          trimmedName ||
          contractCompanyId ||
          UNASSIGNED_COMPANY_LABEL;
        const candidateId = contractCompanyId || createGroupId(displayName);

        assignments.push({
          id: `${candidateId}-${worker.id}`,
          workerId: worker.id,
          workerName: worker.name,
          companyId: candidateId,
          companyName: displayName,
          hours: createEmptyHours(),
        });
      });
      return;
    }

    if (worker.companyNames && worker.companyNames.length > 0) {
      worker.companyNames.forEach((companyName) => {
        const trimmedName = companyName.trim();
        const fallbackId = worker.companies?.trim();
        const resolvedName =
          resolveCompanyName(fallbackId) ||
          trimmedName ||
          fallbackId ||
          undefined;
        const displayName =
          resolvedName || trimmedName || fallbackId || UNASSIGNED_COMPANY_LABEL;
        const candidateId = fallbackId || createGroupId(displayName);
        assignments.push({
          id: `${candidateId}-${worker.id}`,
          workerId: worker.id,
          workerName: worker.name,
          companyId: candidateId,
          companyName: displayName,
          hours: createEmptyHours(),
        });
      });
      return;
    }

    const fallbackId = worker.companies?.trim();
    const resolvedFallback = resolveCompanyName(fallbackId);
    const displayName =
      resolvedFallback || fallbackId || UNASSIGNED_COMPANY_LABEL;
    const candidateId = fallbackId || `sin-empresa-${worker.id}`;

    assignments.push({
      id: `${candidateId}-${worker.id}`,
      workerId: worker.id,
      workerName: worker.name,
      companyId: candidateId,
      companyName: displayName,
      hours: createEmptyHours(),
    });
  });

  return assignments.map(withNormalizedCompany);
};

const parseHour = (value: string): number => {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createEmptyTotals = (): Record<WeekDayKey, number> => ({
  monday: 0,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  sunday: 0,
});

interface AssignmentTotalsContext {
  workerWeekData: Record<string, WorkerWeeklyData>;
  weekDateMap: Record<WeekDayKey, string>;
}

const getManualHourValue = (
  assignment: Assignment,
  dayKey: WeekDayKey
): number | null => {
  const rawValue = assignment.hours[dayKey];
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (trimmed === "") {
    return null;
  }

  return parseHour(trimmed);
};

const getTrackedHourValue = (
  assignment: Assignment,
  dayKey: WeekDayKey,
  context: AssignmentTotalsContext
): number | null => {
  const dateKey = context.weekDateMap[dayKey];
  if (!dateKey) {
    return null;
  }

  const dayData = context.workerWeekData[assignment.workerId]?.days?.[dateKey];
  if (!dayData) {
    return null;
  }

  const tracked = resolveTrackedHoursForAssignment(dayData, assignment);
  if (typeof tracked === "number" && Number.isFinite(tracked)) {
    return tracked;
  }

  return null;
};

const resolveAssignmentHourValue = (
  assignment: Assignment,
  dayKey: WeekDayKey,
  context: AssignmentTotalsContext
): number => {
  const manual = getManualHourValue(assignment, dayKey);
  if (manual !== null) {
    return manual;
  }

  const tracked = getTrackedHourValue(assignment, dayKey, context);
  return tracked ?? 0;
};

const calculateRowTotal = (
  assignment: Assignment,
  context: AssignmentTotalsContext
): number =>
  weekDays.reduce(
    (total, day) =>
      total + resolveAssignmentHourValue(assignment, day.key, context),
    0
  );

const calculateTotals = (
  items: Assignment[],
  context: AssignmentTotalsContext
): Record<WeekDayKey, number> => {
  const totals = createEmptyTotals();

  items.forEach((item) => {
    weekDays.forEach((day) => {
      totals[day.key] += resolveAssignmentHourValue(item, day.key, context);
    });
  });

  return totals;
};

const normalizeKeyPart = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === UNASSIGNED_COMPANY_ID) {
    return UNASSIGNED_COMPANY_ID;
  }
  return trimmed;
};

const buildWorkerWeeklyData = (
  summary: WorkerHoursSummaryResult
): WorkerWeeklyData => {
  const days: WorkerWeeklyData["days"] = {};

  Object.entries(summary.hoursByDate).forEach(([dayKey, detail]) => {
    if (!detail) {
      return;
    }

    const companyHours: WorkerWeeklyDayData["companyHours"] = {};
    detail.companies.forEach((company) => {
      const identity = buildCompanyIdentity(company.companyId, company.name);
      const record = {
        companyId: identity.id,
        name: identity.name,
        hours: company.hours,
      };

      const normalizedId = normalizeKeyPart(identity.id);
      const normalizedName = normalizeKeyPart(identity.name)?.toLowerCase();

      if (normalizedId) {
        companyHours[`id:${normalizedId}`] = record;
      }
      if (normalizedName) {
        companyHours[`name:${normalizedName}`] = record;
      }
    });

    const entries = (detail.entries ?? []).map((entry) => {
      const identity = buildCompanyIdentity(entry.companyId, entry.companyName);
      return {
        ...entry,
        companyId: identity.id,
        companyName: identity.name,
        workShifts: entry.workShifts
          ? entry.workShifts.map((shift) => ({ ...shift }))
          : undefined,
      };
    });

    days[dayKey] = {
      totalHours: detail.totalHours,
      companyHours,
      entries,
    };
  });

  return { days };
};

const resolveTrackedHoursForAssignment = (
  dayData: WorkerWeeklyDayData | undefined,
  assignment: Assignment
): number | undefined => {
  if (!dayData) {
    return undefined;
  }

  const candidateKeys = new Set<string>();
  const normalizedId = normalizeKeyPart(assignment.companyId);
  if (normalizedId) {
    candidateKeys.add(`id:${normalizedId}`);
  }

  const normalizedName = normalizeKeyPart(
    assignment.companyName
  )?.toLowerCase();
  if (normalizedName) {
    candidateKeys.add(`name:${normalizedName}`);
  }

  for (const key of candidateKeys) {
    const record = dayData.companyHours[key];
    if (record) {
      return record.hours;
    }
  }

  return undefined;
};

const resolveEntriesForAssignment = (
  dayData: WorkerWeeklyDayData | undefined,
  assignment: Assignment
): DayScheduleEntry[] => {
  if (!dayData || !dayData.entries || dayData.entries.length === 0) {
    return [];
  }

  const candidateKeys = new Set<string>();
  const normalizedId = normalizeKeyPart(assignment.companyId);
  if (normalizedId) {
    candidateKeys.add(`id:${normalizedId}`);
  }

  const normalizedName = normalizeKeyPart(
    assignment.companyName
  )?.toLowerCase();
  if (normalizedName) {
    candidateKeys.add(`name:${normalizedName}`);
  }

  const matches = dayData.entries.filter((entry) => {
    const entryId = normalizeKeyPart(entry.companyId);
    if (entryId && candidateKeys.has(`id:${entryId}`)) {
      return true;
    }

    const entryName = normalizeKeyPart(entry.companyName)?.toLowerCase();
    if (entryName && candidateKeys.has(`name:${entryName}`)) {
      return true;
    }

    if (!candidateKeys.size) {
      return true;
    }

    return false;
  });

  return matches.map((entry) => ({
    ...entry,
    workShifts: entry.workShifts
      ? entry.workShifts.map((shift) => ({ ...shift }))
      : undefined,
  }));
};

const noteAppliesToAssignment = (
  note: DayNoteEntry,
  assignment: Assignment
) => {
  const normalizedAssignmentId = normalizeKeyPart(assignment.companyId);
  const normalizedAssignmentName = normalizeKeyPart(
    assignment.companyName
  )?.toLowerCase();

  const noteCompanyId = normalizeKeyPart(note.companyId);
  const noteCompanyName = normalizeKeyPart(note.companyName);

  if (
    !noteCompanyId ||
    isUnassignedCompanyIdValue(noteCompanyId) ||
    noteCompanyId === UNASSIGNED_COMPANY_ID
  ) {
    return true;
  }

  if (normalizedAssignmentId && noteCompanyId === normalizedAssignmentId) {
    return true;
  }

  const noteCompanyNameLower = noteCompanyName?.toLowerCase();
  if (
    noteCompanyNameLower &&
    (isUnassignedCompanyNameValue(noteCompanyNameLower) ||
      !noteCompanyNameLower.trim())
  ) {
    return true;
  }

  if (noteCompanyNameLower && normalizedAssignmentName) {
    return noteCompanyNameLower === normalizedAssignmentName;
  }

  return false;
};

const formatHours = (value: number): string =>
  `${hoursFormatter.format(value)} h`;

const getStartOfWeek = (date: Date): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + mondayOffset);
  return start;
};

const addWeeks = (date: Date, weeks: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return getStartOfWeek(next);
};

const weekRangeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatWeekRange = (start: Date): string => {
  const startDate = new Date(start);
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + 6);

  const startLabel = weekRangeFormatter.format(startDate);
  const endLabel = weekRangeFormatter.format(endDate);

  return `${startLabel} - ${endLabel}`;
};

interface HourSegmentsModalProps {
  isOpen: boolean;
  workerName: string;
  companyName: string;
  dayLabel: string;
  initialSegments: HourSegment[];
  existingEntries: DayScheduleEntry[];
  onClose: () => void;
  onSave: (segments: HourSegment[]) => void;
}

const createEmptySegment = (): HourSegment => ({
  id: generateUuid(),
  start: "",
  end: "",
  total: "",
  description: "",
});

const extractObservationText = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const source = raw as Record<string, unknown>;
  const observations = source.observations ?? source.observation;

  if (typeof observations === "string") {
    const trimmed = observations.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(observations)) {
    const joined = observations
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(" · ");
    return joined.length > 0 ? joined : undefined;
  }

  return undefined;
};

const HourSegmentsModal: React.FC<HourSegmentsModalProps> = ({
  isOpen,
  workerName,
  companyName,
  dayLabel,
  initialSegments,
  existingEntries,
  onClose,
  onSave,
}) => {
  const [segments, setSegments] = useState<HourSegment[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialSegments.length > 0) {
      setSegments(
        initialSegments.map((segment) => ({
          ...segment,
          total:
            toInputNumberString(
              segment.total ??
                (segment as { total?: unknown }).total ??
                (segment as { note?: string }).note ??
                undefined
            ) ?? "",
          description: segment.description ?? "",
        }))
      );
      return;
    }

    if (existingEntries.length > 0) {
      const derivedSegments = existingEntries.flatMap((entry) => {
        const entryRaw = (entry as { raw?: unknown }).raw as
          | Record<string, unknown>
          | undefined;
        const observationText = extractObservationText(entryRaw) ?? "";
        const entryTotal =
          toInputNumberString(
            entryRaw?.value ?? entryRaw?.hours ?? entry.hours
          ) ?? "";

        if (Array.isArray(entry.workShifts) && entry.workShifts.length > 0) {
          return entry.workShifts
            .map((shift, index) => {
              const start = shift.startTime ?? "";
              const end = shift.endTime ?? "";
              if (!start && !end) {
                return null;
              }

              const shiftTotal =
                toInputNumberString(
                  (shift as Record<string, unknown> | undefined)?.value ??
                    shift.hours ??
                    (shift as Record<string, unknown> | undefined)?.workedHours
                ) ?? entryTotal;

              return {
                id:
                  shift.id ??
                  `existing-shift-${entry.id}-${index}-${Math.random()
                    .toString(36)
                    .slice(2, 6)}`,
                start,
                end,
                total: shiftTotal ?? "",
                description: observationText,
              } satisfies HourSegment;
            })
            .filter((segment): segment is HourSegment => Boolean(segment));
        }

        if (entryTotal) {
          const numericHours =
            typeof entry.hours === "number" && Number.isFinite(entry.hours)
              ? entry.hours
              : parseHour(String(entryTotal).replace(",", "."));
          if (numericHours <= 0) {
            return [];
          }

          const minutes = Math.round(numericHours * 60);
          const startMinutes = 8 * 60;
          const endMinutes = startMinutes + minutes;
          const startLabel = `${String(Math.floor(startMinutes / 60)).padStart(
            2,
            "0"
          )}:${String(startMinutes % 60).padStart(2, "0")}`;
          const endLabel = `${String(Math.floor(endMinutes / 60)).padStart(
            2,
            "0"
          )}:${String(endMinutes % 60).padStart(2, "0")}`;

          return [
            {
              id: `existing-hours-${entry.id}`,
              start: startLabel,
              end: endLabel,
              total: entryTotal,
              description: observationText,
            } satisfies HourSegment,
          ];
        }

        return [];
      });

      if (derivedSegments.length > 0) {
        setSegments(derivedSegments);
        return;
      }
    }

    setSegments([createEmptySegment()]);
  }, [existingEntries, initialSegments, isOpen]);

  const invalidSegments = useMemo(
    () =>
      segments.some((segment) => {
        if (!segment.start && !segment.end) {
          return false;
        }

        if (!segment.start || !segment.end) {
          return true;
        }

        const start = parseTimeToMinutes(segment.start);
        const end = parseTimeToMinutes(segment.end);

        if (start === null || end === null) {
          return true;
        }

        return end <= start;
      }),
    [segments]
  );

  const totalMinutes = useMemo(
    () => calculateSegmentsTotalMinutes(segments),
    [segments]
  );

  const totalLabel = formatMinutesToHoursLabel(totalMinutes);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMinutesRemainder = totalMinutes % 60;

  const handleSegmentChange = (
    id: string,
    field: "start" | "end" | "total" | "description",
    value: string
  ) => {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === id ? { ...segment, [field]: value } : segment
      )
    );
  };

  const handleRemoveSegment = (id: string) => {
    setSegments((prev) => {
      const next = prev.filter((segment) => segment.id !== id);
      if (next.length === 0) {
        return [createEmptySegment()];
      }
      return next;
    });
  };

  const handleAddSegment = () => {
    setSegments((prev) => [...prev, createEmptySegment()]);
  };

  const handleSave = () => {
    const validSegments = segments.filter((segment) => {
      const start = parseTimeToMinutes(segment.start);
      const end = parseTimeToMinutes(segment.end);
      return (
        segment.start &&
        segment.end &&
        start !== null &&
        end !== null &&
        end > start
      );
    });

    onSave(validSegments.map((segment) => ({ ...segment })));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex flex-col gap-1 border-b border-gray-200 p-4 sm:p-5 dark:border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tramos horarios
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {workerName} · {dayLabel} · {companyName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-100">
            Configura los tramos horarios para sumar las horas automáticamente
            en la celda seleccionada.
          </div>

          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Tramo {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSegment(segment.id)}
                  className="px-2 py-1 text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                  leftIcon={<Trash2 size={16} />}
                >
                  Eliminar
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input
                  type="time"
                  size="sm"
                  label="Inicio"
                  value={segment.start}
                  onChange={(event) =>
                    handleSegmentChange(segment.id, "start", event.target.value)
                  }
                  required
                />
                <Input
                  type="time"
                  size="sm"
                  label="Fin"
                  value={segment.end}
                  onChange={(event) =>
                    handleSegmentChange(segment.id, "end", event.target.value)
                  }
                  required
                />
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  label="Descripción"
                  size="sm"
                  value={segment.description ?? ""}
                  onChange={(event) =>
                    handleSegmentChange(
                      segment.id,
                      "description",
                      event.target.value
                    )
                  }
                  fullWidth
                  placeholder="Observaciones del tramo"
                />
                <div className="sm:w-[12.5%]">
                  <Input
                    label="Total horas"
                    size="sm"
                    value={segment.total ?? ""}
                    onChange={(event) =>
                      handleSegmentChange(
                        segment.id,
                        "total",
                        event.target.value
                      )
                    }
                    fullWidth
                    inputMode="decimal"
                    placeholder="Ej. 3,5"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSegment}
              leftIcon={<Plus size={16} />}
            >
              Añadir tramo
            </Button>
          </div>

          {invalidSegments && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200">
              Revisa los tramos: la hora de fin debe ser posterior a la hora de
              inicio y el formato debe ser HH:MM.
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="font-medium text-gray-700 dark:text-gray-200">
              Horas calculadas
            </p>
            <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
              {totalLabel} h
              {totalMinutes > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({totalHours}h {totalMinutesRemainder}m)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:justify-end sm:gap-4 dark:border-gray-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={invalidSegments}
            className="w-full sm:w-auto"
          >
            Guardar tramos
          </Button>
        </div>
      </div>
    </div>
  );
};

export const MultipleHoursRegistryPage: React.FC = () => {
  const { externalJwt } = useAuthStore();
  const apiUrl = import.meta.env.VITE_API_BASE_URL;

  const [assignments, setAssignments] = useState<Assignment[]>(
    initialAssignments.map(withNormalizedCompany)
  );
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [companyLookupMap, setCompanyLookupMap] = useState<
    Record<string, string>
  >(() => createDefaultCompanyLookupMap());
  const [groupOptions, setGroupOptions] = useState<WorkerGroupOption[]>([
    {
      id: "all",
      label: "Trabajadores",
      description: "Incluye todas las categorías",
      memberCount: initialAssignmentWorkerIds.length,
    },
  ]);
  const [groupMembersById, setGroupMembersById] = useState<
    Record<string, string[]>
  >({
    all: initialAssignmentWorkerIds,
  });
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(["all"]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [showInactiveWorkers, setShowInactiveWorkers] = useState(false);
  const [showUnassignedWorkers, setShowUnassignedWorkers] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState<boolean>(true);
  const [isRefreshingWorkers, setIsRefreshingWorkers] =
    useState<boolean>(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"company" | "worker">("company");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [companyGroupsCollapsed, setCompanyGroupsCollapsed] = useState(false);
  const [workerGroupsCollapsed, setWorkerGroupsCollapsed] = useState(false);
  const [workerWeekData, setWorkerWeekData] = useState<
    Record<string, WorkerWeeklyData>
  >({});
  const [isLoadingWeekData, setIsLoadingWeekData] = useState(false);
  const [weekDataError, setWeekDataError] = useState<string | null>(null);
  const companyLastClickRef = useRef<number | null>(null);
  const workerLastClickRef = useRef<number | null>(null);
  const [segmentsByAssignment, setSegmentsByAssignment] = useState<
    Record<string, Record<WeekDayKey, HourSegment[]>>
  >({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [segmentModalTarget, setSegmentModalTarget] =
    useState<SegmentsModalTarget | null>(null);
  const [notesModalTarget, setNotesModalTarget] =
    useState<NotesModalTarget | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    getStartOfWeek(new Date())
  );
  const [workerInfoModal, setWorkerInfoModal] =
    useState<WorkerInfoModalState | null>(null);

  const allowedWorkersFromGroups = useMemo<Set<string> | null>(() => {
    if (!selectedGroupIds.length || selectedGroupIds.includes("all")) {
      return null;
    }

    const allowed = new Set<string>();
    selectedGroupIds.forEach((groupId) => {
      (groupMembersById[groupId] ?? []).forEach((workerId) =>
        allowed.add(workerId)
      );
    });
    return allowed;
  }, [groupMembersById, selectedGroupIds]);

  const workersMatchingGroups = useMemo(() => {
    if (allowedWorkersFromGroups === null) {
      return allWorkers;
    }

    if (!allowedWorkersFromGroups.size) {
      return [];
    }

    return allWorkers.filter((worker) =>
      allowedWorkersFromGroups.has(worker.id)
    );
  }, [allWorkers, allowedWorkersFromGroups]);

  const filteredWorkers = useMemo(() => {
    return workersMatchingGroups.filter((worker) => {
      const situationValue =
        typeof worker.situation === "number"
          ? worker.situation
          : worker.isActive === false
          ? 1
          : 0;
      const isInactive = situationValue === 1 || worker.isActive === false;
      if (!showInactiveWorkers && isInactive) {
        return false;
      }

      const hasAssignedCompany =
        Array.isArray(worker.companyRelations) &&
        worker.companyRelations.length > 0;
      if (!showUnassignedWorkers && !hasAssignedCompany) {
        return false;
      }

      return true;
    });
  }, [showInactiveWorkers, showUnassignedWorkers, workersMatchingGroups]);

  const workerNameById = useMemo(() => {
    const map: Record<string, string> = {};
    allWorkers.forEach((worker) => {
      map[worker.id] = worker.name;
    });
    return map;
  }, [allWorkers]);

  const filteredWorkerIdSet = useMemo(
    () => new Set(filteredWorkers.map((worker) => worker.id)),
    [filteredWorkers]
  );

  const normalizedSelectedWorkers = useMemo(() => {
    if (!selectedWorkerIds.length) {
      return selectedWorkerIds;
    }

    return selectedWorkerIds.filter((id) => filteredWorkerIdSet.has(id));
  }, [filteredWorkerIdSet, selectedWorkerIds]);

  const selectedWorkerId = normalizedSelectedWorkers[0] ?? "";

  const workersForSelect = filteredWorkers;

  const companyFilterOptions = useMemo(() => {
    const labelMap = new Map<string, string>();

    assignments.forEach((assignment) => {
      if (!labelMap.has(assignment.companyId)) {
        labelMap.set(assignment.companyId, assignment.companyName);
      }
    });

    Object.entries(companyLookupMap).forEach(([companyId, name]) => {
      if (!labelMap.has(companyId) && typeof name === "string") {
        labelMap.set(companyId, name);
      }
    });

    return Array.from(labelMap.entries())
      .map(([companyId, label]) => ({ value: companyId, label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" })
      );
  }, [assignments, companyLookupMap]);

  const selectionAssignments = useMemo(() => {
    let base: Assignment[];

    if (normalizedSelectedWorkers.length) {
      const selectedSet = new Set(normalizedSelectedWorkers);
      base = assignments.filter((assignment) =>
        selectedSet.has(assignment.workerId)
      );
    } else if (!filteredWorkerIdSet.size) {
      base = [] as Assignment[];
    } else {
      base = assignments.filter((assignment) =>
        filteredWorkerIdSet.has(assignment.workerId)
      );
    }

    if (!selectedCompanyIds.length) {
      return base;
    }

    const companySet = new Set(selectedCompanyIds);
    return base.filter((assignment) => companySet.has(assignment.companyId));
  }, [
    assignments,
    filteredWorkerIdSet,
    normalizedSelectedWorkers,
    selectedCompanyIds,
  ]);

  const selectionWorkerIds = useMemo(
    () =>
      Array.from(
        new Set(selectionAssignments.map((assignment) => assignment.workerId))
      ),
    [selectionAssignments]
  );

  const [requestedWorkerIds, setRequestedWorkerIds] = useState<string[] | null>(
    null
  );
  const [requestedCompanyIds, setRequestedCompanyIds] = useState<
    string[] | null
  >(null);

  const hasRequestedResults = requestedWorkerIds !== null;

  const visibleAssignments = useMemo(() => {
    if (requestedWorkerIds === null) {
      return [] as Assignment[];
    }

    if (!requestedWorkerIds.length) {
      return [] as Assignment[];
    }

    const workerSet = new Set(requestedWorkerIds);
    const companySet =
      requestedCompanyIds && requestedCompanyIds.length
        ? new Set(requestedCompanyIds)
        : null;

    return assignments.filter((assignment) => {
      if (!workerSet.has(assignment.workerId)) {
        return false;
      }

      if (companySet && !companySet.has(assignment.companyId)) {
        return false;
      }

      return true;
    });
  }, [assignments, requestedCompanyIds, requestedWorkerIds]);

  const visibleWorkerIds = useMemo(
    () => requestedWorkerIds ?? [],
    [requestedWorkerIds]
  );

  const visibleWorkerIdsKey = useMemo(() => {
    if (requestedWorkerIds === null) {
      return null;
    }
    if (!requestedWorkerIds.length) {
      return "";
    }
    return requestedWorkerIds.slice().sort().join("|");
  }, [requestedWorkerIds]);

  const selectionWorkerIdsKey = useMemo(() => {
    if (!selectionWorkerIds.length) {
      return "";
    }
    return selectionWorkerIds.slice().sort().join("|");
  }, [selectionWorkerIds]);

  const selectionCompanyIdsKey = useMemo(() => {
    if (!selectedCompanyIds.length) {
      return "";
    }
    return selectedCompanyIds.slice().sort().join("|");
  }, [selectedCompanyIds]);

  const requestedCompanyIdsKey = useMemo(() => {
    if (requestedCompanyIds === null) {
      return null;
    }
    if (!requestedCompanyIds.length) {
      return "";
    }
    return requestedCompanyIds.slice().sort().join("|");
  }, [requestedCompanyIds]);

  const resultsAreStale = useMemo(() => {
    if (requestedWorkerIds === null || requestedCompanyIds === null) {
      return selectionWorkerIds.length > 0 || selectedCompanyIds.length > 0;
    }

    return (
      visibleWorkerIdsKey !== selectionWorkerIdsKey ||
      requestedCompanyIdsKey !== selectionCompanyIdsKey
    );
  }, [
    requestedCompanyIds,
    requestedCompanyIdsKey,
    requestedWorkerIds,
    selectedCompanyIds.length,
    selectionCompanyIdsKey,
    selectionWorkerIds.length,
    selectionWorkerIdsKey,
    visibleWorkerIdsKey,
  ]);

  const resultsHelperText = useMemo(() => {
    if (resultsAreStale) {
      return 'Hay cambios sin aplicar. Pulsa "Mostrar resultados".';
    }
    if (!hasRequestedResults) {
      return 'Pulsa "Mostrar resultados" para cargar los datos seleccionados.';
    }
    if (!visibleWorkerIds.length) {
      return "No hay trabajadores en la selección actual.";
    }
    const companyNote =
      requestedCompanyIds && requestedCompanyIds.length
        ? ` en ${requestedCompanyIds.length} empresa${
            requestedCompanyIds.length > 1 ? "s" : ""
          }`
        : "";
    return `Mostrando resultados para ${visibleWorkerIds.length} trabajador${
      visibleWorkerIds.length > 1 ? "es" : ""
    }${companyNote}.`;
  }, [
    hasRequestedResults,
    requestedCompanyIds,
    resultsAreStale,
    visibleWorkerIds.length,
  ]);

  const resultsHelperTone = useMemo(() => {
    if (resultsAreStale) {
      return "text-amber-600 dark:text-amber-400";
    }
    if (hasRequestedResults) {
      return "text-emerald-600 dark:text-emerald-400";
    }
    return "text-gray-500 dark:text-gray-400";
  }, [hasRequestedResults, resultsAreStale]);

  useEffect(() => {
    setSelectedGroupIds((prev) => {
      const valid = prev.filter((id) =>
        groupOptions.some((group) => group.id === id)
      );

      if (!valid.length) {
        return [groupOptions[0]?.id ?? "all"];
      }

      if (valid.includes("all") && valid.length > 1) {
        return valid.filter((id) => id !== "all");
      }

      return valid;
    });
  }, [groupOptions]);

  useEffect(() => {
    if (normalizedSelectedWorkers.length !== selectedWorkerIds.length) {
      setSelectedWorkerIds(normalizedSelectedWorkers);
    }
  }, [normalizedSelectedWorkers, selectedWorkerIds.length]);

  useEffect(() => {
    const validCompanyIds = new Set(
      companyFilterOptions.map((option) => option.value)
    );
    setSelectedCompanyIds((prev) => {
      if (!prev.length) {
        return prev;
      }
      const next = prev.filter((id) => validCompanyIds.has(id));
      const isSame =
        next.length === prev.length &&
        next.every((id, index) => id === prev[index]);
      return isSame ? prev : next;
    });
    setRequestedCompanyIds((prev) => {
      if (prev === null || !prev.length) {
        return prev;
      }
      const next = prev.filter((id) => validCompanyIds.has(id));
      const isSame =
        next.length === prev.length &&
        next.every((id, index) => id === prev[index]);
      return isSame ? prev : next;
    });
  }, [companyFilterOptions]);

  const weekInfo = useMemo(() => {
    const monday = new Date(currentWeekStart);
    const dates: Record<WeekDayKey, string> = {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    };
    const daysOfMonth: Record<WeekDayKey, number> = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    };

    weekDays.forEach((day, index) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + index);
      dates[day.key] = formatLocalDateKey(current);
      daysOfMonth[day.key] = current.getDate();
    });

    return { dates, daysOfMonth };
  }, [currentWeekStart]);

  const weekDateMap = weekInfo.dates;
  const weekDayNumbers = weekInfo.daysOfMonth;

  const weekRangeLabel = useMemo(
    () => formatWeekRange(currentWeekStart),
    [currentWeekStart]
  );

  const totalsContext = useMemo(
    () => ({ workerWeekData, weekDateMap }),
    [workerWeekData, weekDateMap]
  );

  useEffect(() => {
    if (!apiUrl || !externalJwt) {
      setWorkerWeekData({});
      setWeekDataError(null);
      setIsLoadingWeekData(false);
      return;
    }

    if (requestedWorkerIds === null) {
      setWorkerWeekData({});
      setWeekDataError(null);
      setIsLoadingWeekData(false);
      return;
    }

    if (!requestedWorkerIds.length) {
      setWorkerWeekData({});
      setWeekDataError(null);
      setIsLoadingWeekData(false);
      return;
    }

    const start = new Date(currentWeekStart);
    const fromDate = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      0,
      0,
      0,
      0
    );
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + 6);
    toDate.setHours(23, 59, 59, 999);

    let isCancelled = false;

    const loadWeekData = async () => {
      setIsLoadingWeekData(true);
      setWeekDataError(null);

      const results = await Promise.allSettled(
        requestedWorkerIds.map(async (workerId) => {
          try {
            const summary = await fetchWorkerHoursSummary({
              apiUrl,
              token: externalJwt,
              workerId,
              from: fromDate,
              to: toDate,
              companyLookup: companyLookupMap,
              includeNotes: true,
            });

            return {
              workerId,
              summary,
            };
          } catch (error) {
            throw { workerId, error };
          }
        })
      );

      if (isCancelled) {
        return;
      }

      const nextData: Record<string, WorkerWeeklyData> = {};
      const errorMessages: string[] = [];

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const { workerId, summary } = result.value;
          nextData[workerId] = buildWorkerWeeklyData(summary);
        } else {
          const { workerId, error } = result.reason ?? {};
          console.error(
            `Error obteniendo el control horario del trabajador ${workerId}`,
            error
          );
          const workerName =
            workerId && workerNameById[workerId]
              ? workerNameById[workerId]
              : workerId ?? "un trabajador";
          errorMessages.push(
            `No se pudieron cargar los registros horarios de ${workerName}.`
          );
        }
      });

      setWorkerWeekData(nextData);
      setWeekDataError(errorMessages.length ? errorMessages.join(" ") : null);
      setIsLoadingWeekData(false);
    };

    void loadWeekData();

    return () => {
      isCancelled = true;
    };
  }, [
    apiUrl,
    companyLookupMap,
    currentWeekStart,
    externalJwt,
    requestedWorkerIds,
    visibleWorkerIdsKey,
    workerNameById,
  ]);

  const handleWeekChange = useCallback((step: number) => {
    setCurrentWeekStart((previous) => addWeeks(previous, step));
  }, []);

  const companyGroups = useMemo<GroupView[]>(() => {
    const groups = new Map<string, GroupView>();

    visibleAssignments.forEach((assignment) => {
      if (!groups.has(assignment.companyId)) {
        groups.set(assignment.companyId, {
          id: assignment.companyId,
          name: assignment.companyName,
          assignments: [],
          totals: createEmptyTotals(),
        });
      }

      const group = groups.get(assignment.companyId);
      if (group) {
        group.assignments.push(assignment);
      }
    });

    return Array.from(groups.values())
      .map((group) => {
        const sortedAssignments = [...group.assignments].sort((a, b) =>
          a.workerName.localeCompare(b.workerName, "es", {
            sensitivity: "base",
          })
        );

        return {
          ...group,
          assignments: sortedAssignments,
          totals: calculateTotals(sortedAssignments, totalsContext),
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
  }, [totalsContext, visibleAssignments]);

  const workerGroups = useMemo<GroupView[]>(() => {
    const groups = new Map<string, GroupView>();

    visibleAssignments.forEach((assignment) => {
      if (!groups.has(assignment.workerId)) {
        groups.set(assignment.workerId, {
          id: assignment.workerId,
          name: assignment.workerName,
          assignments: [],
          totals: createEmptyTotals(),
        });
      }

      const group = groups.get(assignment.workerId);
      if (group) {
        group.assignments.push(assignment);
      }
    });

    return Array.from(groups.values())
      .map((group) => {
        const sortedAssignments = [...group.assignments].sort((a, b) =>
          a.companyName.localeCompare(b.companyName, "es", {
            sensitivity: "base",
          })
        );

        return {
          ...group,
          assignments: sortedAssignments,
          totals: calculateTotals(sortedAssignments, totalsContext),
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
  }, [totalsContext, visibleAssignments]);

  const currentGroups = viewMode === "company" ? companyGroups : workerGroups;

  const collapseAllCurrentGroups = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const expandAllCurrentGroups = useCallback(() => {
    setExpandedGroups(new Set(currentGroups.map((group) => group.id)));
  }, [currentGroups]);

  useEffect(() => {
    const isCollapsed =
      viewMode === "company" ? companyGroupsCollapsed : workerGroupsCollapsed;
    if (isCollapsed) {
      return;
    }

    const targetIds = currentGroups.map((group) => group.id);

    setExpandedGroups((prev) => {
      if (
        prev.size === targetIds.length &&
        targetIds.every((id) => prev.has(id))
      ) {
        return prev;
      }

      return new Set(targetIds);
    });
  }, [companyGroupsCollapsed, currentGroups, viewMode, workerGroupsCollapsed]);

  const handleHourChange = useCallback(
    (assignmentId: string, dayKey: WeekDayKey, value: string) => {
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === assignmentId
            ? {
                ...assignment,
                hours: {
                  ...assignment.hours,
                  [dayKey]: value,
                },
              }
            : assignment
        )
      );
    },
    []
  );

  const openSegmentsModal = useCallback(
    (assignment: Assignment, dayKey: WeekDayKey, dayLabel: string) => {
      const dateKey = weekDateMap[dayKey];
      const dayData = workerWeekData[assignment.workerId]?.days?.[dateKey];
      const existingEntries = resolveEntriesForAssignment(dayData, assignment);

      setSegmentModalTarget({
        assignmentId: assignment.id,
        workerName: assignment.workerName,
        companyName: assignment.companyName,
        dayKey,
        dayLabel,
        existingEntries,
      });
    },
    [weekDateMap, workerWeekData]
  );

  const closeSegmentsModal = useCallback(() => {
    setSegmentModalTarget(null);
  }, []);

  const openNotesModal = useCallback(
    (
      assignment: Assignment,
      dayKey: WeekDayKey,
      dayLabel: string,
      notes: DayNoteEntry[],
      dateKey: string
    ) => {
      const humanReadableDate = dateKey ? formatDate(dateKey) : undefined;

      setNotesModalTarget({
        workerName: assignment.workerName,
        companyName: assignment.companyName,
        dayLabel,
        dateLabel: humanReadableDate,
        notes,
      });
    },
    []
  );

  const closeNotesModal = useCallback(() => {
    setNotesModalTarget(null);
  }, []);

  const resolveCompanyLabel = useCallback(
    (candidateId?: string | null) => {
      const normalized = normalizeKeyPart(candidateId);
      if (!normalized) {
        return null;
      }

      if (companyLookupMap[normalized]) {
        return companyLookupMap[normalized];
      }

      const matchingAssignment = assignments.find(
        (assignmentItem) => normalizeKeyPart(assignmentItem.companyId) === normalized
      );
      if (matchingAssignment) {
        return matchingAssignment.companyName;
      }

      return null;
    },
    [assignments, companyLookupMap]
  );

  const closeWorkerInfoModal = useCallback(() => {
    setWorkerInfoModal(null);
  }, []);

  const buildWorkerInfoFromWorker = useCallback(
    (worker: Worker): WorkerInfoData => {
      const normalizedEmail = trimToNull(worker.email);
      const normalizedSecondaryEmail = trimToNull(worker.secondaryEmail);
      const normalizedPhone = trimToNull(worker.phone);

      const companyMap = new Map<string, { id: string; name: string; count: number }>();

      const appendCompany = (name?: string | null, stats?: WorkerCompanyStats) => {
        const normalizedName = trimToNull(name);
        if (!normalizedName) {
          return;
        }

        const normalizedId = stats?.companyId
          ? normalizeKeyPart(stats.companyId) ?? stats.companyId
          : createGroupId(normalizedName);

        const existing = companyMap.get(normalizedId);
        const countCandidate = Math.max(
          stats?.contractCount ?? 0,
          stats?.assignmentCount ?? 0,
          1
        );

        if (existing) {
          existing.count = Math.max(existing.count, countCandidate);
        } else {
          companyMap.set(normalizedId, {
            id: normalizedId,
            name: normalizedName,
            count: countCandidate,
          });
        }
      };

      if (Array.isArray(worker.companyNames)) {
        worker.companyNames.forEach((companyName) => {
          const stats = worker.companyStats?.[companyName];
          appendCompany(companyName, stats);
        });
      }

      if (Array.isArray(worker.companyRelations)) {
        worker.companyRelations.forEach((relation) => {
          const relationName = relation.companyName ?? relation.relationId;
          const stats =
            relation.companyName && worker.companyStats
              ? worker.companyStats[relation.companyName]
              : undefined;
          appendCompany(relationName, stats);
        });
      }

      const companies = Array.from(companyMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );

      return {
        id: worker.id,
        name: worker.name,
        email: normalizedEmail ?? undefined,
        secondaryEmail: normalizedSecondaryEmail ?? undefined,
        phone: normalizedPhone ?? undefined,
        companies,
      };
    },
    []
  );

  const openWorkerInfoModal = useCallback(
    async (workerId: string, workerName: string) => {
      const normalizedTargetId = normalizeKeyPart(workerId) ?? workerId;
      const existingWorker = allWorkers.find((worker) =>
        normalizeKeyPart(worker.id) === normalizedTargetId
      );

      if (existingWorker) {
        const info = buildWorkerInfoFromWorker(existingWorker);
        setWorkerInfoModal({
          workerId: existingWorker.id,
          workerName: existingWorker.name,
          isOpen: true,
          isLoading: false,
          error: null,
          data: info,
        });
        return;
      }

      setWorkerInfoModal({
        workerId,
        workerName,
        isOpen: true,
        isLoading: true,
        error: null,
        data: null,
      });

      if (!apiUrl || !externalJwt) {
        setWorkerInfoModal({
          workerId,
          workerName,
          isOpen: true,
          isLoading: false,
          error: "Falta configuración de API o token para obtener los datos del trabajador.",
          data: null,
        });
        return;
      }

      const endpoint = buildApiEndpoint(
        apiUrl,
        `/Parameter/${encodeURIComponent(workerId)}`
      );

      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${externalJwt}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          let message = `Error ${response.status}`;
          try {
            const text = await response.text();
            if (text) {
              message = text;
            }
          } catch {
            // ignore parse failure
          }
          throw new Error(message);
        }

        const payload = await response.json();
        const email = trimToNull(payload?.providerEmail ?? payload?.email);
        const secondaryEmail = trimToNull(
          payload?.secondaryEmail ??
            payload?.secondary_email ??
            payload?.providerSecondaryEmail ??
            payload?.email2 ??
            payload?.secondaryemail
        );
        const phone = trimToNull(payload?.phone ?? payload?.telefon ?? payload?.telefono);

        const companyAggregates = new Map<string, { id: string; name: string; count: number }>();
        if (Array.isArray(payload?.parameterRelations)) {
          payload.parameterRelations.forEach((relation: any) => {
            const relationId = trimToNull(relation?.parameterRelationId);
            if (!relationId) {
              return;
            }

            const normalizedId = normalizeKeyPart(relationId);
            if (!normalizedId) {
              return;
            }

            const resolvedName =
              resolveCompanyLabel(normalizedId) ??
              resolveCompanyLabel(relationId) ??
              relationId;

            const current = companyAggregates.get(normalizedId);
            if (current) {
              current.count += 1;
            } else {
              companyAggregates.set(normalizedId, {
                id: normalizedId,
                name: resolvedName,
                count: 1,
              });
            }
          });
        }

        const companies = Array.from(companyAggregates.values()).sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        );

        setWorkerInfoModal((previous) => {
          if (!previous || previous.workerId !== workerId) {
            return previous;
          }

          return {
            workerId,
            workerName,
            isOpen: true,
            isLoading: false,
            error: null,
            data: {
              id: trimToNull(payload?.id ?? workerId) ?? workerId,
              name: trimToNull(payload?.name ?? workerName) ?? workerName,
              email: email ?? undefined,
              secondaryEmail: secondaryEmail ?? undefined,
              phone: phone ?? undefined,
              companies,
            },
          };
        });
      } catch (error) {
        console.error("Error fetching worker details", error);
        setWorkerInfoModal((previous) => {
          if (!previous || previous.workerId !== workerId) {
            return previous;
          }

          return {
            workerId,
            workerName,
            isOpen: true,
            isLoading: false,
            error:
              error instanceof Error && error.message
                ? error.message
                : "No se pudo obtener la información del trabajador.",
            data: null,
          };
        });
      }
    },
    [apiUrl, allWorkers, buildWorkerInfoFromWorker, externalJwt, resolveCompanyLabel]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ workerId: string; workerName: string }>;
      if (custom?.detail?.workerId) {
        void openWorkerInfoModal(custom.detail.workerId, custom.detail.workerName);
      }
    };

    window.addEventListener("worker-info-modal", handler as EventListener);
    return () => {
      window.removeEventListener("worker-info-modal", handler as EventListener);
    };
  }, [openWorkerInfoModal]);

  const handleSegmentsModalSave = useCallback(
    (segments: HourSegment[]) => {
      if (!segmentModalTarget) {
        setSegmentModalTarget(null);
        return;
      }

      setSegmentsByAssignment((prev) => {
        const next = { ...prev };
        const assignmentSegments = {
          ...(next[segmentModalTarget.assignmentId] ?? {}),
        };

        assignmentSegments[segmentModalTarget.dayKey] = segments;
        next[segmentModalTarget.assignmentId] = assignmentSegments;

        return next;
      });

      const totalMinutes = calculateSegmentsTotalMinutes(segments);
      const formattedValue =
        totalMinutes > 0 ? formatMinutesToHoursLabel(totalMinutes) : "";

      handleHourChange(
        segmentModalTarget.assignmentId,
        segmentModalTarget.dayKey,
        formattedValue
      );

      setSegmentModalTarget(null);
    },
    [handleHourChange, segmentModalTarget]
  );

  const handleWorkerSelectionChange = useCallback((workerIds: string[]) => {
    setSelectedWorkerIds(workerIds);
  }, []);

  const handleShowResults = useCallback(() => {
    setRequestedWorkerIds(() => [...selectionWorkerIds]);
    setRequestedCompanyIds(() => [...selectedCompanyIds]);
  }, [selectedCompanyIds, selectionWorkerIds]);

  const fetchWorkers = useCallback(async () => {
    if (!apiUrl || !externalJwt) {
      setWorkersError("Falta configuración de API o token");
      setAllWorkers([]);
      setAssignments(initialAssignments.map(withNormalizedCompany));
      setGroupOptions([
        {
          id: "all",
          label: "Trabajadores",
          description: "Incluye todas las categorías",
          memberCount: initialAssignmentWorkerIds.length,
        },
      ]);
      setGroupMembersById({ all: initialAssignmentWorkerIds });
      setLastFetchTime(null);
      setCompanyLookupMap(createDefaultCompanyLookupMap());
      setIsLoadingWorkers(false);
      return;
    }

    setIsLoadingWorkers(true);
    setWorkersError(null);

    try {
      const { workers, companyLookup, rawWorkers } = await fetchWorkersData({
        apiUrl,
        token: externalJwt,
        includeInactive: true,
      });
      setAllWorkers(workers);
      const normalizedLookup = normalizeCompanyLookupMap(companyLookup);
      setCompanyLookupMap(normalizedLookup);

      const generatedAssignments = generateAssignmentsFromWorkers(
        workers,
        normalizedLookup
      );
      if (generatedAssignments.length > 0) {
        setAssignments(generatedAssignments);
      } else {
        setAssignments(initialAssignments.map(withNormalizedCompany));
      }

      try {
        const grouping = await fetchWorkerGroupsData(apiUrl, externalJwt, {
          preloadedWorkers: rawWorkers,
        });
        const workerIdSet = new Set(workers.map((worker) => worker.id));

        const sanitizedMembers: Record<string, string[]> = {};
        grouping.groups.forEach((group) => {
          const members = (grouping.membersByGroup[group.id] ?? []).filter(
            (workerId) => workerIdSet.has(workerId)
          );
          sanitizedMembers[group.id] = Array.from(new Set(members));
        });
        sanitizedMembers.all = workers.map((worker) => worker.id);

        const options: WorkerGroupOption[] = [
          {
            id: "all",
            label: "",
            description: grouping.groups.length
              ? "Incluye todos los grupos"
              : "No hay grupos disponibles",
            memberCount: workers.length,
          },
          ...grouping.groups
            .map((group) => {
              const memberCount = sanitizedMembers[group.id]?.length ?? 0;
              const description = group.description
                ? group.description
                : memberCount === 1
                ? "1 trabajador asignado"
                : `${memberCount} trabajadores asignados`;

              return {
                id: group.id,
                label: group.label,
                description,
                memberCount,
              };
            })
            .sort((a, b) =>
              a.label.localeCompare(b.label, "es", { sensitivity: "base" })
            ),
        ];

        setGroupOptions(options);
        setGroupMembersById(sanitizedMembers);
      } catch (groupError) {
        console.error(
          "No se pudieron obtener los grupos para registro múltiple",
          groupError
        );
        const fallbackIds = workers.map((worker) => worker.id);
        setGroupOptions([
          {
            id: "all",
            label: "Trabajadores",
            description: workers.length
              ? "Incluye todas las categorías"
              : "No hay grupos disponibles",
            memberCount: workers.length,
          },
        ]);
        setGroupMembersById({ all: fallbackIds });
      }

      setLastFetchTime(new Date());
    } catch (error) {
      console.error("Error fetching workers para registro múltiple", error);
      setWorkersError("No se pudieron cargar los trabajadores");
      setAllWorkers([]);
      setAssignments(initialAssignments.map(withNormalizedCompany));
      setGroupOptions([
        {
          id: "all",
          label: "Trabajadores",
          description: "Incluye todas las categorías",
          memberCount: initialAssignmentWorkerIds.length,
        },
      ]);
      setGroupMembersById({ all: initialAssignmentWorkerIds });
      setLastFetchTime(null);
      setCompanyLookupMap(createDefaultCompanyLookupMap());
    } finally {
      setIsLoadingWorkers(false);
    }
  }, [apiUrl, externalJwt]);

  const refreshWorkers = useCallback(async () => {
    setIsRefreshingWorkers(true);
    await fetchWorkers();
    setIsRefreshingWorkers(false);
  }, [fetchWorkers]);

  useEffect(() => {
    void fetchWorkers();
  }, [fetchWorkers]);

  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleCompanyButtonClick = useCallback(() => {
    const now = Date.now();

    setViewMode("company");

    if (viewMode !== "company") {
      setCompanyGroupsCollapsed(false);
      setWorkerGroupsCollapsed(false);
      companyLastClickRef.current = null;
      workerLastClickRef.current = null;
      return;
    }

    if (companyGroupsCollapsed) {
      setCompanyGroupsCollapsed(false);
      expandAllCurrentGroups();
      companyLastClickRef.current = null;
      return;
    }

    const lastClick = companyLastClickRef.current;
    if (lastClick && now - lastClick <= DOUBLE_CLICK_TIMEOUT) {
      collapseAllCurrentGroups();
      setCompanyGroupsCollapsed(true);
      companyLastClickRef.current = null;
      return;
    }

    companyLastClickRef.current = now;
  }, [
    collapseAllCurrentGroups,
    companyGroupsCollapsed,
    expandAllCurrentGroups,
    viewMode,
    workerGroupsCollapsed,
  ]);

  const handleWorkerButtonClick = useCallback(() => {
    const now = Date.now();

    setViewMode("worker");

    if (viewMode !== "worker") {
      setWorkerGroupsCollapsed(false);
      setCompanyGroupsCollapsed(false);
      workerLastClickRef.current = null;
      companyLastClickRef.current = null;
      return;
    }

    if (workerGroupsCollapsed) {
      setWorkerGroupsCollapsed(false);
      expandAllCurrentGroups();
      workerLastClickRef.current = null;
      return;
    }

    const lastClick = workerLastClickRef.current;
    if (lastClick && now - lastClick <= DOUBLE_CLICK_TIMEOUT) {
      collapseAllCurrentGroups();
      setWorkerGroupsCollapsed(true);
      workerLastClickRef.current = null;
      return;
    }

    workerLastClickRef.current = now;
  }, [
    companyGroupsCollapsed,
    collapseAllCurrentGroups,
    expandAllCurrentGroups,
    viewMode,
    workerGroupsCollapsed,
  ]);

  const handleSaveAll = useCallback(async () => {
    if (isSavingAll) {
      return;
    }

    type ControlScheduleShift = ControlScheduleSavePayload["workShifts"][number];

    const payload: ControlScheduleSavePayload[] = [];

    visibleAssignments.forEach((assignment) => {
      weekDays.forEach((day) => {
        const dateKey = weekDateMap[day.key];
        const parameterId = assignment.workerId.trim();

        if (!dateKey || !parameterId) {
          return;
        }

        const raw = assignment.hours[day.key];
        const trimmedValue = typeof raw === "string" ? raw.trim() : "";
        const hoursValue = trimmedValue ? parseHour(trimmedValue) : 0;

        const dayData = workerWeekData[assignment.workerId]?.days?.[dateKey];
        const existingEntries = resolveEntriesForAssignment(dayData, assignment);
        const primaryEntry = existingEntries.length > 0 ? existingEntries[0] : null;
        const existingEntryId = primaryEntry?.id?.trim?.() ?? "";

        const assignmentSegments = segmentsByAssignment[assignment.id];
        const storedSegments = assignmentSegments
          ? assignmentSegments[day.key]
          : undefined;

        const fallbackSegments: HourSegment[] = primaryEntry?.workShifts
          ? primaryEntry.workShifts.map((shift) => ({
              id: shift.id?.trim() ?? "",
              start: shift.startTime ?? "",
              end: shift.endTime ?? "",
              total: shift.hours ? String(shift.hours) : "",
              description: "",
            }))
          : [];

        const segmentsSource =
          storedSegments !== undefined ? storedSegments : fallbackSegments;

        const workShifts = segmentsSource
          .map((segment): ControlScheduleShift | null => {
            const workStart = segment.start?.trim() ?? "";
            const workEnd = segment.end?.trim() ?? "";
            if (!workStart || !workEnd) {
              return null;
            }

            const shiftId = segment.id?.trim() ?? "";
            return {
              id: shiftId,
              workStart,
              workEnd,
              observations: segment.description?.trim() ?? "",
            };
          })
          .filter((shift): shift is ControlScheduleShift => Boolean(shift));

        const hasValueToSave = trimmedValue.length > 0 && hoursValue > 0;
        const hasSegmentsDefined =
          storedSegments !== undefined ? true : workShifts.length > 0;
        const hasExistingEntry = Boolean(existingEntryId);

        if (!hasValueToSave && !hasSegmentsDefined && !hasExistingEntry) {
          return;
        }

        const payloadItem: ControlScheduleSavePayload = {
          id: existingEntryId || "",
          dateTime: formatDateKeyToApiDateTime(dateKey),
          parameterId,
          controlScheduleType: CONTROL_SCHEDULE_TYPE_MANUAL,
        };

        if (hasValueToSave) {
          payloadItem.value = hoursValue.toFixed(2);
        }

        if (hasSegmentsDefined) {
          payloadItem.workShifts = workShifts;
        } else if (hasExistingEntry) {
          payloadItem.workShifts = [];
        }

        const companyId = assignment.companyId.trim();
        if (companyId && !isUnassignedCompany(companyId, assignment.companyName)) {
          payloadItem.companyId = companyId;
        }

        payload.push(payloadItem);
      });
    });

    if (payload.length === 0) {
      alert("No hay horas registradas para guardar");
      return;
    }

    if (!apiUrl || !externalJwt) {
      alert("Falta configuración de API o token de autenticación");
      return;
    }

    setIsSavingAll(true);

    try {
      const endpoint = buildApiEndpoint(apiUrl, CONTROL_SCHEDULE_SAVE_PATH);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${externalJwt}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Error ${response.status}`;
        let responseText = "";

        try {
          responseText = await response.text();
        } catch {
          responseText = "";
        }

        if (responseText && responseText.trim().length > 0) {
          try {
            const data = JSON.parse(responseText);
            if (typeof data === "string" && data.trim().length > 0) {
              errorMessage = data;
            } else if (data && typeof data === "object") {
              const candidate =
                (data as Record<string, unknown>).message ??
                (data as Record<string, unknown>).error ??
                (data as Record<string, unknown>).title ??
                (data as Record<string, unknown>).detail;
              if (
                typeof candidate === "string" &&
                candidate.trim().length > 0
              ) {
                errorMessage = candidate;
              } else {
                errorMessage = JSON.stringify(data);
              }
            }
          } catch {
            errorMessage = responseText;
          }
        }

        throw new Error(errorMessage);
      }

      alert("Horas registradas exitosamente");
    } catch (error) {
      console.error("Error al guardar horas", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "No se pudieron guardar las horas. Inténtalo nuevamente.";
      alert(`No se pudieron guardar las horas: ${message}`);
    } finally {
      setIsSavingAll(false);
    }
  }, [
    apiUrl,
    externalJwt,
    isSavingAll,
    segmentsByAssignment,
    visibleAssignments,
    weekDateMap,
    workerWeekData,
  ]);

  const weeklyTotals = useMemo(
    () => calculateTotals(visibleAssignments, totalsContext),
    [totalsContext, visibleAssignments]
  );
  const weeklyTotalHours = useMemo(
    () => weekDays.reduce((total, day) => total + weeklyTotals[day.key], 0),
    [weeklyTotals]
  );

  const workerWeeklyTotals = useMemo(() => {
    if (!visibleWorkerIds.length) {
      return [] as Array<{
        workerId: string;
        workerName: string;
        total: number;
      }>;
    }

    return visibleWorkerIds
      .map((workerId) => {
        const dayRecords = workerWeekData[workerId]?.days ?? {};
        const total = Object.values(dayRecords).reduce(
          (sum, day) => sum + (day?.totalHours ?? 0),
          0
        );

        const workerName =
          workerNameById[workerId] ??
          visibleAssignments.find(
            (assignment) => assignment.workerId === workerId
          )?.workerName ??
          workerId;

        return {
          workerId,
          workerName,
          total,
        };
      })
      .sort((a, b) =>
        a.workerName.localeCompare(b.workerName, "es", { sensitivity: "base" })
      );
  }, [visibleAssignments, visibleWorkerIds, workerNameById, workerWeekData]);

  const renderGroupCard = useCallback(
    (group: GroupView) => {
      const isExpanded = expandedGroups.has(group.id);
      const totalByGroup = weekDays.reduce(
        (total, day) => total + group.totals[day.key],
        0
      );
      return (
        <Card
          key={group.id}
          className="border border-gray-200 shadow-sm dark:border-gray-700"
        >
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleGroupExpansion(group.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:text-blue-300"
                aria-label={isExpanded ? "Contraer grupo" : "Expandir grupo"}
              >
                {isExpanded ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
              <div>
                {viewMode === "worker" ? (
                  <button
                    type="button"
                    onDoubleClick={() =>
                      openWorkerInfoModal(group.id, group.name)
                    }
                    className="text-left text-lg font-semibold text-gray-900 transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white dark:hover:text-blue-300"
                    title="Doble clic para ver detalles del trabajador"
                  >
                    {group.name}
                  </button>
                ) : (
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {group.name}
                  </h3>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {viewMode === "company"
                    ? `${group.assignments.length} trabajador${
                        group.assignments.length === 1 ? "" : "es"
                      }`
                    : `${group.assignments.length} empresa${
                        group.assignments.length === 1 ? "" : "s"
                      }`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-8 gap-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
              {weekDays.map((day) => (
                <div
                  key={`${group.id}-${day.key}`}
                  className="flex flex-col items-end"
                >
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {day.shortLabel}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {formatHours(group.totals[day.key])}
                  </span>
                </div>
              ))}
              <div className="flex flex-col items-end text-blue-600 dark:text-blue-300">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Total
                </span>
                <span className="text-sm font-semibold">
                  {formatHours(totalByGroup)}
                </span>
              </div>
            </div>
          </CardHeader>

          {isExpanded && (
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/70">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                        {viewMode === "company" ? "Trabajador" : "Empresa"}
                      </th>
                      {weekDays.map((day) => (
                        <th
                          key={`${group.id}-${day.key}-header`}
                          className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-300"
                        >
                          {day.label} {weekDayNumbers[day.key] ?? ""}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {group.assignments.map((assignment, index) => {
                      const rowTotal = calculateRowTotal(
                        assignment,
                        totalsContext
                      );

                      return (
                        <tr
                          key={assignment.id}
                          className={
                            index % 2 === 0
                              ? "bg-white dark:bg-gray-900"
                              : "bg-gray-50 dark:bg-gray-900/70"
                          }
                        >
                          <td className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white">
                            {viewMode === "company" ? (
                              <button
                                type="button"
                                onDoubleClick={() =>
                                  openWorkerInfoModal(
                                    assignment.workerId,
                                    assignment.workerName
                                  )
                                }
                                className="inline-flex w-full cursor-pointer select-none items-center justify-start gap-2 rounded-md px-2 py-1 text-left transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-blue-900/30"
                                title="Doble clic para ver detalles"
                              >
                                {assignment.workerName}
                              </button>
                            ) : (
                              assignment.companyName
                            )}
                          </td>
                          {weekDays.map((day) => {
                            const trackedHours = getTrackedHourValue(
                              assignment,
                              day.key,
                              totalsContext
                            );
                            const trackedHoursValue =
                              typeof trackedHours === "number"
                                ? hoursFormatter.format(trackedHours)
                                : "";

                            const currentValue = assignment.hours[day.key];
                            const hasManualValue =
                              typeof currentValue === "string" &&
                              currentValue.trim() !== "";
                            const inputValue = hasManualValue
                              ? currentValue
                              : trackedHoursValue;

                            const existingSegments =
                              segmentsByAssignment[assignment.id]?.[day.key] ?? [];
                            const hasSegments = existingSegments.length > 0;

                            const dateKey = weekDateMap[day.key];
                            const dayData =
                              workerWeekData[assignment.workerId]?.days?.[dateKey];
                            const filteredNotes = (dayData?.noteEntries ?? []).filter(
                              (note) =>
                                typeof note?.text === "string" &&
                                note.text.trim().length > 0 &&
                                noteAppliesToAssignment(note, assignment)
                            );
                            const hasNotes = filteredNotes.length > 0;

                            const highlightClass = hasSegments
                              ? "border-blue-300 focus:ring-blue-400"
                              : hasNotes
                              ? "border-amber-300 focus:ring-amber-400"
                              : "";

                            return (
                              <td
                                key={`${assignment.id}-${day.key}`}
                                className={`px-2 py-2 ${
                                  hasNotes
                                    ? "bg-amber-50 dark:bg-amber-900/30"
                                    : ""
                                }`}
                              >
                                <div className="flex h-full w-full items-center justify-center rounded-lg px-1 py-1 text-center">
                                  <div className="flex items-center gap-1">
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openNotesModal(
                                            assignment,
                                            day.key,
                                            day.label,
                                            filteredNotes,
                                            dateKey
                                          )
                                        }
                                        className={`absolute inset-y-0 left-1.5 z-10 flex items-center text-gray-300 transition hover:text-amber-600 focus:outline-none ${
                                          hasNotes ? "text-amber-500" : ""
                                        }`}
                                        aria-label="Ver notas del día"
                                        tabIndex={-1}
                                      >
                                        <NotebookPen size={14} />
                                      </button>
                                      <Input
                                        size="sm"
                                        type="text"
                                        inputMode="decimal"
                                        value={inputValue}
                                        onChange={(event) =>
                                          handleHourChange(
                                            assignment.id,
                                            day.key,
                                            event.target.value
                                          )
                                        }
                                        className={`w-16 text-center pr-9 pl-7 ${highlightClass}`}
                                        placeholder="0"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openSegmentsModal(
                                            assignment,
                                            day.key,
                                            day.label
                                          )
                                        }
                                        className={`absolute inset-y-0 right-2 flex items-center text-gray-300 transition hover:text-blue-600 focus:outline-none ${
                                          hasSegments ? "text-blue-600" : ""
                                        }`}
                                        aria-label="Configurar tramos horarios"
                                        tabIndex={-1}
                                      >
                                        <CalendarClock size={14} />
                                      </button>
                                    </div>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      h
                                    </span>
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-200">
                            {formatHours(rowTotal)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-100 dark:bg-gray-800/80">
                      <td className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Total{" "}
                        {viewMode === "company" ? "empresa" : "trabajador"}
                      </td>
                      {weekDays.map((day) => (
                        <td
                          key={`${group.id}-${day.key}-total`}
                          className="px-2 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200"
                        >
                          {formatHours(group.totals[day.key])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {formatHours(totalByGroup)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      );
    },
    [
      expandedGroups,
      handleHourChange,
      openSegmentsModal,
      openWorkerInfoModal,
      toggleGroupExpansion,
      viewMode,
      totalsContext,
      segmentsByAssignment,
      weekDayNumbers,
    ]
  );

  return (
    <>
      <div className="space-y-6 w-full max-w-full min-w-0">
        <PageHeader
          title="Registro Múltiple"
          description="Registra y compara las horas semanales por empresa o trabajador sin perder los totales diarios."
          actionLabel="Guardar Todo"
          onAction={handleSaveAll}
          actionIcon={<Save size={18} />}
          actionDisabled={isSavingAll}
          actionLoading={isSavingAll}
        />

        <Card className="overflow-visible">
          <CardHeader>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                  <Users
                    size={20}
                    className="mr-2 text-blue-600 dark:text-blue-400"
                  />
                  Selección de grupo
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex max-w-[255px] items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 px-3 py-1 text-sm text-gray-600 dark:text-gray-300">
                    Actualizado:{" "}
                    {lastFetchTime
                      ? lastFetchTime.toLocaleString("es-ES")
                      : "Sin sincronizar"}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={refreshWorkers}
                    disabled={isRefreshingWorkers || isLoadingWorkers}
                    leftIcon={
                      <RefreshCw
                        size={16}
                        className={isRefreshingWorkers ? "animate-spin" : ""}
                      />
                    }
                  >
                    Actualizar
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingWorkers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  Sincronizando trabajadores...
                </span>
              </div>
            ) : (
              <>
                <GroupSearchSelect
                  groups={groupOptions}
                  selectedGroupIds={selectedGroupIds}
                  onSelectionChange={setSelectedGroupIds}
                  placeholder="Buscar y seleccionar grupo..."
                  clearOptionId="all"
                />

                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 dark:text-gray-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showInactiveWorkers}
                      onChange={(event) =>
                        setShowInactiveWorkers(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                    />
                    Mostrar todos (incluye bajas)
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showUnassignedWorkers}
                      onChange={(event) =>
                        setShowUnassignedWorkers(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                    />
                    Incluir sin empresa asignada
                  </label>
                </div>

                {companyFilterOptions.length > 0 && (
                  <CompanySearchSelect
                    options={companyFilterOptions}
                    selectedValues={selectedCompanyIds}
                    onSelectionChange={setSelectedCompanyIds}
                    placeholder="Buscar empresa..."
                    label="Filtrar por empresa"
                  />
                )}

                {workersForSelect.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                    {workersError ||
                      (selectedGroupIds.includes("all")
                        ? "No hay trabajadores sincronizados. Usa “Actualizar” para obtener los registros desde la API."
                        : "No hay trabajadores asignados a este grupo. Selecciona otro grupo o sincroniza nuevamente.")}
                  </div>
                ) : (
                  <WorkerSearchSelect
                    workers={workersForSelect}
                    selectedWorkerIds={selectedWorkerIds}
                    onSelectionChange={handleWorkerSelectionChange}
                    placeholder={
                      selectedGroupIds.includes("all")
                        ? "Buscar y seleccionar trabajador..."
                        : "Buscar trabajador dentro del grupo..."
                    }
                    label={
                      selectedGroupIds.includes("all")
                        ? "Trabajador"
                        : "Trabajador del grupo"
                    }
                  />
                )}

                {workersError && workersForSelect.length !== 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {workersError}
                  </p>
                )}

                <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                  <Button
                    onClick={handleShowResults}
                    disabled={isLoadingWorkers}
                  >
                    Mostrar resultados
                  </Button>
                  <span className={`text-sm ${resultsHelperTone}`}>
                    {resultsHelperText}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl truncate font-semibold text-gray-900 dark:text-white">
                  Registro semanal
                </h2>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4 lg:w-full">
                <div className="flex w-full flex-wrap items-center justify-center gap-2 lg:flex-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleWeekChange(-1)}
                    leftIcon={<ChevronLeft size={16} />}
                    aria-label="Semana anterior"
                  >
                    Anterior
                  </Button>
                  <div className="w-55 rounded-lg border border-gray-200 px-3 py-1 text-center text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200 whitespace-nowrap">
                    {weekRangeLabel}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleWeekChange(1)}
                    rightIcon={<ChevronRight size={16} />}
                    aria-label="Semana siguiente"
                  >
                    Siguiente
                  </Button>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800 lg:ml-auto">
                  {[
                    { value: "company", label: "Por empresa" },
                    { value: "worker", label: "Por trabajador" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={
                        option.value === "company"
                          ? handleCompanyButtonClick
                          : handleWorkerButtonClick
                      }
                      className={`px-4 py-2 text-sm font-medium rounded-full transition ${
                        viewMode === option.value
                          ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-300"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingWeekData && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <RefreshCw size={16} className="h-4 w-4 animate-spin" />
                <span>Cargando registros horarios...</span>
              </div>
            )}

            {weekDataError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-200">
                {weekDataError}
              </div>
            )}

            {!hasRequestedResults ? (
              <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-12 text-center text-blue-700 dark:border-blue-400/40 dark:bg-blue-950/20 dark:text-blue-200">
                Pulsa "Mostrar resultados" para cargar los registros horarios.
              </div>
            ) : currentGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No hay trabajadores asignados a esta vista.
              </div>
            ) : (
              <div className="space-y-4">
                {currentGroups.map((group) => renderGroupCard(group))}
              </div>
            )}
          </CardContent>
        </Card>

        {hasRequestedResults && workerWeeklyTotals.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Horas por trabajador ({weekRangeLabel})
              </h2>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {workerWeeklyTotals.map((worker) => (
                  <div
                    key={`worker-total-${worker.workerId}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {worker.workerName}
                    </span>
                    <span className="text-base font-semibold text-blue-600 dark:text-blue-300">
                      {formatHours(worker.total)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {hasRequestedResults && (
          <Card>
            <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Total semanal
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatHours(weeklyTotalHours)}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Sumatoria de todas las horas registradas en la tabla.
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-7 lg:w-auto">
                {weekDays.map((day) => (
                  <div
                    key={`summary-${day.key}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {day.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                      {formatHours(weeklyTotals[day.key])}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
      <DayNotesModal
        isOpen={notesModalTarget !== null}
        workerName={notesModalTarget?.workerName ?? ""}
        companyName={notesModalTarget?.companyName ?? ""}
        dayLabel={notesModalTarget?.dayLabel ?? ""}
        dateLabel={notesModalTarget?.dateLabel}
        notes={notesModalTarget?.notes ?? []}
        onClose={closeNotesModal}
      />
      <HourSegmentsModal
        isOpen={segmentModalTarget !== null}
        workerName={segmentModalTarget?.workerName ?? ""}
        companyName={segmentModalTarget?.companyName ?? ""}
        dayLabel={segmentModalTarget?.dayLabel ?? ""}
        initialSegments={
          segmentModalTarget
            ? segmentsByAssignment[segmentModalTarget.assignmentId]?.[
                segmentModalTarget.dayKey
              ] ?? []
            : []
        }
        existingEntries={segmentModalTarget?.existingEntries ?? []}
        onClose={closeSegmentsModal}
        onSave={handleSegmentsModalSave}
      />
      {workerInfoModal?.isOpen && (
        <WorkerInfoModal state={workerInfoModal} onClose={closeWorkerInfoModal} />
      )}
    </>
  );
};
