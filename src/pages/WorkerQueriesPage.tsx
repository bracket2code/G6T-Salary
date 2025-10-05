import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Users,
  FileText,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  Building2,
  User,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { Worker, WorkerCompanyContract } from "../types/salary";
import { formatDate } from "../lib/utils";
import { useAuthStore } from "../store/authStore";
import { fetchWorkersData } from "../lib/salaryData";
import {
  GroupSearchSelect,
  WorkerGroupOption,
  WorkerSearchSelect,
} from "../components/worker/GroupSelectors";
import { createGroupId, fetchWorkerGroupsData } from "../lib/workerGroups";

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

const formatCurrencyValue = (amount: number) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

const getContractTypeLabel = (type: Worker["contractType"] | undefined) => {
  switch (type) {
    case "full_time":
      return "Tiempo completo";
    case "part_time":
      return "Tiempo parcial";
    case "freelance":
      return "Freelance";
    default:
      return "No especificado";
  }
};

export const WorkerQueriesPage: React.FC = () => {
  const { externalJwt } = useAuthStore();
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(["all"]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{
    type: "email" | "phone";
    message: string;
    target?: string;
  } | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const selectedWorkerId = selectedWorkerIds[0] || "";
  const selectedWorker = useMemo(
    () => allWorkers.find((worker) => worker.id === selectedWorkerId) ?? null,
    [allWorkers, selectedWorkerId]
  );
  const selectedWorkerEmail = selectedWorker?.email ?? null;
  const selectedWorkerPhone = selectedWorker?.phone ?? null;
  const selectedWorkerTelHref = useMemo(() => {
    return selectedWorkerPhone ? sanitizeTelHref(selectedWorkerPhone) : null;
  }, [selectedWorkerPhone]);
  const selectedWorkerWhatsappHref = useMemo(() => {
    return selectedWorkerPhone ? buildWhatsAppLink(selectedWorkerPhone) : null;
  }, [selectedWorkerPhone]);

  const [groupOptions, setGroupOptions] = useState<WorkerGroupOption[]>([
    {
      id: "all",
      label: "Trabajadores",
      description: "Incluye todas las categorías",
      memberCount: 0,
    },
  ]);
  const [groupMembersById, setGroupMembersById] = useState<Record<string, string[]>>({
    all: [],
  });

  const selectedGroupSummary = useMemo(() => {
    if (!selectedGroupIds.length || selectedGroupIds.includes("all")) {
      const allOption = groupOptions.find((group) => group.id === "all");
      const memberCount = groupMembersById.all?.length ?? allWorkers.length;
      return {
        label: allOption?.label ?? "Trabajadores",
        memberCount,
      };
    }

    const selectedGroups = groupOptions.filter((group) =>
      selectedGroupIds.includes(group.id)
    );

    const memberSet = new Set<string>();
    selectedGroupIds.forEach((groupId) => {
      (groupMembersById[groupId] ?? []).forEach((workerId) =>
        memberSet.add(workerId)
      );
    });

    return {
      label:
        selectedGroups.length === 1
          ? selectedGroups[0]?.label ?? "Grupo"
          : `${selectedGroups.length} grupos seleccionados`,
      memberCount: memberSet.size,
    };
  }, [allWorkers.length, groupMembersById, groupOptions, selectedGroupIds]);

  const allowedWorkerIdSet = useMemo(() => {
    if (!selectedGroupIds.length || selectedGroupIds.includes("all")) {
      return new Set(allWorkers.map((worker) => worker.id));
    }

    const allowed = new Set<string>();
    selectedGroupIds.forEach((groupId) => {
      (groupMembersById[groupId] ?? []).forEach((workerId) =>
        allowed.add(workerId)
      );
    });
    return allowed;
  }, [allWorkers, groupMembersById, selectedGroupIds]);

  const filteredWorkers = useMemo(() => {
    if (!selectedGroupIds.length || selectedGroupIds.includes("all")) {
      return allWorkers;
    }

    if (!allowedWorkerIdSet.size) {
      return [];
    }

    return allWorkers.filter((worker) => allowedWorkerIdSet.has(worker.id));
  }, [allWorkers, allowedWorkerIdSet, selectedGroupIds]);

  useEffect(
    () => () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    },
    []
  );

  const showCopyFeedback = useCallback(
    (type: "email" | "phone", message: string, target?: string) => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }

      setCopyFeedback({ type, message, target });
      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setCopyFeedback(null);
        copyFeedbackTimeoutRef.current = null;
      }, 2000);
    },
    []
  );

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
    if (!selectedWorkerIds.length) {
      return;
    }

    setSelectedWorkerIds((prev) => prev.filter((id) => allowedWorkerIdSet.has(id)));
    setExpandedCompany(null);
  }, [allowedWorkerIdSet, selectedWorkerIds.length]);

  const handleEmailCopy = useCallback(
    async (emailToCopy?: string | null) => {
      const targetEmail = emailToCopy ?? selectedWorkerEmail;
      if (!targetEmail) {
        return;
      }

      const copied = await copyTextToClipboard(targetEmail);
      if (copied) {
        showCopyFeedback("email", "Email copiado", targetEmail);
      }
    },
    [selectedWorkerEmail, showCopyFeedback]
  );

  const handlePhoneCopy = useCallback(async () => {
    if (!selectedWorkerPhone) {
      return;
    }

    const copied = await copyTextToClipboard(selectedWorkerPhone);
    if (copied) {
      showCopyFeedback("phone", "Teléfono copiado", selectedWorkerPhone);
    }
  }, [selectedWorkerPhone, showCopyFeedback]);

  const openEmailClient = useCallback(() => {
    if (!selectedWorkerEmail || typeof window === "undefined") {
      return;
    }
    window.location.href = `mailto:${selectedWorkerEmail}`;
  }, [selectedWorkerEmail]);

  const openPhoneDialer = useCallback(() => {
    if (!selectedWorkerTelHref || typeof window === "undefined") {
      return;
    }
    window.location.href = selectedWorkerTelHref;
  }, [selectedWorkerTelHref]);

  const openWhatsAppConversation = useCallback(() => {
    if (!selectedWorkerWhatsappHref || typeof window === "undefined") {
      return;
    }
    window.open(selectedWorkerWhatsappHref, "_blank", "noopener");
  }, [selectedWorkerWhatsappHref]);

  const handleWorkerSelectionChange = useCallback((workerIds: string[]) => {
    setSelectedWorkerIds(workerIds);
    setExpandedCompany(null);
  }, []);

  const fetchWorkers = useCallback(async () => {
    if (!apiUrl || !externalJwt) {
      setWorkersError("Falta configuración de API o token");
      setAllWorkers([]);
      setLastFetchTime(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setWorkersError(null);
    try {
      const { workers } = await fetchWorkersData({
        apiUrl,
        token: externalJwt,
      });
      let workersWithGroups = workers;

      try {
        const grouping = await fetchWorkerGroupsData(apiUrl, externalJwt);

        const workerIdSet = new Set(workers.map((worker) => worker.id));
        const groupLabelById: Record<string, string> = {};
        const sanitizedMembers: Record<string, string[]> = {};

        grouping.groups.forEach((group) => {
          groupLabelById[group.id] = group.label;
          const members = (grouping.membersByGroup[group.id] ?? []).filter(
            (workerId) => workerIdSet.has(workerId)
          );
          sanitizedMembers[group.id] = Array.from(new Set(members));
        });

        sanitizedMembers.all = workers.map((worker) => worker.id);

        const options: WorkerGroupOption[] = [
          {
            id: "all",
            label: "Trabajadores",
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

        workersWithGroups = workers.map((worker) => {
          const rawGroupIds = grouping.groupsByWorker[worker.id] ?? [];
          if (!rawGroupIds.length) {
            return worker;
          }

          const groupNames = rawGroupIds
            .map((groupId) => groupLabelById[groupId])
            .filter((name): name is string => Boolean(name));

          if (!groupNames.length) {
            return worker;
          }

          const uniqueNames = Array.from(new Set(groupNames));
          return {
            ...worker,
            department: uniqueNames.join(", "),
          };
        });
      } catch (groupError) {
        console.error(
          "No se pudieron obtener los grupos desde la API",
          groupError
        );

        const fallbackGroupsMap = new Map<
          string,
          { id: string; label: string; memberIds: string[] }
        >();

        workers.forEach((worker) => {
          const rawGroupName = (worker.department ?? "Sin categoría").trim();
          const groupId = createGroupId(rawGroupName);

          if (!fallbackGroupsMap.has(groupId)) {
            fallbackGroupsMap.set(groupId, {
              id: groupId,
              label: rawGroupName || "Sin categoría",
              memberIds: [],
            });
          }

          fallbackGroupsMap.get(groupId)?.memberIds.push(worker.id);
        });

        const fallbackGroups = Array.from(fallbackGroupsMap.values()).sort(
          (a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" })
        );

        const fallbackMembers: Record<string, string[]> = {};
        fallbackGroups.forEach((group) => {
          fallbackMembers[group.id] = [...group.memberIds];
        });
        fallbackMembers.all = workers.map((worker) => worker.id);

        const fallbackOptions: WorkerGroupOption[] = [
          {
            id: "all",
            label: "Trabajadores",
            description: fallbackGroups.length
              ? "Incluye todas las categorías"
              : "No hay categorías disponibles",
            memberCount: workers.length,
          },
          ...fallbackGroups.map((group) => ({
            id: group.id,
            label: group.label,
            description:
              group.memberIds.length === 1
                ? "1 trabajador asignado"
                : `${group.memberIds.length} trabajadores asignados`,
            memberCount: group.memberIds.length,
          })),
        ];

        setGroupOptions(fallbackOptions);
        setGroupMembersById(fallbackMembers);
        workersWithGroups = workers;
      }

      setAllWorkers(workersWithGroups);
      setLastFetchTime(new Date());
    } catch (error) {
      console.error("Error fetching workers:", error);
      setWorkersError("No se pudieron cargar los trabajadores");
      setAllWorkers([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, externalJwt]);

  const refreshWorkers = useCallback(async () => {
    setIsRefreshing(true);
    await fetchWorkers();
    setIsRefreshing(false);
  }, [fetchWorkers]);

  useEffect(() => {
    void fetchWorkers();
  }, [fetchWorkers]);

  const getRoleDisplayName = useCallback((role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "supervisor":
        return "Supervisor";
      case "tecnico":
        return "Técnico";
      default:
        return "Usuario";
    }
  }, []);

  const companyContractsList = useMemo(() => {
    if (!selectedWorker?.companyContracts) {
      return [] as Array<WorkerCompanyContract & { companyName: string }>;
    }

    return Object.entries(selectedWorker.companyContracts).flatMap(
      ([companyName, entries]) =>
        entries.map((entry) => ({ ...entry, companyName }))
    );
  }, [selectedWorker?.companyContracts]);

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Consultas de Trabajadores"
        description="Consulta información detallada de trabajadores, contratos y sueldos"
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
                Selección de Grupo
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
                    {selectedGroupSummary.label}: {selectedGroupSummary.memberCount}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refreshWorkers}
                  disabled={isRefreshing}
                  leftIcon={
                    <RefreshCw
                      size={16}
                      className={isRefreshing ? "animate-spin" : ""}
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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Cargando trabajadores...
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

              {filteredWorkers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                  No hay trabajadores asignados a este grupo. Selecciona otro
                  grupo o sincroniza para obtener más registros.
                </div>
              ) : (
                <WorkerSearchSelect
                  workers={filteredWorkers}
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
              {workersError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {workersError}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FileText
              size={20}
              className="mr-2 text-green-600 dark:text-green-400"
            />
            Detalles del Trabajador
          </h2>
        </CardHeader>
        <CardContent>
          {!selectedWorker ? (
            <div className="text-center py-8">
              <User size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Selecciona un trabajador para ver sus detalles
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <User size={16} className="mr-2" />
                  Información Personal
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Avatar
                      name={selectedWorker.name}
                      src={selectedWorker.avatarUrl}
                      size="lg"
                    />
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedWorker.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {getRoleDisplayName(selectedWorker.role)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Mail size={16} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          Email:
                        </span>
                        {selectedWorker.email ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleEmailCopy(selectedWorker.email);
                            }}
                            className="font-medium text-blue-600 underline transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-100"
                          >
                            {selectedWorker.email}
                          </button>
                        ) : (
                          <span className="font-medium text-gray-900 dark:text-white">
                            No disponible
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={openEmailClient}
                          disabled={!selectedWorker.email}
                          leftIcon={<Mail size={14} />}
                          className="rounded-full border-gray-200 bg-white/80 text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200"
                        >
                          Enviar email
                        </Button>
                      </div>
                      {copyFeedback?.type === "email" && (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300">
                          {copyFeedback.message}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Phone size={16} className="text-gray-400" />
                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                          Teléfono:
                        </span>
                        {selectedWorker.phone ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handlePhoneCopy();
                            }}
                            className="font-medium text-blue-700 underline transition hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                          >
                            {selectedWorker.phone}
                          </button>
                        ) : (
                          <span className="font-medium text-gray-900 dark:text-white">
                            No disponible
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={openPhoneDialer}
                          disabled={!selectedWorkerTelHref}
                          leftIcon={<Phone size={14} />}
                          className="rounded-full border-gray-200 bg-white/80 text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200"
                        >
                          Llamar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={openWhatsAppConversation}
                          disabled={!selectedWorkerWhatsappHref}
                          leftIcon={<MessageCircle size={14} />}
                          className="rounded-full border-gray-200 bg-white/80 text-gray-700 hover:bg-green-50 hover:text-green-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200"
                        >
                          WhatsApp
                        </Button>
                      </div>
                      {copyFeedback?.type === "phone" && (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300">
                          {copyFeedback.message}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">
                        Fecha de alta:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatDate(selectedWorker.createdAt)}
                      </span>
                    </div>

                    {selectedWorker.department && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Building2 size={16} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          Departamento:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedWorker.department}
                        </span>
                      </div>
                    )}

                    {selectedWorker.position && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Users size={16} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          Puesto:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedWorker.position}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Users size={16} className="mr-2" />
                  Información Laboral
                </h3>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      Tipo de contrato:
                    </span>
                    <span className="ml-2">
                      {getContractTypeLabel(selectedWorker.contractType)}
                    </span>
                  </div>

                  {selectedWorker.startDate && (
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        Fecha de ingreso:
                      </span>
                      <span className="ml-2">
                        {formatDate(selectedWorker.startDate)}
                      </span>
                    </div>
                  )}

                  {selectedWorker.companyNames &&
                    selectedWorker.companyNames.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Empresas asignadas:
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedWorker.companyNames.map((company) => (
                            <span
                              key={company}
                              className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium"
                            >
                              {company}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <DollarSign size={16} className="mr-2" />
                  Información Salarial
                </h3>
                <div className="space-y-3">
                  {selectedWorker.baseSalary ? (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Sueldo Base
                      </p>
                      <p className="text-xl font-bold text-green-900 dark:text-green-100">
                        {formatCurrencyValue(selectedWorker.baseSalary)}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Sueldo base no configurado
                      </p>
                    </div>
                  )}

                  {selectedWorker.hourlyRate && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Tarifa por Hora
                      </p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                        {formatCurrencyValue(selectedWorker.hourlyRate)}/h
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Building2 size={16} className="mr-2" />
                  Contratos Asignados
                </h3>

                {companyContractsList.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Building2
                      size={24}
                      className="mx-auto text-gray-400 mb-2"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No hay contratos registrados para este trabajador
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {companyContractsList.map((contract, index) => (
                      <div
                        key={`${contract.id ?? contract.companyName}-${index}`}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600/60"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {contract.label ??
                                contract.position ??
                                contract.companyName}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Empresa: {contract.companyName}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                              contract.hasContract
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                            }`}
                          >
                            {contract.hasContract ? "Contrato" : "Asignación"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {contract.typeLabel && (
                            <p>Tipo: {contract.typeLabel}</p>
                          )}
                          {contract.position && (
                            <p>Puesto: {contract.position}</p>
                          )}
                          {contract.hourlyRate !== undefined && (
                            <p>
                              Tarifa: {formatCurrencyValue(contract.hourlyRate)}
                            </p>
                          )}
                          {contract.startDate && (
                            <p>Inicio: {formatDate(contract.startDate)}</p>
                          )}
                          {contract.endDate && (
                            <p>Fin: {formatDate(contract.endDate)}</p>
                          )}
                          {contract.status && <p>Estado: {contract.status}</p>}
                          {contract.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {contract.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
