import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Calculator, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { TextArea } from "../ui/TextArea";
import { Worker } from "../../types/salary";
import {
  WorkerHoursCalendar,
  type DayHoursSummary,
} from "../WorkerHoursCalendar";
import {
  fetchWorkerHoursSummary,
  type WorkerHoursSummaryResult,
} from "../../lib/salaryData";

interface WorkerCalculationModuleProps {
  worker: Worker;
  apiUrl: string;
  token: string;
  onResultChange: (workerId: string, result: CalculationResult | null) => void;
}

type CompanyKey = string;

type PaymentMethod = "bank" | "cash";

interface CalculationFormState {
  baseSalary: string;
  hoursWorked: string;
  overtimeHours: string;
  bonuses: string;
  deductions: string;
  period: "monthly" | "weekly" | "daily";
  notes: string;
  companyContractInputs: Record<string, CompanyContractInputState>;
}

interface CompanyContractInputState {
  hours: string;
  baseSalary: string;
  hourlyRate?: string;
}

interface CalculationResult {
  totalAmount: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  companyBreakdown: Array<{
    companyId?: string;
    companyKey?: CompanyKey;
    name?: string;
    hours: number;
    amount: number;
    otherPayments?: OtherPaymentDetailSummary[];
  }>;
  usesCalendarHours: boolean;
  otherPaymentsSummary: {
    byCompany: CompanyOtherPaymentsSummary[];
    unassigned: UnassignedOtherPaymentsSummary;
  };
}

type OtherPaymentCategory =
  | "supplements"
  | "bonuses"
  | "discounts"
  | "debts"
  | "deductions";

interface OtherPaymentItem {
  id: string;
  label: string;
  amount: string;
  companyKey: CompanyKey | null;
  paymentMethod: PaymentMethod;
}

type OtherPaymentsState = Record<OtherPaymentCategory, OtherPaymentItem[]>;

type OtherPaymentFlow = "income" | "expense";

interface OtherPaymentDetailSummary {
  id: string;
  label: string;
  amount: number;
  category: OtherPaymentCategory;
  type: OtherPaymentFlow;
  paymentMethod: PaymentMethod;
}

interface CompanyOtherPaymentsSummary {
  companyKey: CompanyKey;
  companyName: string;
  companyId?: string;
  incomes: number;
  expenses: number;
  total: number;
  details: OtherPaymentDetailSummary[];
}

interface UnassignedOtherPaymentsSummary {
  incomes: number;
  expenses: number;
  total: number;
  details: OtherPaymentDetailSummary[];
}

interface CompanyContractStructure {
  groups: Array<{
    companyKey: string;
    companyId?: string;
    companyName: string;
    entries: Array<{
      contractKey: string;
      label: string;
      description?: string;
      hasContract: boolean;
    }>;
  }>;
  contractMap: Map<
    string,
    {
      companyId?: string;
      companyName: string;
      contractLabel: string;
      hasContract: boolean;
      hourlyRate?: number;
    }
  >;
}

interface ManualContractAggregates {
  hasEntries: boolean;
  totalHours: number;
  totalBaseAmount: number;
  companyList: Array<{
    companyId?: string;
    companyName: string;
    hours: number;
    baseAmount: number;
  }>;
}

const OTHER_PAYMENTS_LABELS: Record<OtherPaymentCategory, string> = {
  supplements: "Suplementos",
  bonuses: "Bonificaciones",
  discounts: "Descuentos",
  debts: "Deudas",
  deductions: "Deducciones",
};

const CREDIT_CATEGORIES: OtherPaymentCategory[] = ["supplements", "bonuses"];

const OTHER_PAYMENTS_CATEGORY_ORDER: OtherPaymentCategory[] = [
  "supplements",
  "bonuses",
  "discounts",
  "debts",
  "deductions",
];

const createEmptyOtherPaymentsState = (): OtherPaymentsState => ({
  supplements: [],
  bonuses: [],
  discounts: [],
  debts: [],
  deductions: [],
});

const createOperationId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `op-${Math.random().toString(36).slice(2, 10)}`;
};

