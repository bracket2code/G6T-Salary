import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useId,
} from "react";
import {
  Calculator,
  Users,
  RefreshCw,
  Trash2,
  FileText,
  DollarSign,
  Sigma,
  ChevronDown,
  Plus,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  CompanySearchSelect,
  GroupSearchSelect,
  WorkerGroupOption,
  WorkerSearchSelect,
} from "../components/worker/GroupSelectors";
import { Worker } from "../types/salary";
import { useAuthStore } from "../store/authStore";
import { fetchWorkersData } from "../lib/salaryData";
import { createGroupId, fetchWorkerGroupsData } from "../lib/workerGroups";

interface WorkerCalculation {
  workerId: string;
  workerName: string;
  baseSalary: string;
  hoursWorked: string;
  overtimeHours: string;
  bonuses: string;
  deductions: string;
  results?: {
    grossSalary: number;
    netSalary: number;
    taxes: number;
    socialSecurity: number;
    overtimePay: number;
    bonuses: number;
    deductions: number;
    operationIncrease: number;
    operationDecrease: number;
  };
}

type WorkerOtherOperationType = "increase" | "decrease";

interface WorkerOtherOperation {
  id: string;
  label: string;
  amount: string;
  type: WorkerOtherOperationType;
}

const OTHER_OPERATION_TYPE_OPTIONS: Array<{
  value: WorkerOtherOperationType;
  label: string;
}> = [
  { value: "increase", label: "Suma" },
  { value: "decrease", label: "Descuento" },
];

const parseAmountInput = (value: string): number => {
  if (typeof value !== "string") {
    return 0;
  }
  const normalized = value.replace(/\s+/g, "").replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createOperationId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `op-${Math.random().toString(36).slice(2, 10)}`;
};

const UNASSIGNED_COMPANY_ID = "sin-empresa";
const UNASSIGNED_COMPANY_LABEL = "Sin empresa asignada";
const ALL_COMPANIES_OPTION_ID = "all-companies";
const ALL_COMPANIES_OPTION_LABEL = "Todas las empresas";

