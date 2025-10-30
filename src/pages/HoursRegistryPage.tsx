import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import { addDays, differenceInCalendarDays } from "date-fns";
import {
  Save,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  CalendarDays,
  CalendarClock,
  Clock,
  Plus,
  Trash2,
  NotebookPen,
  FileSpreadsheet,
  X,
  Mail,
  Phone,
  Edit3,
  MessageCircle,
  MessageSquareWarning,
} from "lucide-react";
import { utils as XLSXUtils, writeFile as writeXLSXFile } from "xlsx-js-style";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  WorkerHoursCalendar,
  type DayScheduleEntry,
  type DayNoteEntry,
  type DayHoursSummary,
} from "../components/WorkerHoursCalendar";
import {
  Worker,
  WorkerCompanyContract,
  WorkerCompanyRelation,
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
  compactLabel: string;
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

interface ParameterRelationPayload {
  parameterRelationId?: string | null;
  parameterRelationID?: string | null;
  relationId?: string | null;
  id?: string | null;
  companyId?: string | null;
  company_id?: string | null;
  companyIdContract?: string | null;
  companyName?: string | null;
  parameterRelationName?: string | null;
  name?: string | null;
  [key: string]: unknown;
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

type ControlScheduleShiftPayload = NonNullable<
  ControlScheduleSavePayload["workShifts"]
>[number];

const HOURS_COMPARISON_EPSILON = 0.01;

const areHourValuesEqual = (a: number, b: number): boolean =>
  Math.abs(a - b) < HOURS_COMPARISON_EPSILON;

const buildShiftPayload = (
  segments: HourSegment[]
): ControlScheduleShiftPayload[] =>
  segments
    .map((segment) => {
      const workStart = (segment.start ?? "").trim();
      const workEnd = (segment.end ?? "").trim();
      if (!workStart || !workEnd) {
        return null;
      }

      return {
        id: segment.id?.trim() ?? "",
        workStart,
        workEnd,
        observations: segment.description?.trim() ?? "",
      };
    })
    .filter((shift): shift is ControlScheduleShiftPayload => Boolean(shift));

const normalizeShiftsForComparison = (shifts: ControlScheduleShiftPayload[]) =>
  shifts.map((shift) => ({
    start: shift.workStart,
    end: shift.workEnd,
    observations: shift.observations.trim(),
  }));

const areShiftArraysEqual = (
  a: ControlScheduleShiftPayload[],
  b: ControlScheduleShiftPayload[]
): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  const normalizedA = normalizeShiftsForComparison(a);
  const normalizedB = normalizeShiftsForComparison(b);

  return normalizedA.every((shift, index) => {
    const other = normalizedB[index];
    return (
      shift.start === other.start &&
      shift.end === other.end &&
      shift.observations === other.observations
    );
  });
};

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

const CONTROL_SCHEDULE_TYPE_NOTE = 7;

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
    const result: unknown[][] = Array.from(
      { length: highestIndex + 1 },
      () => []
    );

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
      ids.map((id) => trimToNull(id)).filter((id): id is string => Boolean(id))
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
    console.warn(
      "No se pudo parsear la respuesta de Parameter/GetByIds",
      error
    );
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

interface CompanyParameterOption {
  id: string;
  label: string;
}

const extractParameterItems = (
  payload: unknown
): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object")
    );
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidateKeys = [
      "value",
      "values",
      "data",
      "items",
      "result",
      "results",
      "records",
      "payload",
    ];

    for (const key of candidateKeys) {
      const maybe = record[key];
      if (Array.isArray(maybe)) {
        return maybe.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object")
        );
      }
    }
  }

  return [];
};

const fetchCompanyParameterOptions = async (
  apiUrl: string,
  token: string
): Promise<CompanyParameterOption[]> => {
  const endpoint = buildApiEndpoint(apiUrl, "/Parameter/List?Types=1");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    const items = extractParameterItems(payload);

    const options = items
      .map((item) => {
        const id = pickFirstString(
          item.id,
          item.parameterId,
          item.parameter_id,
          item.guid,
          item.value,
          item.code
        );
        const label = pickFirstString(
          item.name,
          item.label,
          item.description,
          item.title,
          item.parameterName,
          item.parameterLabel,
          item.displayName
        );
        const situation = pickFirstString(
          item.situation,
          item.Situation,
          item.status,
          item.Status
        );

        if (!id || !label) {
          return null;
        }

        if (situation && !["0", "1"].includes(situation)) {
          return null;
        }

        return { id, label };
      })
      .filter((option): option is CompanyParameterOption => option !== null);

    const uniqueMap = new Map<string, CompanyParameterOption>();
    options.forEach((option) => {
      if (!uniqueMap.has(option.id)) {
        uniqueMap.set(option.id, option);
      }
    });

    return Array.from(uniqueMap.values());
  } catch (error) {
    console.error("Error fetching company parameters:", error);
    return [];
  }
};

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

const buildNotesStateKey = (workerId: string, dateKey: string): string =>
  `${workerId}::${dateKey}`;

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
  workerId: string;
  dateKey: string;
  workerName: string;
  companyName: string;
  dayLabel: string;
  dateLabel?: string;
  notes: DayNoteEntry[];
  onClose: () => void;
  onSave: (payload: {
    workerId: string;
    dateKey: string;
    notes: DayNoteEntry[];
    deletedNoteIds: string[];
  }) => void;
}

