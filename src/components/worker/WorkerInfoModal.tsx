import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Edit3,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import {
  Worker,
  WorkerCompanyContract,
  WorkerCompanyStats,
} from "../../types/salary";
import {
  trimToNull,
  normalizeKeyPart,
  normalizeCompanyLabel,
} from "../../lib/valueNormalizers";
import { UNASSIGNED_COMPANY_ID } from "../../constants/company";
import { formatDate } from "../../lib/utils";

export interface CompanyParameterOption {
  id: string;
  label: string;
}

const sanitizeTelHref = (phone: string) => {
  const sanitized = phone.replace(/[^+\d]/g, "");
  return sanitized.length > 0 ? `tel:${sanitized}` : null;
};

const buildWhatsAppLink = (phone: string) => {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly ? `https://wa.me/${digitsOnly}` : null;
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

export interface WorkerInfoModalProps {
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
  companyLookup?: Record<string, string>;
}

const WorkerCompaniesAndContracts: React.FC<
  WorkerCompaniesAndContractsProps
> = ({ companies, contractsByCompany, companyStats, companyLookup }) => {
  const isLikelyIdentifier = useCallback((value?: string | null) => {
    if (!value) {
      return false;
    }
    const trimmed = value.trim();
    if (trimmed.length < 8) {
      return false;
    }
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(trimmed)) {
      return true;
    }
    const hexPattern = /^[0-9a-f-]{12,}$/i;
    if (hexPattern.test(trimmed)) {
      return true;
    }
    const digits = trimmed.replace(/[^0-9]/g, "").length;
    return digits / trimmed.length > 0.6;
  }, []);

  const resolveCompanyName = useCallback(
    (rawName?: string | null) => {
      const trimmed = trimToNull(rawName);
      if (!trimmed) {
        return "Empresa";
      }
      if (!isLikelyIdentifier(trimmed)) {
        return trimmed;
      }

      const lookupCandidates = [
        trimmed,
        trimmed.toLowerCase(),
        trimmed.toUpperCase(),
      ];
      for (const candidate of lookupCandidates) {
        if (candidate && companyLookup?.[candidate]) {
          return companyLookup[candidate];
        }
      }
      return trimmed;
    },
    [companyLookup, isLikelyIdentifier]
  );

  const resolveContractName = useCallback(
    (contract: WorkerCompanyContract) => {
      const detailsLabel =
        contract.details && typeof contract.details === "object"
          ? trimToNull(
              (contract.details as Record<string, unknown>).label as
                | string
                | undefined
            ) ??
            trimToNull(
              (contract.details as Record<string, unknown>).name as
                | string
                | undefined
            )
          : null;
      const candidates = [
        contract.label,
        contract.position,
        contract.description,
        contract.typeLabel,
        detailsLabel,
      ];
      for (const candidate of candidates) {
        const trimmed = trimToNull(candidate);
        if (trimmed && !isLikelyIdentifier(trimmed)) {
          return trimmed;
        }
      }
      return null;
    },
    [isLikelyIdentifier]
  );

  const dedupeContracts = useCallback(
    (contracts: WorkerCompanyContract[] = []) => {
      const seen = new Set<string>();
      return contracts.filter((contract) => {
        const labelKey =
          resolveContractName(contract)?.toLowerCase() ??
          trimToNull(contract.label)?.toLowerCase() ??
          "";
        const rateKey =
          typeof contract.hourlyRate === "number"
            ? contract.hourlyRate.toFixed(4)
            : "";
        const fingerprint = `${labelKey}|${rateKey}`;
        if (seen.has(fingerprint)) {
          return false;
        }
        seen.add(fingerprint);
        return true;
      });
    },
    [resolveContractName]
  );

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
          existing.contracts = dedupeContracts(contracts ?? []);
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
            contracts: dedupeContracts(contracts ?? []),
          });
        }
      }
    );

    const result = Array.from(merged.entries()).map(([companyName, data]) => ({
      companyName,
      assignmentCount: data.assignmentCount,
      contractCount: data.contractCount,
      contracts: dedupeContracts(data.contracts),
    }));

    result.sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "es", { sensitivity: "base" })
    );

    return result;
  }, [companies, contractsByCompany, companyStats, dedupeContracts]);

  const flattenedLines = useMemo(() => {
    const lines: Array<{ key: string; text: string }> = [];
    if (!entries.length) {
      return lines;
    }
    entries.forEach((entry) => {
      const companyLabel = resolveCompanyName(entry.companyName);
      const contracts = dedupeContracts(entry.contracts);
      if (!contracts.length) {
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

      contracts.forEach((contract, index) => {
        const label =
          resolveContractName(contract) ?? `Contrato ${index + 1}`;
        let text = `${companyLabel} · ${label}`;
        if (typeof contract.hourlyRate === "number") {
          text += ` · ${contract.hourlyRate.toFixed(2)} €/h`;
        }

        lines.push({
          key: `${companyLabel}-${label}-${index}`,
          text,
        });
      });
    });

    return lines;
  }, [
    dedupeContracts,
    entries,
    resolveCompanyName,
    resolveContractName,
  ]);

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

export const WorkerInfoModal: React.FC<WorkerInfoModalProps> = ({
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
    companyOptionsMap,
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
                              size="sm"
                              onClick={() =>
                                handleRemoveCompany(company.formId)
                              }
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
                                        size="sm"
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
                <div className="mt-3">
                  {displayData?.companies?.length ? (
                    <WorkerCompaniesAndContracts
                      companies={displayData.companies}
                      contractsByCompany={displayData.contractsByCompany ?? {}}
                      companyStats={displayData.companyStats}
                      companyLookup={companyLookup}
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

export interface WorkerInfoData {
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

export interface WorkerInfoModalState {
  workerId: string;
  workerName: string;
  isOpen: boolean;
  isLoading: boolean;
  error?: string | null;
  data?: WorkerInfoData | null;
}