const INACTIVE_SITUATION_TOKENS = new Set([
  "1",
  "10",
  "1.0",
  "altaenbaja",
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

const trimToNull = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const stringValue = typeof value === "string" ? value : String(value);
  const trimmed = stringValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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

const createDefaultCompanyLookupMap = (): Record<string, string> => ({
  [UNASSIGNED_COMPANY_ID]: UNASSIGNED_COMPANY_LABEL,
});

const normalizeCompanyLookupMap = (
  lookup: Record<string, string>
): Record<string, string> => {
  const normalized = { ...createDefaultCompanyLookupMap() };

  Object.entries(lookup).forEach(([rawId, rawName]) => {
    const id = trimToNull(rawId);
    if (!id) {
      return;
    }

    const name = trimToNull(rawName) ?? id;
    normalized[id] = name;
  });

  return normalized;
};

const getEffectiveCompanyIds = (ids: string[]): string[] => {
  if (!ids.length) {
    return ids;
  }
  if (ids.includes(ALL_COMPANIES_OPTION_ID)) {
    return ids.filter((id) => id !== ALL_COMPANIES_OPTION_ID);
  }
  return ids;
};

const extractWorkerCompanyIds = (
  worker: Worker,
  companyNameToId: Map<string, string>
): string[] => {
  const ids = new Set<string>();
  const relations = worker.companyRelations ?? [];

  if (!relations.length) {
    ids.add(UNASSIGNED_COMPANY_ID);
    return Array.from(ids);
  }

  relations.forEach((relation) => {
    const candidates = [
      trimToNull(relation.companyId),
      trimToNull(relation.relationId),
    ];
    const name = trimToNull(relation.companyName);
    if (name) {
      candidates.push(createGroupId(name));
      const mappedId = companyNameToId.get(name.toLowerCase());
      if (mappedId) {
        candidates.push(mappedId);
      }
    }

    candidates
      .filter((candidate): candidate is string => Boolean(candidate))
      .forEach((candidate) => ids.add(candidate));
  });

  return Array.from(ids);
};

export const MultipleCalculatorPage: React.FC = () => {
  const { externalJwt } = useAuthStore();
  const apiUrl = import.meta.env.VITE_API_BASE_URL;

  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [companyLookupMap, setCompanyLookupMap] = useState<
    Record<string, string>
  >(createDefaultCompanyLookupMap);
  const [groupOptions, setGroupOptions] = useState<WorkerGroupOption[]>([
    {
      id: "all",
      label: "Trabajadores",
      description: "Incluye todas las categorías",
      memberCount: 0,
    },
  ]);
  const [groupMembersById, setGroupMembersById] = useState<
    Record<string, string[]>
  >({
    all: [],
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
  const [period, setPeriod] = useState("monthly");
  const [calculations, setCalculations] = useState<WorkerCalculation[]>([]);
  const [otherOperationsByWorker, setOtherOperationsByWorker] = useState<
    Record<string, WorkerOtherOperation[]>
  >({});
  const [isCalcDataCollapsed, setIsCalcDataCollapsed] = useState(false);
  const [isOtherOpsCollapsed, setIsOtherOpsCollapsed] = useState(false);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);

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

  const fetchWorkers = useCallback(async () => {
    if (!apiUrl || !externalJwt) {
      setWorkersError("Falta configuración de API o token");
      setAllWorkers([]);
      setGroupOptions([
        {
          id: "all",
          label: "Trabajadores",
          description: "Incluye todas las categorías",
          memberCount: 0,
        },
      ]);
      setGroupMembersById({ all: [] });
      setCompanyLookupMap(createDefaultCompanyLookupMap());
      setLastFetchTime(null);
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
          "No se pudieron obtener los grupos para cálculo múltiple",
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
      console.error("Error fetching workers para cálculo múltiple", error);
      setWorkersError("No se pudieron cargar los trabajadores");
      setAllWorkers([]);
      setGroupOptions([
        {
          id: "all",
          label: "Trabajadores",
          description: "Incluye todas las categorías",
          memberCount: 0,
        },
      ]);
      setGroupMembersById({ all: [] });
      setCompanyLookupMap(createDefaultCompanyLookupMap());
      setLastFetchTime(null);
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

  const companyNameToId = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(companyLookupMap).forEach(([id, label]) => {
      const normalizedLabel = trimToNull(label);
      if (!normalizedLabel) {
        return;
      }
      map.set(normalizedLabel.toLowerCase(), id);
    });
    return map;
  }, [companyLookupMap]);

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

  const workersAfterBasicFilters = useMemo(() => {
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

  const workerCompanyIdsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allWorkers.forEach((worker) => {
      map.set(worker.id, extractWorkerCompanyIds(worker, companyNameToId));
    });
    return map;
  }, [allWorkers, companyNameToId]);

  const effectiveSelectedCompanies = useMemo(
    () => getEffectiveCompanyIds(selectedCompanyIds),
    [selectedCompanyIds]
  );

  const workersForSelect = useMemo(() => {
    if (!effectiveSelectedCompanies.length) {
      return workersAfterBasicFilters;
    }

    const companySet = new Set(effectiveSelectedCompanies);
    return workersAfterBasicFilters.filter((worker) => {
      const workerCompanyIds =
        workerCompanyIdsMap.get(worker.id) ?? [UNASSIGNED_COMPANY_ID];
      return workerCompanyIds.some((companyId) => companySet.has(companyId));
    });
  }, [
    effectiveSelectedCompanies,
    workerCompanyIdsMap,
    workersAfterBasicFilters,
  ]);

  const filteredWorkerIdSet = useMemo(
    () => new Set(workersForSelect.map((worker) => worker.id)),
    [workersForSelect]
  );

  const normalizedSelectedWorkerIds = useMemo(() => {
    if (!selectedWorkerIds.length) {
      return selectedWorkerIds;
    }

    return selectedWorkerIds.filter((id) => filteredWorkerIdSet.has(id));
  }, [filteredWorkerIdSet, selectedWorkerIds]);

  useEffect(() => {
    const differs =
      normalizedSelectedWorkerIds.length !== selectedWorkerIds.length ||
      normalizedSelectedWorkerIds.some(
        (id, index) => id !== selectedWorkerIds[index]
      );
    if (differs) {
      setSelectedWorkerIds(normalizedSelectedWorkerIds);
    }
  }, [normalizedSelectedWorkerIds, selectedWorkerIds]);

  useEffect(() => {
    setCalculations((previous) =>
      normalizedSelectedWorkerIds.map((workerId) => {
        const worker = allWorkers.find((w) => w.id === workerId);
        const existingCalc = previous.find(
          (calc) => calc.workerId === workerId
        );

        if (existingCalc) {
          return existingCalc;
        }

        return {
          workerId,
          workerName: worker?.name ?? "Trabajador desconocido",
          baseSalary: worker?.baseSalary
            ? String(worker.baseSalary)
            : "",
          hoursWorked: "",
          overtimeHours: "0",
          bonuses: "0",
          deductions: "0",
        };
      })
    );
  }, [normalizedSelectedWorkerIds, allWorkers]);

  useEffect(() => {
    setOtherOperationsByWorker((previous) => {
      let changed = false;
      const next: Record<string, WorkerOtherOperation[]> = {};
      normalizedSelectedWorkerIds.forEach((workerId) => {
        if (previous[workerId]) {
          next[workerId] = previous[workerId];
        } else {
          next[workerId] = [];
          changed = true;
        }
      });

      if (!changed) {
        const previousKeys = Object.keys(previous);
        if (previousKeys.length !== normalizedSelectedWorkerIds.length) {
          changed = true;
        } else {
          for (const key of previousKeys) {
            if (!(key in next)) {
              changed = true;
              break;
            }
          }
        }
      }

      return changed ? next : previous;
    });
  }, [normalizedSelectedWorkerIds]);

  const addOtherOperation = useCallback(
    (workerId: string, type: WorkerOtherOperationType) => {
      setOtherOperationsByWorker((previous) => {
        const current = previous[workerId] ?? [];
        const nextOperations = [
          ...current,
          {
            id: createOperationId(),
            label: "",
            amount: "",
            type,
          },
        ];
        return {
          ...previous,
          [workerId]: nextOperations,
        };
      });
      setCalculations((prev) =>
        prev.map((calc) =>
          calc.workerId === workerId ? { ...calc, results: undefined } : calc
        )
      );
    },
    []
  );

  const updateOtherOperation = useCallback(
    (
      workerId: string,
      operationId: string,
      field: keyof WorkerOtherOperation,
      value: string | WorkerOtherOperationType
    ) => {
      setOtherOperationsByWorker((previous) => {
        const current = previous[workerId] ?? [];
        const index = current.findIndex((item) => item.id === operationId);
        if (index === -1) {
          return previous;
        }
        const updated: WorkerOtherOperation =
          field === "type"
            ? { ...current[index], type: value as WorkerOtherOperationType }
            : { ...current[index], [field]: value as string };
        const nextOperations = [
          ...current.slice(0, index),
          updated,
          ...current.slice(index + 1),
        ];
        return {
          ...previous,
          [workerId]: nextOperations,
        };
      });
      setCalculations((prev) =>
        prev.map((calc) =>
          calc.workerId === workerId ? { ...calc, results: undefined } : calc
        )
      );
    },
    []
  );

  const removeOtherOperation = useCallback(
    (workerId: string, operationId: string) => {
      setOtherOperationsByWorker((previous) => {
        const current = previous[workerId] ?? [];
        const filtered = current.filter((item) => item.id !== operationId);
        if (filtered.length === current.length) {
          return previous;
        }
        return {
          ...previous,
          [workerId]: filtered,
        };
      });
      setCalculations((prev) =>
        prev.map((calc) =>
          calc.workerId === workerId ? { ...calc, results: undefined } : calc
        )
      );
    },
    []
  );

  const getOperationTotals = useCallback(
    (workerId: string) => {
      const operations = otherOperationsByWorker[workerId] ?? [];
      return operations.reduce(
        (totals, operation) => {
          const amount = parseAmountInput(operation.amount);
          if (operation.type === "increase") {
            totals.increase += amount;
          } else {
            totals.decrease += amount;
          }
          return totals;
        },
        { increase: 0, decrease: 0 }
      );
    },
    [otherOperationsByWorker]
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

  const companyFilterOptions = useMemo(() => {
    const labels = new Map<string, string>();

    Object.entries(companyLookupMap).forEach(([id, label]) => {
      const normalizedId = trimToNull(id);
      const normalizedLabel = trimToNull(label);
      if (!normalizedId || !normalizedLabel) {
        return;
      }
      labels.set(normalizedId, normalizedLabel);
    });

    labels.set(UNASSIGNED_COMPANY_ID, UNASSIGNED_COMPANY_LABEL);

    workersAfterBasicFilters.forEach((worker) => {
      const relations = worker.companyRelations ?? [];
      if (!relations.length) {
        labels.set(UNASSIGNED_COMPANY_ID, UNASSIGNED_COMPANY_LABEL);
        return;
      }

      relations.forEach((relation) => {
        const name = trimToNull(relation.companyName);
        const matchedId = name ? companyNameToId.get(name.toLowerCase()) : null;
        const id =
          trimToNull(relation.companyId) ??
          trimToNull(relation.relationId) ??
          matchedId ??
          (name ? createGroupId(name) : null);

        if (!id) {
          return;
        }

        const label =
          name ??
          trimToNull(companyLookupMap[id]) ??
          trimToNull(companyLookupMap[matchedId ?? ""]) ??
          id;

        labels.set(id, label ?? id);
      });
    });

    const options = Array.from(labels.entries())
      .filter(([id]) => id !== ALL_COMPANIES_OPTION_ID)
      .map(([value, label]) => ({
        value,
        label,
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" })
      );

    options.unshift({
      value: ALL_COMPANIES_OPTION_ID,
      label: ALL_COMPANIES_OPTION_LABEL,
      description: "Incluye todas las empresas",
    });

    return options;
  }, [
    companyLookupMap,
    companyNameToId,
    workersAfterBasicFilters,
  ]);

  const updateCalculation = useCallback(
    (
      workerId: string,
      field: keyof Omit<WorkerCalculation, "results">,
      value: string
    ) => {
      setCalculations((prev) =>
        prev.map((calc) =>
          calc.workerId === workerId
            ? { ...calc, [field]: value, results: undefined }
            : calc
        )
      );
    },
    []
  );

  const calculateSalaryForWorker = useCallback(
    (calc: WorkerCalculation) => {
      const baseSalary = parseAmountInput(calc.baseSalary) || 0;
      const overtimeHours = parseAmountInput(calc.overtimeHours) || 0;
      const bonuses = parseAmountInput(calc.bonuses) || 0;
      const deductions = parseAmountInput(calc.deductions) || 0;

      const operations = otherOperationsByWorker[calc.workerId] ?? [];
      const operationTotals = operations.reduce(
        (totals, operation) => {
          const amount = parseAmountInput(operation.amount);
          if (operation.type === "increase") {
            totals.increase += amount;
          } else {
            totals.decrease += amount;
          }
          return totals;
        },
        { increase: 0, decrease: 0 }
      );

      const taxRate = 0.21;
      const socialSecurityRate = 0.063;

      const regularPay = baseSalary;
      const overtimePay = overtimeHours * (baseSalary / 160) * 1.5;
      const totalBonuses = bonuses + operationTotals.increase;
      const totalDeductions = deductions + operationTotals.decrease;
      const grossSalary = regularPay + overtimePay + totalBonuses;
      const taxes = grossSalary * taxRate;
      const socialSecurity = grossSalary * socialSecurityRate;
      const netSalary =
        grossSalary - taxes - socialSecurity - totalDeductions;

      return {
        grossSalary,
        netSalary,
        taxes,
        socialSecurity,
        overtimePay,
        bonuses: totalBonuses,
        deductions: totalDeductions,
        operationIncrease: operationTotals.increase,
        operationDecrease: operationTotals.decrease,
      };
    },
    [otherOperationsByWorker]
  );

  const handleCalculateAll = useCallback(() => {
    setCalculations((prev) =>
      prev.map((calc) => ({
        ...calc,
        results: calculateSalaryForWorker(calc),
      }))
    );
  }, [calculateSalaryForWorker]);

  const removeWorker = (workerId: string) => {
    setSelectedWorkerIds((prev) => prev.filter((id) => id !== workerId));
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);

  const getTotalResults = () => {
    const calculationsWithResults = calculations.filter((c) => c.results);
    if (calculationsWithResults.length === 0) {
      return null;
    }

    return calculationsWithResults.reduce(
      (totals, calc) => ({
        grossSalary: totals.grossSalary + (calc.results?.grossSalary ?? 0),
        netSalary: totals.netSalary + (calc.results?.netSalary ?? 0),
        taxes: totals.taxes + (calc.results?.taxes ?? 0),
        socialSecurity:
          totals.socialSecurity + (calc.results?.socialSecurity ?? 0),
        overtimePay: totals.overtimePay + (calc.results?.overtimePay ?? 0),
        bonuses: totals.bonuses + (calc.results?.bonuses ?? 0),
        deductions: totals.deductions + (calc.results?.deductions ?? 0),
        operationIncrease:
          totals.operationIncrease + (calc.results?.operationIncrease ?? 0),
        operationDecrease:
          totals.operationDecrease + (calc.results?.operationDecrease ?? 0),
      }),
      {
        grossSalary: 0,
        netSalary: 0,
        taxes: 0,
        socialSecurity: 0,
        overtimePay: 0,
        bonuses: 0,
        deductions: 0,
        operationIncrease: 0,
        operationDecrease: 0,
      }
    );
  };

  const totalResults = getTotalResults();
  const calculationsWithResults = useMemo(
    () => calculations.filter((calc) => calc.results),
    [calculations]
  );

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Cálculo Múltiple"
        description="Calcula sueldos de múltiples trabajadores simultáneamente"
        actionLabel="Calcular Todo"
        onAction={handleCalculateAll}
        actionIcon={<Calculator size={18} />}
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

              <Select
                label="Período de Cálculo"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "monthly", label: "Mensual" },
                  { value: "weekly", label: "Semanal" },
                  { value: "daily", label: "Diario" },
                ]}
                fullWidth
              />
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
                    Podés seguir configurando grupos y filtros mientras
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
              label="Trabajador"
            />
          )}

          {workersError &&
            !isLoadingWorkers &&
            workersForSelect.length !== 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {workersError}
              </p>
            )}

          {selectedWorkerIds.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>{selectedWorkerIds.length}</strong>{" "}
                trabajador{selectedWorkerIds.length !== 1 ? "es" : ""}{" "}
                seleccionado{selectedWorkerIds.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {calculations.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <Sigma
                    size={20}
                    className="mr-2 text-blue-600 dark:text-blue-400"
                  />
                  Datos para Cálculo
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCalcDataCollapsed((value) => !value)}
                  className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                  aria-label="Mostrar u ocultar datos para cálculo"
                >
                  <ChevronDown
                    size={18}
                    className={`text-gray-600 dark:text-gray-300 transition-transform ${
                      isCalcDataCollapsed ? "" : "rotate-180"
                    }`}
                  />
                </button>
              </div>
            </CardHeader>
            {!isCalcDataCollapsed && (
              <CardContent className="space-y-5">
                {calculations.map((calc) => {
                  const operationTotals = getOperationTotals(calc.workerId);
                  return (
                    <div
                      key={calc.workerId}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {calc.workerName}
                          </h3>
                          {(operationTotals.increase > 0 ||
                            operationTotals.decrease > 0) && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Ajustes pendientes:{" "}
                              <span className="text-green-600 dark:text-green-300">
                                {formatCurrency(operationTotals.increase)}
                              </span>{" "}
                              en bonificaciones ·{" "}
                              <span className="text-red-600 dark:text-red-400">
                                {formatCurrency(operationTotals.decrease)}
                              </span>{" "}
                              en descuentos
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeWorker(calc.workerId)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input
                          type="number"
                          label="Sueldo Base (€)"
                          value={calc.baseSalary}
                          onChange={(event) =>
                            updateCalculation(
                              calc.workerId,
                              "baseSalary",
                              event.target.value
                            )
                          }
                          placeholder="1500"
                          fullWidth
                        />
                        <Input
                          type="number"
                          label="Horas Trabajadas"
                          value={calc.hoursWorked}
                          onChange={(event) =>
                            updateCalculation(
                              calc.workerId,
                              "hoursWorked",
                              event.target.value
                            )
                          }
                          placeholder="160"
                          fullWidth
                        />
                        <Input
                          type="number"
                          label="Horas Extra"
                          value={calc.overtimeHours}
                          onChange={(event) =>
                            updateCalculation(
                              calc.workerId,
                              "overtimeHours",
                              event.target.value
                            )
                          }
                          placeholder="0"
                          fullWidth
                        />
                        <Input
                          type="number"
                          label="Bonificaciones (€)"
                          value={calc.bonuses}
                          onChange={(event) =>
                            updateCalculation(
                              calc.workerId,
                              "bonuses",
                              event.target.value
                            )
                          }
                          placeholder="0"
                          fullWidth
                        />
                        <Input
                          type="number"
                          label="Deducciones (€)"
                          value={calc.deductions}
                          onChange={(event) =>
                            updateCalculation(
                              calc.workerId,
                              "deductions",
                              event.target.value
                            )
                          }
                          placeholder="0"
                          fullWidth
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <FileText
                    size={20}
                    className="mr-2 text-purple-600 dark:text-purple-400"
                  />
                  Otras Operaciones
                </h2>
                <button
                  type="button"
                  onClick={() => setIsOtherOpsCollapsed((value) => !value)}
                  className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                  aria-label="Mostrar u ocultar otras operaciones"
                >
                  <ChevronDown
                    size={18}
                    className={`text-gray-600 dark:text-gray-300 transition-transform ${
                      isOtherOpsCollapsed ? "" : "rotate-180"
                    }`}
                  />
                </button>
              </div>
            </CardHeader>
            {!isOtherOpsCollapsed && (
              <CardContent className="space-y-5">
                {calculations.map((calc) => {
                  const operations = otherOperationsByWorker[calc.workerId] ?? [];
                  const operationTotals = getOperationTotals(calc.workerId);
                  return (
                    <div
                      key={calc.workerId}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {calc.workerName}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Bonificaciones adicionales:{" "}
                            <span className="text-green-600 dark:text-green-300">
                              {formatCurrency(operationTotals.increase)}
                            </span>{" "}
                            · Descuentos adicionales:{" "}
                            <span className="text-red-600 dark:text-red-400">
                              {formatCurrency(operationTotals.decrease)}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              addOtherOperation(calc.workerId, "increase")
                            }
                            leftIcon={<Plus size={14} />}
                          >
                            Añadir ingreso
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              addOtherOperation(calc.workerId, "decrease")
                            }
                            leftIcon={<Plus size={14} />}
                          >
                            Añadir descuento
                          </Button>
                        </div>
                      </div>
                      {operations.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No hay operaciones adicionales registradas.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {operations.map((operation) => (
                            <div
                              key={operation.id}
                              className="grid gap-3 md:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
                            >
                              <Select
                                label="Tipo"
                                value={operation.type}
                                onChange={(value) =>
                                  updateOtherOperation(
                                    calc.workerId,
                                    operation.id,
                                    "type",
                                    value as WorkerOtherOperationType
                                  )
                                }
                                options={OTHER_OPERATION_TYPE_OPTIONS.map(
                                  (option) => ({
                                    value: option.value,
                                    label: option.label,
                                  })
                                )}
                                fullWidth
                              />
                              <Input
                                label="Concepto"
                                value={operation.label}
                                onChange={(event) =>
                                  updateOtherOperation(
                                    calc.workerId,
                                    operation.id,
                                    "label",
                                    event.target.value
                                  )
                                }
                                placeholder="Ej: Ajuste nómina"
                                fullWidth
                              />
                              <Input
                                type="number"
                                label="Importe (€)"
                                value={operation.amount}
                                onChange={(event) =>
                                  updateOtherOperation(
                                    calc.workerId,
                                    operation.id,
                                    "amount",
                                    event.target.value
                                  )
                                }
                                placeholder="0"
                                fullWidth
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  removeOtherOperation(calc.workerId, operation.id)
                                }
                                aria-label="Eliminar operación"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <DollarSign
                    size={20}
                    className="mr-2 text-green-600 dark:text-green-400"
                  />
                  Resultados del Cálculo
                </h2>
                <button
                  type="button"
                  onClick={() => setIsResultsCollapsed((value) => !value)}
                  className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                  aria-label="Mostrar u ocultar resultados"
                >
                  <ChevronDown
                    size={18}
                    className={`text-gray-600 dark:text-gray-300 transition-transform ${
                      isResultsCollapsed ? "" : "rotate-180"
                    }`}
                  />
                </button>
              </div>
            </CardHeader>
            {!isResultsCollapsed && (
              <CardContent className="space-y-6">
                {calculationsWithResults.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <Calculator
                      size={36}
                      className="mx-auto text-gray-400 dark:text-gray-500"
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Ejecuta “Calcular Todo” para obtener los resultados
                      estimados.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {calculationsWithResults.map((calc) => {
                        const results = calc.results!;
                        return (
                          <div
                            key={calc.workerId}
                            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 space-y-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                  {calc.workerName}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Período seleccionado:{" "}
                                  <span className="font-medium capitalize">
                                    {period === "monthly"
                                      ? "Mensual"
                                      : period === "weekly"
                                      ? "Semanal"
                                      : "Diario"}
                                  </span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  Neto estimado
                                </p>
                                <p className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                                  {formatCurrency(results.netSalary)}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-700 dark:bg-green-900/20">
                                <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                                  Bruto
                                </p>
                                <p className="text-lg font-bold text-green-900 dark:text-green-100">
                                  {formatCurrency(results.grossSalary)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                  Neto
                                </p>
                                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                                  {formatCurrency(results.netSalary)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/20">
                                <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                                  Impuestos
                                </p>
                                <p className="text-lg font-bold text-red-900 dark:text-red-100">
                                  {formatCurrency(results.taxes)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-700 dark:bg-orange-900/20">
                                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                                  Seguridad Social
                                </p>
                                <p className="text-lg font-bold text-orange-900 dark:text-orange-100">
                                  {formatCurrency(results.socialSecurity)}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                  Pago horas extra
                                </p>
                                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                                  {formatCurrency(results.overtimePay)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                  Bonificaciones (incluye ajustes)
                                </p>
                                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                                  {formatCurrency(results.bonuses)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                  Deducciones (incluye ajustes)
                                </p>
                                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                                  {formatCurrency(results.deductions)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                  Ajustes aplicados
                                </p>
                                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                                  +{formatCurrency(results.operationIncrease)} / -
                                  {formatCurrency(results.operationDecrease)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {totalResults && (
                      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Resumen Total ({calculationsWithResults.length}{" "}
                            trabajador
                            {calculationsWithResults.length === 1 ? "" : "es"})
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                            <p className="text-sm text-green-700 dark:text-green-300 mb-1">
                              Total Bruto
                            </p>
                            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                              {formatCurrency(totalResults.grossSalary)}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                            <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">
                              Total Neto
                            </p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                              {formatCurrency(totalResults.netSalary)}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                            <p className="text-sm text-red-700 dark:text-red-300 mb-1">
                              Total Impuestos
                            </p>
                            <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                              {formatCurrency(totalResults.taxes)}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                            <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">
                              Total S. Social
                            </p>
                            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                              {formatCurrency(totalResults.socialSecurity)}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800/40">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Pago horas extra
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {formatCurrency(totalResults.overtimePay)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800/40">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Bonificaciones totales
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {formatCurrency(totalResults.bonuses)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800/40">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Deducciones totales
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {formatCurrency(totalResults.deductions)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800/40">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Ajustes adicionales
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              +{formatCurrency(totalResults.operationIncrease)} / -
                              {formatCurrency(totalResults.operationDecrease)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="outline"
                            leftIcon={<FileText size={16} />}
                            onClick={() => {
                              alert("Función de exportar reporte próximamente");
                            }}
                          >
                            Exportar Reporte
                          </Button>
                          <Button
                            variant="outline"
                            leftIcon={<Calculator size={16} />}
                            onClick={() => {
                              alert("Función de guardar cálculos próximamente");
                            }}
                          >
                            Guardar Todos
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Selecciona trabajadores para comenzar
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Usa el selector de arriba para elegir múltiples trabajadores y
              calcular sus sueldos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
