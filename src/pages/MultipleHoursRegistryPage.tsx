import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addDays, differenceInCalendarDays } from "date-fns";
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
import {
  Worker,
  WorkerCompanyContract,
  WorkerCompanyStats,
} from "../types/salary";
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
import { DateRangePicker } from "../components/ui/DateRangePicker";

interface DayDescriptor {
  date: Date;
  dateKey: string;
  label: string;
  shortLabel: string;
  dayOfMonth: number;
}

interface DateInterval {
  start: Date;
  end: Date;
}

interface Assignment {
  id: string;
  workerId: string;
  workerName: string;
  companyId: string;
  companyName: string;
  hours: Record<string, string>;
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

const ALL_COMPANIES_OPTION_ID = "all-companies";
const ALL_COMPANIES_OPTION_LABEL = "Todas las empresas";

const getEffectiveCompanyIds = (ids: string[]): string[] => {
  if (!ids.length) {
    return ids;
  }
  if (ids.includes(ALL_COMPANIES_OPTION_ID)) {
    return ids.filter((id) => id !== ALL_COMPANIES_OPTION_ID);
  }
  return ids;
};

const trimToNull = (value?: string | null): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const pickFirstString = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
};

const normalizeParameterGroups = (payload: unknown): unknown[][] => {
  if (Array.isArray(payload)) {
    return payload.map((group) => {
      if (Array.isArray(group)) {
        return group;
      }
      if (group === null || group === undefined) {
        return [];
      }
      return [group];
    });
  }

  if (payload && typeof payload === "object") {
    const container = payload as Record<string, unknown>;
    const numericEntries: Array<[number, unknown[]]> = [];
    let sequentialIndex = 0;

    Object.entries(container).forEach(([rawKey, rawValue]) => {
      const match = rawKey.match(/(\d+)/);
      const indexCandidate = match ? Number(match[1]) : Number(rawKey);
      const group = Array.isArray(rawValue)
        ? rawValue
        : rawValue === null || rawValue === undefined
        ? []
        : [rawValue];

      if (Number.isFinite(indexCandidate)) {
        numericEntries.push([indexCandidate, group]);
      } else {
        numericEntries.push([sequentialIndex, group]);
        sequentialIndex += 1;
      }
    });

    if (!numericEntries.length) {
      return [];
    }

    numericEntries.sort((a, b) => a[0] - b[0]);

    const highestIndex = numericEntries[numericEntries.length - 1][0];
    const result: unknown[][] = Array.from({ length: highestIndex + 1 }, () => []);

    numericEntries.forEach(([index, group]) => {
      result[index] = group;
    });

    return result;
  }

  return [];
};