const DayNotesModal: React.FC<DayNotesModalProps> = ({
  isOpen,
  workerId,
  dateKey,
  workerName,
  dayLabel,
  dateLabel,
  notes,
  onClose,
  onSave,
}) => {
  const [editableNote, setEditableNote] = useState<{
    id: string;
    text: string;
    isNew: boolean;
    original?: DayNoteEntry;
  } | null>(null);
  const rawNoteFieldId = useId();
  const noteFieldId = `day-note-${
    rawNoteFieldId.replace(/[^a-zA-Z0-9_-]/g, "") || "field"
  }`;
  const noteHelperId = `${noteFieldId}-helper`;
  const noteFieldName = `day-note-${workerId}-${dateKey}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );

  useEffect(() => {
    if (!isOpen) {
      setEditableNote(null);
      return;
    }

    if (notes.length > 0) {
      const primary = notes[0];
      setEditableNote({
        id: primary.id,
        text: primary.text ?? "",
        isNew: false,
        original: primary,
      });
      return;
    }

    setEditableNote({
      id: generateUuid(),
      text: "",
      isNew: true,
    });
  }, [isOpen, notes]);

  const initialText = useMemo(() => (notes[0]?.text ?? "").trim(), [notes]);

  const trimmedCurrentText = useMemo(
    () => (editableNote?.text ?? "").trim(),
    [editableNote]
  );

  const preparedState = useMemo(() => {
    if (!editableNote) {
      return {
        finalNotes: [] as DayNoteEntry[],
        deletedNoteIds: [] as string[],
      };
    }

    if (!trimmedCurrentText.length) {
      return {
        finalNotes: [],
        deletedNoteIds: editableNote.original ? [editableNote.original.id] : [],
      };
    }

    const finalNote = editableNote.original
      ? {
          ...editableNote.original,
          text: trimmedCurrentText,
        }
      : {
          id: editableNote.id,
          text: trimmedCurrentText,
          origin: "note" as DayNoteEntry["origin"],
        };

    return {
      finalNotes: [finalNote],
      deletedNoteIds: [],
    };
  }, [editableNote, trimmedCurrentText]);

  const hasChanges = trimmedCurrentText !== initialText;

  const formattedLabel =
    dateLabel && dateLabel !== dayLabel
      ? `${dayLabel} · ${dateLabel}`
      : dateLabel ?? dayLabel;

  if (!isOpen) {
    return null;
  }

  const handleSaveClick = () => {
    if (!editableNote || !hasChanges) {
      onClose();
      return;
    }

    onSave({
      workerId,
      dateKey,
      notes: preparedState.finalNotes,
      deletedNoteIds: preparedState.deletedNoteIds,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[104] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
              <NotebookPen size={16} />
              Notas del día
            </div>
            <div className="flex flex-wrap items-baseline gap-3 text-gray-500 dark:text-gray-400">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {formattedLabel}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {workerName}
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
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="space-y-3">
            <label
              htmlFor={noteFieldId}
              className="block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Nota del día
            </label>
            <textarea
              id={noteFieldId}
              name={noteFieldName}
              aria-describedby={noteHelperId}
              value={editableNote?.text ?? ""}
              onChange={(event) =>
                setEditableNote((previous) =>
                  previous
                    ? {
                        ...previous,
                        text: event.target.value,
                      }
                    : {
                        id: generateUuid(),
                        text: event.target.value,
                        isNew: true,
                      }
                )
              }
              rows={6}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
              placeholder="Escribe la nota para este día..."
            />
            <p
              id={noteHelperId}
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              Solo se permite una nota por día. Para eliminarla, deja el campo
              vacío y guarda los cambios.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={!hasChanges}
            leftIcon={<Save size={16} />}
          >
            Guardar notas
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
  if (
    ["2", "biweekly", "quincenal", "quincena", "bi-weekly"].includes(lowered)
  ) {
    return "Quincenal";
  }

  return normalized;
};

const formatSituationLabel = (
  value?: number | null | string
): string | null => {
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
  companyLookup?: Record<string, string>;
  availableCompanies?: CompanyParameterOption[];
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

interface WorkerCompaniesAndContractsProps {
  companies: Array<{ id: string; name: string; count: number }>;
  contractsByCompany: Record<string, WorkerCompanyContract[]>;
  companyStats?: Record<string, WorkerCompanyStats>;
}

const WorkerCompaniesAndContracts: React.FC<
  WorkerCompaniesAndContractsProps
> = ({ companies, contractsByCompany, companyStats }) => {
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

    Object.entries(contractsByCompany ?? {}).forEach(
      ([companyName, contracts]) => {
        const existing = merged.get(companyName);
        if (existing) {
          existing.contracts = contracts ?? [];
          if (typeof existing.contractCount !== "number") {
            existing.contractCount = contracts?.length ?? 0;
          } else {
            existing.contractCount =
              contracts?.length ?? existing.contractCount;
          }
        } else {
          const stats = companyStats?.[companyName];
          merged.set(companyName, {
            assignmentCount: stats?.assignmentCount ?? 0,
            contractCount: stats?.contractCount ?? contracts?.length ?? 0,
            contracts: contracts ?? [],
          });
        }
      }
    );

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

  const flattenedLines = useMemo(() => {
    const lines: Array<{ key: string; text: string }> = [];
    if (!entries.length) {
      return lines;
    }
    entries.forEach((entry) => {
      const companyLabel = entry.companyName;
      if (!entry.contracts.length) {
        if ((entry.assignmentCount ?? 0) > 0) {
          lines.push({
            key: `${companyLabel}-assignment`,
            text: `${companyLabel} · Sin contrato`,
          });
        } else {
          lines.push({
            key: `${companyLabel}-no-contract`,
            text: `${companyLabel} · Sin contrato registrado`,
          });
        }
        return;
      }

      entry.contracts.forEach((contract, index) => {
        const label =
          trimToNull(contract.label) ??
          trimToNull(contract.position) ??
          `Contrato ${index + 1}`;
        let text = `${companyLabel} · ${label}`;
        if (typeof contract.hourlyRate === "number") {
          text += ` · ${contract.hourlyRate.toFixed(2)} €/h`;
        }

        lines.push({
          key: `${companyLabel}-${contract.id ?? index}`,
          text,
        });
      });
    });

    return lines;
  }, [entries]);

  if (!flattenedLines.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Empresas y contratos
      </h4>
      <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
        {flattenedLines.map((line) => {
          const [companyPart, ...rest] = line.text.split(" · ");
          return (
            <li
              key={line.key}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {companyPart}
              </span>
              {rest.length > 0 ? (
                <span className="text-gray-600 dark:text-gray-300">
                  {` · ${rest.join(" · ")}`}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

interface WorkerEditableFields {
  name: string;
  email: string;
  secondaryEmail: string;
  phone: string;
  dni: string;
  address: string;
  iban: string;
  staffType: string;
  birthDate: string;
  socialSecurity: string;
  department: string;
  position: string;
  baseSalary: string;
  hourlyRate: string;
  contractType: string;
}

interface WorkerCompanyContractFormValue {
  contractKey: string;
  label: string;
  hourlyRate: string;
}

interface WorkerCompanyFormValue {
  formId: string;
  companyKey: string;
  name: string;
  count: number;
  contracts: WorkerCompanyContractFormValue[];
}

const WorkerInfoModal: React.FC<WorkerInfoModalProps> = ({
  state,
  onClose,
  companyLookup,
  availableCompanies = [],
}) => {
  const [copyFeedback, setCopyFeedback] = useState<{
    type: "email" | "phone";
    message: string;
    target?: string;
  } | null>(null);
  const [displayData, setDisplayData] = useState<WorkerInfoData | null>(
    state.data ?? null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<WorkerEditableFields>(() => ({
    name: trimToNull(state.data?.name) ?? state.workerName ?? "",
    email: state.data?.email ?? "",
    secondaryEmail: state.data?.secondaryEmail ?? "",
    phone: state.data?.phone ?? "",
    dni: state.data?.dni ?? "",
    address: state.data?.address ?? "",
    iban: state.data?.iban ?? "",
    staffType: state.data?.staffType ?? "",
    birthDate: state.data?.birthDate ?? "",
    socialSecurity: state.data?.socialSecurity ?? "",
    department: state.data?.department ?? "",
    position: state.data?.position ?? "",
    baseSalary:
      typeof state.data?.baseSalary === "number"
        ? String(state.data.baseSalary)
        : "",
    hourlyRate:
      typeof state.data?.hourlyRate === "number"
        ? String(state.data.hourlyRate)
        : "",
    contractType: state.data?.contractType ?? "",
  }));
  const [companyFormValues, setCompanyFormValues] = useState<
    WorkerCompanyFormValue[]
  >(() => {
    const data = state.data;
    if (!data || !data.companies?.length) {
      return [];
    }
    return data.companies.map((company, index) => {
      const baseKey =
        trimToNull(company.id) ?? normalizeKeyPart(company.name ?? "");
      const normalizedKey = baseKey ?? "";
      const formId = baseKey ? `${baseKey}-${index}` : `company-form-${index}`;
      const relatedContracts = data.contractsByCompany?.[company.name] ?? [];
      return {
        formId,
        companyKey: normalizedKey,
        name: company.name ?? "",
        count: company.count ?? Math.max(relatedContracts.length, 1),
        contracts: relatedContracts.map((contract, contractIndex) => ({
          contractKey:
            contract.id ?? `${normalizedKey}-contract-${contractIndex}`,
          label:
            trimToNull(contract.label) ?? trimToNull(contract.position) ?? "",
          hourlyRate:
            typeof contract.hourlyRate === "number"
              ? String(contract.hourlyRate)
              : "",
        })),
      };
    });
  });

  const companyOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();

    const addOption = (
      value?: string | null,
      label?: string | null,
      optionsConfig: { allowUnassigned?: boolean } = {}
    ) => {
      const trimmedValue = trimToNull(value);
      if (!trimmedValue) {
        return;
      }

      const isUnassigned = trimmedValue === UNASSIGNED_COMPANY_ID;
      if (isUnassigned && !optionsConfig.allowUnassigned) {
        return;
      }

      const trimmedLabel = trimToNull(label) ?? trimmedValue;
      if (!options.has(trimmedValue)) {
        options.set(trimmedValue, {
          value: trimmedValue,
          label: trimmedLabel,
        });
      }
    };

    availableCompanies.forEach((option) => {
      addOption(option.id, option.label);
    });

    const sourceCompanies =
      displayData?.companies ?? state.data?.companies ?? [];
    sourceCompanies.forEach((company, index) => {
      const canonicalId = trimToNull(company.id);
      if (canonicalId) {
        addOption(canonicalId, company.name ?? canonicalId, {
          allowUnassigned: true,
        });
        return;
      }

      const normalized = normalizeKeyPart(company.name ?? "");
      if (normalized) {
        addOption(normalized, company.name ?? normalized, {
          allowUnassigned: true,
        });
      } else {
        addOption(`company-${index}`, company.name ?? null, {
          allowUnassigned: true,
        });
      }
    });

    companyFormValues.forEach((company, index) => {
      const existing = options.get(company.companyKey);
      const label =
        existing?.label ?? trimToNull(company.name) ?? `Empresa ${index + 1}`;
      addOption(company.companyKey, label, { allowUnassigned: true });
    });

    if (companyLookup) {
      Object.entries(companyLookup).forEach(([key, label]) => {
        addOption(key, label ?? key);
      });
    }

    const sorted = Array.from(options.values())
      .filter((option) => option.value !== "")
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" })
      );

    const seenLabels = new Set<string>();
    const deduped = sorted.filter((option) => {
      const normalizedLabel =
        normalizeCompanyLabel(option.label) ?? option.label.toLowerCase();
      if (seenLabels.has(normalizedLabel)) {
        return false;
      }
      seenLabels.add(normalizedLabel);
      return true;
    });

    return [{ value: "", label: "Selecciona una empresa" }, ...deduped];
  }, [
    availableCompanies,
    companyFormValues,
    companyLookup,
    displayData?.companies,
    state.data?.companies,
  ]);

  const companyOptionsMap = useMemo(() => {
    const map = new Map<string, string>();
    companyOptions.forEach((option) => {
      map.set(option.value, option.label);
    });
    return map;
  }, [companyOptions]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const nameClickCountRef = useRef(0);
  const [isShowingWorkerId, setIsShowingWorkerId] = useState(false);

  const computeEditableFields = useCallback(
    (data: WorkerInfoData | null): WorkerEditableFields => ({
      name: trimToNull(data?.name) ?? state.workerName ?? "",
      email: data?.email ?? "",
      secondaryEmail: data?.secondaryEmail ?? "",
      phone: data?.phone ?? "",
      dni: data?.dni ?? "",
      address: data?.address ?? "",
      iban: data?.iban ?? "",
      staffType: data?.staffType ?? "",
      birthDate: data?.birthDate ?? "",
      socialSecurity: data?.socialSecurity ?? "",
      department: data?.department ?? "",
      position: data?.position ?? "",
      baseSalary:
        typeof data?.baseSalary === "number" ? String(data.baseSalary) : "",
      hourlyRate:
        typeof data?.hourlyRate === "number" ? String(data.hourlyRate) : "",
      contractType: data?.contractType ?? "",
    }),
    [state.workerName]
  );

  const computeCompanyForms = useCallback(
    (data: WorkerInfoData | null): WorkerCompanyFormValue[] => {
      if (!data || !data.companies?.length) {
        return [];
      }
      return data.companies.map((company, index) => {
        const baseKey =
          trimToNull(company.id) ?? normalizeKeyPart(company.name ?? "");
        const normalizedKey = baseKey ?? "";
        const formId = baseKey
          ? `${baseKey}-${index}`
          : `company-form-${index}`;
        const relatedContracts = data.contractsByCompany?.[company.name] ?? [];
        return {
          formId,
          companyKey: normalizedKey,
          name: company.name ?? "",
          count: company.count ?? Math.max(relatedContracts.length, 1),
          contracts: relatedContracts.map((contract, contractIndex) => ({
            contractKey:
              contract.id ?? `${normalizedKey}-contract-${contractIndex}`,
            label:
              trimToNull(contract.label) ?? trimToNull(contract.position) ?? "",
            hourlyRate:
              typeof contract.hourlyRate === "number"
                ? String(contract.hourlyRate)
                : "",
          })),
        };
      });
    },
    []
  );

  const resetForms = useCallback(
    (data: WorkerInfoData | null) => {
      setFormValues(computeEditableFields(data));
      setCompanyFormValues(computeCompanyForms(data));
    },
    [computeEditableFields, computeCompanyForms]
  );

  useEffect(() => {
    if (!state.isOpen) {
      setCopyFeedback(null);
      nameClickCountRef.current = 0;
      setIsShowingWorkerId(false);
      setIsEditing(false);
      setSaveMessage(null);
      setIsSavingDraft(false);
    }
  }, [state.isOpen]);

  useEffect(() => {
    if (!state.isOpen) {
      return;
    }
    if (!isEditing) {
      const sourceData = state.data ?? null;
      setDisplayData(sourceData);
      resetForms(sourceData);
    }
  }, [state.data, state.isOpen, isEditing, resetForms]);

  useEffect(() => {
    nameClickCountRef.current = 0;
    setIsShowingWorkerId(false);
  }, [displayData?.id]);

  const handleNameTap = useCallback(() => {
    nameClickCountRef.current += 1;
    const next = nameClickCountRef.current;
    if (next % 7 === 0) {
      setIsShowingWorkerId((previous) => !previous);
    }
  }, []);

  useEffect(() => {
    if (!copyFeedback) {
      return;
    }
    const timer = window.setTimeout(() => setCopyFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  const phoneHref = displayData?.phone
    ? sanitizeTelHref(displayData.phone)
    : null;
  const whatsappHref = displayData?.phone
    ? buildWhatsAppLink(displayData.phone)
    : null;
  const emailHref = displayData?.email ? `mailto:${displayData.email}` : null;

  const generalInfo = useMemo(() => {
    if (!displayData) {
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

    const dniDisplay = displayData.dni
      ? displayData.dni.toUpperCase()
      : displayData.dni;
    addItem("DNI", dniDisplay, { always: true });

    addItem("Dirección", displayData.address, { always: true });

    const ibanDisplay = displayData.iban
      ? displayData.iban.toUpperCase()
      : displayData.iban;
    addItem("IBAN", ibanDisplay, { always: true });

    const staffTypeDisplay =
      formatPersonalType(displayData.staffType) ??
      trimToNull(displayData.staffType);
    addItem("Tipo de personal", staffTypeDisplay, { always: true });

    const birthDateDisplay =
      formatMaybeDate(displayData.birthDate) ?? displayData.birthDate;
    addItem("Fecha de nacimiento", birthDateDisplay, { always: true });

    addItem("Seguridad Social", displayData.socialSecurity, { always: true });

    addItem("Departamento", displayData.department);
    addItem("Puesto", displayData.position);

    const formattedStart =
      formatMaybeDate(displayData.startDate) ?? displayData.startDate;
    addItem("Inicio", formattedStart);

    if (typeof displayData.baseSalary === "number") {
      addItem("Salario base", euroFormatter.format(displayData.baseSalary));
    }

    if (typeof displayData.hourlyRate === "number") {
      addItem("Tarifa hora", euroFormatter.format(displayData.hourlyRate));
    }

    return items;
  }, [displayData]);

  const workerStatus = useMemo(() => {
    if (!displayData) {
      return null;
    }
    return formatActiveStatus(
      displayData.isActive,
      displayData.situation ?? null
    );
  }, [displayData]);

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

  const handleFieldChange = useCallback(
    (field: keyof WorkerEditableFields, value: string) => {
      setFormValues((previous) => ({
        ...previous,
        [field]: value,
      }));
    },
    []
  );

  const handleStartEditing = useCallback(() => {
    setIsEditing(true);
    setSaveMessage(null);
    resetForms(displayData ?? state.data ?? null);
  }, [displayData, resetForms, state.data]);

  const handleCancelEdits = useCallback(() => {
    setIsEditing(false);
    setSaveMessage(null);
    resetForms(displayData ?? state.data ?? null);
  }, [displayData, resetForms, state.data]);

  const handleAddCompany = useCallback(() => {
    const formId = `temp-company-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    setCompanyFormValues((previous) => [
      ...previous,
      {
        formId,
        companyKey: "",
        name: "",
        count: 1,
        contracts: [],
      },
    ]);
  }, []);

  const handleRemoveCompany = useCallback((formId: string) => {
    setCompanyFormValues((previous) =>
      previous.filter((company) => company.formId !== formId)
    );
  }, []);

  const handleCompanyNameChange = useCallback(
    (formId: string, nextCompanyKey: string) => {
      const sanitizedKey = trimToNull(nextCompanyKey) ?? "";
      setCompanyFormValues((previous) =>
        previous.map((company) =>
          company.formId === formId
            ? {
                ...company,
                companyKey: sanitizedKey,
                name: sanitizedKey
                  ? companyOptionsMap.get(sanitizedKey) ?? company.name ?? ""
                  : "",
              }
            : company
        )
      );
    },
    [companyOptionsMap]
  );

  const handleAddContract = useCallback((formId: string) => {
    setCompanyFormValues((previous) =>
      previous.map((company) => {
        if (company.formId !== formId) {
          return company;
        }
        const nextContracts = [
          ...company.contracts,
          {
            contractKey: `temp-contract-${Date.now()}`,
            label: "",
            hourlyRate: "",
          },
        ];
        return {
          ...company,
          contracts: nextContracts,
          count: Math.max(company.count, nextContracts.length || 1),
        };
      })
    );
  }, []);

  const handleRemoveContract = useCallback(
    (formId: string, contractKey: string) => {
      setCompanyFormValues((previous) =>
        previous.map((company) => {
          if (company.formId !== formId) {
            return company;
          }
          const nextContracts = company.contracts.filter(
            (contract) => contract.contractKey !== contractKey
          );
          return {
            ...company,
            contracts: nextContracts,
            count: Math.max(nextContracts.length, 1),
          };
        })
      );
    },
    []
  );

  const handleContractChange = useCallback(
    (
      formId: string,
      contractKey: string,
      field: keyof WorkerCompanyContractFormValue,
      value: string
    ) => {
      setCompanyFormValues((previous) =>
        previous.map((company) => {
          if (company.formId !== formId) {
            return company;
          }
          const nextContracts = company.contracts.map((contract) =>
            contract.contractKey === contractKey
              ? { ...contract, [field]: value }
              : contract
          );
          return {
            ...company,
            contracts: nextContracts,
          };
        })
      );
    },
    []
  );

  const handleSaveEdits = useCallback(() => {
    if (isSavingDraft) {
      return;
    }

    setIsSavingDraft(true);
    setTimeout(() => {
      setDisplayData((previous) => {
        const base = previous ??
          state.data ?? {
            id: state.workerId,
            name: state.workerName,
            companies: [],
            contractsByCompany: {},
          };

        const sanitizeString = (value: string) =>
          trimToNull(value) ?? undefined;
        const parseNumeric = (value: string): number | undefined => {
          const normalized = trimToNull(value);
          if (!normalized) {
            return undefined;
          }

          const parsed = Number(normalized.replace(",", "."));
          return Number.isFinite(parsed) ? parsed : undefined;
        };

        const updatedCompanies = companyFormValues.map((company, index) => {
          const resolvedName =
            trimToNull(
              companyOptionsMap.get(company.companyKey) ?? company.name
            ) ?? `Empresa ${index + 1}`;
          const normalizedKey =
            trimToNull(company.companyKey) ??
            normalizeKeyPart(resolvedName ?? "") ??
            company.formId ??
            `company-${index}`;

          const mappedContracts = company.contracts
            .map((contract, contractIndex) => {
              const normalizedLabel = trimToNull(contract.label);
              const parsedRate = parseNumeric(contract.hourlyRate);

              if (!normalizedLabel && parsedRate === undefined) {
                return null;
              }

              const resultLabel =
                normalizedLabel ?? `Contrato ${contractIndex + 1}`;
              return {
                id:
                  contract.contractKey ||
                  `${normalizedKey}-contract-${contractIndex}`,
                hasContract: true,
                label: resultLabel,
                position: resultLabel,
                hourlyRate: parsedRate,
                companyName: resolvedName,
              } as WorkerCompanyContract;
            })
            .filter(
              (contract): contract is WorkerCompanyContract => contract !== null
            );

          const effectiveCount =
            company.count && company.count > 0
              ? company.count
              : Math.max(mappedContracts.length, 1);

          return {
            fallbackName: resolvedName,
            normalizedKey,
            mappedContracts,
            effectiveCount,
          };
        });

        const contractsByCompany: Record<string, WorkerCompanyContract[]> = {};
        updatedCompanies.forEach((entry) => {
          if (entry.mappedContracts.length > 0) {
            contractsByCompany[entry.fallbackName] = entry.mappedContracts;
          }
        });

        const companies = updatedCompanies.map((entry) => ({
          id: entry.normalizedKey,
          name: entry.fallbackName,
          count: Math.max(
            entry.effectiveCount,
            entry.mappedContracts.length || 1
          ),
        }));

        const updatedData: WorkerInfoData = {
          ...base,
          name: trimToNull(formValues.name) ?? base.name ?? state.workerName,
          email: sanitizeString(formValues.email),
          secondaryEmail: sanitizeString(formValues.secondaryEmail),
          phone: sanitizeString(formValues.phone),
          dni: sanitizeString(formValues.dni),
          address: sanitizeString(formValues.address),
          iban: sanitizeString(formValues.iban)?.toUpperCase(),
          staffType: sanitizeString(formValues.staffType),
          birthDate: sanitizeString(formValues.birthDate),
          socialSecurity: sanitizeString(formValues.socialSecurity),
          department: sanitizeString(formValues.department),
          position: sanitizeString(formValues.position),
          baseSalary: parseNumeric(formValues.baseSalary),
          hourlyRate: parseNumeric(formValues.hourlyRate),
          contractType: sanitizeString(formValues.contractType) as
            | Worker["contractType"]
            | undefined,
          companies,
          contractsByCompany,
        };

        return updatedData;
      });

      setIsEditing(false);
      setIsSavingDraft(false);
      setSaveMessage("Cambios guardados localmente");
    }, 250);
  }, [
    companyFormValues,
    formValues,
    isSavingDraft,
    state.data,
    state.workerId,
    state.workerName,
  ]);

  const primaryEmail = useMemo(
    () => trimToNull(displayData?.email),
    [displayData?.email]
  );
  const secondaryEmail = useMemo(
    () => trimToNull(displayData?.secondaryEmail),
    [displayData?.secondaryEmail]
  );
  const primaryPhone = useMemo(
    () => trimToNull(displayData?.phone),
    [displayData?.phone]
  );

  if (!state.isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="cursor-default select-none text-xl font-semibold text-gray-900 dark:text-white"
                onClick={handleNameTap}
              >
                {displayData?.name ?? state.workerName}
              </span>
              {workerStatus ? (
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    workerStatus.toLowerCase() === "alta"
                      ? "bg-green-100 text-green-700"
                      : workerStatus.toLowerCase() === "baja"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {workerStatus}
                </span>
              ) : null}
            </div>
            {isShowingWorkerId && (
              <span className="mt-1 select-text text-sm text-gray-500 dark:text-gray-300">
                {displayData?.id ?? state.workerId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && saveMessage ? (
              <span className="text-xs font-medium text-green-600 dark:text-green-300">
                {saveMessage}
              </span>
            ) : null}
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdits}
                  disabled={isSavingDraft}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdits}
                  isLoading={isSavingDraft}
                >
                  Guardar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartEditing}
                leftIcon={<Edit3 size={16} />}
                disabled={state.isLoading || Boolean(state.error)}
              >
                Editar
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Cerrar información de trabajador"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-5 max-h-[70vh] overflow-y-auto pr-1">
          {state.isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cargando información del trabajador...
            </p>
          ) : state.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : isEditing ? (
            <div className="space-y-6 text-sm text-gray-700 dark:text-gray-200">
              <section>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Información de contacto
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    fullWidth
                    label="Nombre completo"
                    value={formValues.name}
                    onChange={(event) =>
                      handleFieldChange("name", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Teléfono"
                    value={formValues.phone}
                    onChange={(event) =>
                      handleFieldChange("phone", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    type="email"
                    label="Email"
                    value={formValues.email}
                    onChange={(event) =>
                      handleFieldChange("email", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    type="email"
                    label="Email secundario"
                    value={formValues.secondaryEmail}
                    onChange={(event) =>
                      handleFieldChange("secondaryEmail", event.target.value)
                    }
                  />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Datos personales
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    fullWidth
                    label="DNI"
                    value={formValues.dni}
                    onChange={(event) =>
                      handleFieldChange("dni", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="IBAN"
                    value={formValues.iban}
                    onChange={(event) =>
                      handleFieldChange("iban", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Dirección"
                    value={formValues.address}
                    onChange={(event) =>
                      handleFieldChange("address", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Tipo de personal"
                    value={formValues.staffType}
                    onChange={(event) =>
                      handleFieldChange("staffType", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Fecha de nacimiento"
                    placeholder="YYYY-MM-DD"
                    value={formValues.birthDate}
                    onChange={(event) =>
                      handleFieldChange("birthDate", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Seguridad Social"
                    value={formValues.socialSecurity}
                    onChange={(event) =>
                      handleFieldChange("socialSecurity", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Departamento"
                    value={formValues.department}
                    onChange={(event) =>
                      handleFieldChange("department", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Puesto"
                    value={formValues.position}
                    onChange={(event) =>
                      handleFieldChange("position", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Salario base (€)"
                    type="number"
                    value={formValues.baseSalary}
                    onChange={(event) =>
                      handleFieldChange("baseSalary", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Tarifa hora (€)"
                    type="number"
                    value={formValues.hourlyRate}
                    onChange={(event) =>
                      handleFieldChange("hourlyRate", event.target.value)
                    }
                  />
                  <Input
                    fullWidth
                    label="Tipo de contrato"
                    placeholder="full_time, part_time..."
                    value={formValues.contractType}
                    onChange={(event) =>
                      handleFieldChange("contractType", event.target.value)
                    }
                  />
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Empresas y contratos
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAddCompany}
                    leftIcon={<Plus size={16} />}
                  >
                    Añadir empresa
                  </Button>
                </div>
                {companyFormValues.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    No hay empresas registradas. Usa "Añadir empresa" para crear
                    la primera.
                  </p>
                ) : (
                  <div className="mt-3 space-y-4">
                    {companyFormValues.map((company) => (
                      <div
                        key={company.formId}
                        className="rounded-xl border border-gray-200 bg-gray-100 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/40"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="min-w-0 flex-1">
                            <Select
                              label="Nombre de la empresa"
                              value={company.companyKey}
                              onChange={(value) =>
                                handleCompanyNameChange(company.formId, value)
                              }
                              options={companyOptions}
                              fullWidth
                              disabled={companyOptions.length <= 1}
                            />
                          </div>
                          <div className="hidden w-[44px] flex-col sm:flex">
                            <span className="mb-2 text-sm font-medium text-transparent">
                              &nbsp;
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCompany(company.formId)}
                              className="inline-flex h-[44px] w-[44px] min-w-0 items-center justify-center rounded-lg text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              aria-label="Eliminar empresa"
                            >
                              <Trash2 size={18} />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-3">
                          {company.contracts.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Sin contratos. Añade uno nuevo si lo necesitas.
                            </p>
                          ) : (
                            company.contracts.map((contract) => (
                              <div
                                key={contract.contractKey}
                                className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                              >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                                  <Input
                                    fullWidth
                                    label="Nombre del contrato"
                                    value={contract.label}
                                    onChange={(event) =>
                                      handleContractChange(
                                        company.formId,
                                        contract.contractKey,
                                        "label",
                                        event.target.value
                                      )
                                    }
                                  />
                                  <div className="flex items-end gap-2">
                                    <Input
                                      label="Precio por hora(€)"
                                      type="number"
                                      value={contract.hourlyRate}
                                      onChange={(event) =>
                                        handleContractChange(
                                          company.formId,
                                          contract.contractKey,
                                          "hourlyRate",
                                          event.target.value
                                        )
                                      }
                                      className="w-28"
                                      inputMode="decimal"
                                    />
                                    <div className="flex w-28 flex-col items-end">
                                      <span className="mb-2 text-sm font-medium text-transparent">
                                        &nbsp;
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="inline-flex h-[42px] w-[42px] min-w-0 items-center justify-center rounded-lg text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                        onClick={() =>
                                          handleRemoveContract(
                                            company.formId,
                                            contract.contractKey
                                          )
                                        }
                                        aria-label="Eliminar contrato"
                                      >
                                        <Trash2 size={16} />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddContract(company.formId)}
                            leftIcon={<Plus size={16} />}
                          >
                            Añadir contrato
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-6 text-sm text-gray-600 dark:text-gray-300">
              <section>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      Email:
                    </span>{" "}
                    {primaryEmail ? (
                      <button
                        type="button"
                        onClick={() => void handleCopy("email", primaryEmail)}
                        className="text-blue-600 transition hover:underline dark:text-blue-400"
                      >
                        {primaryEmail}
                      </button>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        No disponible
                      </span>
                    )}
                    {copyFeedback?.type === "email" &&
                    copyFeedback.target === primaryEmail ? (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-300">
                        {copyFeedback.message}
                      </span>
                    ) : null}
                  </p>
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      Teléfono:
                    </span>{" "}
                    {primaryPhone ? (
                      <button
                        type="button"
                        onClick={() => void handleCopy("phone", primaryPhone)}
                        className="text-blue-600 transition hover:underline dark:text-blue-400"
                      >
                        {primaryPhone}
                      </button>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        No disponible
                      </span>
                    )}
                    {copyFeedback?.type === "phone" &&
                    copyFeedback.target === primaryPhone ? (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-300">
                        {copyFeedback.message}
                      </span>
                    ) : null}
                  </p>
                  {secondaryEmail ? (
                    <p>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Email 2:
                      </span>{" "}
                      <button
                        type="button"
                        onClick={() => void handleCopy("email", secondaryEmail)}
                        className="text-blue-600 transition hover:underline dark:text-blue-400"
                      >
                        {secondaryEmail}
                      </button>
                    </p>
                  ) : null}
                </div>
              </section>

              {generalInfo.length > 0 ? (
                <section>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    {generalInfo.map((item) => (
                      <div key={item.label} className="flex gap-2">
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          {item.label}:
                        </span>
                        <span className="text-gray-600 dark:text-gray-300">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Empresas y contratos
                </h3>
                <div className="mt-3">
                  {displayData?.companies?.length ? (
                    <WorkerCompaniesAndContracts
                      companies={displayData.companies}
                      contractsByCompany={displayData.contractsByCompany ?? {}}
                      companyStats={displayData.companyStats}
                    />
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No hay empresas asignadas.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={
              !primaryEmail ||
              isEditing ||
              state.isLoading ||
              Boolean(state.error)
            }
            onClick={handleOpenEmail}
            leftIcon={<Mail size={16} />}
          >
            Enviar email
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              !phoneHref || isEditing || state.isLoading || Boolean(state.error)
            }
            onClick={handleOpenPhone}
            leftIcon={<Phone size={16} />}
          >
            Llamar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              !whatsappHref ||
              isEditing ||
              state.isLoading ||
              Boolean(state.error)
            }
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
  workerId: string;
  dateKey: string;
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

const sanitizeWorkerForRegistry = (worker: Worker): Worker => {
  const normalizedCompanyNames = Array.isArray(worker.companyNames)
    ? worker.companyNames
        .map((name) => trimToNull(name))
        .filter((name): name is string => Boolean(name))
    : undefined;

  const normalizedCompanyRelations = Array.isArray(worker.companyRelations)
    ? worker.companyRelations
        .filter(
          (relation): relation is WorkerCompanyRelation =>
            relation !== null && typeof relation === "object"
        )
        .map((relation) => ({
          relationId: trimToNull(relation.relationId) ?? undefined,
          companyId: trimToNull(relation.companyId) ?? undefined,
          companyName: trimToNull(relation.companyName) ?? undefined,
        }))
    : undefined;

  const normalizedCompanyContracts = worker.companyContracts
    ? Object.fromEntries(
        Object.entries(worker.companyContracts).map(
          ([companyName, contracts]) => {
            const sanitizedContracts = Array.isArray(contracts)
              ? contracts
                  .filter(
                    (contract): contract is WorkerCompanyContract =>
                      contract !== null && typeof contract === "object"
                  )
                  .map((contract) => ({
                    id: contract.id,
                    hasContract: Boolean(contract.hasContract),
                    relationType: contract.relationType,
                    typeLabel: trimToNull(contract.typeLabel) ?? undefined,
                    hourlyRate: contract.hourlyRate,
                    companyId: trimToNull(contract.companyId) ?? undefined,
                    companyName: trimToNull(contract.companyName) ?? undefined,
                    label: trimToNull(contract.label) ?? undefined,
                    position: trimToNull(contract.position) ?? undefined,
                    description: trimToNull(contract.description) ?? undefined,
                    startDate: trimToNull(contract.startDate) ?? undefined,
                    endDate: trimToNull(contract.endDate) ?? undefined,
                    status: trimToNull(contract.status) ?? undefined,
                    details: contract.details ?? undefined,
                  }))
              : [];
            return [companyName, sanitizedContracts];
          }
        )
      )
    : undefined;

  const normalizedCompanyStats = worker.companyStats
    ? Object.fromEntries(
        Object.entries(worker.companyStats).map(([key, stats]) => [
          key,
          { ...stats },
        ])
      )
    : undefined;

  return {
    id: worker.id,
    name: worker.name,
    email: worker.email,
    secondaryEmail: worker.secondaryEmail ?? null,
    situation: worker.situation,
    isActive: worker.isActive,
    role: worker.role,
    phone: worker.phone,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt ?? null,
    avatarUrl: worker.avatarUrl ?? null,
    baseSalary: worker.baseSalary,
    hourlyRate: worker.hourlyRate,
    contractType: worker.contractType,
    department: worker.department,
    position: worker.position,
    startDate: worker.startDate,
    dni: worker.dni,
    socialSecurity: worker.socialSecurity,
    birthDate: worker.birthDate,
    address: worker.address,
    iban: worker.iban,
    category: worker.category,
    categoryId: worker.categoryId,
    subcategory: worker.subcategory,
    subcategoryId: worker.subcategoryId,
    staffType: worker.staffType,
    companies: worker.companies ?? null,
    companyNames: normalizedCompanyNames,
    companyContracts: normalizedCompanyContracts,
    companyStats: normalizedCompanyStats,
    companyRelations: normalizedCompanyRelations,
  };
};

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

const normalizeCompanyLabel = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  return trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
};

const collectContractsMatchingAssignment = (
  worker: Worker,
  assignment: Assignment,
  companyLookup: Record<string, string>
): WorkerCompanyContract[] => {
  const normalizedAssignmentName = normalizeCompanyLabel(
    assignment.companyName
  );
  const normalizedAssignmentId = normalizeKeyPart(assignment.companyId);

  const contractsByCompany = worker.companyContracts ?? {};
  const candidateContracts: WorkerCompanyContract[] = [];

  const lookupCompanyName = (id?: string | null): string | null => {
    if (!id) {
      return null;
    }
    const trimmed = id.trim();
    if (!trimmed) {
      return null;
    }

    const direct = companyLookup[trimmed];
    if (typeof direct === "string" && direct.trim().length > 0) {
      return direct;
    }

    const normalizedId = normalizeKeyPart(trimmed);
    if (normalizedId && normalizedId !== trimmed) {
      const normalizedDirect = companyLookup[normalizedId];
      if (
        typeof normalizedDirect === "string" &&
        normalizedDirect.trim().length > 0
      ) {
        return normalizedDirect;
      }
    }

    return null;
  };

  Object.entries(contractsByCompany).forEach(([companyName, contractList]) => {
    if (!Array.isArray(contractList) || contractList.length === 0) {
      return;
    }

    const normalizedKeyName = normalizeCompanyLabel(companyName);
    const matchesKeyName = Boolean(
      normalizedAssignmentName &&
        normalizedKeyName &&
        normalizedAssignmentName === normalizedKeyName
    );

    contractList.forEach((contract) => {
      if (!contract) {
        return;
      }

      const normalizedContractName = normalizeCompanyLabel(
        contract.companyName
      );
      const normalizedContractId = normalizeKeyPart(contract.companyId);
      const lookupName = lookupCompanyName(contract.companyId);
      const normalizedLookupName = normalizeCompanyLabel(lookupName);

      const matchesId =
        normalizedAssignmentId &&
        normalizedContractId &&
        normalizedAssignmentId === normalizedContractId;

      const matchesName = Boolean(
        normalizedAssignmentName &&
          ((normalizedContractName &&
            normalizedAssignmentName === normalizedContractName) ||
            (normalizedLookupName &&
              normalizedAssignmentName === normalizedLookupName) ||
            matchesKeyName)
      );

      if (matchesId || matchesName) {
        candidateContracts.push(contract);
      }
    });
  });

  return candidateContracts;
};

const resolveHourlyRateFromWorker = (
  worker: Worker | undefined,
  assignment: Assignment,
  companyLookup: Record<string, string>
): number | undefined => {
  if (!worker) {
    return undefined;
  }

  const candidateContracts = collectContractsMatchingAssignment(
    worker,
    assignment,
    companyLookup
  );

  const contractWithRate = candidateContracts.find(
    (contract) =>
      typeof contract.hourlyRate === "number" &&
      Number.isFinite(contract.hourlyRate)
  );

  if (contractWithRate) {
    return contractWithRate.hourlyRate;
  }

  if (
    typeof worker.hourlyRate === "number" &&
    Number.isFinite(worker.hourlyRate)
  ) {
    return worker.hourlyRate;
  }

  return undefined;
};

const hasCompanyHourlyRate = (
  worker: Worker | undefined,
  assignment: Assignment,
  companyLookup: Record<string, string>
): boolean => {
  if (!worker) {
    return false;
  }

  return collectContractsMatchingAssignment(
    worker,
    assignment,
    companyLookup
  ).some(
    (contract) =>
      typeof contract.hourlyRate === "number" &&
      Number.isFinite(contract.hourlyRate)
  );
};

const roundToDecimals = (value: number, decimals = 2): number => {
  if (!Number.isFinite(value)) {
    return value;
  }
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
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

const buildCompactDayLabel = (label: string): string => {
  if (!label) {
    return "";
  }
  return label.charAt(0).toUpperCase();
};

const normalizeToStartOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const ensureRangeOrder = (
  start: Date,
  end: Date
): { start: Date; end: Date } => {
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
    const shortLabel = normalizeDayLabel(
      dayShortLabelFormatter.format(current)
    );
    const compactLabel = buildCompactDayLabel(label);

    descriptors.push({
      date: current,
      dateKey: formatLocalDateKey(current),
      label,
      shortLabel,
      compactLabel,
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
    const directDescription = (
      shift as { description: string }
    ).description.trim();
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
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return false;
    }
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
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
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {assignment.workerName}
            </p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 text-right">
              {displayLabel}
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onSelectNotes(target)}
            leftIcon={<NotebookPen size={16} />}
          >
            Notas del día
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onSelectSegments(target)}
            leftIcon={<CalendarClock size={16} />}
          >
            Turnos horarios
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};

interface HourEntryCellProps {
  assignment: Assignment;
  day: DayDescriptor;
  displayLabel: string;
  inputValue: string;
  allNotes: DayNoteEntry[];
  hasSegments: boolean;
  highlightClass: string;
  onHourChange: (assignmentId: string, dateKey: string, value: string) => void;
  onOpenNotes: (
    assignment: Assignment,
    day: DayDescriptor,
    displayLabel: string,
    notes?: DayNoteEntry[]
  ) => void;
  onOpenSegments: (
    assignment: Assignment,
    day: DayDescriptor,
    displayLabel: string
  ) => void;
  onLongPressStart: (enable: boolean, payload: MobileCellActionsTarget) => void;
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
  allNotes,
  hasSegments,
  highlightClass,
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
  const hourInputIdBase = `hours-${assignment.id}-${day.dateKey}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );
  const hourInputId = hourInputIdBase.length ? hourInputIdBase : "hours-entry";
  const hourInputName = hourInputId;
  const companyNameTrimmed = assignment.companyName.trim();
  const shouldIncludeCompany =
    companyNameTrimmed.length > 0 &&
    !UNASSIGNED_COMPANY_NAME_VARIANTS.has(companyNameTrimmed.toLowerCase());
  const hourInputContext = [
    assignment.workerName,
    shouldIncludeCompany ? companyNameTrimmed : null,
    displayLabel,
  ].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );
  const hourInputAriaLabel =
    hourInputContext.length > 0
      ? `Horas registradas para ${hourInputContext.join(" · ")}`
      : "Horas registradas";

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
      return;
    }

    setShowIcons(true);
  }, [isCompactLayout]);

  const assignmentNotes = allNotes.filter((note) =>
    noteAppliesToAssignment(note, assignment)
  );
  const hasNotes = assignmentNotes.length > 0;

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();

      const target = event.currentTarget;
      const dayKey = target.dataset.dayKey;
      if (!dayKey) {
        return;
      }

      const escapedDayKey =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(dayKey)
          : dayKey.replace(/["\\]/g, "\\$&");

      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          `input[data-hour-input="true"][data-day-key="${escapedDayKey}"]`
        )
      );

      const currentIndex = inputs.indexOf(target);
      if (currentIndex === -1) {
        return;
      }

      const direction = event.shiftKey ? -1 : 1;
      const nextInput = inputs[currentIndex + direction];

      if (nextInput) {
        nextInput.focus();
        nextInput.select?.();
      }
    },
    []
  );

  const enableCompactInteractions = isCompactLayout || !showIcons;
  const inputTitle = enableCompactInteractions
    ? "Mantén pulsado o haz doble clic para ver notas o turnos en pantallas compactas"
    : "Haz clic en los iconos para gestionar notas o turnos horarios";
  const inputSizingClasses = showIcons ? "w-28 pl-8 pr-10" : "w-24 px-3";

  return (
    <div
      className="flex h-full w-full min-w-[65px] items-center justify-center rounded-lg px-1 py-1 text-center"
      onPointerDown={() =>
        onLongPressStart(enableCompactInteractions, {
          assignment,
          day,
          displayLabel,
          notes: allNotes,
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
                onOpenNotes(assignment, day, displayLabel, allNotes)
              }
              className={`absolute inset-y-0 left-1.5 z-10 flex items-center text-gray-300 transition hover:text-amber-600 focus:outline-none ${
                hasNotes ? "text-amber-500" : ""
              }`}
              aria-label="Notas del día"
              tabIndex={-1}
            >
              <NotebookPen size={14} />
            </button>
          )}
          <Input
            id={hourInputId}
            name={hourInputName}
            size="sm"
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(event) =>
              onHourChange(assignment.id, day.dateKey, event.target.value)
            }
            onKeyDown={handleInputKeyDown}
            data-hour-input="true"
            data-day-key={day.dateKey}
            aria-label={hourInputAriaLabel}
            className={`${inputSizingClasses} text-center ${highlightClass}`}
            placeholder="0"
            title={inputTitle}
          />
          {showIcons && (
            <button
              type="button"
              onClick={() => onOpenSegments(assignment, day, displayLabel)}
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
      prev.map((segment) => {
        if (segment.id !== id) {
          return segment;
        }

        const nextSegment = { ...segment, [field]: value };
        if (field === "start" || field === "end") {
          const startMinutes = parseTimeToMinutes(
            field === "start" ? value : nextSegment.start
          );
          const endMinutes = parseTimeToMinutes(
            field === "end" ? value : nextSegment.end
          );
          if (
            startMinutes !== null &&
            endMinutes !== null &&
            endMinutes > startMinutes
          ) {
            const diffMinutes = endMinutes - startMinutes;
            const hours = diffMinutes / 60;
            const formatted = hours.toFixed(2);
            nextSegment.total = formatted
              .replace(/\.00$/, "")
              .replace(/(\.\d)0$/, "$1");
          }
        }

        return nextSegment;
      })
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

interface IndividualWorkerCalendarState {
  monthKey: string;
  hoursByDate: Record<string, DayHoursSummary>;
  isLoading: boolean;
  error: string | null;
}

interface IndividualModeViewProps {
  workers: Worker[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  apiUrl: string | null;
  token: string | null;
  companyLookup: Record<string, string>;
}

const formatDateKeyForIndividual = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;

const parseDateKey = (value: string): Date | null => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const buildCompanyLookupKey = (lookup: Record<string, string>): string =>
  Object.entries(lookup)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, name]) => `${id}:${name}`)
    .join("|");

const IndividualModeView: React.FC<IndividualModeViewProps> = ({
  workers,
  activeIndex,
  onActiveIndexChange,
  apiUrl,
  token,
  companyLookup,
}) => {
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarDataByWorker, setCalendarDataByWorker] = useState<
    Record<string, IndividualWorkerCalendarState>
  >({});
  const [selectedDayKeyByWorker, setSelectedDayKeyByWorker] = useState<
    Record<string, string | null>
  >({});

  const calendarDataRef = useRef(calendarDataByWorker);
  useEffect(() => {
    calendarDataRef.current = calendarDataByWorker;
  }, [calendarDataByWorker]);

  const selectedDayKeyRef = useRef(selectedDayKeyByWorker);
  useEffect(() => {
    selectedDayKeyRef.current = selectedDayKeyByWorker;
  }, [selectedDayKeyByWorker]);

  const totalWorkers = workers.length;
  const activeWorker = workers[activeIndex] ?? null;
  const monthKey = useMemo(
    () =>
      `${calendarMonth.getFullYear()}-${String(
        calendarMonth.getMonth() + 1
      ).padStart(2, "0")}`,
    [calendarMonth]
  );
  const companyLookupKey = useMemo(
    () => buildCompanyLookupKey(companyLookup),
    [companyLookup]
  );

  useEffect(() => {
    if (!activeWorker) {
      return;
    }

    const workerId = activeWorker.id;
    const existingEntry = calendarDataRef.current[workerId];

    if (!apiUrl || !token) {
      if (!existingEntry || existingEntry.error === null) {
        setCalendarDataByWorker((prev) => ({
          ...prev,
          [workerId]: {
            monthKey,
            hoursByDate: existingEntry?.hoursByDate ?? {},
            isLoading: false,
            error:
              "Falta configuración de API o token para cargar el calendario.",
          },
        }));
      }
      return;
    }

    if (
      existingEntry &&
      existingEntry.monthKey === monthKey &&
      !existingEntry.isLoading
    ) {
      if (!selectedDayKeyRef.current[workerId]) {
        const dayKeys = Object.keys(existingEntry.hoursByDate ?? {});
        const todayKey = formatDateKeyForIndividual(new Date());
        const fallbackKey = dayKeys.includes(todayKey)
          ? todayKey
          : dayKeys.sort()[0] ?? formatDateKeyForIndividual(calendarMonth);
        setSelectedDayKeyByWorker((prev) => ({
          ...prev,
          [workerId]: fallbackKey,
        }));
      }
      return;
    }

    let isCancelled = false;

    if (
      existingEntry &&
      existingEntry.monthKey === monthKey &&
      existingEntry.isLoading
    ) {
      return;
    }

    setCalendarDataByWorker((prev) => ({
      ...prev,
      [workerId]: {
        monthKey,
        hoursByDate: existingEntry?.hoursByDate ?? {},
        isLoading: true,
        error: null,
      },
    }));

    const loadData = async () => {
      try {
        const summary = await fetchWorkerHoursSummary({
          apiUrl,
          token,
          workerId,
          month: calendarMonth,
          companyLookup,
          includeNotes: true,
        });

        if (isCancelled) {
          return;
        }

        setCalendarDataByWorker((prev) => ({
          ...prev,
          [workerId]: {
            monthKey,
            hoursByDate: summary.hoursByDate ?? {},
            isLoading: false,
            error: null,
          },
        }));

        setSelectedDayKeyByWorker((prev) => {
          if (prev[workerId]) {
            return prev;
          }

          const dayKeys = Object.keys(summary.hoursByDate ?? {});
          const todayKey = formatDateKeyForIndividual(new Date());

          return {
            ...prev,
            [workerId]:
              (dayKeys.includes(todayKey) ? todayKey : dayKeys.sort()[0]) ??
              formatDateKeyForIndividual(calendarMonth),
          };
        });
      } catch (error) {
        console.error(
          `No se pudo obtener el calendario para el trabajador ${workerId}`,
          error
        );
        if (isCancelled) {
          return;
        }

        setCalendarDataByWorker((prev) => ({
          ...prev,
          [workerId]: {
            monthKey,
            hoursByDate: existingEntry?.hoursByDate ?? {},
            isLoading: false,
            error:
              "No se pudieron cargar los datos del calendario para este trabajador.",
          },
        }));
      }
    };

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [
    activeWorker,
    apiUrl,
    token,
    calendarMonth,
    monthKey,
    companyLookup,
    companyLookupKey,
  ]);

  useEffect(() => {
    if (!activeWorker) {
      return;
    }

    const workerId = activeWorker.id;
    if (
      selectedDayKeyRef.current[workerId] &&
      calendarDataRef.current[workerId]?.monthKey === monthKey
    ) {
      return;
    }

    const dayKeys = Object.keys(
      calendarDataRef.current[workerId]?.hoursByDate ?? {}
    );
    const todayKey = formatDateKeyForIndividual(new Date());
    setSelectedDayKeyByWorker((prev) => ({
      ...prev,
      [workerId]:
        (dayKeys.includes(todayKey) ? todayKey : dayKeys.sort()[0]) ??
        formatDateKeyForIndividual(calendarMonth),
    }));
  }, [activeWorker, monthKey, calendarMonth]);

  const setSelectedDayForWorker = useCallback(
    (workerId: string, nextKey: string | null) => {
      setSelectedDayKeyByWorker((prev) => ({
        ...prev,
        [workerId]: nextKey,
      }));
    },
    []
  );

  const handleMonthChange = useCallback((next: Date) => {
    const normalized = new Date(next.getFullYear(), next.getMonth(), 1);
    setCalendarMonth(normalized);
  }, []);

  const handlePrevWorker = useCallback(() => {
    if (totalWorkers <= 1) {
      return;
    }
    const nextIndex =
      (activeIndex - 1 + totalWorkers) % Math.max(totalWorkers, 1);
    onActiveIndexChange(nextIndex);
  }, [activeIndex, onActiveIndexChange, totalWorkers]);

  const handleNextWorker = useCallback(() => {
    if (totalWorkers <= 1) {
      return;
    }
    const nextIndex = (activeIndex + 1) % Math.max(totalWorkers, 1);
    onActiveIndexChange(nextIndex);
  }, [activeIndex, onActiveIndexChange, totalWorkers]);

  const calendarEntry =
    activeWorker && calendarDataByWorker[activeWorker.id]
      ? calendarDataByWorker[activeWorker.id]
      : null;

  const selectedDayKey =
    activeWorker && selectedDayKeyByWorker[activeWorker.id]
      ? selectedDayKeyByWorker[activeWorker.id]
      : null;

  const selectedDayDate = selectedDayKey ? parseDateKey(selectedDayKey) : null;
  const selectedDaySummary =
    selectedDayKey && calendarEntry
      ? calendarEntry.hoursByDate[selectedDayKey] ?? null
      : null;

  const weekdayLabel = selectedDayDate
    ? selectedDayDate.toLocaleDateString("es-ES", {
        weekday: "long",
      })
    : null;
  const dayFullLabel = selectedDayDate
    ? selectedDayDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const groupedEntries = useMemo(() => {
    if (!selectedDaySummary?.entries?.length) {
      return [];
    }

    return selectedDaySummary.entries.map((entry) => {
      const companyName =
        entry.companyName?.trim() ||
        companyLookup[entry.companyId ?? ""] ||
        "Sin empresa";
      const shifts =
        entry.workShifts?.map((shift, index) => {
          const start = shift.startTime ?? "";
          const end = shift.endTime ?? "";
          const label =
            start && end
              ? `${start} – ${end}`
              : start
              ? `Desde ${start}`
              : end
              ? `Hasta ${end}`
              : `Tramo ${index + 1}`;
          return {
            id: shift.id ?? `${entry.id}-shift-${index + 1}`,
            label,
            observations:
              typeof shift.observations === "string"
                ? shift.observations.trim()
                : "",
            hours: typeof shift.hours === "number" ? shift.hours : undefined,
          };
        }) ?? [];

      return {
        id: entry.id,
        companyName,
        hours:
          typeof entry.hours === "number" && Number.isFinite(entry.hours)
            ? entry.hours
            : 0,
        description: entry.description?.trim() ?? "",
        shifts,
      };
    });
  }, [companyLookup, selectedDaySummary?.entries]);

  const dayNotes = useMemo(() => {
    if (!selectedDaySummary?.noteEntries?.length) {
      return [];
    }
    return selectedDaySummary.noteEntries
      .map((note) => note.text?.trim())
      .filter((text): text is string => Boolean(text));
  }, [selectedDaySummary?.noteEntries]);

  const handleShiftDay = useCallback(
    (delta: number) => {
      if (!activeWorker || !selectedDayKey) {
        return;
      }
      const current = parseDateKey(selectedDayKey);
      if (!current) {
        return;
      }
      const nextDate = new Date(current);
      nextDate.setDate(current.getDate() + delta);
      setSelectedDayForWorker(
        activeWorker.id,
        formatDateKeyForIndividual(nextDate)
      );
    },
    [activeWorker, selectedDayKey, setSelectedDayForWorker]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[auto_1fr_auto]">
        <div className="flex justify-start">
          {totalWorkers > 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrevWorker}
              leftIcon={<ChevronLeft size={16} />}
            >
              Anterior
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-1 text-center text-gray-600 dark:text-gray-300">
          {activeWorker ? (
            <>
              <span className="text-xl font-semibold text-gray-900 dark:text-white">
                {activeWorker.name}
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {`Trabajador ${activeIndex + 1} de ${totalWorkers}`}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Sin trabajadores seleccionados
            </span>
          )}
        </div>
        <div className="flex justify-end">
          {totalWorkers > 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextWorker}
              rightIcon={<ChevronRight size={16} />}
            >
              Siguiente
            </Button>
          )}
        </div>
      </div>

      {!activeWorker ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          Selecciona uno o más trabajadores y pulsa “Mostrar resultados”.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center">
                <h3 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                  <CalendarDays
                    size={20}
                    className="mr-2 text-blue-600 dark:text-blue-400"
                  />
                  Calendario de horas
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              {calendarEntry?.error && (
                <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                  {calendarEntry.error}
                </div>
              )}
              <WorkerHoursCalendar
                worker={activeWorker}
                selectedMonth={calendarMonth}
                hoursByDate={calendarEntry?.hoursByDate ?? {}}
                onMonthChange={handleMonthChange}
                isLoading={calendarEntry?.isLoading}
                hideTitle
                selectedDayKey={selectedDayKey}
                onSelectedDayChange={(dayKey) =>
                  setSelectedDayForWorker(activeWorker.id, dayKey)
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                  <Clock
                    size={20}
                    className="mr-2 text-blue-600 dark:text-blue-400"
                  />
                  Registro
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleShiftDay(-1)}
                    disabled={!selectedDayKey}
                    aria-label="Día anterior"
                  >
                    <ChevronLeft size={18} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleShiftDay(1)}
                    disabled={!selectedDayKey}
                    aria-label="Día siguiente"
                  >
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDayKey ? (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Selecciona un día en el calendario para ver el detalle.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900/40">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {dayFullLabel}
                    </span>
                    {weekdayLabel && (
                      <span className="uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {weekdayLabel}
                      </span>
                    )}
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Total registrado:{" "}
                      <span className="font-semibold text-blue-600 dark:text-blue-300">
                        {formatHours(selectedDaySummary?.totalHours ?? 0)}
                      </span>
                    </span>
                  </div>

                  {selectedDaySummary?.companies?.length ? (
                    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                              Empresa
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-200">
                              Horas
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {selectedDaySummary.companies.map((company) => (
                            <tr
                              key={`${selectedDayKey}-${
                                company.companyId ?? company.name ?? "sin"
                              }`}
                            >
                              <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                                {company.name?.trim() ||
                                  companyLookup[company.companyId ?? ""] ||
                                  "Sin empresa"}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-800 dark:text-gray-100">
                                {formatHours(company.hours)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                      No hay horas registradas para este día.
                    </div>
                  )}

                  {groupedEntries.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Detalle de registros
                      </h4>
                      {groupedEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-900/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {entry.companyName}
                            </span>
                            <span className="font-semibold text-blue-600 dark:text-blue-300">
                              {formatHours(entry.hours)}
                            </span>
                          </div>
                          {entry.description && (
                            <p className="mt-2 text-gray-600 dark:text-gray-300">
                              {entry.description}
                            </p>
                          )}
                          {entry.shifts.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                              {entry.shifts.map((shift) => (
                                <li key={shift.id}>
                                  <span className="font-medium text-gray-600 dark:text-gray-300">
                                    {shift.label}
                                  </span>
                                  {shift.hours !== undefined && (
                                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                                      ({formatHours(shift.hours)})
                                    </span>
                                  )}
                                  {shift.observations && (
                                    <span className="ml-2 italic text-gray-500 dark:text-gray-400">
                                      {shift.observations}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {dayNotes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Notas del día
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        {dayNotes.map((note, index) => (
                          <li
                            key={`${selectedDayKey}-note-${index}`}
                            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40"
                          >
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export const HoursRegistryPage: React.FC = () => {
  const { externalJwt } = useAuthStore();
  const apiUrl = import.meta.env.VITE_API_BASE_URL;

  const [assignments, setAssignments] = useState<Assignment[]>(
    initialAssignments.map(withNormalizedCompany)
  );
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [workerNameById, setWorkerNameById] = useState<Record<string, string>>(
    {}
  );
  const [workerLookupById, setWorkerLookupById] = useState<
    Record<string, Worker>
  >({});
  const [workerLookupByNormalizedId, setWorkerLookupByNormalizedId] = useState<
    Record<string, Worker>
  >({});
  const [companyLookupMap, setCompanyLookupMap] = useState<
    Record<string, string>
  >(() => createDefaultCompanyLookupMap());
  const [companyParameterOptions, setCompanyParameterOptions] = useState<
    CompanyParameterOption[]
  >([]);
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
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"company" | "worker" | "individual">(
    "company"
  );
  const rawShowInactiveId = useId();
  const showInactiveCheckboxId = `show-inactive-${
    rawShowInactiveId.replace(/[^a-zA-Z0-9_-]/g, "") || "toggle"
  }`;
  const showInactiveCheckboxName = showInactiveCheckboxId;
  const rawShowUnassignedId = useId();
  const showUnassignedCheckboxId = `show-unassigned-${
    rawShowUnassignedId.replace(/[^a-zA-Z0-9_-]/g, "") || "toggle"
  }`;
  const showUnassignedCheckboxName = showUnassignedCheckboxId;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [companyGroupsCollapsed, setCompanyGroupsCollapsed] = useState(false);
  const [workerGroupsCollapsed, setWorkerGroupsCollapsed] = useState(false);
  const [workerWeekData, setWorkerWeekData] = useState<
    Record<string, WorkerWeeklyData>
  >({});
  const [isLoadingWeekData, setIsLoadingWeekData] = useState(false);
  const [weekDataError, setWeekDataError] = useState<string | null>(null);
  const [individualViewIndex, setIndividualViewIndex] = useState(0);
  const companyLastClickRef = useRef<number | null>(null);
  const workerLastClickRef = useRef<number | null>(null);
  const [segmentsByAssignment, setSegmentsByAssignment] = useState<
    Record<string, Record<string, HourSegment[]>>
  >({});
  const [noteDraftsByDay, setNoteDraftsByDay] = useState<
    Record<string, DayNoteEntry[]>
  >({});
  const [noteOriginalsByDay, setNoteOriginalsByDay] = useState<
    Record<string, DayNoteEntry[]>
  >({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [segmentModalTarget, setSegmentModalTarget] =
    useState<SegmentsModalTarget | null>(null);
  const [notesModalTarget, setNotesModalTarget] =
    useState<NotesModalTarget | null>(null);

  useEffect(() => {
    if (!apiUrl || !externalJwt) {
      setCompanyParameterOptions([]);
      return;
    }

    let cancelled = false;

    const loadCompanyParameters = async () => {
      const options = await fetchCompanyParameterOptions(apiUrl, externalJwt);
      if (!cancelled) {
        setCompanyParameterOptions(options);
      }
    };

    void loadCompanyParameters();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, externalJwt]);
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

  const assignmentIndexes = useMemo(() => {
    const byWorker = new Map<string, Assignment[]>();
    const byCompany = new Map<string, Assignment[]>();
    const companyLabels = new Map<string, string>();

    assignments.forEach((assignment) => {
      if (!byWorker.has(assignment.workerId)) {
        byWorker.set(assignment.workerId, []);
      }
      byWorker.get(assignment.workerId)!.push(assignment);

      if (!byCompany.has(assignment.companyId)) {
        byCompany.set(assignment.companyId, []);
      }
      byCompany.get(assignment.companyId)!.push(assignment);

      if (!companyLabels.has(assignment.companyId)) {
        companyLabels.set(assignment.companyId, assignment.companyName);
      }
    });

    return {
      byWorker,
      byCompany,
      companyLabels,
    };
  }, [assignments]);

  const assignmentsByWorker = assignmentIndexes.byWorker;
  const assignmentsByCompany = assignmentIndexes.byCompany;
  const assignmentCompanyLabels = assignmentIndexes.companyLabels;

  const clearMobileLongPressTimer = useCallback(() => {
    if (typeof window !== "undefined" && longPressTimerRef.current !== null) {
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

  const workersForSelect = filteredWorkers;

  const companyFilterOptions = useMemo(() => {
    const labelMap = new Map<string, string>(assignmentCompanyLabels);

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
  }, [assignmentCompanyLabels, companyLookupMap]);

  const selectionAssignments = useMemo(() => {
    const collectAssignments = (workerIds: Iterable<string>): Assignment[] => {
      const result: Assignment[] = [];
      for (const workerId of workerIds) {
        const entries = assignmentsByWorker.get(workerId);
        if (entries && entries.length) {
          result.push(...entries);
        }
      }
      return result;
    };

    let base: Assignment[];

    if (normalizedSelectedWorkers.length) {
      base = collectAssignments(normalizedSelectedWorkers);
    } else if (!filteredWorkerIdSet.size) {
      base = [];
    } else {
      base = collectAssignments(filteredWorkerIdSet.values());
    }

    if (!base.length) {
      return base;
    }

    const effectiveSelectedCompanies =
      getEffectiveCompanyIds(selectedCompanyIds);

    if (!effectiveSelectedCompanies.length) {
      return base;
    }

    const companySet = new Set(effectiveSelectedCompanies);
    return base.filter((assignment) => companySet.has(assignment.companyId));
  }, [
    assignmentsByWorker,
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
    if (requestedWorkerIds === null || !requestedWorkerIds.length) {
      return [] as Assignment[];
    }

    const effectiveRequestedCompanies = requestedCompanyIds
      ? getEffectiveCompanyIds(requestedCompanyIds)
      : null;
    const companySet =
      effectiveRequestedCompanies && effectiveRequestedCompanies.length
        ? new Set(effectiveRequestedCompanies)
        : null;

    const result: Assignment[] = [];
    requestedWorkerIds.forEach((workerId) => {
      const entries = assignmentsByWorker.get(workerId);
      if (!entries || !entries.length) {
        return;
      }

      if (!companySet) {
        result.push(...entries);
        return;
      }

      entries.forEach((assignment) => {
        if (companySet.has(assignment.companyId)) {
          result.push(assignment);
        }
      });
    });

    return result;
  }, [assignmentsByWorker, requestedCompanyIds, requestedWorkerIds]);

  const visibleWorkerIds = useMemo(
    () => requestedWorkerIds ?? [],
    [requestedWorkerIds]
  );

  useEffect(() => {
    if (viewMode !== "individual") {
      return;
    }
    if (!visibleWorkerIds.length) {
      if (individualViewIndex !== 0) {
        setIndividualViewIndex(0);
      }
      return;
    }
    setIndividualViewIndex((prev) => {
      if (prev >= 0 && prev < visibleWorkerIds.length) {
        return prev;
      }
      return visibleWorkerIds.length - 1;
    });
  }, [viewMode, visibleWorkerIds.length, individualViewIndex]);

  const visibleWorkerIdsKey = useMemo(() => {
    if (requestedWorkerIds === null) {
      return null;
    }
    if (!requestedWorkerIds.length) {
      return "";
    }
    return requestedWorkerIds.slice().sort().join("|");
  }, [requestedWorkerIds]);

  useEffect(() => {
    if (viewMode !== "individual") {
      return;
    }
    setIndividualViewIndex(0);
  }, [viewMode, visibleWorkerIdsKey]);

  const individualWorkers = useMemo(() => {
    if (!visibleWorkerIds.length) {
      return [] as Worker[];
    }
    return visibleWorkerIds
      .map((workerId) => workerLookupById[workerId] ?? null)
      .filter((worker): worker is Worker => worker !== null);
  }, [visibleWorkerIds, workerLookupById]);

  const effectiveIndividualIndex = useMemo(() => {
    if (!individualWorkers.length) {
      return 0;
    }
    if (individualViewIndex < 0) {
      return 0;
    }
    if (individualViewIndex >= individualWorkers.length) {
      return individualWorkers.length - 1;
    }
    return individualViewIndex;
  }, [individualViewIndex, individualWorkers.length]);

  const handleIndividualIndexChange = useCallback((nextIndex: number) => {
    setIndividualViewIndex(nextIndex);
  }, []);

  const resolveDayNotes = useCallback(
    (workerId: string, dateKey: string): DayNoteEntry[] => {
      const key = buildNotesStateKey(workerId, dateKey);
      if (noteDraftsByDay[key]) {
        return noteDraftsByDay[key];
      }
      const dayData = workerWeekData[workerId]?.days?.[dateKey];
      return dayData?.noteEntries ?? [];
    },
    [noteDraftsByDay, workerWeekData]
  );

  const selectedRangeStartMs = selectedRange.start.getTime();
  const selectedRangeEndMs = selectedRange.end.getTime();

  useEffect(() => {
    setNoteDraftsByDay({});
    setNoteOriginalsByDay({});
  }, [visibleWorkerIdsKey, selectedRangeStartMs, selectedRangeEndMs]);

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

  const totalsContext = useMemo(() => ({ workerWeekData }), [workerWeekData]);

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

  const handleRangeSelect = useCallback((range: { from: Date; to: Date }) => {
    const ordered = ensureRangeOrder(
      normalizeToStartOfDay(range.from),
      normalizeToStartOfDay(range.to)
    );
    setSelectedRange({ start: ordered.start, end: ordered.end });
  }, []);

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
          totals: calculateTotals(
            sortedAssignments,
            totalsContext,
            visibleDays
          ),
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
          totals: calculateTotals(
            sortedAssignments,
            totalsContext,
            visibleDays
          ),
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
  }, [totalsContext, visibleAssignments, visibleDays]);

  const currentGroups = useMemo(() => {
    if (viewMode === "company") {
      return companyGroups;
    }
    if (viewMode === "worker") {
      return workerGroups;
    }
    return [];
  }, [companyGroups, viewMode, workerGroups]);

  const collapseAllCurrentGroups = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const expandAllCurrentGroups = useCallback(() => {
    setExpandedGroups(new Set(currentGroups.map((group) => group.id)));
  }, [currentGroups]);

  useEffect(() => {
    const isCollapsed =
      viewMode === "company"
        ? companyGroupsCollapsed
        : viewMode === "worker"
        ? workerGroupsCollapsed
        : false;
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
      notes?: DayNoteEntry[]
    ) => {
      const effectiveNotes =
        notes ?? resolveDayNotes(assignment.workerId, day.dateKey);

      const humanReadableDate = day.dateKey
        ? formatDate(day.dateKey)
        : undefined;

      setNotesModalTarget({
        workerId: assignment.workerId,
        dateKey: day.dateKey,
        workerName: assignment.workerName,
        companyName: assignment.companyName,
        dayLabel,
        dateLabel: humanReadableDate,
        notes: effectiveNotes,
      });
    },
    [resolveDayNotes]
  );

  const closeNotesModal = useCallback(() => {
    setNotesModalTarget(null);
  }, []);

  const handleNotesModalSave = useCallback(
    (payload: {
      workerId: string;
      dateKey: string;
      notes: DayNoteEntry[];
      deletedNoteIds: string[];
    }) => {
      const key = buildNotesStateKey(payload.workerId, payload.dateKey);

      const baseline =
        noteOriginalsByDay[key] ??
        workerWeekData[payload.workerId]?.days?.[payload.dateKey]
          ?.noteEntries ??
        [];

      const normalize = (collection: DayNoteEntry[]) =>
        collection
          .map((note) => ({
            id: note.id,
            text: (note.text ?? "").trim(),
          }))
          .sort((a, b) => a.id.localeCompare(b.id));

      const normalizedBaseline = normalize(baseline);
      const normalizedCurrent = normalize(payload.notes);

      const hasDifferences =
        normalizedBaseline.length !== normalizedCurrent.length ||
        normalizedCurrent.some((note, index) => {
          const baselineNote = normalizedBaseline[index];
          if (!baselineNote) {
            return true;
          }
          return baselineNote.id !== note.id || baselineNote.text !== note.text;
        });

      setNoteOriginalsByDay((prev) => {
        if (prev[key]) {
          return prev;
        }
        return {
          ...prev,
          [key]: baseline,
        };
      });

      setNoteDraftsByDay((prev) => {
        if (!hasDifferences) {
          if (!(key in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return {
          ...prev,
          [key]: payload.notes,
        };
      });

      setNotesModalTarget((current) => {
        if (
          current &&
          current.workerId === payload.workerId &&
          current.dateKey === payload.dateKey
        ) {
          return {
            ...current,
            notes: payload.notes,
          };
        }
        return current;
      });
    },
    [noteOriginalsByDay, workerWeekData]
  );

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
      const candidates: string[] = [];
      const normalized = normalizeKeyPart(candidateId);
      if (normalized) {
        candidates.push(normalized);
      }

      if (
        typeof candidateId === "string" &&
        candidateId.trim().length > 0 &&
        (!normalized || normalized !== candidateId.trim())
      ) {
        candidates.push(candidateId.trim());
      }

      for (const key of candidates) {
        const fromLookup = companyLookupMap[key];
        if (fromLookup) {
          return fromLookup;
        }
      }

      for (const key of candidates) {
        const entries = assignmentsByCompany.get(key);
        if (entries && entries.length) {
          return entries[0].companyName;
        }
      }

      return null;
    },
    [assignmentsByCompany, companyLookupMap]
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
      const existingWorker =
        workerLookupByNormalizedId[normalizedTargetId] ??
        workerLookupById[workerId];

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
          payload?.hourlyRate ??
            payload?.rate ??
            payload?.amount ??
            payload?.hoursPerWeek
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

        const parameterRelations: ParameterRelationPayload[] = Array.isArray(
          payload?.parameterRelations
        )
          ? payload.parameterRelations.filter(
              (relation): relation is ParameterRelationPayload =>
                relation !== null && typeof relation === "object"
            )
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

        parameterRelations.forEach((relation) => {
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
          parameterRelations.forEach((relation, index) => {
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
            const normalizedCompanyId = normalizeKeyPart(
              relationCompanyIdValue
            );

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
      buildWorkerInfoFromWorker,
      enrichWorkerInfoData,
      externalJwt,
      resolveCompanyLabel,
      workerLookupById,
      workerLookupByNormalizedId,
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

  const handleCompanySelectionChange = useCallback((values: string[]) => {
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
  }, []);

  const handleShowResults = useCallback(() => {
    const sortedWorkerIds = [...selectionWorkerIds].sort((a, b) => {
      const nameA = workerNameById[a] ?? "";
      const nameB = workerNameById[b] ?? "";
      const comparison = nameA.localeCompare(nameB, "es", {
        sensitivity: "base",
        ignorePunctuation: true,
      });

      if (comparison !== 0) {
        return comparison;
      }

      return a.localeCompare(b, "es", { sensitivity: "base" });
    });

    setRequestedWorkerIds(sortedWorkerIds);
    setRequestedCompanyIds(() => [
      ...getEffectiveCompanyIds(selectedCompanyIds),
    ]);
  }, [selectedCompanyIds, selectionWorkerIds, workerNameById]);

  const fetchWorkers = useCallback(async () => {
    if (!apiUrl || !externalJwt) {
      setWorkersError("Falta configuración de API o token");
      setAllWorkers([]);
      setWorkerNameById({});
      setWorkerLookupById({});
      setWorkerLookupByNormalizedId({});
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
      const {
        workers: fetchedWorkers,
        companyLookup,
        rawWorkers,
      } = await fetchWorkersData({
        apiUrl,
        token: externalJwt,
        includeInactive: true,
      });

      const compactWorkers = fetchedWorkers.map(sanitizeWorkerForRegistry);
      const nameLookup: Record<string, string> = {};
      const lookupById: Record<string, Worker> = {};
      const lookupByNormalizedId: Record<string, Worker> = {};

      compactWorkers.forEach((worker) => {
        nameLookup[worker.id] = worker.name;
        lookupById[worker.id] = worker;
        const normalizedId = normalizeKeyPart(worker.id);
        if (normalizedId) {
          lookupByNormalizedId[normalizedId] = worker;
        }
        lookupByNormalizedId[worker.id] = worker;
      });

      setAllWorkers(compactWorkers);
      setWorkerNameById(nameLookup);
      setWorkerLookupById(lookupById);
      setWorkerLookupByNormalizedId(lookupByNormalizedId);

      const normalizedLookup = normalizeCompanyLookupMap(companyLookup);
      setCompanyLookupMap(normalizedLookup);
      setIsLoadingCompanyOptions(false);

      const generatedAssignments = generateAssignmentsFromWorkers(
        compactWorkers,
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
        const workerIdSet = new Set(compactWorkers.map((worker) => worker.id));

        const sanitizedMembers: Record<string, string[]> = {};
        grouping.groups.forEach((group) => {
          const members = (grouping.membersByGroup[group.id] ?? []).filter(
            (workerId) => workerIdSet.has(workerId)
          );
          sanitizedMembers[group.id] = Array.from(new Set(members));
        });
        sanitizedMembers.all = compactWorkers.map((worker) => worker.id);

        const options: WorkerGroupOption[] = [
          {
            id: "all",
            label: "Todos los grupos",
            description: grouping.groups.length
              ? "Incluye todos los grupos"
              : "No hay grupos disponibles",
            memberCount: compactWorkers.length,
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
        const fallbackIds = compactWorkers.map((worker) => worker.id);
        setGroupOptions([
          {
            id: "all",
            label: "Trabajadores",
            description: compactWorkers.length
              ? "Incluye todas las categorías"
              : "No hay grupos disponibles",
            memberCount: compactWorkers.length,
          },
        ]);
        setGroupMembersById({ all: fallbackIds });
        setIsLoadingGroupOptions(false);
      }
    } catch (error) {
      console.error("Error fetching workers para registro múltiple", error);
      setWorkersError("No se pudieron cargar los trabajadores");
      setAllWorkers([]);
      setWorkerNameById({});
      setWorkerLookupById({});
      setWorkerLookupByNormalizedId({});
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
      setCompanyLookupMap(createDefaultCompanyLookupMap());
      setIsLoadingGroupOptions(false);
      setIsLoadingCompanyOptions(false);
    } finally {
      setIsLoadingWorkers(false);
    }
  }, [apiUrl, externalJwt]);

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
    collapseAllCurrentGroups,
    expandAllCurrentGroups,
    viewMode,
    workerGroupsCollapsed,
  ]);

  const handleIndividualButtonClick = useCallback(() => {
    setViewMode("individual");
    setCompanyGroupsCollapsed(false);
    setWorkerGroupsCollapsed(false);
    companyLastClickRef.current = null;
    workerLastClickRef.current = null;
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (isSavingAll) {
      return;
    }

    const workersPayload = new Map<string, ControlScheduleSavePayload[]>();
    const unassignedPayload: ControlScheduleSavePayload[] = [];
    let totalPayloadItems = 0;

    const addPayloadItem = (item: ControlScheduleSavePayload) => {
      totalPayloadItems += 1;
      const workerId = item.parameterId?.trim();
      if (!workerId) {
        unassignedPayload.push(item);
        return;
      }

      if (!workersPayload.has(workerId)) {
        workersPayload.set(workerId, []);
      }
      workersPayload.get(workerId)!.push(item);
    };

    visibleAssignments.forEach((assignment) => {
      visibleDays.forEach((day) => {
        const dateKey = day.dateKey;
        const parameterId = assignment.workerId.trim();

        if (!dateKey || !parameterId) {
          return;
        }

        const raw = assignment.hours[dateKey];
        const trimmedValue = typeof raw === "string" ? raw.trim() : "";
        const manualInputExists = Object.prototype.hasOwnProperty.call(
          assignment.hours,
          dateKey
        );
        const manualInputProvided = trimmedValue.length > 0;
        const hoursValue = manualInputProvided ? parseHour(trimmedValue) : 0;

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

        const primaryEntryRaw = (
          primaryEntry as { raw?: unknown } | null | undefined
        )?.raw;
        const primaryEntryObservation =
          extractObservationText(primaryEntryRaw) ?? "";

        const existingHoursValue =
          primaryEntry && typeof primaryEntry.hours === "number"
            ? primaryEntry.hours
            : 0;

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
        const fallbackShiftPayload = buildShiftPayload(fallbackSegments);

        const storedShiftPayload =
          storedSegments !== undefined
            ? buildShiftPayload(storedSegments)
            : undefined;

        const newShiftPayload =
          storedSegments !== undefined
            ? storedShiftPayload ?? []
            : fallbackShiftPayload;

        const segmentsChanged =
          storedSegments !== undefined &&
          !areShiftArraysEqual(fallbackShiftPayload, newShiftPayload);

        const removalViaSegments =
          storedSegments !== undefined &&
          (storedShiftPayload?.length ?? 0) === 0 &&
          fallbackShiftPayload.length > 0;

        const manualInputRemoved =
          manualInputExists &&
          !manualInputProvided &&
          primaryEntry !== null &&
          (storedShiftPayload?.length ?? 0) === 0 &&
          fallbackShiftPayload.length === 0;

        const shouldCreateEntry =
          !primaryEntry &&
          ((manualInputProvided && hoursValue > 0) ||
            (storedSegments !== undefined &&
              (storedShiftPayload?.length ?? 0) > 0));

        const hoursChanged = primaryEntry
          ? manualInputProvided
            ? !areHourValuesEqual(existingHoursValue, hoursValue)
            : false
          : manualInputProvided && hoursValue > 0;

        const isDeletion =
          primaryEntry !== null &&
          ((manualInputProvided &&
            hoursValue <= 0 &&
            (storedSegments !== undefined
              ? (storedShiftPayload?.length ?? 0) === 0
              : fallbackShiftPayload.length === 0)) ||
            manualInputRemoved ||
            (!manualInputProvided && removalViaSegments));

        const shouldUpdateEntry =
          primaryEntry !== null &&
          (hoursChanged || segmentsChanged || isDeletion);

        if (!shouldCreateEntry && !shouldUpdateEntry) {
          return;
        }

        const payloadItem: ControlScheduleSavePayload = {
          id: existingEntryId || "",
          dateTime: formatDateKeyToApiDateTime(dateKey),
          parameterId,
          controlScheduleType: CONTROL_SCHEDULE_TYPE_MANUAL,
        };

        if (manualInputProvided) {
          payloadItem.value = hoursValue > 0 ? hoursValue.toFixed(2) : "0";
        } else if (isDeletion) {
          payloadItem.value = "0";
        } else if (
          !primaryEntry &&
          storedSegments !== undefined &&
          (storedShiftPayload?.length ?? 0) > 0
        ) {
          const minutesFromSegments =
            calculateSegmentsTotalMinutes(storedSegments);
          if (minutesFromSegments > 0) {
            payloadItem.value = (minutesFromSegments / 60).toFixed(2);
          }
        }

        if (isDeletion) {
          payloadItem.workShifts = [];
        } else if (newShiftPayload.length > 0) {
          payloadItem.workShifts = newShiftPayload;
        } else if (segmentsChanged && storedSegments !== undefined) {
          payloadItem.workShifts = [];
        }

        const companyId = assignment.companyId.trim();
        if (
          companyId &&
          !isUnassignedCompany(companyId, assignment.companyName)
        ) {
          payloadItem.companyId = companyId;
        }

        addPayloadItem(payloadItem);
      });
    });

    Object.entries(noteDraftsByDay).forEach(([key, editedNotes]) => {
      const [workerId, dateKey] = key.split("::");
      if (!workerId || !dateKey) {
        return;
      }

      const baseline =
        noteOriginalsByDay[key] ??
        workerWeekData[workerId]?.days?.[dateKey]?.noteEntries ??
        [];

      const sanitizedEdited = editedNotes
        .map((note) => ({
          ...note,
          text: (note.text ?? "").trim(),
        }))
        .filter((note) => note.text.length > 0);

      const normalize = (collection: DayNoteEntry[]) =>
        collection
          .map((note) => ({
            id: note.id ?? "",
            text: (note.text ?? "").trim(),
          }))
          .filter((note) => note.text.length > 0)
          .sort((a, b) => a.id.localeCompare(b.id));

      const normalizedBaseline = normalize(baseline);
      const normalizedCurrent = normalize(sanitizedEdited);

      const baselineNote = normalizedBaseline[0];
      const editedNote = normalizedCurrent[0];

      if (!editedNote && baselineNote) {
        addPayloadItem({
          id: baselineNote.id,
          dateTime: formatDateKeyToApiDateTime(dateKey),
          parameterId: workerId,
          controlScheduleType: CONTROL_SCHEDULE_TYPE_NOTE,
          value: "",
        });
        return;
      }

      if (editedNote && !baselineNote) {
        addPayloadItem({
          id: "",
          dateTime: formatDateKeyToApiDateTime(dateKey),
          parameterId: workerId,
          controlScheduleType: CONTROL_SCHEDULE_TYPE_NOTE,
          value: editedNote.text,
        });
        return;
      }

      if (editedNote && baselineNote && editedNote.text !== baselineNote.text) {
        addPayloadItem({
          id: baselineNote.id,
          dateTime: formatDateKeyToApiDateTime(dateKey),
          parameterId: workerId,
          controlScheduleType: CONTROL_SCHEDULE_TYPE_NOTE,
          value: editedNote.text,
        });
      }
    });

    if (totalPayloadItems === 0) {
      alert("No hay cambios de horas o notas para guardar");
      return;
    }

    if (!apiUrl || !externalJwt) {
      alert("Falta configuración de API o token de autenticación");
      return;
    }

    const buildErrorMessage = async (response: Response) => {
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
            if (typeof candidate === "string" && candidate.trim().length > 0) {
              errorMessage = candidate;
            } else {
              errorMessage = JSON.stringify(data);
            }
          }
        } catch {
          errorMessage = responseText;
        }
      }

      return errorMessage;
    };

    setIsSavingAll(true);

    try {
      const endpoint = buildApiEndpoint(apiUrl, CONTROL_SCHEDULE_SAVE_PATH);

      if (unassignedPayload.length > 0) {
        throw new Error(
          "Hay registros sin trabajador asociado; no se enviaron los cambios."
        );
      }

      for (const workerPayload of workersPayload.values()) {
        const orderedPayload = workerPayload
          .slice()
          .sort((a, b) => a.controlScheduleType - b.controlScheduleType);
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${externalJwt}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(orderedPayload),
        });

        if (!response.ok) {
          const errorMessage = await buildErrorMessage(response);
          throw new Error(errorMessage);
        }
      }

      if (Object.keys(noteDraftsByDay).length > 0) {
        setWorkerWeekData((prev) => {
          let changed = false;
          const next = { ...prev };

          Object.entries(noteDraftsByDay).forEach(([key, notes]) => {
            const [workerId, dateKey] = key.split("::");
            if (!workerId || !dateKey) {
              return;
            }

            const workerData = next[workerId];
            if (!workerData) {
              return;
            }

            const existingDays = workerData.days ?? {};
            const dayRecord = existingDays[dateKey];
            const updatedDay: WorkerWeeklyDayData = dayRecord
              ? {
                  ...dayRecord,
                  noteEntries: notes,
                }
              : {
                  totalHours: 0,
                  companyHours: {},
                  entries: [],
                  noteEntries: notes,
                };

            next[workerId] = {
              ...workerData,
              days: {
                ...existingDays,
                [dateKey]: updatedDay,
              },
            };
            changed = true;
          });

          return changed ? next : prev;
        });

        setNoteOriginalsByDay((prev) => {
          const next = { ...prev };
          Object.entries(noteDraftsByDay).forEach(([key, notes]) => {
            next[key] = notes;
          });
          return next;
        });

        setNoteDraftsByDay({});
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
    noteDraftsByDay,
    noteOriginalsByDay,
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
          workerLookupById[workerId]?.name ??
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
  }, [visibleWorkerIds, workerLookupById, workerNameById, workerWeekData]);

  const canExport = hasRequestedResults && visibleAssignments.length > 0;

  const handleExportExcel = useCallback(() => {
    if (!hasRequestedResults || visibleAssignments.length === 0) {
      alert("No hay datos para exportar en el rango seleccionado.");
      return;
    }

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

    visibleAssignments.forEach((assignment) => {
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
      alert("No hay datos para exportar en el rango seleccionado.");
      return;
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
        .filter((row) => Math.abs(row.hours) >= HOURS_COMPARISON_EPSILON)
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
      .filter(
        (company) => Math.abs(company.totalHours) >= HOURS_COMPARISON_EPSILON
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
      const merges = worksheet["!merges"] ?? [];
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
      { wch: 28 }, // A
      { wch: 22 }, // B
      { wch: 12 }, // C
      { wch: 12 }, // D
      { wch: 16 }, // E
      { wch: 2 }, // F separator
      { wch: 2 }, // G separator
      { wch: 28 }, // H
      { wch: 16 }, // I
      { wch: 12 }, // J
      { wch: 16 }, // K
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

    try {
      writeXLSXFile(workbook, fileName, { cellStyles: true });
    } catch (error) {
      console.error("No se pudo generar el Excel", error);
      alert("Ocurrió un error al generar el archivo de Excel.");
    }
  }, [
    companyLookupMap,
    hasRequestedResults,
    rangeLabel,
    selectedRange.end,
    selectedRange.start,
    totalsContext,
    visibleAssignments,
    visibleDays,
    workerLookupById,
    workerNameById,
  ]);

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
            <div className="flex flex-col items-end text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Total
              </span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                {formatHours(totalByGroup)}
              </span>
            </div>
          </CardHeader>

          {isExpanded && (
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm dark:divide-gray-700">
                  <colgroup>
                    <col style={{ width: "18rem" }} />
                    {visibleDays.map((day) => (
                      <col
                        key={`${group.id}-${day.dateKey}-col`}
                        style={{ width: "11rem" }}
                      />
                    ))}
                    <col style={{ width: "11rem" }} />
                  </colgroup>
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
                          <span className="inline max-[1199px]:hidden">
                            {day.label} {day.dayOfMonth}
                          </span>
                          <span className="hidden max-[1199px]:inline">
                            {`${day.compactLabel}${day.dayOfMonth}`.trim()}
                          </span>
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
                      const workerRecord =
                        workerLookupById[assignment.workerId];
                      const showHourlyWarning = workerRecord
                        ? !hasCompanyHourlyRate(
                            workerRecord,
                            assignment,
                            companyLookupMap
                          )
                        : false;

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
                                <span className="truncate">
                                  {assignment.workerName}
                                </span>
                                {showHourlyWarning ? (
                                  <span
                                    className="inline-flex items-center text-rose-400 dark:text-rose-300"
                                    title="Sin precio por hora asignado"
                                  >
                                    <MessageSquareWarning
                                      size={16}
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                      Sin precio por hora asignado
                                    </span>
                                  </span>
                                ) : null}
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="truncate">
                                  {assignment.companyName}
                                </span>
                                {showHourlyWarning ? (
                                  <span
                                    className="inline-flex items-center text-rose-400 dark:text-rose-300"
                                    title="Sin precio por hora asignado"
                                  >
                                    <MessageSquareWarning
                                      size={16}
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                      Sin precio por hora asignado
                                    </span>
                                  </span>
                                ) : null}
                              </div>
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
                              Object.prototype.hasOwnProperty.call(
                                assignment.hours,
                                day.dateKey
                              );
                            const inputValue = hasManualValue
                              ? typeof currentValue === "string"
                                ? currentValue
                                : ""
                              : trackedHoursValue;

                            const existingSegments =
                              segmentsByAssignment[assignment.id]?.[
                                day.dateKey
                              ] ?? [];
                            const hasSegments = existingSegments.length > 0;

                            const dateKey = day.dateKey;
                            const dayNotes = resolveDayNotes(
                              assignment.workerId,
                              dateKey
                            );
                            const assignmentNotes = dayNotes.filter(
                              (note) =>
                                typeof note?.text === "string" &&
                                note.text.trim().length > 0 &&
                                noteAppliesToAssignment(note, assignment)
                            );
                            const hasNotes = assignmentNotes.length > 0;
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
                                  allNotes={dayNotes}
                                  hasSegments={hasSegments}
                                  highlightClass={highlightClass}
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
      handleCellDoubleClick,
      handleCellLongPressStart,
      openNotesModal,
      openSegmentsModal,
      openWorkerInfoModal,
      clearMobileLongPressTimer,
      isCompactLayout,
      resolveDayNotes,
      toggleGroupExpansion,
      viewMode,
      totalsContext,
      segmentsByAssignment,
      visibleDays,
      workerLookupById,
      companyLookupMap,
    ]
  );

  return (
    <>
      <div className="space-y-6 w-full max-w-full min-w-0">
        <PageHeader
          title="Registro"
          description="Registra y compara las horas semanales por empresa o trabajador sin perder los totales diarios."
        />

        <Card className="overflow-visible">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                <Users
                  size={20}
                  className="mr-2 text-blue-600 dark:text-blue-400"
                />
                Selección de grupo
              </h2>
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
                  <label
                    htmlFor={showInactiveCheckboxId}
                    className="flex items-center gap-2"
                  >
                    <input
                      id={showInactiveCheckboxId}
                      name={showInactiveCheckboxName}
                      type="checkbox"
                      checked={showInactiveWorkers}
                      onChange={(event) =>
                        setShowInactiveWorkers(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                    />
                    Mostrar todos (incluye bajas)
                  </label>

                  <label
                    htmlFor={showUnassignedCheckboxId}
                    className="flex items-center gap-2"
                  >
                    <input
                      id={showUnassignedCheckboxId}
                      name={showUnassignedCheckboxName}
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
                    ? "No hay trabajadores sincronizados. Recarga la página para obtener los registros desde la API."
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
              <div className="flex items-center justify-center lg:justify-start">
                <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 shadow-sm dark:bg-gray-800">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gray-500 dark:text-gray-400">
                    Vista
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      {
                        value: "company" as const,
                        label: "Empresa",
                        handler: handleCompanyButtonClick,
                      },
                      {
                        value: "worker" as const,
                        label: "Trabajador",
                        handler: handleWorkerButtonClick,
                      },
                      {
                        value: "individual" as const,
                        label: "Individual",
                        handler: handleIndividualButtonClick,
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={option.handler}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition ${
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
              <div className="flex items-center justify-center gap-3 lg:justify-self-center">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => shiftSelectedRange(-1)}
                    aria-label="Rango anterior"
                    className="h-9 w-7 rounded-md"
                  >
                    <ChevronLeft size={18} />
                  </Button>
                  <DateRangePicker
                    value={{ from: selectedRange.start, to: selectedRange.end }}
                    onChange={handleRangeSelect}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => shiftSelectedRange(1)}
                    aria-label="Rango siguiente"
                    className="h-9 w-7 rounded-md"
                  >
                    <ChevronRight size={18} />
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

            {viewMode === "individual" ? (
              !hasRequestedResults ? (
                <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-12 text-center text-blue-700 dark:border-blue-400/40 dark:bg-blue-950/20 dark:text-blue-200">
                  Pulsa "Mostrar resultados" para cargar los registros horarios.
                </div>
              ) : (
                <IndividualModeView
                  workers={individualWorkers}
                  activeIndex={effectiveIndividualIndex}
                  onActiveIndexChange={handleIndividualIndexChange}
                  apiUrl={apiUrl ?? null}
                  token={externalJwt ?? null}
                  companyLookup={companyLookupMap}
                />
              )
            ) : !hasRequestedResults ? (
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
          <div className="flex justify-end">
            <Button
              className="bg-green-700 text-white hover:bg-white hover:text-green-700"
              variant="outline"
              leftIcon={<FileSpreadsheet size={16} />}
              onClick={handleExportExcel}
              disabled={!canExport}
            >
              Exportar Excel
            </Button>
          </div>
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
                  Sumatoria de todas las horas registradas en el intervalo
                  seleccionado.
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                {visibleDays.map((day) => (
                  <div
                    key={`summary-${day.dateKey}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      <span className="inline max-[1199px]:hidden">
                        {day.label}
                      </span>
                      <span className="hidden max-[1199px]:inline">
                        {day.compactLabel}
                      </span>
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
        workerId={notesModalTarget?.workerId ?? ""}
        dateKey={notesModalTarget?.dateKey ?? ""}
        workerName={notesModalTarget?.workerName ?? ""}
        companyName={notesModalTarget?.companyName ?? ""}
        dayLabel={notesModalTarget?.dayLabel ?? ""}
        dateLabel={notesModalTarget?.dateLabel}
        notes={notesModalTarget?.notes ?? []}
        onClose={closeNotesModal}
        onSave={handleNotesModalSave}
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
          companyLookup={companyLookupMap}
          availableCompanies={companyParameterOptions}
        />
      )}
    </>
  );
};