const parseAmountInput = (value: string): number => {
  if (typeof value !== "string") {
    return 0;
  }
  const normalized = value.replace(/\s+/g, "").replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const trimToNull = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const stringValue = typeof value === "string" ? value : String(value);
  const trimmed = stringValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isValidCompanyName = (name?: string | null) => {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return false;
  return n !== "empresa sin nombre" && n !== "sin empresa";
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

const parseWorkerCompanyContracts = (
  worker: Worker,
  companyLookup: Record<string, string>
): CompanyContractStructure => {
  const groups: CompanyContractStructure["groups"] = [];
  const contractMap: CompanyContractStructure["contractMap"] = new Map();

  const companyContracts = worker.companyContracts ?? {};
  const companyStats = worker.companyStats ?? {};
  const knownCompanyNames = new Set<string>();

  Object.keys(companyContracts).forEach((name) => {
    if (typeof name === "string" && name.trim().length > 0) {
      knownCompanyNames.add(name);
    }
  });

  Object.keys(companyStats).forEach((name) => {
    if (typeof name === "string" && name.trim().length > 0) {
      knownCompanyNames.add(name);
    }
  });

  Array.from(knownCompanyNames)
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .forEach((companyName, index) => {
      const trimmedName = companyName?.trim() ?? "";
      const contractsForCompany = (
        companyContracts[companyName] ?? []
      ).filter((c) => c.hasContract === true);
      const statsForCompany = companyStats[companyName];
      const preferredCompanyId = statsForCompany?.companyId;
      const resolvedCompanyName =
        (trimmedName.length > 0 ? trimmedName : undefined) ??
        (preferredCompanyId ? companyLookup[preferredCompanyId] : undefined);

      if (!isValidCompanyName(resolvedCompanyName)) {
        return;
      }

      const companyKeyBase =
        preferredCompanyId ??
        (trimmedName.length > 0 ? trimmedName : `company-${index}`);
      const companyKey = `${companyKeyBase}-${index}`;

      const entries: Array<{
        contractKey: string;
        label: string;
        description?: string;
        hasContract: boolean;
      }> = [];

      if (contractsForCompany.length > 0) {
        contractsForCompany.forEach((contract, contractIndex) => {
          const normalizedId =
            (typeof contract.id === "string" && contract.id.trim().length > 0
              ? contract.id.trim()
              : null) ?? `contract-${index}-${contractIndex}`;
          const contractKey = `${companyKeyBase}-${normalizedId}`;

          const labelCandidate =
            contract.label?.trim() ||
            contract.position?.trim() ||
            contract.description?.trim() ||
            (contract.hasContract
              ? `Contrato ${contractIndex + 1}`
              : `Asignación ${contractIndex + 1}`);

          const descriptionCandidate =
            contract.description?.trim() ||
            contract.position?.trim() ||
            undefined;

          contractMap.set(contractKey, {
            companyId: contract.companyId ?? preferredCompanyId,
            companyName: resolvedCompanyName,
            contractLabel: labelCandidate,
            hasContract: contract.hasContract,
            hourlyRate:
              typeof contract.hourlyRate === "number" &&
              Number.isFinite(contract.hourlyRate)
                ? contract.hourlyRate
                : undefined,
          });

          entries.push({
            contractKey,
            label: labelCandidate,
            description:
              descriptionCandidate && descriptionCandidate !== labelCandidate
                ? descriptionCandidate
                : undefined,
            hasContract: contract.hasContract,
          });
        });
      } else {
        return;
      }

      groups.push({
        companyKey,
        companyId: preferredCompanyId,
        companyName: resolvedCompanyName,
        entries,
      });
    });

  return {
    groups,
    contractMap,
  };
};

const getCompanyKey = (entry: {
  companyId?: string;
  name?: string;
  companyKey?: CompanyKey;
}): CompanyKey => {
  if (entry.companyKey) {
    return entry.companyKey;
  }

  if (entry.companyId) {
    return `id:${entry.companyId}`;
  }

  if (entry.name) {
    return `name:${entry.name}`;
  }

  return "sin";
};

const buildCompanyKeyInfoMap = (structure: CompanyContractStructure) => {
  const map = new Map<
    CompanyKey,
    {
      companyName: string;
      companyId?: string;
    }
  >();

  structure.groups.forEach((group) => {
    map.set(group.companyKey, {
      companyName: group.companyName,
      companyId: group.companyId,
    });
  });

  return map;
};

const WorkerCalculationModule: React.FC<WorkerCalculationModuleProps> = ({
  worker,
  apiUrl,
  token,
  onResultChange,
}) => {
  const [calculationData, setCalculationData] = useState<CalculationFormState>({
    baseSalary: worker.baseSalary ? String(worker.baseSalary) : "",
    hoursWorked: "",
    overtimeHours: "0",
    bonuses: "0",
    deductions: "0",
    period: "monthly",
    notes: "",
    companyContractInputs: {},
  });
  const [autoFillHoursMap, setAutoFillHoursMap] = useState<Record<string, boolean>>({});
  const [expandedCompanyInputs, setExpandedCompanyInputs] = useState<Record<string, boolean>>({});
  const [isContractInputsOpen, setIsContractInputsOpen] = useState(true);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(true);
  const [isOtherOpsCollapsed, setIsOtherOpsCollapsed] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarHours, setCalendarHours] = useState<Record<string, DayHoursSummary>>({});
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [otherPayments, setOtherPayments] = useState<OtherPaymentsState>(createEmptyOtherPaymentsState);
  const [results, setResults] = useState<CalculationResult | null>(null);

  const workerCompanyLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    (worker.companyRelations ?? []).forEach((relation) => {
      const id = trimToNull(relation.companyId);
      const name = trimToNull(relation.companyName);
      if (id && name) {
        lookup[id] = name;
      }
    });
    return lookup;
  }, [worker.companyRelations]);

  const companyContractStructure = useMemo(() => {
    return parseWorkerCompanyContracts(worker, workerCompanyLookup);
  }, [worker, workerCompanyLookup]);

  const companyKeyToInfo = useMemo(() => {
    return buildCompanyKeyInfoMap(companyContractStructure);
  }, [companyContractStructure]);

  const autoFilledContractKeysRef = useRef<Map<string, Set<string>>>(new Map());
  const manualHoursOverrideRef = useRef<Set<string>>(new Set());

  const manualContractAggregates: ManualContractAggregates = useMemo(() => {
    const contractMap = companyContractStructure.contractMap;
    const perCompany = new Map<string, {
      companyId?: string;
      companyName: string;
      hours: number;
      baseAmount: number;
    }>();

    let totalHours = 0;
    let totalBaseAmount = 0;
    let hasEntries = false;

    contractMap.forEach((meta, contractKey) => {
      const input = calculationData.companyContractInputs[contractKey];
      const parsedHours = parseFloat(input?.hours ?? "");
      const parsedBase = parseFloat(input?.baseSalary ?? "");
      const parsedRateFromInput = parseFloat(input?.hourlyRate ?? "");

      const hours = Number.isFinite(parsedHours) ? parsedHours : 0;
      const explicitBase = Number.isFinite(parsedBase) ? parsedBase : 0;
      const hourlyRate = Number.isFinite(parsedRateFromInput)
        ? parsedRateFromInput
        : typeof meta?.hourlyRate === "number" &&
          Number.isFinite(meta.hourlyRate)
        ? meta.hourlyRate
        : 0;

      const baseAmount =
        explicitBase > 0
          ? explicitBase
          : hours > 0 && hourlyRate > 0
          ? hours * hourlyRate
          : 0;

      if (hours !== 0 || baseAmount !== 0) {
        hasEntries = true;
      }

      if (hours !== 0) {
        totalHours += hours;
      }
      if (baseAmount !== 0) {
        totalBaseAmount += baseAmount;
      }

      const companyKey =
        (meta.companyId && `id:${meta.companyId}`) ||
        `name:${meta.companyName}`;

      if (!perCompany.has(companyKey)) {
        perCompany.set(companyKey, {
          companyId: meta.companyId,
          companyName: meta.companyName,
          hours: 0,
          baseAmount: 0,
        });
      }

      const aggregate = perCompany.get(companyKey);
      if (!aggregate) {
        return;
      }

      aggregate.hours += hours;
      aggregate.baseAmount += baseAmount;
    });

    const companyList = Array.from(perCompany.values()).sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "es", { sensitivity: "base" })
    );

    return {
      hasEntries,
      totalHours,
      totalBaseAmount,
      companyList,
    };
  }, [calculationData.companyContractInputs, companyContractStructure.contractMap]);

  const fetchCalendarHours = useCallback(
    async (referenceMonth: Date) => {
      setIsCalendarLoading(true);
      try {
        const summary: WorkerHoursSummaryResult = await fetchWorkerHoursSummary({
          apiUrl,
          token,
          workerId: worker.id,
          month: referenceMonth,
          companyLookup: workerCompanyLookup,
        });
        setCalendarHours(summary.hoursByDate);
      } catch (error) {
        console.error("No se pudieron cargar las horas del trabajador", error);
        setCalendarHours({});
      } finally {
        setIsCalendarLoading(false);
      }
    },
    [apiUrl, token, worker.id, workerCompanyLookup]
  );

  useEffect(() => {
    void fetchCalendarHours(calendarMonth);
  }, [calendarMonth, fetchCalendarHours]);

  const getCalendarHoursForCompany = useCallback(
    (companyId?: string, companyName?: string) => {
      const totals = new Map<
        string,
        {
          companyId?: string;
          companyName?: string;
          normalizedName: string;
          hours: number;
        }
      >();

      Object.values(calendarHours).forEach((daySummary) => {
        if (!daySummary || !Array.isArray(daySummary.companies)) {
          return;
        }

        daySummary.companies.forEach((company) => {
          if (!company || company.hours <= 0) {
            return;
          }

          const normalizedName =
            typeof company.name === "string"
              ? company.name.trim().toLowerCase()
              : "";
          const key = company.companyId ?? `name:${normalizedName}`;

          const existing = totals.get(key);
          if (existing) {
            existing.hours += company.hours;
          } else {
            totals.set(key, {
              companyId: company.companyId,
              companyName: company.name ?? undefined,
              normalizedName,
              hours: company.hours,
            });
          }
        });
      });

      if (companyId) {
        for (const entry of totals.values()) {
          if (entry.companyId && entry.companyId === companyId) {
            return entry.hours;
          }
        }
      }

      if (companyName) {
        const normalized = companyName.trim().toLowerCase();
        if (normalized.length > 0) {
          for (const entry of totals.values()) {
            if (entry.normalizedName === normalized) {
              return entry.hours;
            }
          }
        }
      }

      return 0;
    },
    [calendarHours]
  );

  const clearAutoFilledHoursForGroup = useCallback(
    (companyKey: string) => {
      const filledKeys = autoFilledContractKeysRef.current.get(companyKey);
      autoFilledContractKeysRef.current.delete(companyKey);

      if (!filledKeys || filledKeys.size === 0) {
        return;
      }

      setCalculationData((prev) => {
        const updatedInputs = { ...prev.companyContractInputs };
        let changed = false;

        filledKeys.forEach((contractKey) => {
          const existing = updatedInputs[contractKey];
          if (existing && existing.hours !== "") {
            updatedInputs[contractKey] = {
              ...existing,
              hours: "",
            };
            changed = true;
          }
        });

        if (!changed) {
          return prev;
        }

        return {
          ...prev,
          companyContractInputs: updatedInputs,
        };
      });
    },
    []
  );

  const applyAutoFillHoursForGroup = useCallback(
    (group: CompanyContractStructure["groups"][number]) => {
      const calendarHoursValue = getCalendarHoursForCompany(
        group.companyId,
        group.companyName
      );

      if (!calendarHoursValue || calendarHoursValue <= 0) {
        clearAutoFilledHoursForGroup(group.companyKey);
        return;
      }

      if (group.entries.length === 0) {
        clearAutoFilledHoursForGroup(group.companyKey);
        return;
      }

      const hoursPerEntry = calendarHoursValue / group.entries.length;
      const newFilledKeys = new Set<string>();
      let changed = false;

      setCalculationData((prev) => {
        const updatedInputs = { ...prev.companyContractInputs };

        group.entries.forEach((entry) => {
          if (manualHoursOverrideRef.current.has(entry.contractKey)) {
            return;
          }

          const roundedHours = Math.round(hoursPerEntry * 100) / 100;
          const newHours = roundedHours > 0 ? `${roundedHours}` : "";
          const existingRecord = updatedInputs[entry.contractKey];

          if (existingRecord) {
            if (existingRecord.hours !== newHours) {
              updatedInputs[entry.contractKey] = {
                ...existingRecord,
                hours: newHours,
              };
              changed = true;
            }
          } else if (newHours !== "") {
            updatedInputs[entry.contractKey] = {
              hours: newHours,
              baseSalary: "",
            };
            changed = true;
          }

          if (!manualHoursOverrideRef.current.has(entry.contractKey)) {
            newFilledKeys.add(entry.contractKey);
          }
        });

        autoFilledContractKeysRef.current.set(group.companyKey, newFilledKeys);

        if (!changed) {
          return prev;
        }

        return {
          ...prev,
          companyContractInputs: updatedInputs,
        };
      });
    },
    [clearAutoFilledHoursForGroup, getCalendarHoursForCompany]
  );

  useEffect(() => {
    const invalidKeys: string[] = [];
    companyContractStructure.groups.forEach((group) => {
      if (!autoFillHoursMap[group.companyKey]) {
        return;
      }

      const calendarHoursForGroup = getCalendarHoursForCompany(
        group.companyId,
        group.companyName
      );

      if (calendarHoursForGroup && calendarHoursForGroup > 0) {
        applyAutoFillHoursForGroup(group);
      } else {
        invalidKeys.push(group.companyKey);
        clearAutoFilledHoursForGroup(group.companyKey);
      }
    });

    if (invalidKeys.length > 0) {
      setAutoFillHoursMap((prev) => {
        const next = { ...prev };
        let changed = false;
        invalidKeys.forEach((key) => {
          if (next[key]) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [
    autoFillHoursMap,
    companyContractStructure,
    applyAutoFillHoursForGroup,
    clearAutoFilledHoursForGroup,
    getCalendarHoursForCompany,
  ]);

  const handleAutoFillHoursToggle = useCallback(
    (
      group: CompanyContractStructure["groups"][number],
      enabled: boolean
    ) => {
      if (enabled) {
        const calendarHoursForGroup = getCalendarHoursForCompany(
          group.companyId,
          group.companyName
        );
        if (!calendarHoursForGroup || calendarHoursForGroup <= 0) {
          clearAutoFilledHoursForGroup(group.companyKey);
          setAutoFillHoursMap((prev) => {
            if (!prev[group.companyKey]) {
              return prev;
            }
            const next = { ...prev };
            delete next[group.companyKey];
            return next;
          });
          return;
        }
      }

      setAutoFillHoursMap((prev) => {
        const next = { ...prev };
        if (enabled) {
          next[group.companyKey] = true;
        } else {
          delete next[group.companyKey];
        }
        return next;
      });

      if (enabled) {
        group.entries.forEach((entry) => {
          manualHoursOverrideRef.current.delete(entry.contractKey);
        });
        applyAutoFillHoursForGroup(group);
      } else {
        clearAutoFilledHoursForGroup(group.companyKey);
      }
    },
    [
      getCalendarHoursForCompany,
      clearAutoFilledHoursForGroup,
      applyAutoFillHoursForGroup,
    ]
  );

  const handleToggleAllAutoFill = useCallback(
    (enable: boolean) => {
      const groups = companyContractStructure.groups;
      if (enable) {
        const nextMap: Record<string, boolean> = {};
        groups.forEach((group) => {
          const calendarHoursForGroup = getCalendarHoursForCompany(
            group.companyId,
            group.companyName
          );

          if (!calendarHoursForGroup || calendarHoursForGroup <= 0) {
            clearAutoFilledHoursForGroup(group.companyKey);
            return;
          }

          nextMap[group.companyKey] = true;
          group.entries.forEach((entry) =>
            manualHoursOverrideRef.current.delete(entry.contractKey)
          );
          applyAutoFillHoursForGroup(group);
        });
        setAutoFillHoursMap(nextMap);
      } else {
        setAutoFillHoursMap({});
        groups.forEach((group) => {
          clearAutoFilledHoursForGroup(group.companyKey);
        });
      }
    },
    [
      companyContractStructure.groups,
      getCalendarHoursForCompany,
      applyAutoFillHoursForGroup,
      clearAutoFilledHoursForGroup,
    ]
  );

  const handleContractInputChange = useCallback(
    (
      contractKey: string,
      field: keyof CompanyContractInputState,
      value: string
    ) => {
      setCalculationData((prev) => {
        const nextInputs = {
          ...prev.companyContractInputs,
          [contractKey]: {
            ...prev.companyContractInputs[contractKey],
            [field]: value,
          },
        };
        if (field === "hours") {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            manualHoursOverrideRef.current.add(contractKey);
          } else {
            manualHoursOverrideRef.current.delete(contractKey);
          }
        }
        return {
          ...prev,
          companyContractInputs: nextInputs,
        };
      });
    },
    []
  );

  const handleCompanyGroupToggle = useCallback((companyKey: string) => {
    setExpandedCompanyInputs((prev) => ({
      ...prev,
      [companyKey]: !prev[companyKey],
    }));
  }, []);

  const updateCalculationField = useCallback(
    (field: keyof CalculationFormState, value: string) => {
      setCalculationData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const updateOtherPayments = useCallback(
    (
      updater: (current: OtherPaymentsState) => OtherPaymentsState
    ) => {
      setOtherPayments((prev) => updater(prev));
    },
    []
  );

  const addOtherPaymentItem = useCallback(
    (category: OtherPaymentCategory) => {
      const newItem: OtherPaymentItem = {
        id: createOperationId(),
        label: "",
        amount: "",
        companyKey: null,
        paymentMethod: "bank",
      };

      updateOtherPayments((previous) => ({
        ...previous,
        [category]: [...previous[category], newItem],
      }));
    },
    [updateOtherPayments]
  );

  const updateOtherPaymentItem = useCallback(
    (
      category: OtherPaymentCategory,
      itemId: string,
      field: keyof OtherPaymentItem,
      value: string
    ) => {
      updateOtherPayments((previous) => {
        const items = previous[category].map((item) =>
          item.id === itemId
            ? {
                ...item,
                [field]: value,
              }
            : item
        );
        return {
          ...previous,
          [category]: items,
        };
      });
    },
    [updateOtherPayments]
  );

  const removeOtherPaymentItem = useCallback(
    (category: OtherPaymentCategory, itemId: string) => {
      updateOtherPayments((previous) => ({
        ...previous,
        [category]: previous[category].filter((item) => item.id !== itemId),
      }));
    },
    [updateOtherPayments]
  );

  const otherPaymentsTotals = useMemo(() => {
    return OTHER_PAYMENTS_CATEGORY_ORDER.reduce(
      (acc, category) => {
        const entries = otherPayments[category];
        entries.forEach((entry) => {
          const amount = parseAmountInput(entry.amount);
          if (amount === 0) {
            return;
          }
          if (CREDIT_CATEGORIES.includes(category)) {
            acc.additions += amount;
          } else {
            acc.subtractions += amount;
          }
        });
        return acc;
      },
      { additions: 0, subtractions: 0 }
    );
  }, [otherPayments]);

  const calculateSalary = useCallback(() => {
    const overtimeHours = parseFloat(calculationData.overtimeHours) || 0;
    const baseBonuses = parseFloat(calculationData.bonuses) || 0;
    const baseDeductions = parseFloat(calculationData.deductions) || 0;
    const bonuses = baseBonuses + otherPaymentsTotals.additions;
    const deductions = baseDeductions + otherPaymentsTotals.subtractions;

    if (manualContractAggregates.hasEntries) {
      const filteredCompanies = manualContractAggregates.companyList.filter(
        (c) => isValidCompanyName(c.companyName)
      );

      const regularHours = filteredCompanies.reduce(
        (acc, c) => acc + (c.hours || 0),
        0
      );
      const baseAmountTotal = filteredCompanies.reduce(
        (acc, c) => acc + (c.baseAmount || 0),
        0
      );

      const averageRate =
        regularHours > 0 && baseAmountTotal > 0
          ? baseAmountTotal / regularHours
          : 0;
      const overtimePay =
        overtimeHours > 0 && averageRate > 0
          ? overtimeHours * averageRate * 1.5
          : 0;

      const amountBeforeAdjustments = baseAmountTotal + overtimePay;
      const totalAmount = amountBeforeAdjustments + bonuses - deductions;
      const extras = totalAmount - baseAmountTotal;

      const baseKeys = filteredCompanies.map((company) =>
        company.companyId ? `id:${company.companyId}` : `name:${company.companyName}`
      );

      const baseCompanyMap = new Map<
        CompanyKey,
        (typeof filteredCompanies)[number]
      >();
      baseKeys.forEach((key, index) => {
        baseCompanyMap.set(key, filteredCompanies[index]);
      });

      const adjustmentsMap = new Map<
        CompanyKey,
        {
          total: number;
          details: OtherPaymentDetailSummary[];
          companyName?: string;
          companyId?: string;
        }
      >();

      OTHER_PAYMENTS_CATEGORY_ORDER.forEach((category) => {
        otherPayments[category].forEach((item) => {
          const amount = parseAmountInput(item.amount);
          if (!amount) return;
          const companyKey = item.companyKey ?? "__unassigned__";
          const existing = adjustmentsMap.get(companyKey) ?? {
            total: 0,
            details: [],
            companyName: companyKey.startsWith("id:")
              ? companyKey
              : companyKey.replace("name:", ""),
          };
          const type: OtherPaymentFlow = CREDIT_CATEGORIES.includes(category)
            ? "income"
            : "expense";
          const signedAmount = type === "income" ? amount : -amount;
          existing.total += signedAmount;
          existing.details.push({
            id: item.id,
            label: item.label,
            amount: signedAmount,
            category,
            type,
            paymentMethod: item.paymentMethod,
          });
          adjustmentsMap.set(companyKey, existing);
        });
      });

      const regularHoursValue = regularHours;
      const totalHours = regularHoursValue + overtimeHours;
      const usesCalendarHours = regularHoursValue > 0;

      const additionalKeys = Array.from(adjustmentsMap.keys()).filter(
        (key) => !baseCompanyMap.has(key)
      );
      additionalKeys.sort((a, b) => {
        const infoA = adjustmentsMap.get(a);
        const infoB = adjustmentsMap.get(b);
        return (infoA?.companyName ?? "").localeCompare(
          infoB?.companyName ?? "",
          "es",
          { sensitivity: "base" }
        );
      });

      const orderedKeys = [...baseKeys, ...additionalKeys];
      const companyCount = orderedKeys.length;

      const companyBreakdown = orderedKeys.map((companyKey) => {
        const baseEntry = baseCompanyMap.get(companyKey);
        const adjustmentEntry = adjustmentsMap.get(companyKey);
        const hoursShare = baseEntry?.hours ?? 0;

        let baseShare = 0;
        if (amountBeforeAdjustments > 0) {
          if (regularHoursValue > 0) {
            baseShare = (hoursShare / regularHoursValue) * baseAmountTotal;
          } else if (companyCount > 0) {
            baseShare = baseAmountTotal / companyCount;
          }
        }

        let weight = 0;
        if (regularHoursValue > 0) {
          weight = hoursShare / regularHoursValue;
        } else if (companyCount > 0) {
          weight = 1 / companyCount;
        }

        const amount =
          baseShare + extras * weight + (adjustmentEntry?.total ?? 0);

        return {
          companyId: baseEntry?.companyId ?? adjustmentEntry?.companyId,
          companyKey,
          name: baseEntry?.companyName ?? adjustmentEntry?.companyName,
          hours: hoursShare,
          amount,
          otherPayments: adjustmentEntry?.details ?? undefined,
        };
      });

      const computedSum = companyBreakdown.reduce(
        (acc, item) => acc + item.amount,
        0
      );
      const adjustment = totalAmount - computedSum;
      if (companyBreakdown.length > 0 && Math.abs(adjustment) > 0.01) {
        const lastIndex = companyBreakdown.length - 1;
        companyBreakdown[lastIndex] = {
          ...companyBreakdown[lastIndex],
          amount: companyBreakdown[lastIndex].amount + adjustment,
        };
      }

      setResults({
        totalAmount,
        totalHours,
        regularHours: regularHoursValue,
        overtimeHours,
        companyBreakdown,
        usesCalendarHours,
        otherPaymentsSummary: {
          byCompany: [],
          unassigned: {
            incomes: 0,
            expenses: 0,
            total: 0,
            details: [],
          },
        },
      });

      return;
    }

    const baseSalary = parseFloat(calculationData.baseSalary) || 0;
    const hoursWorked = parseFloat(calculationData.hoursWorked) || 0;
    const regularHours = hoursWorked;
    const totalHours = regularHours + overtimeHours;
    const usesCalendarHours = false;

    const companyBreakdown = [] as CalculationResult["companyBreakdown"];

    const overtimePay =
      overtimeHours > 0 && regularHours > 0
        ? (baseSalary / regularHours) * overtimeHours * 1.5
        : 0;

    const totalAmount = baseSalary + overtimePay + bonuses - deductions;

    setResults({
      totalAmount,
      totalHours,
      regularHours,
      overtimeHours,
      companyBreakdown,
      usesCalendarHours,
      otherPaymentsSummary: {
        byCompany: [],
        unassigned: {
          incomes: 0,
          expenses: 0,
          total: 0,
          details: [],
        },
      },
    });
  }, [
    calculationData,
    manualContractAggregates,
    otherPaymentsTotals,
    otherPayments,
  ]);

  useEffect(() => {
    calculateSalary();
  }, [calculateSalary]);

  useEffect(() => {
    onResultChange(worker.id, results);
  }, [results, onResultChange, worker.id]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {worker.name}
            </h3>
            <Select
              value={calculationData.period}
              onChange={(value) => updateCalculationField("period", value)}
              options={[
                { value: "monthly", label: "Mensual" },
                { value: "weekly", label: "Semanal" },
                { value: "daily", label: "Diario" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
              <div className="min-w-0 flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setIsContractInputsOpen((current) => !current)}
                  className="flex items-center justify-center mt-3 rounded-full border border-gray-300 p-0.5 text-gray-500 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label={isContractInputsOpen ? "Contraer" : "Desplegar"}
                >
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-gray-500 transition-transform dark:text-gray-300 ${
                      isContractInputsOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">
                    Horas y sueldos
                  </p>
                  <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                    {manualContractAggregates.hasEntries
                      ? `Total horas: ${formatHours(manualContractAggregates.totalHours)}`
                      : ""}
                  </p>
                </div>
              </div>
              {(() => {
                const groups = companyContractStructure.groups;
                const eligibleGroups = groups.filter((group) => {
                  const calendarHoursForGroup = getCalendarHoursForCompany(
                    group.companyId,
                    group.companyName
                  );
                  return Boolean(
                    calendarHoursForGroup && calendarHoursForGroup > 0
                  );
                });

                const enabledCount = eligibleGroups.filter((group) =>
                  Boolean(autoFillHoursMap[group.companyKey])
                ).length;

                const allEnabled =
                  eligibleGroups.length > 0 &&
                  enabledCount === eligibleGroups.length;
                const isDisabled = eligibleGroups.length === 0;

                return (
                  <label
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-sm ${
                      isDisabled
                        ? "cursor-not-allowed border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500"
                        : "cursor-pointer border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                    title={
                      isDisabled
                        ? "No hay registros de horas para aplicar automáticamente"
                        : allEnabled
                        ? "Desactivar 'Usar registro' en todas"
                        : "Activar 'Usar registro' en todas"
                    }
                    onClick={(e) => {
                      if (isDisabled) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      e.stopPropagation();
                    }}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                      aria-label="Usar registro en todas"
                      disabled={isDisabled}
                      checked={allEnabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleAllAutoFill(e.target.checked);
                      }}
                    />
                    <span>Usar registro</span>
                  </label>
                );
              })()}
              <p className="mt-1 truncate text-base font-semibold text-gray-800 dark:text-gray-100 justify-self-end">
                {manualContractAggregates.hasEntries
                  ? `Total: ${formatCurrency(manualContractAggregates.totalBaseAmount)}`
                  : ""}
              </p>
            </div>
            {isContractInputsOpen && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {companyContractStructure.groups.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    No hay empresas asignadas al trabajador.
                  </div>
                ) : (
                  <div className="space-y-4 px-4 py-5">
                    {companyContractStructure.groups
                      .filter((g) => isValidCompanyName(g.companyName))
                      .map((group) => {
                        const summary =
                          manualContractAggregates.companyList.find((company) =>
                            (group.companyId && company.companyId === group.companyId) ||
                            company.companyName === group.companyName
                          );

                        const totalCompanyHours = summary?.hours ?? 0;
                        const totalCompanyBase = summary?.baseAmount ?? 0;
                        const calendarHoursForGroup = getCalendarHoursForCompany(
                          group.companyId,
                          group.companyName
                        );
                        const hasCalendarHours = calendarHoursForGroup > 0;
                        const isAutoFillEnabled =
                          hasCalendarHours && Boolean(autoFillHoursMap[group.companyKey]);
                        const isExpanded = expandedCompanyInputs[group.companyKey] ?? false;

                        return (
                          <div
                            key={group.companyKey}
                            className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                          >
                            <div
                              className="border-b border-gray-200 px-4 py-3 dark:border-gray-700 cursor-pointer"
                              onClick={() => handleCompanyGroupToggle(group.companyKey)}
                            >
                              <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,160px)] items-center gap-4">
                                <div className="flex items-start gap-2 min-w-[220px]">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCompanyGroupToggle(group.companyKey);
                                    }}
                                    className="flex items-center justify-center rounded-full border border-gray-300 p-1 text-gray-500 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                    aria-expanded={isExpanded}
                                    aria-label={
                                      isExpanded ? "Contraer empresa" : "Expandir empresa"
                                    }
                                  >
                                    <ChevronDown
                                      size={16}
                                      className={`transition-transform ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                                  </button>
                                  <div className="min-w-0 select-none">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                      {group.companyName}
                                    </p>
                                    <p
                                      className={`text-xs font-medium mt-0.5 ${
                                        Math.abs(totalCompanyHours - calendarHoursForGroup) > 0.001
                                          ? "text-amber-700 dark:text-amber-300"
                                          : "text-gray-600 dark:text-gray-300"
                                      }`}
                                    >
                                      {formatHours(totalCompanyHours)} Horas
                                    </p>
                                  </div>
                                </div>
                                <div
                                  className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 min-w-[180px] justify-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label
                                    className={`flex items-center gap-1.5 text-sm font-medium ${
                                      hasCalendarHours
                                        ? "text-gray-700 dark:text-gray-200"
                                        : "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                    }`}
                                    title={
                                      hasCalendarHours
                                        ? "Completa automáticamente con el registro de horas"
                                        : "Sin registros de horas para este periodo"
                                    }
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      checked={isAutoFillEnabled}
                                      disabled={!hasCalendarHours}
                                      onChange={(event) =>
                                        handleAutoFillHoursToggle(group, event.target.checked)
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span>
                                      {hasCalendarHours ? "Usar registro" : "Sin registro"}
                                    </span>
                                  </label>
                                </div>
                                <div
                                  className="text-base font-semibold text-gray-800 dark:text-gray-100 justify-self-end"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {formatCurrency(totalCompanyBase)}
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="space-y-3 px-3 py-2.5">
                                {group.entries.map((entry) => {
                                  const contractInput =
                                    calculationData.companyContractInputs[entry.contractKey] ?? {
                                      hours: "",
                                      baseSalary: "",
                                    };
                                  const contractMeta =
                                    companyContractStructure.contractMap.get(entry.contractKey);

                                  return (
                                    <div
                                      key={entry.contractKey}
                                      className="rounded-md border border-dashed border-gray-300 p-2.5 dark:border-gray-600"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                            {entry.label}
                                          </p>
                                          {entry.description && (
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                                              {entry.description}
                                            </p>
                                          )}
                                        </div>
                                        {!entry.hasContract && (
                                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                            Sin contrato
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        <Input
                                          type="number"
                                          label="Horas"
                                          placeholder="0"
                                          value={contractInput.hours}
                                          size="sm"
                                          onChange={(event) =>
                                            handleContractInputChange(
                                              entry.contractKey,
                                              "hours",
                                              event.target.value
                                            )
                                          }
                                          min="0"
                                          step="0.25"
                                          fullWidth
                                        />
                                        <Input
                                          type="number"
                                          label="Precio/Hora (€)"
                                          placeholder="0"
                                          value={
                                            contractInput.hourlyRate ??
                                            (typeof contractMeta?.hourlyRate === "number"
                                              ? String(contractMeta.hourlyRate)
                                              : "")
                                          }
                                          size="sm"
                                          onChange={(event) =>
                                            handleContractInputChange(
                                              entry.contractKey,
                                              "hourlyRate",
                                              event.target.value
                                            )
                                          }
                                          step="0.01"
                                          fullWidth
                                        />
                                        <Input
                                          type="number"
                                          label="Sueldo base (€)"
                                          placeholder="0"
                                          value={contractInput.baseSalary}
                                          size="sm"
                                          onChange={(event) =>
                                            handleContractInputChange(
                                              entry.contractKey,
                                              "baseSalary",
                                              event.target.value
                                            )
                                          }
                                          step="0.01"
                                          fullWidth
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Sueldo Base (€)"
              value={calculationData.baseSalary}
              onChange={(event) => updateCalculationField("baseSalary", event.target.value)}
              placeholder="1500"
              fullWidth
            />
            <Input
              type="number"
              label="Horas Trabajadas"
              value={calculationData.hoursWorked}
              onChange={(event) => updateCalculationField("hoursWorked", event.target.value)}
              placeholder="160"
              fullWidth
            />
            <Input
              type="number"
              label="Horas Extra"
              value={calculationData.overtimeHours}
              onChange={(event) => updateCalculationField("overtimeHours", event.target.value)}
              placeholder="0"
              fullWidth
            />
            <Input
              type="number"
              label="Bonificaciones (€)"
              value={calculationData.bonuses}
              onChange={(event) => updateCalculationField("bonuses", event.target.value)}
              placeholder="0"
              fullWidth
            />
            <Input
              type="number"
              label="Deducciones (€)"
              value={calculationData.deductions}
              onChange={(event) => updateCalculationField("deductions", event.target.value)}
              placeholder="0"
              fullWidth
            />
          </div>

          <TextArea
            label="Notas"
            value={calculationData.notes}
            onChange={(event) => updateCalculationField("notes", event.target.value)}
            placeholder="Notas adicionales..."
            rows={3}
            fullWidth
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <h4 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
              <Calculator
                size={20}
                className="mr-2 text-yellow-600 dark:text-yellow-400"
              />
              Otras operaciones
            </h4>
            <button
              type="button"
              onClick={() => setIsOtherOpsCollapsed((value) => !value)}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <ChevronDown
                size={18}
                className={`transition-transform ${
                  isOtherOpsCollapsed ? "" : "rotate-180"
                }`}
              />
            </button>
          </div>
        </CardHeader>
        {!isOtherOpsCollapsed && (
          <CardContent className="space-y-5">
            <div className="space-y-4">
              {OTHER_PAYMENTS_CATEGORY_ORDER.map((category) => {
                const entries = otherPayments[category];
                return (
                  <div
                    key={category}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {OTHER_PAYMENTS_LABELS[category]}
                      </h5>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addOtherPaymentItem(category)}
                        leftIcon={<Plus size={14} />}
                      >
                        Añadir
                      </Button>
                    </div>
                    {entries.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No hay registros.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {entries.map((item) => (
                          <div
                            key={item.id}
                            className="grid gap-3 items-end md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] md:items-center"
                          >
                            <Input
                              label="Descripción"
                              value={item.label}
                              onChange={(event) =>
                                updateOtherPaymentItem(
                                  category,
                                  item.id,
                                  "label",
                                  event.target.value
                                )
                              }
                              placeholder="Ej: Bono productividad"
                              fullWidth
                            />
                            <Input
                              label="Importe (€)"
                              value={item.amount}
                              onChange={(event) =>
                                updateOtherPaymentItem(
                                  category,
                                  item.id,
                                  "amount",
                                  event.target.value
                                )
                              }
                              placeholder="0"
                              fullWidth
                            />
                            <Select
                              label="Forma de pago"
                              value={item.paymentMethod}
                              onChange={(value) =>
                                updateOtherPaymentItem(
                                  category,
                                  item.id,
                                  "paymentMethod",
                                  value
                                )
                              }
                              options={[
                                { value: "bank", label: "Banco" },
                                { value: "cash", label: "Efectivo" },
                              ]}
                              fullWidth
                            />
                            <Select
                              label="Empresa"
                              value={item.companyKey ?? ""}
                              onChange={(value) =>
                                updateOtherPaymentItem(
                                  category,
                                  item.id,
                                  "companyKey",
                                  value || null
                                )
                              }
                              options={[
                                { value: "", label: "Sin asignar" },
                                ...companyContractStructure.groups.map((group) => ({
                                  value: group.companyKey,
                                  label: group.companyName,
                                })),
                              ]}
                              fullWidth
                            />
                            <button
                              type="button"
                              onClick={() => removeOtherPaymentItem(category, item.id)}
                              aria-label="Eliminar concepto"
                              className="flex h-11 w-11 items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 dark:text-gray-500 dark:hover:text-red-400 md:h-12 md:w-12"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <h4 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
              <ChevronDown size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
              Calendario de horas
            </h4>
            <button
              type="button"
              onClick={() => setIsCalendarCollapsed((value) => !value)}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <ChevronDown
                size={18}
                className={`transition-transform ${
                  isCalendarCollapsed ? "" : "rotate-180"
                }`}
              />
            </button>
          </div>
        </CardHeader>
        {!isCalendarCollapsed && (
          <CardContent>
            <div className="min-w-0 h-full text-xs">
              <WorkerHoursCalendar
                worker={worker}
                selectedMonth={calendarMonth}
                hoursByDate={calendarHours}
                onMonthChange={(date) => setCalendarMonth(date)}
                isLoading={isCalendarLoading}
                hideTitle
              />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export type { CalculationResult };
export default WorkerCalculationModule;