const fetchParameterLabels = async (
  apiUrl: string,
  token: string,
  ids: string[]
): Promise<Record<string, string>> => {
  const trimmedIds = Array.from(
    new Set(
      ids
        .map((id) => trimToNull(id))
        .filter((id): id is string => Boolean(id))
    )
  );

  if (!trimmedIds.length) {
    return {};
  }

  const params = new URLSearchParams();
  trimmedIds.forEach((id, index) => {
    params.append(`Ids[${index}]`, id);
  });

  const endpoint = buildApiEndpoint(
    apiUrl,
    `/Parameter/GetByIds?${params.toString()}`
  );

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (response.status === 204 || response.status === 404) {
    return {};
  }

  if (!response.ok) {
    throw new Error(`Error ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    console.warn("No se pudo parsear la respuesta de Parameter/GetByIds", error);
    return {};
  }

  const groups = normalizeParameterGroups(payload);
  const labelMap = new Map<string, string>();

  const registerLabel = (idValue: string | null, labelValue: string | null) => {
    const normalizedId = trimToNull(idValue);
    const normalizedLabel = trimToNull(labelValue);
    if (!normalizedId || !normalizedLabel) {
      return;
    }
    labelMap.set(normalizedId, normalizedLabel);
    labelMap.set(normalizedId.toLowerCase(), normalizedLabel);
    labelMap.set(normalizedId.toUpperCase(), normalizedLabel);
  };

  groups.forEach((group, index) => {
    const idForGroup = trimmedIds[index] ?? null;
    if (idForGroup) {
      const labelFromGroup = group
        .map((entry) => {
          if (typeof entry === "string") {
            return trimToNull(entry);
          }
          if (entry && typeof entry === "object") {
            const record = entry as Record<string, unknown>;
            return pickFirstString(
              record?.name,
              record?.label,
              record?.description,
              record?.title,
              record?.parameterName,
              record?.parameterLabel,
              record?.value
            );
          }
          return null;
        })
        .find((value): value is string => Boolean(value));

      if (labelFromGroup) {
        registerLabel(idForGroup, labelFromGroup);
      }
    }

    group.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const record = entry as Record<string, unknown>;
      const recordId = pickFirstString(
        record?.id,
        record?.parameterId,
        record?.parameter_id,
        record?.guid,
        record?.value,
        record?.code,
        record?.parameterGuid
      );

      const recordLabel = pickFirstString(
        record?.name,
        record?.label,
        record?.description,
        record?.title,
        record?.parameterName,
        record?.parameterLabel,
        record?.displayName
      );

      registerLabel(recordId, recordLabel);
    });
  });

  const result: Record<string, string> = {};
  labelMap.forEach((label, key) => {
    result[key] = label;
  });

  return result;
};

const INACTIVE_SITUATION_TOKENS = new Set([
  "1",
  "01",
  "10",
  "1.0",
  "baja",
  "inactive",
  "inactivo",
  "inactiva",
  "debaja",
  "bajalaboral",
]);

const ACTIVE_SITUATION_TOKENS = new Set([
  "0",
  "00",
  "0.0",
  "alta",
  "activo",
  "activa",
]);

const normalizeSituationToken = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");

const parseSituationValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return numeric;
    }

    const normalized = normalizeSituationToken(trimmed);
    if (!normalized) {
      return null;
    }

    if (INACTIVE_SITUATION_TOKENS.has(normalized)) {
      return 1;
    }
    if (ACTIVE_SITUATION_TOKENS.has(normalized)) {
      return 0;
    }
  }
  return null;
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
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16;
    const value =
      char === "x" ? Math.floor(random) : (Math.floor(random) & 0x3) | 0x8;
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

const parseNumericValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9,.-]/g, "").replace(/,/g, ".");
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const formatActiveStatus = (
  isActive?: boolean,
  situation?: number | null
): string | null => {
  if (typeof isActive === "boolean") {
    return isActive ? "Alta" : "Baja";
  }
  if (typeof situation === "number") {
    return situation === 1 ? "Baja" : "Alta";
  }
  return null;
};

const formatPersonalType = (value?: string | null): string | null => {
  const normalized = trimToNull(value);
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (["1", "weekly", "week", "semanal", "semana"].includes(lowered)) {
    return "Semanal";
  }
  if (["0", "monthly", "month", "mensual", "mes"].includes(lowered)) {
    return "Mensual";
  }
  if (["2", "biweekly", "quincenal", "quincena", "bi-weekly"].includes(lowered)) {
    return "Quincenal";
  }

  return normalized;
};

const formatSituationLabel = (value?: number | null | string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value === 1 ? "Baja" : "Alta";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed === "1") {
      return "Baja";
    }

    if (trimmed === "0") {
      return "Alta";
    }
  }

  return null;
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

interface WorkerContractListProps {
  companyName: string;
  contracts: WorkerCompanyContract[];
  assignmentCount?: number;
  contractCount?: number;
}

const formatMaybeDate = (value?: string | null) => {
  const normalized = trimToNull(value);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDate(parsed.toISOString());
    }
  } catch (error) {
    console.warn("No se pudo formatear la fecha", error);
  }

  return normalized;
};

const WorkerContractList: React.FC<WorkerContractListProps> = ({
  companyName,
  contracts,
  assignmentCount,
  contractCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex flex-col gap-1 text-left">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {companyName}
          </h5>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {(contractCount ?? contracts.length) === 1
                ? "1 contrato"
                : `${contractCount ?? contracts.length} contratos`}
            </span>
            {typeof assignmentCount === "number" && assignmentCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-200 px-2 py-0.5 font-semibold text-blue-800 dark:bg-blue-800/60 dark:text-blue-100">
                Asignaciones {assignmentCount}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="mt-3 max-h-48 space-y-3 overflow-y-auto pr-1">
          {contracts.length === 0 ? (
            <div className="rounded-md bg-white p-3 text-xs text-gray-500 shadow-sm dark:bg-gray-900 dark:text-gray-400">
              Este trabajador no tiene contratos guardados para esta empresa.
            </div>
          ) : (
            contracts.map((contract, index) => {
              const label = trimToNull(contract.label) ?? `Contrato ${index + 1}`;
              const typeText = trimToNull(contract.typeLabel ?? contract.position);
              const descriptionText = trimToNull(contract.description);
              const startDate = formatMaybeDate(contract.startDate);
              const endDate = formatMaybeDate(contract.endDate);
          const statusText = trimToNull(contract.status);

          return (
            <div
              key={`${contract.id}-${index}`}
              className="rounded-md bg-white p-3 text-sm text-gray-700 shadow-sm dark:bg-gray-900 dark:text-gray-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {label}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                      contract.hasContract
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                        : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {contract.hasContract ? "Activo" : "Asignación"}
                  </span>
                  {statusText && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {statusText}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 grid gap-1 text-xs text-gray-600 dark:text-gray-400">
                {typeText && <span>{typeText}</span>}
                {(startDate || endDate) && (
                  <span>
                    {startDate ?? "¿"} – {endDate ?? "¿"}
                  </span>
                )}
                {typeof contract.hourlyRate === "number" && (
                  <span>Tarifa: {contract.hourlyRate.toFixed(2)} €/h</span>
                )}
              </div>

              {descriptionText && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {descriptionText}
                </p>
              )}
            </div>
            );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface WorkerCompaniesAndContractsProps {
  companies: Array<{ id: string; name: string; count: number }>;
  contractsByCompany: Record<string, WorkerCompanyContract[]>;
  companyStats?: Record<string, WorkerCompanyStats>;
}

const WorkerCompaniesAndContracts: React.FC<WorkerCompaniesAndContractsProps> = ({
  companies,
  contractsByCompany,
  companyStats,
}) => {
  const entries = useMemo(() => {
    const merged = new Map<
      string,
      {
        assignmentCount: number;
        contractCount: number;
        contracts: WorkerCompanyContract[];
      }
    >();

    companies.forEach((company) => {
      const stats = companyStats?.[company.name];
      merged.set(company.name, {
        assignmentCount:
          stats?.assignmentCount ?? company.count ?? stats?.contractCount ?? 0,
        contractCount:
          stats?.contractCount ?? contractsByCompany[company.name]?.length ?? 0,
        contracts: contractsByCompany[company.name] ?? [],
      });
    });

    Object.entries(contractsByCompany ?? {}).forEach(([companyName, contracts]) => {
      const existing = merged.get(companyName);
      if (existing) {
        existing.contracts = contracts ?? [];
        if (typeof existing.contractCount !== "number") {
          existing.contractCount = contracts?.length ?? 0;
        } else {
          existing.contractCount = contracts?.length ?? existing.contractCount;
        }
      } else {
        const stats = companyStats?.[companyName];
        merged.set(companyName, {
          assignmentCount: stats?.assignmentCount ?? 0,
          contractCount: stats?.contractCount ?? contracts?.length ?? 0,
          contracts: contracts ?? [],
        });
      }
    });

    const result = Array.from(merged.entries()).map(([companyName, data]) => ({
      companyName,
      assignmentCount: data.assignmentCount,
      contractCount: data.contractCount,
      contracts: data.contracts,
    }));

    result.sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "es", { sensitivity: "base" })
    );

    return result;
  }, [companies, contractsByCompany, companyStats]);

  if (!entries.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Empresas y contratos
      </h4>
      {entries.map((entry) => (
        <WorkerContractList
          key={entry.companyName}
          companyName={entry.companyName}
          contracts={entry.contracts}
          assignmentCount={entry.assignmentCount}
          contractCount={entry.contractCount}
        />
      ))}
    </div>
  );
};

const WorkerInfoModal: React.FC<WorkerInfoModalProps> = ({
  state,
  onClose,
}) => {
  if (!state.isOpen) {
    return null;
  }

  const [copyFeedback, setCopyFeedback] = useState<{
    type: "email" | "phone";
    message: string;
    target?: string;
  } | null>(null);

  const phoneHref = state.data?.phone
    ? sanitizeTelHref(state.data.phone)
    : null;
  const whatsappHref = state.data?.phone
    ? buildWhatsAppLink(state.data.phone)
    : null;
  const emailHref = state.data?.email ? `mailto:${state.data.email}` : null;

  const generalInfo = useMemo(() => {
    if (!state.data) {
      return [] as Array<{ label: string; value: string }>;
    }

    const items: Array<{ label: string; value: string }> = [];
    const addItem = (
      label: string,
      value: string | number | null | undefined,
      options: { fallback?: string; always?: boolean } = {}
    ) => {
      const { fallback = "No disponible", always = false } = options;

      let normalized: string | null = null;
      if (typeof value === "number") {
        normalized = Number.isFinite(value) ? String(value) : null;
      } else if (typeof value === "string") {
        normalized = trimToNull(value);
      } else if (value !== null && value !== undefined) {
        normalized = trimToNull(String(value));
      }

      if (normalized) {
        items.push({ label, value: normalized });
        return;
      }

      if (always) {
        items.push({ label, value: fallback });
      }
    };

    const dniDisplay = state.data.dni ? state.data.dni.toUpperCase() : state.data.dni;
    addItem("DNI", dniDisplay, { always: true });

    addItem("Dirección", state.data.address, { always: true });

    const ibanDisplay = state.data.iban
      ? state.data.iban.toUpperCase()
      : state.data.iban;
    addItem("IBAN", ibanDisplay, { always: true });

    const categoryDisplay = state.data.category ?? state.data.categoryId;
    addItem("Categoría", categoryDisplay, { always: true });

    const subcategoryDisplay =
      state.data.subcategory ?? state.data.subcategoryId;
    addItem("Subcategoría", subcategoryDisplay, { always: true });

    const staffTypeDisplay =
      formatPersonalType(state.data.staffType) ??
      trimToNull(state.data.staffType);
    addItem("Tipo de personal", staffTypeDisplay, { always: true });

    const birthDateDisplay =
      formatMaybeDate(state.data.birthDate) ?? state.data.birthDate;
    addItem("Fecha de nacimiento", birthDateDisplay, { always: true });

    addItem("Seguridad Social", state.data.socialSecurity, { always: true });

    const statusText = formatActiveStatus(
      state.data.isActive,
      state.data.situation ?? null
    );
    const statusLabel =
      statusText ??
      formatSituationLabel(state.data.situation) ??
      (state.data.situation !== undefined && state.data.situation !== null
        ? `Código ${state.data.situation}`
        : null);
    addItem("Estado", statusLabel, { always: true });

    addItem("Departamento", state.data.department);
    addItem("Puesto", state.data.position);

    if (state.data.contractType) {
      const contractLabel =
        state.data.contractType === "full_time"
          ? "Tiempo completo"
          : state.data.contractType === "part_time"
          ? "Tiempo parcial"
          : state.data.contractType === "freelance"
          ? "Freelance"
          : state.data.contractType;
      addItem("Tipo de contrato", contractLabel);
    }

    const formattedStart =
      formatMaybeDate(state.data.startDate) ?? state.data.startDate;
    addItem("Inicio", formattedStart);

    if (typeof state.data.baseSalary === "number") {
      addItem("Salario base", euroFormatter.format(state.data.baseSalary));
    }

    if (typeof state.data.hourlyRate === "number") {
      addItem("Tarifa hora", euroFormatter.format(state.data.hourlyRate));
    }

    return items;
  }, [state.data]);

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

        <div className="mt-4 max-h-[65vh] overflow-y-auto space-y-4 pr-1">
          {state.isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cargando información del trabajador...
            </p>
          ) : state.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          ) : (
            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <div className="space-y-2">
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
              </div>

              {generalInfo.length > 0 && (
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  {generalInfo.map((item) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      className="text-gray-600 dark:text-gray-300"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {item.label}:
                      </span>{" "}
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {state.data && !state.isLoading && !state.error && (
            <WorkerCompaniesAndContracts
              companies={state.data.companies ?? []}
              contractsByCompany={state.data.contractsByCompany ?? {}}
              companyStats={state.data.companyStats}
            />
          )}
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
  dateKey: string;
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
  contractsByCompany: Record<string, WorkerCompanyContract[]>;
  role?: Worker["role"];
  situation?: number | null;
  isActive?: boolean;
  department?: string;
  position?: string;
  baseSalary?: number;
  hourlyRate?: number;
  contractType?: Worker["contractType"];
  startDate?: string;
  dni?: string;
  socialSecurity?: string;
  birthDate?: string;
  address?: string;
  iban?: string;
  category?: string;
  categoryId?: string;
  subcategory?: string;
  subcategoryId?: string;
  staffType?: string;
  companyStats?: Record<string, WorkerCompanyStats>;
  rawPayload?: Record<string, unknown> | null;
}

interface WorkerInfoModalState {
  workerId: string;
  workerName: string;
  isOpen: boolean;
  isLoading: boolean;
  error?: string | null;
  data?: WorkerInfoData | null;
}

const resolveWorkerParameterLabels = async (
  info: WorkerInfoData,
  apiUrl: string,
  token: string
): Promise<WorkerInfoData> => {
  const pending: Array<{
    id: string;
    assign: (target: WorkerInfoData, label: string) => void;
  }> = [];

  const normalizedCategoryId = trimToNull(info.categoryId);
  if (normalizedCategoryId && !trimToNull(info.category)) {
    pending.push({
      id: normalizedCategoryId,
      assign: (target, label) => {
        target.category = label;
      },
    });
  }

  const normalizedSubcategoryId = trimToNull(info.subcategoryId);
  if (normalizedSubcategoryId && !trimToNull(info.subcategory)) {
    pending.push({
      id: normalizedSubcategoryId,
      assign: (target, label) => {
        target.subcategory = label;
      },
    });
  }

  if (!pending.length) {
    return info;
  }

  const lookupIds = Array.from(new Set(pending.map((item) => item.id)));

  try {
    const labelMap = await fetchParameterLabels(apiUrl, token, lookupIds);
    if (!Object.keys(labelMap).length) {
      return info;
    }

    const next = { ...info };
    pending.forEach(({ id, assign }) => {
      const resolvedLabel =
        labelMap[id] ??
        labelMap[id.toLowerCase()] ??
        labelMap[id.toUpperCase()];
      if (resolvedLabel) {
        assign(next, resolvedLabel);
      }
    });

    return next;
  } catch (error) {
    console.error("No se pudieron resolver etiquetas de parámetros", error);
    return info;
  }
};

interface GroupView {
  id: string;
  name: string;
  assignments: Assignment[];
  totals: Record<string, number>;
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
  noteEntries?: DayNoteEntry[];
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

const createEmptyHours = (): Record<string, string> => ({});

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

const createEmptyTotals = (dateKeys: string[]): Record<string, number> => {
  const totals: Record<string, number> = {};
  dateKeys.forEach((key) => {
    totals[key] = 0;
  });
  return totals;
};

interface AssignmentTotalsContext {
  workerWeekData: Record<string, WorkerWeeklyData>;
}

const getManualHourValue = (
  assignment: Assignment,
  dateKey: string
): number | null => {
  const rawValue = assignment.hours[dateKey];
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
  dateKey: string,
  context: AssignmentTotalsContext
): number | null => {
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
  dateKey: string,
  context: AssignmentTotalsContext
): number => {
  const manual = getManualHourValue(assignment, dateKey);
  if (manual !== null) {
    return manual;
  }

  const tracked = getTrackedHourValue(assignment, dateKey, context);
  return tracked ?? 0;
};

const calculateRowTotal = (
  assignment: Assignment,
  context: AssignmentTotalsContext,
  dayDescriptors: DayDescriptor[]
): number =>
  dayDescriptors.reduce(
    (total, day) =>
      total + resolveAssignmentHourValue(assignment, day.dateKey, context),
    0
  );

const calculateTotals = (
  items: Assignment[],
  context: AssignmentTotalsContext,
  dayDescriptors: DayDescriptor[]
): Record<string, number> => {
  const totals = createEmptyTotals(dayDescriptors.map((day) => day.dateKey));

  items.forEach((item) => {
    dayDescriptors.forEach((day) => {
      totals[day.dateKey] += resolveAssignmentHourValue(
        item,
        day.dateKey,
        context
      );
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

    const noteEntries = (detail.noteEntries ?? []).map((note) => {
      const identity = buildCompanyIdentity(note.companyId, note.companyName);
      return {
        ...note,
        companyId: identity.id,
        companyName: identity.name,
      };
    });

    days[dayKey] = {
      totalHours: detail.totalHours,
      companyHours,
      entries,
      noteEntries,
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

const dayLabelFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
});

const dayShortLabelFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
});

const normalizeDayLabel = (value: string): string => {
  const sanitized = value.replace(/\.$/, "");
  if (!sanitized) {
    return sanitized;
  }
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
};

const normalizeToStartOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const ensureRangeOrder = (start: Date, end: Date): { start: Date; end: Date } => {
  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }
  return { start: end, end: start };
};

const buildDayDescriptors = (start: Date, end: Date): DayDescriptor[] => {
  if (!(start instanceof Date) || !(end instanceof Date)) {
    return [];
  }

  const normalizedStart = normalizeToStartOfDay(start);
  const normalizedEnd = normalizeToStartOfDay(end);
  const ordered = ensureRangeOrder(normalizedStart, normalizedEnd);

  const descriptors: DayDescriptor[] = [];
  let cursor = ordered.start;

  while (cursor.getTime() <= ordered.end.getTime()) {
    const current = new Date(cursor);
    const label = normalizeDayLabel(dayLabelFormatter.format(current));
    const shortLabel = normalizeDayLabel(dayShortLabelFormatter.format(current));

    descriptors.push({
      date: current,
      dateKey: formatLocalDateKey(current),
      label,
      shortLabel,
      dayOfMonth: current.getDate(),
    });

    cursor = addDays(cursor, 1);
  }

  return descriptors;
};

const weekRangeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatDateRange = (start: Date, end: Date): string => {
  const normalized = ensureRangeOrder(
    normalizeToStartOfDay(start),
    normalizeToStartOfDay(end)
  );

  const startLabel = weekRangeFormatter.format(normalized.start);
  const endLabel = weekRangeFormatter.format(normalized.end);

  if (startLabel === endLabel) {
    return startLabel;
  }

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

const extractShiftDescription = (
  shift: unknown,
  fallback?: string
): string | undefined => {
  const observationText = extractObservationText(shift);
  if (observationText) {
    return observationText;
  }

  if (
    shift &&
    typeof shift === "object" &&
    typeof (shift as { description?: unknown }).description === "string"
  ) {
    const directDescription = (shift as { description: string }).description.trim();
    if (directDescription.length > 0) {
      return directDescription;
    }
  }

  if (typeof fallback === "string") {
    const trimmedFallback = fallback.trim();
    if (trimmedFallback.length > 0) {
      return trimmedFallback;
    }
  }

  return undefined;
};

const MOBILE_BREAKPOINT_QUERY = "(max-width: 640px)";
const LONG_PRESS_DURATION_MS = 500;
// Minimum pixel width needed to keep the note/turn icons without covering the value.
const HOUR_CELL_ICON_MIN_WIDTH = 136;

const useIsCompactLayout = (): boolean => {
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };

    setIsCompact(mediaQueryList.matches);

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
      return () => mediaQueryList.removeEventListener("change", handleChange);
    }

    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, []);

  return isCompact;
};

interface MobileCellActionsTarget {
  assignment: Assignment;
  day: DayDescriptor;
  displayLabel: string;
  notes: DayNoteEntry[];
}

interface MobileCellActionsSheetProps {
  target: MobileCellActionsTarget | null;
  onClose: () => void;
  onSelectNotes: (target: MobileCellActionsTarget) => void;
  onSelectSegments: (target: MobileCellActionsTarget) => void;
}

const MobileCellActionsSheet: React.FC<MobileCellActionsSheetProps> = ({
  target,
  onClose,
  onSelectNotes,
  onSelectSegments,
}) => {
  if (!target) {
    return null;
  }

  const { assignment, displayLabel } = target;

  return (
    <div className="fixed inset-0 z-[108] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Acciones rápidas
          </h3>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {assignment.workerName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{displayLabel}</p>
        </div>
        <div className="mt-5 space-y-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onSelectNotes(target)}
            leftIcon={<NotebookPen size={16} />}
          >
            Ver notas del día
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onSelectSegments(target)}
            leftIcon={<CalendarClock size={16} />}
          >
            Gestionar turnos horarios
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancelar
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          Mantén pulsada la celda para abrir este menú en pantallas compactas.
        </p>
      </div>
    </div>
  );
};

interface HourEntryCellProps {
  assignment: Assignment;
  day: DayDescriptor;
  displayLabel: string;
  inputValue: string;
  hasNotes: boolean;
  hasSegments: boolean;
  highlightClass: string;
  filteredNotes: DayNoteEntry[];
  onHourChange: (assignmentId: string, dateKey: string, value: string) => void;
  onOpenNotes: (
    assignment: Assignment,
    day: DayDescriptor,
    displayLabel: string,
    notes: DayNoteEntry[]
  ) => void;
  onOpenSegments: (
    assignment: Assignment,
    day: DayDescriptor,
    displayLabel: string
  ) => void;
  onLongPressStart: (
    enable: boolean,
    payload: MobileCellActionsTarget
  ) => void;
  onLongPressEnd: () => void;
  onCellDoubleClick: (
    event: React.MouseEvent<HTMLDivElement>,
    enable: boolean,
    assignment: Assignment,
    day: DayDescriptor,
    displayLabel: string
  ) => void;
  isCompactLayout: boolean;
}

const HourEntryCell: React.FC<HourEntryCellProps> = ({
  assignment,
  day,
  displayLabel,
  inputValue,
  hasNotes,
  hasSegments,
  highlightClass,
  filteredNotes,
  onHourChange,
  onOpenNotes,
  onOpenSegments,
  onLongPressStart,
  onLongPressEnd,
  onCellDoubleClick,
  isCompactLayout,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showIcons, setShowIcons] = useState<boolean>(() => !isCompactLayout);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      setShowIcons(!isCompactLayout);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const shouldShow =
        entry.contentRect.width >= HOUR_CELL_ICON_MIN_WIDTH && !isCompactLayout;
      setShowIcons((prev) => (prev === shouldShow ? prev : shouldShow));
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isCompactLayout]);

  useEffect(() => {
    if (isCompactLayout) {
      setShowIcons(false);
    }
  }, [isCompactLayout]);

  const enableCompactInteractions = isCompactLayout || !showIcons;
  const inputTitle = enableCompactInteractions
    ? "Mantén pulsado o haz doble clic para ver notas o turnos en pantallas compactas"
    : "Haz clic en los iconos para gestionar notas o turnos horarios";
  const inputSizingClasses = showIcons
    ? "w-28 pl-8 pr-10"
    : "w-24 px-3";

  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-lg px-1 py-1 text-center"
      onPointerDown={() =>
        onLongPressStart(enableCompactInteractions, {
          assignment,
          day,
          displayLabel,
          notes: filteredNotes,
        })
      }
      onPointerUp={onLongPressEnd}
      onPointerLeave={onLongPressEnd}
      onPointerCancel={onLongPressEnd}
      onDoubleClick={(event) =>
        onCellDoubleClick(
          event,
          enableCompactInteractions,
          assignment,
          day,
          displayLabel
        )
      }
    >
      <div className="flex items-center gap-1">
        <div ref={containerRef} className="relative">
          {showIcons && (
            <button
              type="button"
              onClick={() =>
                onOpenNotes(assignment, day, displayLabel, filteredNotes)
              }
              className={`absolute inset-y-0 left-1.5 z-10 flex items-center text-gray-300 transition hover:text-amber-600 focus:outline-none ${
                hasNotes ? "text-amber-500" : ""
              }`}
              aria-label="Ver notas del día"
              tabIndex={-1}
            >
              <NotebookPen size={14} />
            </button>
          )}
          <Input
            size="sm"
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(event) =>
              onHourChange(assignment.id, day.dateKey, event.target.value)
            }
            className={`${inputSizingClasses} text-center ${highlightClass}`}
            placeholder="0"
            title={inputTitle}
          />
          {showIcons && (
            <button
              type="button"
              onClick={() =>
                onOpenSegments(assignment, day, displayLabel)
              }
              className={`absolute inset-y-0 right-2 flex items-center text-gray-300 transition hover:text-blue-600 focus:outline-none ${
                hasSegments ? "text-blue-600" : ""
              }`}
              aria-label="Configurar turnos horarios"
              tabIndex={-1}
            >
              <CalendarClock size={14} />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">h</span>
      </div>
    </div>
  );
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

              const shiftDescription =
                extractShiftDescription(shift, observationText) ?? "";

              return {
                id:
                  shift.id ??
                  `existing-shift-${entry.id}-${index}-${Math.random()
                    .toString(36)
                    .slice(2, 6)}`,
                start,
                end,
                total: shiftTotal ?? "",
                description: shiftDescription,
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
      <div className="relative z-10 flex w-full max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 p-4 sm:p-5 dark:border-gray-700">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {companyName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {workerName}
              </p>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {dayLabel}
              </h2>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Cerrar configuración de turnos"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">

          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Turno {index + 1}
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
                  placeholder="Observaciones del turno"
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
              Añadir turno
            </Button>
          </div>

          {invalidSegments && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200">
              Revisa los turnos: la hora de fin debe ser posterior a la hora de
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
            Guardar turnos
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
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([
    ALL_COMPANIES_OPTION_ID,
  ]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState<boolean>(true);
  const [isLoadingGroupOptions, setIsLoadingGroupOptions] =
    useState<boolean>(true);
  const [isLoadingCompanyOptions, setIsLoadingCompanyOptions] =
    useState<boolean>(true);
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
    Record<string, Record<string, HourSegment[]>>
  >({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [segmentModalTarget, setSegmentModalTarget] =
    useState<SegmentsModalTarget | null>(null);
  const [notesModalTarget, setNotesModalTarget] =
    useState<NotesModalTarget | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateInterval>(() => {
    const start = getStartOfWeek(new Date());
    const end = addDays(start, 6);
    return { start, end };
  });
  const [workerInfoModal, setWorkerInfoModal] =
    useState<WorkerInfoModalState | null>(null);
  const isCompactLayout = useIsCompactLayout();
  const longPressTimerRef = useRef<number | null>(null);
  const [mobileCellActions, setMobileCellActions] =
    useState<MobileCellActionsTarget | null>(null);

  const clearMobileLongPressTimer = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      longPressTimerRef.current !== null
    ) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const openMobileCellActions = useCallback(
    (payload: MobileCellActionsTarget) => {
      setMobileCellActions(payload);
    },
    []
  );

  const closeMobileCellActions = useCallback(() => {
    setMobileCellActions(null);
  }, []);

  useEffect(() => {
    return () => {
      clearMobileLongPressTimer();
    };
  }, [clearMobileLongPressTimer]);

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
      const situationParsed = parseSituationValue(worker.situation);
      const isInactiveBySituation =
        situationParsed !== null ? situationParsed >= 1 : null;
      const isInactive =
        isInactiveBySituation !== null
          ? isInactiveBySituation
          : worker.isActive === false;
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

    const entries = Array.from(labelMap.entries())
      .map(([companyId, label]) => ({ value: companyId, label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" })
      );

    if (!entries.some((entry) => entry.value === ALL_COMPANIES_OPTION_ID)) {
      entries.unshift({
        value: ALL_COMPANIES_OPTION_ID,
        label: ALL_COMPANIES_OPTION_LABEL,
        description: "Incluye empresas detectadas en las asignaciones",
      });
    }

    return entries;
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

    const effectiveSelectedCompanies =
      getEffectiveCompanyIds(selectedCompanyIds);

    if (!effectiveSelectedCompanies.length) {
      return base;
    }

    const companySet = new Set(effectiveSelectedCompanies);
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
    const effectiveRequestedCompanies = requestedCompanyIds
      ? getEffectiveCompanyIds(requestedCompanyIds)
      : null;
    const companySet =
      effectiveRequestedCompanies && effectiveRequestedCompanies.length
        ? new Set(effectiveRequestedCompanies)
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
    const effective = getEffectiveCompanyIds(selectedCompanyIds);
    if (!effective.length) {
      return "";
    }
    return effective.slice().sort().join("|");
  }, [selectedCompanyIds]);

  const requestedCompanyIdsKey = useMemo(() => {
    if (requestedCompanyIds === null) {
      return null;
    }
    const effective = getEffectiveCompanyIds(requestedCompanyIds);
    if (!effective.length) {
      return "";
    }
    return effective.slice().sort().join("|");
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
    if (!companyFilterOptions.length) {
      return;
    }

    const optionValues = new Set(
      companyFilterOptions.map((option) => option.value)
    );

    setSelectedCompanyIds((prev) => {
      const filtered = prev.filter((id) => optionValues.has(id));

      let next = filtered;

      if (!next.length && optionValues.has(ALL_COMPANIES_OPTION_ID)) {
        next = [ALL_COMPANIES_OPTION_ID];
      } else if (next.includes(ALL_COMPANIES_OPTION_ID) && next.length > 1) {
        next = next.filter((id) => id !== ALL_COMPANIES_OPTION_ID);
      }

      const isSame =
        next.length === prev.length &&
        next.every((id, index) => id === prev[index]);

      return isSame ? prev : next;
    });
  }, [companyFilterOptions]);

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

  const visibleDays = useMemo(
    () => buildDayDescriptors(selectedRange.start, selectedRange.end),
    [selectedRange]
  );

  const rangeLabel = useMemo(
    () => formatDateRange(selectedRange.start, selectedRange.end),
    [selectedRange]
  );

  const totalsContext = useMemo(
    () => ({ workerWeekData }),
    [workerWeekData]
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

    const fromDate = normalizeToStartOfDay(selectedRange.start);
    const toDate = normalizeToStartOfDay(selectedRange.end);
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
    externalJwt,
    requestedWorkerIds,
    selectedRange,
    visibleWorkerIdsKey,
    workerNameById,
  ]);

  const shiftSelectedRange = useCallback((step: number) => {
    if (!Number.isFinite(step) || step === 0) {
      return;
    }

    setSelectedRange((previous) => {
      const length = Math.max(
        differenceInCalendarDays(previous.end, previous.start) + 1,
        1
      );
      const delta = step * length;
      const nextStart = normalizeToStartOfDay(addDays(previous.start, delta));
      const nextEnd = normalizeToStartOfDay(addDays(previous.end, delta));

      return {
        start: nextStart,
        end: nextEnd,
      };
    });
  }, []);

  const handleRangeSelect = useCallback(
    (range: { from: Date; to: Date }) => {
      const ordered = ensureRangeOrder(
        normalizeToStartOfDay(range.from),
        normalizeToStartOfDay(range.to)
      );
      setSelectedRange({ start: ordered.start, end: ordered.end });
    },
    []
  );

  const companyGroups = useMemo<GroupView[]>(() => {
    const dayKeys = visibleDays.map((day) => day.dateKey);
    const groups = new Map<string, GroupView>();

    visibleAssignments.forEach((assignment) => {
      if (!groups.has(assignment.companyId)) {
        groups.set(assignment.companyId, {
          id: assignment.companyId,
          name: assignment.companyName,
          assignments: [],
          totals: createEmptyTotals(dayKeys),
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
          totals: calculateTotals(sortedAssignments, totalsContext, visibleDays),
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
  }, [totalsContext, visibleAssignments, visibleDays]);

  const workerGroups = useMemo<GroupView[]>(() => {
    const dayKeys = visibleDays.map((day) => day.dateKey);
    const groups = new Map<string, GroupView>();

    visibleAssignments.forEach((assignment) => {
      if (!groups.has(assignment.workerId)) {
        groups.set(assignment.workerId, {
          id: assignment.workerId,
          name: assignment.workerName,
          assignments: [],
          totals: createEmptyTotals(dayKeys),
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
          totals: calculateTotals(sortedAssignments, totalsContext, visibleDays),
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
  }, [totalsContext, visibleAssignments, visibleDays]);

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
    (assignmentId: string, dateKey: string, value: string) => {
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === assignmentId
            ? {
                ...assignment,
                hours: {
                  ...assignment.hours,
                  [dateKey]: value,
                },
              }
            : assignment
        )
      );
    },
    []
  );

  const openSegmentsModal = useCallback(
    (assignment: Assignment, day: DayDescriptor, dayLabel: string) => {
      const dateKey = day.dateKey;
      const dayData = workerWeekData[assignment.workerId]?.days?.[dateKey];
      const existingEntries = resolveEntriesForAssignment(dayData, assignment);

      setSegmentModalTarget({
        assignmentId: assignment.id,
        workerName: assignment.workerName,
        companyName: assignment.companyName,
        dateKey,
        dayLabel,
        existingEntries,
      });
    },
    [workerWeekData]
  );

  const closeSegmentsModal = useCallback(() => {
    setSegmentModalTarget(null);
  }, []);

  const openNotesModal = useCallback(
    (
      assignment: Assignment,
      day: DayDescriptor,
      dayLabel: string,
      notes: DayNoteEntry[]
    ) => {
      const humanReadableDate = day.dateKey ? formatDate(day.dateKey) : undefined;

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

  const handleMobileNotesSelection = useCallback(
    (target: MobileCellActionsTarget) => {
      closeMobileCellActions();
      openNotesModal(
        target.assignment,
        target.day,
        target.displayLabel,
        target.notes
      );
    },
    [closeMobileCellActions, openNotesModal]
  );

  const handleMobileSegmentsSelection = useCallback(
    (target: MobileCellActionsTarget) => {
      closeMobileCellActions();
      openSegmentsModal(target.assignment, target.day, target.displayLabel);
    },
    [closeMobileCellActions, openSegmentsModal]
  );

  const handleCellLongPressStart = useCallback(
    (enable: boolean, payload: MobileCellActionsTarget) => {
      if (!enable || typeof window === "undefined") {
        return;
      }

      clearMobileLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        openMobileCellActions(payload);
      }, LONG_PRESS_DURATION_MS);
    },
    [clearMobileLongPressTimer, openMobileCellActions]
  );

  const handleCellDoubleClick = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement>,
      enable: boolean,
      assignment: Assignment,
      day: DayDescriptor,
      displayLabel: string
    ) => {
      if (!enable) {
        return;
      }

      if (event.target instanceof HTMLInputElement) {
        return;
      }

      clearMobileLongPressTimer();
      openSegmentsModal(assignment, day, displayLabel);
    },
    [clearMobileLongPressTimer, openSegmentsModal]
  );

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
        (assignmentItem) =>
          normalizeKeyPart(assignmentItem.companyId) === normalized
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

      const companyMap = new Map<
        string,
        { id: string; name: string; count: number }
      >();
      const contractsByCompany: Record<string, WorkerCompanyContract[]> = {};

      const appendCompany = (
        name?: string | null,
        stats?: WorkerCompanyStats
      ) => {
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

      if (worker.companyContracts) {
        Object.entries(worker.companyContracts).forEach(
          ([companyName, contracts]) => {
            if (!contracts || contracts.length === 0) {
              return;
            }
            contractsByCompany[companyName] = contracts.map((contract) => ({
              ...contract,
            }));

            const stats = worker.companyStats?.[companyName];
            appendCompany(companyName, stats);
          }
        );
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
        contractsByCompany,
        role: worker.role,
        situation: worker.situation ?? null,
        isActive: worker.isActive,
        department: trimToNull(worker.department) ?? undefined,
        position: trimToNull(worker.position) ?? undefined,
        baseSalary:
          typeof worker.baseSalary === "number" ? worker.baseSalary : undefined,
        hourlyRate:
          typeof worker.hourlyRate === "number" ? worker.hourlyRate : undefined,
        contractType: worker.contractType,
        startDate: trimToNull(worker.startDate) ?? undefined,
        dni: trimToNull(worker.dni) ?? undefined,
        socialSecurity: trimToNull(worker.socialSecurity) ?? undefined,
        birthDate: trimToNull(worker.birthDate) ?? undefined,
        address: trimToNull(worker.address) ?? undefined,
        iban: trimToNull(worker.iban) ?? undefined,
        category: trimToNull(worker.category) ?? undefined,
        categoryId: trimToNull(worker.categoryId) ?? undefined,
        subcategory: trimToNull(worker.subcategory) ?? undefined,
        subcategoryId: trimToNull(worker.subcategoryId) ?? undefined,
        staffType: trimToNull(worker.staffType) ?? undefined,
        companyStats: worker.companyStats,
        rawPayload: null,
      };
    },
    []
  );

  const enrichWorkerInfoData = useCallback(
    async (info: WorkerInfoData): Promise<WorkerInfoData> => {
      if (!apiUrl || !externalJwt) {
        return info;
      }

      return resolveWorkerParameterLabels(info, apiUrl, externalJwt);
    },
    [apiUrl, externalJwt]
  );

  const openWorkerInfoModal = useCallback(
    async (workerId: string, workerName: string) => {
      const normalizedTargetId = normalizeKeyPart(workerId) ?? workerId;
      const existingWorker = allWorkers.find(
        (worker) => normalizeKeyPart(worker.id) === normalizedTargetId
      );

      if (existingWorker) {
        const baseInfo = buildWorkerInfoFromWorker(existingWorker);
        const info = await enrichWorkerInfoData(baseInfo);
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
          error:
            "Falta configuración de API o token para obtener los datos del trabajador.",
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
        const phone = trimToNull(
          payload?.phone ?? payload?.telefon ?? payload?.telefono
        );
        const role = trimToNull(payload?.role ?? payload?.workerRole) as
          | Worker["role"]
          | undefined;
        const situationValue = parseNumericValue(
          payload?.situation ?? payload?.workerSituation ?? payload?.status
        );
        const isActiveValue =
          typeof payload?.isActive === "boolean"
            ? payload.isActive
            : situationValue !== undefined
            ? situationValue !== 1
            : undefined;
        const department = trimToNull(
          payload?.department ?? payload?.area ?? payload?.departmentName
        );
        const position = trimToNull(
          payload?.position ?? payload?.jobTitle ?? payload?.roleName
        );
        const baseSalaryValue = parseNumericValue(
          payload?.baseSalary ?? payload?.salary ?? payload?.amountBase
        );
        const hourlyRateValue = parseNumericValue(
          payload?.hourlyRate ?? payload?.rate ?? payload?.amount ?? payload?.hoursPerWeek
        );
        const contractTypeValue = trimToNull(
          payload?.contractType ?? payload?.employmentType ?? payload?.type
        ) as Worker["contractType"] | undefined;
        const startDateValue = trimToNull(
          payload?.startDate ?? payload?.dateStart ?? payload?.beginDate
        );
        const dniValue = pickFirstString(
          payload?.dni,
          payload?.dniNumber,
          payload?.documentNumber,
          payload?.documento,
          payload?.document,
          payload?.nif,
          payload?.nie,
          payload?.taxId,
          payload?.cif
        );
        const socialSecurityValue = pickFirstString(
          payload?.socialSecurity,
          payload?.socialSecurityNumber,
          payload?.seguridadSocial,
          payload?.ssn,
          payload?.nss,
          payload?.numSeguridadSocial
        );
        const birthDateValue = pickFirstString(
          payload?.birthDate,
          payload?.dateBirth,
          payload?.fechaNacimiento,
          payload?.bornDate,
          payload?.dob
        );
        const addressValue = pickFirstString(
          payload?.address,
          payload?.direccion,
          payload?.addressLine1,
          payload?.street,
          payload?.domicilio,
          payload?.address1
        );
        const ibanValue = pickFirstString(
          payload?.iban,
          payload?.ibanNumber,
          payload?.ibanProvider,
          payload?.bankAccount,
          payload?.accountNumber,
          payload?.ccc
        );
        const parentIdValue = pickFirstString(
          payload?.parentId,
          payload?.parent,
          payload?.parentParameterId,
          payload?.parentParameter,
          payload?.parentParameter_id,
          payload?.parentParameterID,
          payload?.parentGuid,
          payload?.parentParameterGuid
        );
        const parentNameValue = pickFirstString(
          payload?.parentName,
          payload?.parentLabel,
          payload?.parentDescription,
          payload?.parentTitle,
          payload?.parentParameterName,
          payload?.parentParameterLabel,
          payload?.parentParameterDescription
        );
        const categoryIdValue =
          parentIdValue ??
          pickFirstString(
            payload?.categoryId,
            payload?.category_id,
            payload?.categoryParameterId,
            payload?.parentCategoryId,
            payload?.categoryGuid
          );
        const subcategoryIdValue = pickFirstString(
          payload?.subcategoryId,
          payload?.subCategoryId,
          payload?.subcategory_id,
          payload?.subCategory_id,
          payload?.subcategoryGuid
        );

        const parameterRelations = Array.isArray(payload?.parameterRelations)
          ? payload.parameterRelations
          : [];

        const labelCandidateIds = new Set<string>();

        const registerLabelCandidate = (value?: string | null) => {
          const normalized = trimToNull(value);
          if (normalized) {
            labelCandidateIds.add(normalized);
          }
        };

        registerLabelCandidate(categoryIdValue);
        registerLabelCandidate(subcategoryIdValue);

        parameterRelations.forEach((relation: any) => {
          const relationIdValue = pickFirstString(
            relation?.parameterRelationId,
            relation?.parameterRelationID,
            relation?.relationId,
            relation?.id
          );
          const relationCompanyIdValue = pickFirstString(
            relation?.companyId,
            relation?.company_id,
            relation?.companyIdContract
          );
          registerLabelCandidate(relationIdValue);
          registerLabelCandidate(relationCompanyIdValue);
        });

        let parameterLabelMap: Record<string, string> = {};
        if (labelCandidateIds.size > 0) {
          try {
            parameterLabelMap = await fetchParameterLabels(
              apiUrl,
              externalJwt,
              Array.from(labelCandidateIds)
            );
          } catch (labelError) {
            console.warn(
              "No se pudieron obtener etiquetas de parámetros",
              labelError
            );
          }
        }

        const resolveParameterLabel = (value?: string | null) => {
          const normalized = trimToNull(value);
          if (!normalized) {
            return null;
          }
          return (
            parameterLabelMap[normalized] ??
            parameterLabelMap[normalized.toLowerCase()] ??
            parameterLabelMap[normalized.toUpperCase()] ??
            null
          );
        };

        const categoryName =
          trimToNull(parentNameValue) ??
          resolveParameterLabel(categoryIdValue) ??
          pickFirstString(
            payload?.categoryName,
            payload?.category,
            payload?.categoria,
            payload?.categoryLabel
          );

        const subcategoryName =
          resolveParameterLabel(subcategoryIdValue) ??
          pickFirstString(
            payload?.subcategoryName,
            payload?.subcategory,
            payload?.subCategory,
            payload?.subcategoria,
            payload?.subcategoryLabel
          );

        const staffTypeValue = pickFirstString(
          payload?.staffType,
          payload?.personalType,
          payload?.personnelType,
          payload?.movementType,
          payload?.payrollType,
          payload?.salaryPeriod,
          payload?.tipoPersonal,
          payload?.tipo_personal,
          payload?.tipoDePersonal
        );

        const companyAggregates = new Map<
          string,
          { id: string; name: string; count: number }
        >();
        const contractsByCompany: Record<string, WorkerCompanyContract[]> = {};

        if (parameterRelations.length > 0) {
          parameterRelations.forEach((relation: any, index: number) => {
            const relationIdValue = pickFirstString(
              relation?.parameterRelationId,
              relation?.parameterRelationID,
              relation?.relationId,
              relation?.id
            );
            const relationCompanyIdValue = pickFirstString(
              relation?.companyId,
              relation?.company_id,
              relation?.companyIdContract
            );

            const normalizedRelationId = normalizeKeyPart(relationIdValue);
            const normalizedCompanyId = normalizeKeyPart(relationCompanyIdValue);

            const lookupLabel =
              resolveParameterLabel(relationIdValue) ??
              resolveParameterLabel(relationCompanyIdValue);

            const resolvedName =
              lookupLabel ??
              resolveCompanyLabel(normalizedRelationId) ??
              resolveCompanyLabel(relationIdValue) ??
              trimToNull(relation?.companyName) ??
              trimToNull(relation?.parameterRelationName) ??
              trimToNull(relation?.name) ??
              normalizedRelationId ??
              normalizedCompanyId ??
              `Empresa ${index + 1}`;

            const aggregateKey =
              normalizedRelationId ??
              normalizedCompanyId ??
              createGroupId(resolvedName ?? `empresa-${index + 1}`);
            const displayName = resolvedName ?? aggregateKey;

            const existingAggregate = companyAggregates.get(aggregateKey);
            const nextCount = (existingAggregate?.count ?? 0) + 1;

            if (existingAggregate) {
              existingAggregate.count = nextCount;
              if (displayName && existingAggregate.name !== displayName) {
                existingAggregate.name = displayName;
              }
            } else {
              companyAggregates.set(aggregateKey, {
                id: aggregateKey,
                name: displayName,
                count: nextCount,
              });
            }

            const hasContract = Number(relation?.type) === 1;
            const labelCandidate =
              trimToNull(relation?.contractName) ??
              trimToNull(relation?.name) ??
              `Relación ${nextCount}`;

            const descriptionCandidate = trimToNull(
              relation?.description ??
                relation?.contractDescription ??
                relation?.notes ??
                relation?.observations
            );

            const startDate = trimToNull(
              relation?.startDate ??
                relation?.contractStartDate ??
                relation?.dateStart
            );
            const endDate = trimToNull(
              relation?.endDate ??
                relation?.contractEndDate ??
                relation?.dateEnd
            );

            const contractEntry: WorkerCompanyContract = {
              id:
                trimToNull(relation?.id) ??
                normalizedRelationId ??
                `${aggregateKey}-${index}`,
              hasContract,
              relationType: Number.isFinite(Number(relation?.type))
                ? Number(relation?.type)
                : undefined,
              typeLabel:
                trimToNull(
                  relation?.contractTypeName ??
                    relation?.typeLabel ??
                    relation?.typeDescription
                ) ?? undefined,
              hourlyRate:
                typeof relation?.amount === "number"
                  ? relation.amount
                  : undefined,
              companyId:
                trimToNull(relationCompanyIdValue) ??
                normalizedRelationId ??
                undefined,
              companyName: displayName,
              label: labelCandidate ?? undefined,
              description: descriptionCandidate ?? undefined,
              startDate: startDate ?? undefined,
              endDate: endDate ?? undefined,
              status:
                trimToNull(relation?.status ?? relation?.contractStatus) ??
                undefined,
              details: undefined,
            };

            const bucketKey = displayName;
            const bucket = contractsByCompany[bucketKey] ?? [];
            bucket.push(contractEntry);
            contractsByCompany[bucketKey] = bucket;
            if (bucketKey !== aggregateKey) {
              contractsByCompany[aggregateKey] = bucket;
            }
          });
        }

        const companies = Array.from(companyAggregates.values()).sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        );

        const companyStatsFromApi: Record<string, WorkerCompanyStats> = {};
        companies.forEach((company) => {
          const contractList =
            contractsByCompany[company.name] ??
            contractsByCompany[company.id] ??
            [];
          companyStatsFromApi[company.name] = {
            companyId: company.id,
            contractCount: contractList.length,
            assignmentCount: company.count,
          };
        });

        const infoData: WorkerInfoData = {
          id: trimToNull(payload?.id ?? workerId) ?? workerId,
          name: trimToNull(payload?.name ?? workerName) ?? workerName,
          email: email ?? undefined,
          secondaryEmail: secondaryEmail ?? undefined,
          phone: phone ?? undefined,
          companies,
          contractsByCompany,
          role,
          situation: situationValue ?? null,
          isActive: isActiveValue,
          department: department ?? undefined,
          position: position ?? undefined,
          baseSalary: baseSalaryValue,
          hourlyRate: hourlyRateValue,
          contractType: contractTypeValue,
          startDate: startDateValue ?? undefined,
          dni: trimToNull(dniValue?.toUpperCase() ?? null) ?? undefined,
          socialSecurity: trimToNull(socialSecurityValue) ?? undefined,
          birthDate: trimToNull(birthDateValue) ?? undefined,
          address: trimToNull(addressValue) ?? undefined,
          iban: trimToNull(ibanValue?.toUpperCase() ?? null) ?? undefined,
          category: trimToNull(categoryName) ?? undefined,
          categoryId: trimToNull(categoryIdValue) ?? undefined,
          subcategory: trimToNull(subcategoryName) ?? undefined,
          subcategoryId: trimToNull(subcategoryIdValue) ?? undefined,
          staffType: trimToNull(staffTypeValue) ?? undefined,
          companyStats: companyStatsFromApi,
          rawPayload: payload ?? null,
        };

        const enrichedInfo = await enrichWorkerInfoData(infoData);

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
            data: enrichedInfo,
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
    [
      apiUrl,
      allWorkers,
      buildWorkerInfoFromWorker,
      enrichWorkerInfoData,
      externalJwt,
      resolveCompanyLabel,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{
        workerId: string;
        workerName: string;
      }>;
      if (custom?.detail?.workerId) {
        void openWorkerInfoModal(
          custom.detail.workerId,
          custom.detail.workerName
        );
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

        assignmentSegments[segmentModalTarget.dateKey] = segments;
        next[segmentModalTarget.assignmentId] = assignmentSegments;

        return next;
      });

      const totalMinutes = calculateSegmentsTotalMinutes(segments);
      const formattedValue =
        totalMinutes > 0 ? formatMinutesToHoursLabel(totalMinutes) : "";

      handleHourChange(
        segmentModalTarget.assignmentId,
        segmentModalTarget.dateKey,
        formattedValue
      );

      setSegmentModalTarget(null);
    },
    [handleHourChange, segmentModalTarget]
  );

  const handleWorkerSelectionChange = useCallback((workerIds: string[]) => {
    setSelectedWorkerIds(workerIds);
  }, []);

  const handleCompanySelectionChange = useCallback(
    (values: string[]) => {
      if (!values.length) {
        setSelectedCompanyIds([ALL_COMPANIES_OPTION_ID]);
        return;
      }

      const hasAll = values.includes(ALL_COMPANIES_OPTION_ID);

      if (hasAll && values.length > 1) {
        setSelectedCompanyIds(
          values.filter((value) => value !== ALL_COMPANIES_OPTION_ID)
        );
        return;
      }

      setSelectedCompanyIds(values);
    },
    []
  );

  const handleShowResults = useCallback(() => {
    setRequestedWorkerIds(() => [...selectionWorkerIds]);
    setRequestedCompanyIds(() => [
      ...getEffectiveCompanyIds(selectedCompanyIds),
    ]);
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
      setIsLoadingGroupOptions(false);
      setIsLoadingCompanyOptions(false);
      setIsLoadingWorkers(false);
      return;
    }

    setIsLoadingWorkers(true);
    setIsLoadingGroupOptions(true);
    setIsLoadingCompanyOptions(true);
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
      setIsLoadingCompanyOptions(false);

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
            label: "Todos los grupos",
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
        setIsLoadingGroupOptions(false);
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
        setIsLoadingGroupOptions(false);
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
      setIsLoadingGroupOptions(false);
      setIsLoadingCompanyOptions(false);
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

    type ControlScheduleShift =
      ControlScheduleSavePayload["workShifts"][number];

    const payload: ControlScheduleSavePayload[] = [];

    visibleAssignments.forEach((assignment) => {
      visibleDays.forEach((day) => {
        const dateKey = day.dateKey;
        const parameterId = assignment.workerId.trim();

        if (!dateKey || !parameterId) {
          return;
        }

        const raw = assignment.hours[dateKey];
        const trimmedValue = typeof raw === "string" ? raw.trim() : "";
        const hoursValue = trimmedValue ? parseHour(trimmedValue) : 0;

        const dayData = workerWeekData[assignment.workerId]?.days?.[dateKey];
        const existingEntries = resolveEntriesForAssignment(
          dayData,
          assignment
        );
        const primaryEntry =
          existingEntries.length > 0 ? existingEntries[0] : null;
        const existingEntryId = primaryEntry?.id?.trim?.() ?? "";

        const assignmentSegments = segmentsByAssignment[assignment.id];
        const storedSegments = assignmentSegments
          ? assignmentSegments[dateKey]
          : undefined;

        const primaryEntryRaw =
          (primaryEntry as { raw?: unknown } | null | undefined)?.raw;
        const primaryEntryObservation =
          extractObservationText(primaryEntryRaw) ?? "";

        const fallbackSegments: HourSegment[] = primaryEntry?.workShifts
          ? primaryEntry.workShifts.map((shift) => ({
              id: shift.id?.trim() ?? "",
              start: shift.startTime ?? "",
              end: shift.endTime ?? "",
              total: shift.hours ? String(shift.hours) : "",
              description:
                extractShiftDescription(shift, primaryEntryObservation) ?? "",
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
        if (
          companyId &&
          !isUnassignedCompany(companyId, assignment.companyName)
        ) {
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
    visibleDays,
    workerWeekData,
  ]);

  const weeklyTotals = useMemo(
    () => calculateTotals(visibleAssignments, totalsContext, visibleDays),
    [totalsContext, visibleAssignments, visibleDays]
  );
  const weeklyTotalHours = useMemo(
    () =>
      visibleDays.reduce(
        (total, day) => total + (weeklyTotals[day.dateKey] ?? 0),
        0
      ),
    [visibleDays, weeklyTotals]
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
      const totalByGroup = visibleDays.reduce(
        (total, day) => total + (group.totals[day.dateKey] ?? 0),
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
            <div className="flex flex-wrap items-end justify-end gap-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
              {visibleDays.map((day) => (
                <div
                  key={`${group.id}-${day.dateKey}`}
                  className="flex flex-col items-end"
                >
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {day.shortLabel}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {formatHours(group.totals[day.dateKey] ?? 0)}
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
                      {visibleDays.map((day) => (
                        <th
                          key={`${group.id}-${day.dateKey}-header`}
                          className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-300"
                        >
                          {day.label} {day.dayOfMonth}
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
                        totalsContext,
                        visibleDays
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
                          {visibleDays.map((day) => {
                            const trackedHours = getTrackedHourValue(
                              assignment,
                              day.dateKey,
                              totalsContext
                            );
                            const trackedHoursValue =
                              typeof trackedHours === "number"
                                ? hoursFormatter.format(trackedHours)
                                : "";

                            const currentValue = assignment.hours[day.dateKey];
                            const hasManualValue =
                              typeof currentValue === "string" &&
                              currentValue.trim() !== "";
                            const inputValue = hasManualValue
                              ? currentValue
                              : trackedHoursValue;

                            const existingSegments =
                              segmentsByAssignment[assignment.id]?.[
                                day.dateKey
                              ] ??
                              [];
                            const hasSegments = existingSegments.length > 0;

                            const dateKey = day.dateKey;
                            const dayData =
                              workerWeekData[assignment.workerId]?.days?.[
                                dateKey
                              ];
                            const filteredNotes = (
                              dayData?.noteEntries ?? []
                            ).filter(
                              (note) =>
                                typeof note?.text === "string" &&
                                note.text.trim().length > 0 &&
                                noteAppliesToAssignment(note, assignment)
                            );
                            const hasNotes = filteredNotes.length > 0;
                            const displayLabel =
                              formatDate(dateKey) ??
                              `${day.label} ${day.dayOfMonth}`;

                            const highlightClass = hasSegments
                              ? "border-blue-300 focus:ring-blue-400"
                              : hasNotes
                              ? "border-amber-300 focus:ring-amber-400"
                              : "";

                            return (
                              <td
                                key={`${assignment.id}-${day.dateKey}`}
                                className={`px-2 py-2 ${
                                  hasNotes
                                    ? "bg-amber-50 dark:bg-amber-900/30"
                                    : ""
                                }`}
                              >
                                <HourEntryCell
                                  assignment={assignment}
                                  day={day}
                                  displayLabel={displayLabel}
                                  inputValue={inputValue}
                                  hasNotes={hasNotes}
                                  hasSegments={hasSegments}
                                  highlightClass={highlightClass}
                                  filteredNotes={filteredNotes}
                                  onHourChange={handleHourChange}
                                  onOpenNotes={openNotesModal}
                                  onOpenSegments={openSegmentsModal}
                                  onLongPressStart={handleCellLongPressStart}
                                  onLongPressEnd={clearMobileLongPressTimer}
                                  onCellDoubleClick={handleCellDoubleClick}
                                  isCompactLayout={isCompactLayout}
                                />
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
                      {visibleDays.map((day) => (
                        <td
                          key={`${group.id}-${day.dateKey}-total`}
                          className="px-2 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200"
                        >
                          {formatHours(group.totals[day.dateKey] ?? 0)}
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
      openNotesModal,
      openSegmentsModal,
      openWorkerInfoModal,
      clearMobileLongPressTimer,
      isCompactLayout,
      openMobileCellActions,
      toggleGroupExpansion,
      viewMode,
      totalsContext,
      segmentsByAssignment,
      visibleDays,
      workerWeekData,
    ]
  );

  return (
    <>
      <div className="space-y-6 w-full max-w-full min-w-0">
        <PageHeader
          title="Registro Múltiple"
          description="Registra y compara las horas semanales por empresa o trabajador sin perder los totales diarios."
        />

        <Card className="overflow-visible">
          <CardHeader>
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <h2 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white pr-28 sm:pr-0">
                <Users
                  size={20}
                  className="mr-2 text-blue-600 dark:text-blue-400"
                />
                Selección de grupo
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <div className="inline-flex max-w-[255px] items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 px-3 py-1 text-sm text-gray-600 dark:text-gray-300">
                  Actualizado:{" "}
                  {lastFetchTime
                    ? lastFetchTime.toLocaleString("es-ES")
                    : "Sin sincronizar"}
                </div>
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
                className="absolute right-0 top-0 sm:static sm:ml-2"
              >
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-6">
              <div className="w-full xl:w-1/2 space-y-4">
                <div
                  className={
                    isLoadingGroupOptions
                      ? groupOptions.length > 0
                        ? "opacity-80"
                        : "pointer-events-none opacity-60"
                      : ""
                  }
                >
                  <GroupSearchSelect
                    groups={groupOptions}
                    selectedGroupIds={selectedGroupIds}
                    onSelectionChange={setSelectedGroupIds}
                    placeholder="Buscar y seleccionar grupo..."
                    clearOptionId="all"
                  />
                </div>
                {isLoadingGroupOptions && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Cargando grupos disponibles...
                  </p>
                )}

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
              </div>

              <div className="w-full xl:w-1/2 space-y-4">
                {companyFilterOptions.length > 0 && (
                  <div
                    className={
                      isLoadingCompanyOptions
                        ? companyFilterOptions.length > 0
                          ? "opacity-80"
                          : "pointer-events-none opacity-60"
                        : ""
                    }
                  >
                    <CompanySearchSelect
                      options={companyFilterOptions}
                      selectedValues={selectedCompanyIds}
                      onSelectionChange={handleCompanySelectionChange}
                      placeholder="Buscar y seleccionar empresa..."
                      label="Empresas"
                    />
                  </div>
                )}
                {isLoadingCompanyOptions && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Cargando empresas asociadas...
                  </p>
                )}
              </div>
            </div>

            {isLoadingWorkers ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
                <div className="flex items-center justify-center gap-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400" />
                  <div className="flex flex-col text-left text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      Sincronizando trabajadores...
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Podés seguir configurando grupos y empresas mientras
                      terminamos.
                    </span>
                  </div>
                </div>
              </div>
            ) : workersForSelect.length === 0 ? (
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
                  selectedGroupIds.includes("all") ? "Trabajador" : "Trabajador"
                }
              />
            )}

            {workersError &&
              !isLoadingWorkers &&
              workersForSelect.length !== 0 && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {workersError}
                </p>
              )}

            <div className="flex justify-center">
              <Button onClick={handleShowResults} disabled={isLoadingWorkers}>
                Mostrar resultados
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="grid w-full grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
              <div className="flex items-center justify-center gap-2 lg:justify-start">
                <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
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
              <div className="flex items-center justify-center gap-3 lg:justify-self-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => shiftSelectedRange(-1)}
                    leftIcon={<ChevronLeft size={16} />}
                    aria-label="Rango anterior"
                    className="px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <DateRangePicker
                    value={{ from: selectedRange.start, to: selectedRange.end }}
                    onChange={handleRangeSelect}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => shiftSelectedRange(1)}
                    rightIcon={<ChevronRight size={16} />}
                    aria-label="Rango siguiente"
                    className="px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center lg:justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={isSavingAll}
                  leftIcon={<Save size={16} />}
                >
                  Guardar Todo
                </Button>
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
                Horas por trabajador ({rangeLabel})
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
                  Total del período
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatHours(weeklyTotalHours)}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Sumatoria de todas las horas registradas en el intervalo seleccionado.
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                {visibleDays.map((day) => (
                  <div
                    key={`summary-${day.dateKey}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {day.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                      {formatHours(weeklyTotals[day.dateKey] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <MobileCellActionsSheet
        target={mobileCellActions}
        onClose={() => {
          clearMobileLongPressTimer();
          closeMobileCellActions();
        }}
        onSelectNotes={handleMobileNotesSelection}
        onSelectSegments={handleMobileSegmentsSelection}
      />
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
                segmentModalTarget.dateKey
              ] ?? []
            : []
        }
        existingEntries={segmentModalTarget?.existingEntries ?? []}
        onClose={closeSegmentsModal}
        onSave={handleSegmentsModalSave}
      />
      {workerInfoModal?.isOpen && (
        <WorkerInfoModal
          state={workerInfoModal}
          onClose={closeWorkerInfoModal}
        />
      )}
    </>
  );
};
