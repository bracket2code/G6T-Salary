import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Clock,
  Save,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { HourEntry, Worker } from "../types/salary";
import { formatDate } from "../lib/utils";
import { fetchWorkersData } from "../lib/salaryData";
import { useAuthStore } from "../store/authStore";
import {
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

interface GroupView {
  id: string;
  name: string;
  assignments: Assignment[];
  totals: Record<WeekDayKey, number>;
}

const hoursFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

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
          "Sin empresa";
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
          resolvedName || trimmedName || contractCompanyId || "Sin empresa";
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
          resolvedName || trimmedName || fallbackId || "Sin empresa";
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
    const displayName = resolvedFallback || fallbackId || "Sin empresa";
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

  return assignments;
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

const calculateRowTotal = (assignment: Assignment): number =>
  weekDays.reduce(
    (total, day) => total + parseHour(assignment.hours[day.key]),
    0
  );

const calculateTotals = (items: Assignment[]): Record<WeekDayKey, number> => {
  const totals = createEmptyTotals();

  items.forEach((item) => {
    weekDays.forEach((day) => {
      totals[day.key] += parseHour(item.hours[day.key]);
    });
  });

  return totals;
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

export const MultipleHoursRegistryPage: React.FC = () => {
  const { externalJwt } = useAuthStore();
  const apiUrl = import.meta.env.VITE_API_BASE_URL;

  const [assignments, setAssignments] =
    useState<Assignment[]>(initialAssignments);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
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
  const [isLoadingWorkers, setIsLoadingWorkers] = useState<boolean>(true);
  const [isRefreshingWorkers, setIsRefreshingWorkers] =
    useState<boolean>(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"company" | "worker">("company");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [companyGroupsCollapsed, setCompanyGroupsCollapsed] = useState(false);
  const [workerGroupsCollapsed, setWorkerGroupsCollapsed] = useState(false);
  const companyLastClickRef = useRef<number | null>(null);
  const workerLastClickRef = useRef<number | null>(null);
  const [recentEntries, setRecentEntries] = useState<HourEntry[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    getStartOfWeek(new Date())
  );

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

  const selectedGroupSummary = useMemo(() => {
    if (!selectedGroupIds.length || selectedGroupIds.includes("all")) {
      const allOption = groupOptions.find((group) => group.id === "all");
      return {
        label: allOption?.label ?? "Trabajadores",
        memberCount: filteredWorkers.length,
      };
    }

    const selectedGroups = groupOptions.filter((group) =>
      selectedGroupIds.includes(group.id)
    );

    return {
      label:
        selectedGroups.length === 1
          ? selectedGroups[0]?.label ?? "Grupo"
          : `${selectedGroups.length} grupos seleccionados`,
      memberCount: filteredWorkers.length,
    };
  }, [filteredWorkers.length, groupOptions, selectedGroupIds]);

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

  const visibleAssignments = useMemo(() => {
    if (normalizedSelectedWorkers.length) {
      const selectedSet = new Set(normalizedSelectedWorkers);
      return assignments.filter((assignment) =>
        selectedSet.has(assignment.workerId)
      );
    }

    if (!filteredWorkerIdSet.size) {
      return [] as Assignment[];
    }

    return assignments.filter((assignment) =>
      filteredWorkerIdSet.has(assignment.workerId)
    );
  }, [assignments, filteredWorkerIdSet, normalizedSelectedWorkers]);

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

  const weekDateMap = useMemo(() => {
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

    weekDays.forEach((day, index) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + index);
      dates[day.key] = current.toISOString().split("T")[0];
    });

    return dates;
  }, [currentWeekStart]);

  const weekRangeLabel = useMemo(
    () => formatWeekRange(currentWeekStart),
    [currentWeekStart]
  );

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
          totals: calculateTotals(sortedAssignments),
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
  }, [visibleAssignments]);

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
          totals: calculateTotals(sortedAssignments),
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      );
  }, [visibleAssignments]);

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

  const handleWorkerSelectionChange = useCallback((workerIds: string[]) => {
    setSelectedWorkerIds(workerIds);
    setExpandedCompany(null);
  }, []);

  const fetchWorkers = useCallback(async () => {
    if (!apiUrl || !externalJwt) {
      setWorkersError("Falta configuración de API o token");
      setAllWorkers([]);
      setAssignments(initialAssignments);
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

      const generatedAssignments = generateAssignmentsFromWorkers(
        workers,
        companyLookup
      );
      if (generatedAssignments.length > 0) {
        setAssignments(generatedAssignments);
      } else {
        setAssignments(initialAssignments);
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
      setAssignments(initialAssignments);
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

  const handleSaveAll = useCallback(() => {
    const entriesToSave: HourEntry[] = [];

    visibleAssignments.forEach((assignment) => {
      weekDays.forEach((day) => {
        const rawValue = assignment.hours[day.key].trim();
        if (!rawValue) {
          return;
        }

        const hoursValue = parseHour(rawValue);
        if (hoursValue <= 0) {
          return;
        }

        entriesToSave.push({
          id: `${assignment.id}-${day.key}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          workerId: assignment.workerId,
          workerName: assignment.workerName,
          date: weekDateMap[day.key],
          regularHours: hoursValue,
          overtimeHours: 0,
          description: `${assignment.companyName} · ${day.label}`,
          approved: false,
          createdAt: new Date().toISOString(),
        });
      });
    });

    if (entriesToSave.length === 0) {
      alert("No hay horas registradas para guardar");
      return;
    }

    setRecentEntries((prev) => [...entriesToSave, ...prev].slice(0, 12));
    alert("Horas registradas exitosamente");
  }, [visibleAssignments, weekDateMap]);

  const fetchRecentEntries = useCallback(() => {
    const mockRecentEntries: HourEntry[] = [
      {
        id: "recent-1",
        workerId: "w1",
        workerName: "Luis Martínez",
        date: weekDateMap.monday,
        regularHours: 7.5,
        overtimeHours: 1,
        description: "Mombassa · Reparación maquinaria",
        approved: true,
        approvedBy: "gerencia@mombassa.com",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "recent-2",
        workerId: "w2",
        workerName: "Pablo Ortega",
        date: weekDateMap.tuesday,
        regularHours: 6,
        overtimeHours: 0,
        description: "Cafetería Central · Inventario",
        approved: false,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ];

    setRecentEntries(mockRecentEntries);
  }, [weekDateMap]);

  useEffect(() => {
    fetchRecentEntries();
  }, [fetchRecentEntries]);

  const weeklyTotals = useMemo(
    () => calculateTotals(visibleAssignments),
    [visibleAssignments]
  );
  const weeklyTotalHours = useMemo(
    () => weekDays.reduce((total, day) => total + weeklyTotals[day.key], 0),
    [weeklyTotals]
  );

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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {group.name}
                </h3>
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
                          {day.label}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {group.assignments.map((assignment, index) => {
                      const rowTotal = calculateRowTotal(assignment);

                      return (
                        <tr
                          key={assignment.id}
                          className={
                            index % 2 === 0
                              ? "bg-white dark:bg-gray-900"
                              : "bg-gray-50 dark:bg-gray-900/70"
                          }
                        >
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                            {viewMode === "company"
                              ? assignment.workerName
                              : assignment.companyName}
                          </td>
                          {weekDays.map((day) => (
                            <td
                              key={`${assignment.id}-${day.key}`}
                              className="px-2 py-2"
                            >
                              <div className="flex items-center justify-center gap-0.5">
                                <Input
                                  size="sm"
                                  type="text"
                                  inputMode="decimal"
                                  value={assignment.hours[day.key]}
                                  onChange={(event) =>
                                    handleHourChange(
                                      assignment.id,
                                      day.key,
                                      event.target.value
                                    )
                                  }
                                  className="w-10 text-center"
                                  placeholder="0"
                                />
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  h
                                </span>
                              </div>
                            </td>
                          ))}
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
    [expandedGroups, handleHourChange, toggleGroupExpansion, viewMode]
  );

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Registro Múltiple"
        description="Registra y compara las horas semanales por empresa o trabajador sin perder los totales diarios."
        actionLabel="Guardar Todo"
        onAction={handleSaveAll}
        actionIcon={<Save size={18} />}
      />

      <Card>
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
                {selectedGroupSummary && (
                  <div className="inline-flex max-w-[255px] items-center rounded-xl border border-blue-200 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 text-sm text-blue-700 dark:text-blue-200">
                    {selectedGroupSummary.label}
                    {"Trabajadores"}: {selectedGroupSummary.memberCount}
                  </div>
                )}
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
          {currentGroups.length === 0 ? (
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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Clock
              size={20}
              className="mr-2 text-purple-600 dark:text-purple-400"
            />
            Entradas recientes
          </h2>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No hay registros de horas recientes
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Las entradas aparecerán aquí después de guardar el registro
                múltiple
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {entry.workerName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(entry.date)} · {entry.regularHours}h ·{" "}
                      {entry.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.approved
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      }`}
                    >
                      {entry.approved ? "Aprobado" : "Pendiente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
