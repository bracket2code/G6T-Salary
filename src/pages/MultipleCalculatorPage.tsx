import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, DollarSign, Users } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
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
import WorkerCalculationModule, {
  CalculationResult,
} from "../components/multiple/WorkerCalculationModule";

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

const formatHours = (hours: number) =>
  new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(hours);

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

const MultipleCalculatorPage: React.FC = () => {
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
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [resultsByWorker, setResultsByWorker] = useState<
    Record<string, CalculationResult | null>
  >({});
  const [requestedWorkerIds, setRequestedWorkerIds] = useState<string[] | null>(
    null
  );
  const hasRequestedResults = requestedWorkerIds !== null;
  const [activeWorkerIndex, setActiveWorkerIndex] = useState(0);

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
      setIsLoadingGroupOptions(false);
      setIsLoadingCompanyOptions(false);
    } finally {
      setIsLoadingWorkers(false);
    }
  }, [apiUrl, externalJwt]);

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
      const workerCompanyIds = workerCompanyIdsMap.get(worker.id) ?? [
        UNASSIGNED_COMPANY_ID,
      ];
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
    if (normalizedSelectedWorkerIds.length !== selectedWorkerIds.length) {
      setSelectedWorkerIds(normalizedSelectedWorkerIds);
    }
  }, [normalizedSelectedWorkerIds, selectedWorkerIds]);

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
      // description: "Incluye todas las empresas",
    });

    return options;
  }, [companyLookupMap, companyNameToId, workersAfterBasicFilters]);

  const handleShowResults = useCallback(() => {
    const baseIds =
      normalizedSelectedWorkerIds.length > 0
        ? normalizedSelectedWorkerIds
        : workersForSelect.map((worker) => worker.id);

    const uniqueRequestedIds = Array.from(new Set(baseIds));
    setRequestedWorkerIds(uniqueRequestedIds);
    setActiveWorkerIndex(0);
    setResultsByWorker((previous) => {
      if (!uniqueRequestedIds.length) {
        return {};
      }
      const next: Record<string, CalculationResult | null> = {};
      uniqueRequestedIds.forEach((workerId) => {
        if (workerId in previous) {
          next[workerId] = previous[workerId];
        }
      });
      return next;
    });
  }, [normalizedSelectedWorkerIds, workersForSelect]);

  const handleResultChange = useCallback(
    (workerId: string, result: CalculationResult | null) => {
      setResultsByWorker((previous) => ({
        ...previous,
        [workerId]: result,
      }));
    },
    []
  );

  const visibleWorkers = useMemo(() => {
    if (!requestedWorkerIds || !requestedWorkerIds.length) {
      return [] as Worker[];
    }

    const workerMap = new Map(allWorkers.map((worker) => [worker.id, worker]));

    return requestedWorkerIds
      .map((id) => workerMap.get(id) ?? null)
      .filter((worker): worker is Worker => worker !== null);
  }, [allWorkers, requestedWorkerIds]);

  useEffect(() => {
    setActiveWorkerIndex((previous) => {
      if (!visibleWorkers.length) {
        return 0;
      }
      if (previous < 0) {
        return 0;
      }
      if (previous >= visibleWorkers.length) {
        return visibleWorkers.length - 1;
      }
      return previous;
    });
  }, [visibleWorkers.length]);

  const visibleWorkerIds = useMemo(
    () => visibleWorkers.map((worker) => worker.id),
    [visibleWorkers]
  );

  const aggregatedResults = useMemo(() => {
    if (!hasRequestedResults || !visibleWorkerIds.length) {
      return null;
    }

    const validResults = visibleWorkerIds
      .map((workerId) => resultsByWorker[workerId])
      .filter((result): result is CalculationResult => Boolean(result));

    if (!validResults.length) {
      return null;
    }

    return validResults.reduce(
      (totals, result) => ({
        totalAmount: totals.totalAmount + result.totalAmount,
        regularHours: totals.regularHours + result.regularHours,
        overtimeHours: totals.overtimeHours + result.overtimeHours,
        totalHours: totals.totalHours + result.totalHours,
      }),
      {
        totalAmount: 0,
        regularHours: 0,
        overtimeHours: 0,
        totalHours: 0,
      }
    );
  }, [hasRequestedResults, resultsByWorker, visibleWorkerIds]);

  const handlePrevWorker = useCallback(() => {
    setActiveWorkerIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNextWorker = useCallback(() => {
    setActiveWorkerIndex((prev) =>
      visibleWorkers.length ? Math.min(prev + 1, visibleWorkers.length - 1) : 0
    );
  }, [visibleWorkers.length]);

  const activeWorker =
    visibleWorkers.length > 0
      ? visibleWorkers[Math.min(activeWorkerIndex, visibleWorkers.length - 1)]
      : null;
  const hasMultipleVisibleWorkers = visibleWorkers.length > 1;

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Cálculo Múltiple"
        description="Calcula sueldos de múltiples trabajadores simultáneamente"
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
                <strong>{selectedWorkerIds.length}</strong> trabajador
                {selectedWorkerIds.length !== 1 ? "es" : ""} seleccionado
                {selectedWorkerIds.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          <div className="flex justify-center">
            <Button onClick={handleShowResults} disabled={isLoadingWorkers}>
              Mostrar resultados
            </Button>
          </div>
        </CardContent>
      </Card>

      {!hasRequestedResults ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Selecciona trabajadores para comenzar
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Usa el selector de arriba y pulsa “Mostrar resultados” para
              generar los cálculos de los trabajadores elegidos.
            </p>
          </CardContent>
        </Card>
      ) : visibleWorkers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No hay trabajadores disponibles
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Ajusta los filtros o selecciona uno o más trabajadores y pulsa
              “Mostrar resultados” para ver sus cálculos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {hasMultipleVisibleWorkers && activeWorker && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Trabajador {activeWorkerIndex + 1} de {visibleWorkers.length}
                {activeWorker.name ? ` · ${activeWorker.name}` : ""}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevWorker}
                  disabled={activeWorkerIndex === 0}
                  className="h-9 w-9 rounded-full p-0"
                  aria-label="Trabajador anterior"
                >
                  <ChevronLeft size={18} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextWorker}
                  disabled={activeWorkerIndex >= visibleWorkers.length - 1}
                  className="h-9 w-9 rounded-full p-0"
                  aria-label="Trabajador siguiente"
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          )}

          {activeWorker && (
            <WorkerCalculationModule
              key={activeWorker.id}
              worker={activeWorker}
              apiUrl={apiUrl ?? ""}
              token={externalJwt ?? ""}
              onResultChange={handleResultChange}
            />
          )}

          {aggregatedResults && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <DollarSign
                      size={20}
                      className="mr-2 text-green-600 dark:text-green-400"
                    />
                    Resumen total
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {visibleWorkers.length} trabajador
                    {visibleWorkers.length === 1 ? "" : "es"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-sm text-green-700 dark:text-green-300 mb-1">
                      Total importe
                    </p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(aggregatedResults.totalAmount)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">
                      Horas regulares
                    </p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {formatHours(aggregatedResults.regularHours)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-1">
                      Horas extra
                    </p>
                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                      {formatHours(aggregatedResults.overtimeHours)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">
                      Horas totales
                    </p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {formatHours(aggregatedResults.totalHours)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export { MultipleCalculatorPage };
export default MultipleCalculatorPage;
