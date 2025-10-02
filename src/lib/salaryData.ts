import {
  DayHoursSummary,
  DayScheduleEntry,
  DayNoteEntry,
} from "../components/WorkerHoursCalendar";
import {
  Worker,
  WorkerCompanyContract,
  WorkerCompanyStats,
} from "../types/salary";

interface ApiRequestOptions {
  apiUrl: string;
  token: string;
}

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const pickString = (
  ...values: Array<string | number | null | undefined>
): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      return value.toString();
    }
  }
  return null;
};

const parseNumeric = (value: unknown): number | undefined => {
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

const parseRelationType = (
  ...values: Array<string | number | null | undefined>
): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const normalizeIdentifier = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
};

const generateLocalId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
};

export interface WorkerDataResult {
  workers: Worker[];
  companyLookup: Record<string, string>;
}

export const fetchWorkersData = async ({
  apiUrl,
  token,
}: ApiRequestOptions): Promise<WorkerDataResult> => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const companyLookup: Record<string, string> = {};

  try {
    const companiesResponse = await fetch(
      `${apiUrl}/parameter/list?types=1`,
      {
        method: "GET",
        headers,
      }
    );

    if (companiesResponse.ok) {
      const companiesData = await companiesResponse.json();
      companiesData.forEach((company: any) => {
        const companyId = pickString(company?.id, company?.parameterId);
        const companyName =
          pickString(company?.name, company?.description, company?.label) ??
          undefined;
        if (companyId && companyName) {
          companyLookup[companyId] = companyName;
        }
      });
    } else {
      console.warn(
        `No se pudieron obtener las empresas: ${companiesResponse.status}`
      );
    }
  } catch (error) {
    console.error("Error fetching companies for worker data", error);
  }

  let workerSecondaryEmailLookup: Record<string, string> = {};

  const enableUsersLookup =
    (import.meta as any).env?.VITE_ENABLE_USERS_LOOKUP === "true";

  if (enableUsersLookup) {
    try {
      let usersResponse = await fetch(`${apiUrl}/User/GetAll`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!usersResponse.ok) {
        usersResponse = await fetch(`${apiUrl}/User/GetAll`, {
          method: "GET",
          headers,
        });
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        const usersArray = Array.isArray(usersData)
          ? usersData
          : Array.isArray(usersData?.data)
          ? usersData.data
          : Array.isArray(usersData?.items)
          ? usersData.items
          : [];

        usersArray.forEach((user: any) => {
          const workerRelationId = pickString(
            user?.workerIdRelation,
            user?.workerRelationId,
            user?.workerId,
            user?.worker_id
          );

          const emailCandidate = pickString(
            user?.email,
            user?.userEmail,
            user?.contactEmail,
            user?.secondaryEmail
          );

          if (workerRelationId && emailCandidate) {
            workerSecondaryEmailLookup[workerRelationId] = emailCandidate;
          }
        });
      } else {
        console.warn(
          `No se pudieron obtener usuarios (status ${usersResponse.status})`
        );
      }
    } catch (error) {
      console.error("Error fetching user email relationships", error);
    }
  }

  let contractLookup: Record<
    string,
    {
      companyId?: string;
      companyName?: string;
      relationType?: number;
      label?: string;
      description?: string;
      status?: string;
      typeLabel?: string;
      hourlyRate?: number;
      startDate?: string;
      endDate?: string;
    }
  > = {};

  try {
    const contractsResponse = await fetch(
      `${apiUrl}/parameter/list?types=7`,
      {
        method: "GET",
        headers,
      }
    );

    if (contractsResponse.ok) {
      const contractsData = await contractsResponse.json();
      if (Array.isArray(contractsData)) {
        contractLookup = contractsData.reduce(
          (acc, contract) => {
            const identifier = pickString(
              contract?.id,
              contract?.contractId,
              contract?.contract_id
            );

            if (!identifier) {
              return acc;
            }

            const companyId = pickString(
              contract?.companyId,
              contract?.company_id,
              contract?.companyIdContract
            );

            acc[identifier] = {
              companyId: companyId ?? undefined,
              companyName:
                companyId && companyLookup[companyId]
                  ? companyLookup[companyId]
                  : pickString(
                      contract?.companyName,
                      contract?.company,
                      contract?.companyLabel
                    ) ?? undefined,
              relationType: parseRelationType(
                contract?.relationType,
                contract?.type,
                contract?.contractType
              ),
              label:
                pickString(
                  contract?.name,
                  contract?.contractName,
                  contract?.title,
                  contract?.alias
                ) ?? undefined,
              description:
                pickString(
                  contract?.description,
                  contract?.contractDescription,
                  contract?.notes
                ) ?? undefined,
              status:
                pickString(
                  contract?.status,
                  contract?.state,
                  contract?.contractStatus
                ) ?? undefined,
              typeLabel:
                pickString(
                  contract?.contractTypeName,
                  contract?.typeName,
                  contract?.typeDescription,
                  contract?.contractTypeLabel
                ) ?? undefined,
              hourlyRate:
                parseNumeric(
                  contract?.amount ??
                    contract?.hourlyRate ??
                    contract?.rate ??
                    contract?.price ??
                    contract?.weeklyHours ??
                    contract?.hoursPerWeek ??
                    contract?.hours_week
                ) ?? undefined,
              startDate:
                pickString(
                  contract?.startDate,
                  contract?.contractStartDate,
                  contract?.dateStart,
                  contract?.beginDate
                ) ?? undefined,
              endDate:
                pickString(
                  contract?.endDate,
                  contract?.contractEndDate,
                  contract?.dateEnd,
                  contract?.finishDate
                ) ?? undefined,
            };

            return acc;
          },
          {} as typeof contractLookup
        );
      }
    }
  } catch (error) {
    console.error("Error fetching contract lookup", error);
  }

  const workersResponse = await fetch(
    `${apiUrl}/parameter/list?types[0]=5&types[1]=4&situation=0`,
    {
      method: "GET",
      headers,
    }
  );

  if (!workersResponse.ok) {
    throw new Error(
      `Error fetching workers: ${workersResponse.status} - ${workersResponse.statusText}`
    );
  }

  const workersRaw = await workersResponse.json();
  const workersArray = Array.isArray(workersRaw)
    ? workersRaw
    : Array.isArray(workersRaw?.data)
    ? workersRaw.data
    : Array.isArray(workersRaw?.items)
    ? workersRaw.items
    : [];

  const transformedWorkers: Worker[] = workersArray.map((apiWorker: any) => {
    const workerId =
      normalizeIdentifier(apiWorker?.id) ??
      normalizeIdentifier(apiWorker?.parameterId) ??
      normalizeIdentifier(apiWorker?.workerId) ??
      normalizeIdentifier(apiWorker?.worker_id) ??
      Math.random().toString(36).slice(2);

    const workerRelationKey =
      pickString(
        apiWorker?.workerIdRelation,
        apiWorker?.workerRelationId,
        apiWorker?.workerRelation,
        apiWorker?.workerParameterId,
        apiWorker?.relationId,
        apiWorker?.id
      ) ?? workerId;

    const lookedUpSecondary = workerSecondaryEmailLookup[workerRelationKey];
    const primaryEmail =
      pickString(
        apiWorker?.email,
        apiWorker?.workerEmail,
        apiWorker?.contactEmail,
        apiWorker?.parameterEmail,
        apiWorker?.principalEmail,
        apiWorker?.providerEmail,
        apiWorker?.userEmail,
        apiWorker?.mail,
        apiWorker?.emailAddress,
        apiWorker?.user?.email
      ) ?? undefined;

    const normalizedPrimary =
      typeof primaryEmail === "string"
        ? primaryEmail.trim().toLowerCase()
        : "";
    const displayEmail =
      normalizedPrimary && primaryEmail
        ? primaryEmail.trim()
        : lookedUpSecondary && lookedUpSecondary.trim().length > 0
        ? lookedUpSecondary.trim()
        : undefined;

    const secondaryEmailFinal =
      lookedUpSecondary &&
      displayEmail &&
      lookedUpSecondary.trim().toLowerCase() !== displayEmail.toLowerCase()
        ? lookedUpSecondary
        : undefined;

    const baseWorker: Worker = {
      id: workerId,
      name:
        pickString(
          apiWorker?.name,
          apiWorker?.fullName,
          apiWorker?.label,
          apiWorker?.description,
          apiWorker?.workerName,
          apiWorker?.firstName
        ) ?? "Trabajador sin nombre",
      email: displayEmail ?? "Email no disponible",
      secondaryEmail: secondaryEmailFinal,
      role:
        (pickString(apiWorker?.role, apiWorker?.workerRole) as Worker["role"]) ??
        "tecnico",
      phone:
        pickString(
          apiWorker?.phone,
          apiWorker?.workerPhone,
          apiWorker?.contactPhone,
          apiWorker?.mobile,
          apiWorker?.telephone,
          apiWorker?.phoneNumber,
          apiWorker?.tel
        ) ?? null,
      createdAt:
        pickString(
          apiWorker?.createdAt,
          apiWorker?.creationDate,
          apiWorker?.dateCreated
        ) ?? new Date().toISOString(),
      updatedAt:
        pickString(
          apiWorker?.updatedAt,
          apiWorker?.dateUpdated,
          apiWorker?.modifiedAt
        ),
      avatarUrl:
        pickString(
          apiWorker?.avatarUrl,
          apiWorker?.picture,
          apiWorker?.profileImage
        ) ?? null,
      baseSalary: parseNumeric(apiWorker?.baseSalary ?? apiWorker?.salary),
      hourlyRate: parseNumeric(apiWorker?.hourlyRate ?? apiWorker?.rate),
      contractType:
        (pickString(
          apiWorker?.contractType,
          apiWorker?.type,
          apiWorker?.employmentType
        ) as Worker["contractType"]) ?? undefined,
      department:
        pickString(
          apiWorker?.department,
          apiWorker?.area,
          apiWorker?.departmentName
        ) ?? undefined,
      position:
        pickString(
          apiWorker?.position,
          apiWorker?.jobTitle,
          apiWorker?.roleName
        ) ?? undefined,
      startDate:
        pickString(
          apiWorker?.startDate,
          apiWorker?.dateStart,
          apiWorker?.beginDate
        ) ?? undefined,
      companies: pickString(apiWorker?.companies, apiWorker?.companyList),
      companyNames: undefined,
      companyContracts: {},
      companyStats: {},
    };

    const companyNamesSet = new Set<string>();
    const companyContractsMap: Record<string, WorkerCompanyContract[]> = {};
    const companyStatsMap: Record<string, WorkerCompanyStats> = {};

    if (Array.isArray(apiWorker?.parameterRelations)) {
      apiWorker.parameterRelations.forEach((relation: any) => {
        const relationIdentifier = pickString(
          relation?.parameterRelationId,
          relation?.relationId,
          relation?.id
        );

        const contractMeta = relationIdentifier
          ? contractLookup[relationIdentifier]
          : undefined;

        const relationType = parseRelationType(
          relation?.type,
          relation?.relationType,
          relation?.contractType,
          relation?.typeId,
          relation?.type_id,
          contractMeta?.relationType
        );

        const hasContract = relationType === 1;

        const companyId =
          pickString(
            contractMeta?.companyId,
            relation?.companyId,
            relation?.company_id,
            relation?.companyIdContract
          ) ?? undefined;

        const relationCompanyPointer = normalizeIdentifier(
          relation?.parameterRelationId
        );

        const relationCompanyId =
          (relationCompanyPointer &&
            contractLookup[relationCompanyPointer]?.companyId) ||
          companyId;

        const companyName =
          relationCompanyId && companyLookup[relationCompanyId]
            ? companyLookup[relationCompanyId]
            : contractMeta?.companyName ??
              pickString(
                relation?.companyName,
                relation?.company,
                relation?.companyLabel
              ) ??
              (relationCompanyId ?? undefined);

        if (companyName) {
          companyNamesSet.add(companyName);
        }

        if (companyName) {
          const contractEntry: WorkerCompanyContract = {
            id:
              relationIdentifier ??
              `${workerId}-${relationCompanyId}-${relation?.type}`,
            hasContract,
            relationType,
            typeLabel:
              contractMeta?.typeLabel ??
              pickString(
                relation?.typeLabel,
                relation?.relationLabel,
                relation?.contractTypeLabel
              ) ?? undefined,
            hourlyRate:
              parseNumeric(
                relation?.hourlyRate ??
                  relation?.amount ??
                  relation?.rate ??
                  contractMeta?.hourlyRate
              ) ?? undefined,
            companyId: relationCompanyId,
            companyName,
            label:
              pickString(
                relation?.label,
                relation?.name,
                relation?.relationName,
                relation?.contractName,
                contractMeta?.label
              ) ?? undefined,
            position:
              pickString(
                relation?.position,
                relation?.jobTitle,
                relation?.role,
                relation?.relationPosition
              ) ?? undefined,
            description:
              pickString(
                relation?.description,
                relation?.notes,
                relation?.contractDescription,
                relation?.detail
              ) ?? undefined,
            startDate:
              pickString(
                relation?.startDate,
                relation?.contractStartDate,
                relation?.dateStart,
                contractMeta?.startDate
              ) ?? undefined,
            endDate:
              pickString(
                relation?.endDate,
                relation?.contractEndDate,
                relation?.dateEnd,
                contractMeta?.endDate
              ) ?? undefined,
            status:
              pickString(
                relation?.status,
                relation?.state,
                relation?.contractStatus,
                contractMeta?.status
              ) ?? undefined,
            details: relation?.details ?? undefined,
          };

          const contractKey = companyName;
          if (!companyContractsMap[contractKey]) {
            companyContractsMap[contractKey] = [];
          }
          companyContractsMap[contractKey].push(contractEntry);

          if (!companyStatsMap[contractKey]) {
            companyStatsMap[contractKey] = {
              companyId: relationCompanyId ?? undefined,
              contractCount: 0,
              assignmentCount: 0,
            };
          }

          if (hasContract) {
            companyStatsMap[contractKey].contractCount += 1;
          }
        }

        if (companyName) {
          const statsKey = companyName;
          if (!companyStatsMap[statsKey]) {
            companyStatsMap[statsKey] = {
              companyId: relationCompanyId ?? undefined,
              contractCount: 0,
              assignmentCount: 0,
            };
          }
          companyStatsMap[statsKey].assignmentCount += 1;
          if (relationCompanyId && !companyStatsMap[statsKey].companyId) {
            companyStatsMap[statsKey].companyId = relationCompanyId;
          }
        }
      });
    }

    return {
      ...baseWorker,
      companyNames:
        companyNamesSet.size > 0
          ? Array.from(companyNamesSet).sort((a, b) =>
              a.localeCompare(b, "es", { sensitivity: "base" })
            )
          : undefined,
      companyContracts: companyContractsMap,
      companyStats: companyStatsMap,
    };
  });

  return {
    workers: transformedWorkers,
    companyLookup,
  };
};

export interface WorkerHoursSummaryResult {
  hoursByDate: Record<string, DayHoursSummary>;
  totalHours: number;
  totalTrackedDays: number;
  companyTotals: Array<{
    companyId?: string;
    name?: string;
    hours: number;
  }>;
}

export const fetchWorkerHoursSummary = async (
  options: ApiRequestOptions & {
    workerId: string;
    month: Date;
    companyLookup?: Record<string, string>;
  }
): Promise<WorkerHoursSummaryResult> => {
  const { apiUrl, token, workerId, month, companyLookup = {} } = options;

  const fromDate = new Date(
    Date.UTC(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0)
  );
  const toDate = new Date(
    Date.UTC(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999)
  );

  const baseRequestPayload = {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    parametersId: [workerId],
    companiesId: [],
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const fetchScheduleEntries = async (types: number[]) => {
    const response = await fetch(`${apiUrl}/ControlSchedule/List`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...baseRequestPayload,
        types,
      }),
    });

    if (response.status === 204 || response.status === 404) {
      return [] as any[];
    }

    if (!response.ok) {
      throw new Error(
        `Error fetching schedule control (types: ${types.join(",")}): ${
          response.status
        } - ${response.statusText}`
      );
    }

    const rawData = await response.json();
    const entries = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.entries)
      ? rawData.entries
      : [];

    return entries as any[];
  };

  const collectNoteStrings = (collector: Set<string>, value: unknown) => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        collector.add(trimmed);
      }
      return;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      collector.add(String(value));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => collectNoteStrings(collector, item));
      return;
    }

    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      Object.keys(obj).forEach((key) => {
        collectNoteStrings(collector, obj[key]);
      });
    }
  };

  const extractNoteText = (entry: any): string | null => {
    const inspect = (value: unknown): string | null => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const result = inspect(item);
          if (result) {
            return result;
          }
        }
        return null;
      }

      if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const preferredKeys = [
          "text",
          "note",
          "description",
          "value",
          "comment",
        ];

        for (const key of preferredKeys) {
          if (key in obj) {
            const result = inspect(obj[key]);
            if (result) {
              return result;
            }
          }
        }

        for (const key of Object.keys(obj)) {
          const result = inspect(obj[key]);
          if (result) {
            return result;
          }
        }
      }

      return null;
    };

    const candidates = [
      entry?.note,
      entry?.notes,
      entry?.comment,
      entry?.comments,
      entry?.observation,
      entry?.observations,
      entry?.description,
      entry?.value,
    ];

    for (const candidate of candidates) {
      const text = inspect(candidate);
      if (text) {
        return text;
      }
    }

    return null;
  };

  const ensureAggregate = (
    aggregates: Record<string, MutableDailyAggregate>,
    key: string
  ) => {
    if (!aggregates[key]) {
      aggregates[key] = {
        totalHours: 0,
        notesText: new Set<string>(),
        companies: {},
        entries: [],
        noteEntries: new Map<string, DayNoteEntry>(),
      };
    }
    return aggregates[key];
  };

  type MutableDailyAggregate = {
    totalHours: number;
    notesText: Set<string>;
    companies: Record<
      string,
      {
        companyId?: string;
        name?: string;
        hours: number;
      }
    >;
    entries: DayScheduleEntry[];
    noteEntries: Map<string, DayNoteEntry>;
  };

  const dailyAggregates: Record<string, MutableDailyAggregate> = {};

  const hourEntries = await fetchScheduleEntries([1]);
  let noteEntries: any[] = [];
  try {
    noteEntries = await fetchScheduleEntries([7]);
  } catch (error) {
    console.error("Error fetching worker notes:", error);
  }

  const normalizeEntryDate = (entry: any) => {
    let date: Date | null = null;

    if (entry?.dateTime) {
      const parsed = new Date(entry.dateTime);
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }

    if (!date) {
      const dateString = pickString(
        entry?.start,
        entry?.date,
        entry?.day,
        entry?.createdAt
      );
      if (dateString) {
        const parsed = new Date(dateString);
        if (!Number.isNaN(parsed.getTime())) {
          date = parsed;
        }
      }
    }

    if (!date) {
      return null;
    }

    date.setHours(date.getHours() + 2);
    return date;
  };

  const processEntryHours = (entry: any) => {
    let hours = 0;

    const valueRaw = entry?.value ?? entry?.hours ?? entry?.workedHours;
    if (typeof valueRaw === "number" && Number.isFinite(valueRaw)) {
      hours = valueRaw;
    } else if (typeof valueRaw === "string") {
      const normalized = valueRaw.replace(/[^0-9,.-]/g, "").replace(/,/g, ".");
      const parsed = Number(normalized);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        hours = parsed;
      }
    }

    if (hours === 0 && Array.isArray(entry?.workShifts)) {
      const shiftsTotal = entry.workShifts.reduce((acc: number, shift: any) => {
        if (!shift) {
          return acc;
        }

        if (shift?.hours || shift?.value || shift?.workedHours) {
          const parsedShift = parseNumeric(
            shift.hours ?? shift.value ?? shift.workedHours
          );
          if (typeof parsedShift === "number" && Number.isFinite(parsedShift)) {
            return acc + parsedShift;
          }
        }

        if (shift?.workStart && shift?.workEnd) {
          const start = new Date(`2000-01-01T${shift.workStart}`);
          const end = new Date(`2000-01-01T${shift.workEnd}`);
          if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            if (diff > 0) {
              return acc + diff;
            }
          }
        }

        return acc;
      }, 0);

      if (Number.isFinite(shiftsTotal) && shiftsTotal > 0) {
        hours = shiftsTotal;
      }
    }

    if (Number.isNaN(hours) || !Number.isFinite(hours) || hours < 0) {
      hours = 0;
    }

    return hours;
  };

  hourEntries.forEach((entry) => {
    const date = normalizeEntryDate(entry);
    if (!date) {
      return;
    }

    const dayKey = formatDateKey(date);
    const aggregate = ensureAggregate(dailyAggregates, dayKey);

    const hours = processEntryHours(entry);
    if (hours > 0) {
      aggregate.totalHours += hours;
    }

    const companyId = pickString(
      entry?.companyId,
      entry?.company_id,
      entry?.company?.id,
      entry?.companyID,
      entry?.companyIdContract
    );

    const companyNameCandidate = pickString(
      entry?.companyName,
      entry?.company_name,
      entry?.company?.name,
      entry?.company
    );

    const companyKey = companyId ?? companyNameCandidate ?? 'sin-empresa';
    const resolvedCompanyName =
      companyNameCandidate ??
      (companyId ? companyLookup[companyId] : undefined) ??
      (companyId ?? 'Sin empresa');

    if (!aggregate.companies[companyKey]) {
      aggregate.companies[companyKey] = {
        companyId: companyId ?? undefined,
        name: resolvedCompanyName,
        hours: 0,
      };
    }

    aggregate.companies[companyKey].hours += hours;

    const scheduleEntryId =
      normalizeIdentifier(entry?.id) ??
      normalizeIdentifier(entry?.controlScheduleId) ??
      normalizeIdentifier(entry?.scheduleId) ??
      normalizeIdentifier(entry?.registerId) ??
      normalizeIdentifier(entry?.recordId) ??
      generateLocalId(`hours-${dayKey}`);

    const descriptionText = extractNoteText(entry);
    if (descriptionText) {
      // keep description on the entry record, but avoid marking it as a calendar note
    }

    const workShifts = Array.isArray(entry?.workShifts)
      ? entry.workShifts
          .map((shift: any, index: number) => {
            const start =
              typeof shift?.workStart === 'string'
                ? shift.workStart.trim()
                : undefined;
            const end =
              typeof shift?.workEnd === 'string'
                ? shift.workEnd.trim()
                : undefined;
            const shiftHours = parseNumeric(
              shift?.hours ?? shift?.value ?? shift?.workedHours
            );

            if (!start && !end && (shiftHours === undefined || Number.isNaN(shiftHours))) {
              return null;
            }

            return {
              id:
                normalizeIdentifier(shift?.id) ??
                normalizeIdentifier(shift?.workShiftId) ??
                generateLocalId(`shift-${index + 1}-${scheduleEntryId}`),
              startTime: start ?? undefined,
              endTime: end ?? undefined,
              hours:
                typeof shiftHours === 'number' && Number.isFinite(shiftHours)
                  ? shiftHours
                  : undefined,
            };
          })
          .filter((shift): shift is NonNullable<typeof shift> => Boolean(shift))
      : undefined;

    const observationText = Array.isArray(entry?.observations)
      ? entry.observations
          .map((item: unknown) =>
            typeof item === 'string' ? item.trim() : ''
          )
          .filter(Boolean)
          .join(' \u2022 ')
      : typeof entry?.observations === 'string'
      ? entry.observations.trim()
      : undefined;

    const combinedDescription = [
      descriptionText,
      observationText,
    ]
      .filter((chunk) => typeof chunk === 'string' && chunk.length > 0)
      .join(' \u2022 ');

    if (hours > 0 || (combinedDescription && combinedDescription.length > 0)) {
      const entryRecord: DayScheduleEntry = {
        id: scheduleEntryId,
        companyId: companyId ?? undefined,
        companyName: resolvedCompanyName,
        hours,
        description: combinedDescription || undefined,
        workShifts,
        raw: entry,
      };

      aggregate.entries.push(entryRecord);
    }
  });

  noteEntries.forEach((entry) => {
    const date = normalizeEntryDate(entry);
    if (!date) {
      return;
    }

    const dayKey = formatDateKey(date);
    const aggregate = ensureAggregate(dailyAggregates, dayKey);

    const noteCollector = new Set<string>();
    collectNoteStrings(noteCollector, entry?.notes);
    collectNoteStrings(noteCollector, entry?.note);
    collectNoteStrings(noteCollector, entry?.comment);
    collectNoteStrings(noteCollector, entry?.comments);
    collectNoteStrings(noteCollector, entry?.observation);
    collectNoteStrings(noteCollector, entry?.observations);
    collectNoteStrings(noteCollector, entry?.description);
    collectNoteStrings(noteCollector, entry?.value);

    if (noteCollector.size === 0) {
      return;
    }

    const primaryNoteText =
      extractNoteText(entry) ?? Array.from(noteCollector)[0];

    if (!primaryNoteText) {
      return;
    }

    noteCollector.forEach((text) => aggregate.notesText.add(text));

    const providedId =
      normalizeIdentifier(entry?.id) ??
      normalizeIdentifier(entry?.noteId) ??
      normalizeIdentifier(entry?.identifier) ??
      normalizeIdentifier(entry?.recordId);

    const noteId = providedId ?? generateLocalId(`note-${dayKey}`);

    aggregate.noteEntries.set(noteId, {
      id: noteId,
      text: primaryNoteText,
      origin: 'note',
      raw: entry,
    });
  });

  const formattedTotals: Record<string, DayHoursSummary> = {};
  const companyTotalsMap: Record<string, { companyId?: string; name?: string; hours: number }> = {};

  Object.entries(dailyAggregates).forEach(([key, aggregate]) => {
    if (
      aggregate.totalHours === 0 &&
      aggregate.notesText.size === 0 &&
      aggregate.noteEntries.size === 0 &&
      Object.keys(aggregate.companies).length === 0
    ) {
      return;
    }

    const companies = Object.values(aggregate.companies).map((company) => {
      const resolvedName =
        company.companyId && companyLookup[company.companyId]
          ? companyLookup[company.companyId]
          : company.name ?? company.companyId;
      const normalized = {
        ...company,
        name: resolvedName ?? "Sin empresa",
      };

      const summaryKey = company.companyId ?? normalized.name ?? "unknown";
      if (!companyTotalsMap[summaryKey]) {
        companyTotalsMap[summaryKey] = {
          companyId: company.companyId,
          name: normalized.name,
          hours: 0,
        };
      }
      companyTotalsMap[summaryKey].hours += normalized.hours;

      return normalized;
    });

    companies.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "es", { sensitivity: "base" })
    );

    const sortedEntries = [...aggregate.entries].sort((a, b) =>
      (a.companyName ?? '').localeCompare(b.companyName ?? '', 'es', {
        sensitivity: 'base',
      })
    );

    const noteEntriesForDay = Array.from(aggregate.noteEntries.values());

    formattedTotals[key] = {
      totalHours: aggregate.totalHours,
      notes: Array.from(aggregate.notesText),
      noteEntries: noteEntriesForDay,
      entries: sortedEntries,
      companies,
    };
  });

  const totalTrackedDays = Object.values(formattedTotals).reduce((acc, detail) => {
    if (detail && detail.totalHours > 0) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const totalHours = Object.values(formattedTotals).reduce(
    (acc, value) => acc + (value?.totalHours ?? 0),
    0
  );

  const companyTotals = Object.values(companyTotalsMap).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "es", { sensitivity: "base" })
  );

  return {
    hoursByDate: formattedTotals,
    totalHours,
    totalTrackedDays,
    companyTotals,
  };
};
