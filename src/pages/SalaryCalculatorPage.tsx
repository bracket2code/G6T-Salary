import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Calculator,
  Search,
  User,
  Sigma,
  Clock,
  DollarSign,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Mail,
  Phone,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { Landmark, Banknote } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  Worker,
  WorkerCompanyContract,
  WorkerCompanyStats,
} from "../types/salary";
import { formatDate } from "../lib/utils";
import { useAuthStore } from "../store/authStore";
import {
  WorkerHoursCalendar,
  type DayHoursSummary,
} from "../components/WorkerHoursCalendar";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useTemplatesStore, type PdfTemplate } from "../store/templatesStore";
import {
  useGroupingStore,
  type CompanyGroup as StoredCompanyGroup,
} from "../store/groupingStore";

const sanitizeTelHref = (phone: string) => {
  const sanitized = phone.replace(/[^+\d]/g, "");
  return sanitized.length > 0 ? `tel:${sanitized}` : null;
};

const buildWhatsAppLink = (phone: string) => {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly ? `https://wa.me/${digitsOnly}` : null;
};

const isValidCompanyName = (name?: string | null) => {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return false;
  return n !== "empresa sin nombre" && n !== "sin empresa";
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

// Combined Search and Select Component
interface WorkerSearchSelectProps {
  workers: Worker[];
  selectedWorkerId: string;
  onWorkerSelect: (workerId: string) => void;
  placeholder?: string;
}

interface CompanyContractInputState {
  hours: string;
  baseSalary: string;
  hourlyRate?: string;
}

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

interface CalculationResult {
  totalAmount: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  companyBreakdown: Array<{
    companyId?: string;
    name?: string;
    hours: number;
    amount: number;
  }>;
  usesCalendarHours: boolean;
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
}

type OtherPaymentsState = Record<OtherPaymentCategory, OtherPaymentItem[]>;

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

type CompanyKey = string;

interface SplitPaymentRule {
  id: string;
  targetKey: CompanyKey | null;
  mode: "percentage" | "amount";
  value: string;
  method: "bank" | "cash";
}

interface SplitConfig {
  mode: "keep" | "split";
  rules: SplitPaymentRule[];
}

type SplitConfigsState = Record<CompanyKey, SplitConfig>;

const escapePdfText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const createSimplePdfBlob = (lines: string[]): Blob => {
  const encoder = new TextEncoder();
  const objects: Array<{ id: number; body: string }> = [];

  const addObject = (body: string) => {
    const id = objects.length + 1;
    objects.push({ id, body });
    return id;
  };

  const fontObjectId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  );

  let content = "BT\n/F1 16 Tf\n72 770 Td\n";
  lines.forEach((line, index) => {
    if (index > 0) {
      content += "0 -18 Td\n";
    }
    const text = line.trim().length > 0 ? line : " ";
    content += `(${escapePdfText(text)}) Tj\n`;
  });
  content += "ET";

  const contentBytes = encoder.encode(content);
  const contentObjectId = addObject(
    `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`
  );

  const pagesObjectId = objects.length + 2;
  const pageObjectId = addObject(
    `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectId} 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> >>`
  );
  addObject(`<< /Type /Pages /Kids [${pageObjectId} 0 R] /Count 1 >>`);
  const catalogObjectId = addObject(
    `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  let currentLength = encoder.encode(pdf).length;

  objects.forEach(({ id, body }) => {
    offsets[id] = currentLength;
    const objStr = `${id} 0 obj\n${body}\nendobj\n`;
    pdf += objStr;
    currentLength += encoder.encode(objStr).length;
  });

  const xrefOffset = currentLength;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${
    objects.length + 1
  } /Root ${catalogObjectId} 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

const WorkerSearchSelect: React.FC<WorkerSearchSelectProps> = ({
  workers,
  selectedWorkerId,
  onWorkerSelect,
  placeholder = "Buscar trabajador...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  // Filter workers based on search
  const filteredWorkers = workers
    .filter(
      (worker) =>
        worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (worker.phone &&
          worker.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (worker.department &&
          worker.department
            .toLowerCase()
            .includes(searchQuery.toLowerCase())) ||
        (worker.position &&
          worker.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (worker.companyNames &&
          worker.companyNames.some((company) =>
            company.toLowerCase().includes(searchQuery.toLowerCase())
          ))
    )
    .sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Si hay un trabajador seleccionado, mostrar su nombre, sino limpiar
        if (selectedWorker) {
          setInputValue(selectedWorker.name);
        } else {
          setInputValue("");
        }
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Actualizar el valor del input cuando cambia el trabajador seleccionado
  useEffect(() => {
    if (selectedWorker) {
      setInputValue(selectedWorker.name);
    } else {
      setInputValue("");
    }
  }, [selectedWorker]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, filteredWorkers.length);
  }, [filteredWorkers.length]);
  const handleWorkerSelect = (worker: Worker) => {
    onWorkerSelect(worker.id);
    setInputValue(worker.name);
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWorkerSelect("");
    setInputValue("");
    setSearchQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSearchQuery(value);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // Si se borra todo el contenido, deseleccionar trabajador
    if (value === "") {
      onWorkerSelect("");
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // Si hay un trabajador seleccionado, limpiar para permitir búsqueda
    if (selectedWorker) {
      setInputValue("");
      setSearchQuery("");
    }
    if (filteredWorkers.length > 0) {
      setHighlightedIndex(0);
    }
  };

  const handleInputClick = () => {
    setIsOpen(true);
    if (filteredWorkers.length > 0 && highlightedIndex === -1) {
      setHighlightedIndex(0);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (selectedWorker) {
        setInputValue(selectedWorker.name);
      }
      return;
    }

    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
    }

    if (!filteredWorkers.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= filteredWorkers.length || prev === -1) {
          return 0;
        }
        return nextIndex;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev <= 0) {
          return filteredWorkers.length - 1;
        }
        return prev - 1;
      });
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < filteredWorkers.length) {
        event.preventDefault();
        handleWorkerSelect(filteredWorkers[highlightedIndex]);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (filteredWorkers.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    if (highlightedIndex === -1) {
      setHighlightedIndex(0);
    } else if (highlightedIndex >= filteredWorkers.length) {
      setHighlightedIndex(filteredWorkers.length - 1);
    }
  }, [filteredWorkers, isOpen, highlightedIndex]);

  useEffect(() => {
    if (highlightedIndex >= 0) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Trabajador
      </label>

      {/* Input Field */}
      <div
        className={`
          min-h-[42px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
          rounded-md flex items-center
          hover:border-gray-400 dark:hover:border-gray-500
          ${isOpen ? "border-blue-500 ring-1 ring-blue-500" : ""}
        `}
      >
        <div className="flex-1 flex items-center px-3 py-2">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClick={handleInputClick}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center space-x-1">
          {(selectedWorker || inputValue) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 mr-2 ${
              isOpen ? "rotate-180" : ""
            }`}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* Results */}
          <div className="max-h-48 overflow-y-auto">
            {filteredWorkers.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery
                  ? `No se encontraron trabajadores con "${searchQuery}"`
                  : "Escribe para buscar trabajadores"}
              </div>
            ) : (
              <>
                {/* Results count */}
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                  {searchQuery
                    ? `${filteredWorkers.length} de ${workers.length} trabajadores`
                    : `${workers.length} trabajadores disponibles`}
                </div>

                {/* Worker list */}
                {filteredWorkers.map((worker, index) => {
                  const isHighlighted = highlightedIndex === index;
                  const isSelected = selectedWorkerId === worker.id;
                  const baseClasses = `px-3 py-3 cursor-pointer flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700`;
                  const highlightClass = isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : isHighlighted
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "";

                  return (
                    <div
                      key={`${worker.id}-${index}`}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      className={`${baseClasses} ${highlightClass}`}
                      onClick={() => handleWorkerSelect(worker)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {worker.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {worker.companyNames && worker.companyNames.length > 0
                            ? worker.companyNames.join(", ")
                            : "Sin empresas asignadas"}
                        </p>
                        {(worker.department || worker.position) && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {[worker.department, worker.position]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        )}
                      </div>
                      {selectedWorkerId === worker.id && (
                        <Check
                          size={16}
                          className="text-blue-600 dark:text-blue-400 ml-2"
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SalaryCalculatorPage: React.FC = () => {
  const { externalJwt } = useAuthStore();

  // All workers from API (cached in memory)
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  // Filtered workers based on search
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [companyLookup, setCompanyLookup] = useState<Record<string, string>>(
    {}
  );
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarHours, setCalendarHours] = useState<
    Record<string, DayHoursSummary>
  >({});
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isContractInputsOpen, setIsContractInputsOpen] = useState(false);
  const [autoFillHoursMap, setAutoFillHoursMap] = useState<
    Record<string, boolean>
  >({});
  const [expandedCompanyInputs, setExpandedCompanyInputs] = useState<
    Record<string, boolean>
  >({});
  const [companyAssignmentWarning, setCompanyAssignmentWarning] = useState<
    string | null
  >(null);
  const [otherPayments, setOtherPayments] = useState<OtherPaymentsState>(() =>
    createEmptyOtherPaymentsState()
  );
  const [splitConfigs, setSplitConfigs] = useState<SplitConfigsState>({});

  // Collapsible modules state
  const [isCalcDataCollapsed, setIsCalcDataCollapsed] = useState(true);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(true);
  const [isOtherOpsCollapsed, setIsOtherOpsCollapsed] = useState(true);
  const [isGroupManagerCollapsed, setIsGroupManagerCollapsed] = useState(false);
  const [isOtherPaymentsCollapsed, setIsOtherPaymentsCollapsed] =
    useState(true);
  const [isSplitPaymentsCollapsed, setIsSplitPaymentsCollapsed] =
    useState(true);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(true);

  // PDF export modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const { templates, createTemplate, setActiveTemplate } = useTemplatesStore();

  const ensureSeedTemplates = useCallback(() => {
    if (templates && templates.length > 0) return;
    const colors = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed"];
    const sizes: Array<{ size: any; orientation: any }> = [
      { size: "A4", orientation: "portrait" },
      { size: "A4", orientation: "landscape" },
      { size: "letter", orientation: "portrait" },
      { size: "A5", orientation: "portrait" },
    ];
    for (let i = 0; i < 3; i++) {
      const pick = sizes[i % sizes.length];
      const col = colors[i % colors.length];
      const t = createTemplate({
        name: `Plantilla demo ${i + 1}`,
        description: "Plantilla generada para pruebas",
        pageSize: pick.size as any,
        orientation: pick.orientation as any,
        accentColor: col,
        header: {
          title: `Resumen ${i + 1}`,
          subtitle: "Diseño de ejemplo",
          showWorkerInfo: true,
          showPeriodSummary: i % 2 === 0,
        },
        includeCompanyTotals: i % 2 === 0,
        includeDailyBreakdown: i % 2 === 1,
      });
      if (i === 0) setSelectedTemplateId(t.id);
    }
  }, [templates, createTemplate]);

  // ===== Otras operaciones: Agrupar pagos =====
  const [companyGroups, setCompanyGroups] = useState<StoredCompanyGroup[]>([]);
  const { getGroups, setGroups } = useGroupingStore();

  // Calculation results (declaration moved up for grouping dependencies)
  const [results, setResults] = useState<CalculationResult | null>(null);

  const getCompanyKey = useCallback(
    (entry: { companyId?: string; name?: string }) => {
      return (
        (entry.companyId && String(entry.companyId)) ||
        (entry.name ? `name:${entry.name}` : "sin")
      );
    },
    []
  );

  const availableCompanies = useMemo(() => {
    if (!results)
      return [] as Array<{
        key: CompanyKey;
        name: string;
        hours: number;
        amount: number;
      }>;
    return results.companyBreakdown
      .filter((c) => isValidCompanyName(c.name))
      .map((c) => ({
        key: getCompanyKey(c),
        name: c.name ?? "",
        hours: c.hours,
        amount: c.amount,
      }));
  }, [results, getCompanyKey]);

  useEffect(() => {
    setSplitConfigs((prev) => {
      const next: SplitConfigsState = {};
      availableCompanies.forEach((company) => {
        const existing = prev[company.key];
        const filteredRules =
          existing?.rules?.filter(
            (rule) =>
              rule.targetKey &&
              rule.targetKey !== company.key &&
              availableCompanies.some((c) => c.key === rule.targetKey)
          ) ?? [];

        next[company.key] = {
          mode: existing?.mode ?? "keep",
          rules: filteredRules,
        };
      });
      return next;
    });
  }, [availableCompanies]);

  const companyAssignments = useMemo(() => {
    const assignments = new Map<CompanyKey, StoredCompanyGroup>();
    companyGroups.forEach((group) => {
      group.companies.forEach((company) => {
        if (!assignments.has(company)) {
          assignments.set(company, group);
        }
      });
    });
    return assignments;
  }, [companyGroups]);

  const otherPaymentsTotals = useMemo(() => {
    let additions = 0;
    let subtractions = 0;

    (Object.keys(otherPayments) as OtherPaymentCategory[]).forEach(
      (category) => {
        otherPayments[category].forEach((item) => {
          const amount = parseFloat(item.amount.replace(",", "."));
          if (!Number.isFinite(amount)) {
            return;
          }
          if (CREDIT_CATEGORIES.includes(category)) {
            additions += amount;
          } else {
            subtractions += amount;
          }
        });
      }
    );

    return { additions, subtractions };
  }, [otherPayments]);

  const addOtherPayment = (category: OtherPaymentCategory) => {
    const newItem: OtherPaymentItem = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label: "",
      amount: "",
    };

    setOtherPayments((prev) => ({
      ...prev,
      [category]: [...prev[category], newItem],
    }));
  };

  const updateOtherPayment = (
    category: OtherPaymentCategory,
    id: string,
    field: "label" | "amount",
    value: string
  ) => {
    setOtherPayments((prev) => ({
      ...prev,
      [category]: prev[category].map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeOtherPayment = (category: OtherPaymentCategory, id: string) => {
    setOtherPayments((prev) => ({
      ...prev,
      [category]: prev[category].filter((item) => item.id !== id),
    }));
  };

  const setSplitMode = (sourceKey: CompanyKey, mode: "keep" | "split") => {
    setSplitConfigs((prev) => {
      const existing = prev[sourceKey] ?? { mode: "keep", rules: [] };
      return {
        ...prev,
        [sourceKey]: {
          ...existing,
          mode,
        },
      };
    });
  };

  const addSplitPaymentRule = (sourceKey: CompanyKey) => {
    const candidateDestinations = availableCompanies.filter(
      (company) => company.key !== sourceKey
    );
    if (candidateDestinations.length === 0) {
      return;
    }

    const fallbackTarget = candidateDestinations[0].key;

    setSplitConfigs((prev) => {
      const existing = prev[sourceKey] ?? { mode: "split", rules: [] };
      const existingTargets = new Set(
        existing.rules
          .map((rule) => rule.targetKey)
          .filter((key): key is CompanyKey => Boolean(key))
      );
      const defaultTarget =
        candidateDestinations.find(
          (company) => !existingTargets.has(company.key)
        )?.key ?? fallbackTarget;

      const newRule: SplitPaymentRule = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        targetKey: defaultTarget,
        mode: "percentage",
        value: "",
        method: "bank",
      };

      return {
        ...prev,
        [sourceKey]: {
          mode: "split",
          rules: [...existing.rules, newRule],
        },
      };
    });
  };

  const updateSplitPaymentRule = <K extends keyof SplitPaymentRule>(
    sourceKey: CompanyKey,
    id: string,
    field: K,
    value: SplitPaymentRule[K]
  ) => {
    setSplitConfigs((prev) => {
      const existing = prev[sourceKey];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        [sourceKey]: {
          ...existing,
          rules: existing.rules.map((rule) =>
            rule.id === id ? { ...rule, [field]: value } : rule
          ),
        },
      };
    });
  };

  const removeSplitPaymentRule = (sourceKey: CompanyKey, id: string) => {
    setSplitConfigs((prev) => {
      const existing = prev[sourceKey];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        [sourceKey]: {
          ...existing,
          rules: existing.rules.filter((rule) => rule.id !== id),
        },
      };
    });
  };

  const splitSummaries = useMemo(() => {
    const summaries = new Map<
      CompanyKey,
      {
        sourceAmount: number;
        distributed: number;
        remaining: number;
        ruleAmounts: Map<string, number>;
      }
    >();

    availableCompanies.forEach((company) => {
      const config = splitConfigs[company.key];
      const sourceAmount = company.amount;
      if (!config || config.mode !== "split" || config.rules.length === 0) {
        summaries.set(company.key, {
          sourceAmount,
          distributed: 0,
          remaining: sourceAmount,
          ruleAmounts: new Map(),
        });
        return;
      }

      let distributed = 0;
      const ruleAmounts = new Map<string, number>();
      config.rules.forEach((rule) => {
        if (!rule.targetKey || rule.targetKey === company.key) {
          return;
        }
        const raw = parseFloat(rule.value.replace(",", "."));
        const numeric = Number.isFinite(raw) ? raw : 0;
        const amount =
          rule.mode === "percentage" ? (sourceAmount * numeric) / 100 : numeric;
        distributed += amount;
        ruleAmounts.set(rule.id, amount);
      });

      summaries.set(company.key, {
        sourceAmount,
        distributed,
        remaining: sourceAmount - distributed,
        ruleAmounts,
      });
    });

    return summaries;
  }, [availableCompanies, splitConfigs]);

  const renderSplitPaymentsSection = () => {
    if (availableCompanies.length === 0) {
      return null;
    }

    const totals = Array.from(splitSummaries.values()).reduce(
      (acc, summary) => {
        acc.source += summary.sourceAmount;
        acc.distributed += summary.distributed;
        acc.remaining += summary.remaining;
        return acc;
      },
      { source: 0, distributed: 0, remaining: 0 }
    );

    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 shadow-sm">
        <div
          className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 py-4 ${
            isSplitPaymentsCollapsed
              ? ""
              : "border-b border-gray-200 dark:border-gray-700"
          }`}
        >
          <div className="space-y-2">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Dividir Pagos
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Revisa las asignaciones por empresa y decide si mantenerlas o
              repartirlas manualmente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-300" />
                {formatCurrency(totals.source)} origen total
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
                  totals.distributed <= totals.source + 0.001
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current/60" />
                {formatCurrency(totals.distributed)} repartido
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
                  totals.remaining > 0
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current/60" />
                {formatCurrency(totals.remaining)} restante
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSplitPaymentsCollapsed((prev) => !prev)}
              className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              aria-label="Mostrar u ocultar división de pagos"
            >
              <ChevronDown
                size={18}
                className={`text-gray-600 dark:text-gray-300 transition-transform ${
                  isSplitPaymentsCollapsed ? "" : "rotate-180"
                }`}
              />
            </button>
          </div>
        </div>
        {!isSplitPaymentsCollapsed && (
          <div className="px-4 py-5 space-y-5">
            <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300 sm:hidden">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-300" />
                {formatCurrency(totals.source)} origen total
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
                  totals.distributed <= totals.source + 0.001
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current/60" />
                {formatCurrency(totals.distributed)} repartido
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
                  totals.remaining > 0
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current/60" />
                {formatCurrency(totals.remaining)} restante
              </span>
            </div>

            {availableCompanies.map((company) => {
              const config = splitConfigs[company.key] ?? {
                mode: "keep",
                rules: [],
              };
              const summary =
                splitSummaries.get(company.key) ??
                ({
                  sourceAmount: company.amount,
                  distributed: 0,
                  remaining: company.amount,
                  ruleAmounts: new Map<string, number>(),
                } as const);
              const candidateDestinations = availableCompanies.filter(
                (c) => c.key !== company.key
              );
              const canAddRule = candidateDestinations.length > 0;
              const isSplit = config.mode === "split";

              return (
                <div
                  key={company.key}
                  className="space-y-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {company.name}
                      </h5>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                          <span className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-300" />
                          {formatCurrency(summary.sourceAmount)} origen
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
                            summary.distributed <= summary.sourceAmount + 0.001
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full bg-current/60" />
                          {formatCurrency(summary.distributed)} repartido
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
                            summary.remaining > 0
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-300"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full bg-current/60" />
                          {formatCurrency(summary.remaining)} restante
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setSplitMode(company.key, "keep")}
                          className={`px-3 py-1.5 text-xs font-medium transition ${
                            !isSplit
                              ? "bg-blue-600 text-white"
                              : "bg-transparent text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          Mantener asignación
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSplitMode(company.key, "split");
                            if (config.rules.length === 0 && canAddRule) {
                              addSplitPaymentRule(company.key);
                            }
                          }}
                          className={`px-3 py-1.5 text-xs font-medium transition ${
                            isSplit
                              ? "bg-blue-600 text-white"
                              : "bg-transparent text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          Dividir manualmente
                        </button>
                      </div>
                      {isSplit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addSplitPaymentRule(company.key)}
                          disabled={!canAddRule}
                        >
                          Añadir destino
                        </Button>
                      )}
                    </div>
                  </div>

                  {!isSplit && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      El importe se mantendrá asignado a {company.name} sin
                      modificaciones.
                    </p>
                  )}

                  {isSplit && (
                    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] md:items-center md:gap-3 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
                        <span>Destino</span>
                        <span>Método</span>
                        <span>Tipo</span>
                        <span>Valor calculado</span>
                        <span className="text-right">Acciones</span>
                      </div>
                      {config.rules.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                          Añade destinos para repartir el importe.
                        </div>
                      ) : (
                        config.rules.map((rule) => {
                          const computedAmount =
                            summary.ruleAmounts.get(rule.id) ?? 0;
                          return (
                            <div
                              key={rule.id}
                              className="border-t border-gray-100 px-4 py-4 dark:border-gray-800"
                            >
                              <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] md:items-center md:gap-3">
                                <Select
                                  value={rule.targetKey ?? ""}
                                  onChange={(value) =>
                                    updateSplitPaymentRule(
                                      company.key,
                                      rule.id,
                                      "targetKey",
                                      value ? (value as CompanyKey) : null
                                    )
                                  }
                                  options={[
                                    {
                                      value: "",
                                      label: "Selecciona empresa destino",
                                    },
                                    ...candidateDestinations.map((c) => ({
                                      value: c.key,
                                      label: `${c.name} (${formatCurrency(
                                        c.amount
                                      )})`,
                                    })),
                                  ]}
                                  aria-label="Empresa destino"
                                  fullWidth
                                />

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSplitPaymentRule(
                                        company.key,
                                        rule.id,
                                        "method",
                                        "bank"
                                      )
                                    }
                                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition ${
                                      rule.method !== "cash"
                                        ? "border-blue-500 bg-blue-600 text-white"
                                        : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    <div className="flex items-center justify-center gap-1">
                                      <Landmark size={14} /> Banco
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSplitPaymentRule(
                                        company.key,
                                        rule.id,
                                        "method",
                                        "cash"
                                      )
                                    }
                                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition ${
                                      rule.method === "cash"
                                        ? "border-blue-500 bg-blue-600 text-white"
                                        : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    <div className="flex items-center justify-center gap-1">
                                      <Banknote size={14} /> Efectivo
                                    </div>
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSplitPaymentRule(
                                        company.key,
                                        rule.id,
                                        "mode",
                                        "percentage"
                                      )
                                    }
                                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition ${
                                      rule.mode === "percentage"
                                        ? "border-indigo-500 bg-indigo-600 text-white"
                                        : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    %
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSplitPaymentRule(
                                        company.key,
                                        rule.id,
                                        "mode",
                                        "amount"
                                      )
                                    }
                                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition ${
                                      rule.mode === "amount"
                                        ? "border-indigo-500 bg-indigo-600 text-white"
                                        : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    €
                                  </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.01"
                                      min="0"
                                      value={rule.value}
                                      onChange={(e) =>
                                        updateSplitPaymentRule(
                                          company.key,
                                          rule.id,
                                          "value",
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        rule.mode === "percentage"
                                          ? "0"
                                          : "0,00"
                                      }
                                      className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-2 text-right text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                                    />
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {rule.mode === "percentage" ? "%" : "€"}
                                    </span>
                                  </div>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(computedAmount)}
                                  </span>
                                </div>

                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeSplitPaymentRule(
                                        company.key,
                                        rule.id
                                      )
                                    }
                                    className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/20"
                                    title="Eliminar reparto"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
              <span>
                Ajusta los valores hasta cubrir el importe del origen. Puedes
                mezclar porcentajes e importes fijos.
              </span>
              <span>
                El reparto solo se guarda en esta pantalla; si recalculas,
                vuelve a confirmarlo antes de exportar.
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const exportResultsToPdf = (template?: PdfTemplate | null) => {
    if (!results) {
      alert("Calcula primero para poder exportar el PDF.");
      return;
    }

    const lines: string[] = [];
    const templateName = template?.name ?? "Resumen de salario";
    lines.push(templateName);
    if (selectedWorker) {
      lines.push(`Trabajador: ${selectedWorker.name}`);
    }

    const periodText =
      calculationData.period === "monthly"
        ? "Mensual"
        : calculationData.period === "weekly"
        ? "Semanal"
        : "Diario";

    lines.push(`Período: ${periodText}`);
    lines.push(`Horas totales: ${formatHours(results.totalHours)}`);
    lines.push(`Importe total: ${formatCurrency(results.totalAmount)}`);
    lines.push(`Generado: ${new Date().toLocaleString("es-ES")}`);
    lines.push(" ");

    if (companyGroups.length > 0 && groupedBreakdown) {
      lines.push("Agrupaciones:");
      groupedBreakdown.groups.forEach((group) => {
        lines.push(
          ` - ${group.name}: ${formatHours(group.hours)} h · ${formatCurrency(
            group.amount
          )}`
        );
        if (group.items?.length) {
          group.items.forEach((item) => {
            lines.push(
              `    · ${item.name}: ${formatHours(
                item.hours
              )} h · ${formatCurrency(item.amount)}`
            );
          });
        }
      });
      if (groupedBreakdown.remaining.length > 0) {
        lines.push("Empresas sin agrupar:");
        groupedBreakdown.remaining.forEach((item) => {
          lines.push(
            ` - ${item.name}: ${formatHours(item.hours)} h · ${formatCurrency(
              item.amount
            )}`
          );
        });
      }
    } else {
      lines.push("Detalle por empresa:");
      results.companyBreakdown
        .filter((company) => isValidCompanyName(company.name))
        .forEach((company) => {
          lines.push(
            ` - ${company.name ?? "Sin nombre"}: ${formatHours(
              company.hours
            )} h · ${formatCurrency(company.amount)}`
          );
        });
    }

    const splitEntries = availableCompanies.filter((company) => {
      const config = splitConfigs[company.key];
      return config && config.mode === "split" && config.rules.length > 0;
    });

    if (splitEntries.length > 0) {
      lines.push(" ");
      lines.push("Dividir pagos:");
      splitEntries.forEach((company) => {
        const config = splitConfigs[company.key];
        const summary = splitSummaries.get(company.key);
        const sourceAmount = summary?.sourceAmount ?? company.amount;
        lines.push(` ${company.name} (${formatCurrency(sourceAmount)})`);

        config?.rules.forEach((rule, index) => {
          const destination = availableCompanies.find(
            (candidate) => candidate.key === rule.targetKey
          );
          const methodLabel = rule.method === "cash" ? "Efectivo" : "Banco";
          const baseValueLabel =
            rule.mode === "percentage"
              ? `${rule.value || "0"}%`
              : formatCurrency(Number(rule.value || 0));
          const computed = summary?.ruleAmounts.get(rule.id) ?? 0;
          lines.push(
            `   ${index + 1}. ${
              destination?.name ?? "Destino sin asignar"
            } · ${methodLabel} → ${formatCurrency(
              computed
            )} (base ${baseValueLabel})`
          );
        });

        if (summary && Math.abs(summary.remaining) > 0.01) {
          lines.push(
            `   Restante sin distribuir: ${formatCurrency(summary.remaining)}`
          );
        }
      });
    }

    lines.push(" ");
    lines.push(`Plantilla utilizada: ${templateName}`);

    const blob = createSimplePdfBlob(lines);
    const fileNameBase = selectedWorker?.name
      ? selectedWorker.name.replace(/\s+/g, "-")
      : "calculo";
    const fileName = `${fileNameBase.toLowerCase()}-${Date.now()}.pdf`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const colorsPalette = [
    "#2563eb",
    "#16a34a",
    "#f59e0b",
    "#ef4444",
    "#7c3aed",
    "#0ea5e9",
  ];

  const addEmptyGroup = () => {
    const id = Math.random().toString(36).slice(2, 8);
    const color = colorsPalette[companyGroups.length % colorsPalette.length];
    setCompanyGroups((prev) => [
      ...prev,
      {
        id,
        name: `Grupo ${prev.length + 1}`,
        color,
        companies: [],
        paymentMethod: "bank",
      },
    ]);
  };

  const removeGroup = (id: string) => {
    setCompanyGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const toggleCompanyInGroup = (groupId: string, companyKey: CompanyKey) => {
    let warning: string | null = null;
    let didChange = false;

    setCompanyGroups((prev) => {
      const target = prev.find((g) => g.id === groupId);
      const alreadyInTarget = !!target && target.companies.includes(companyKey);
      if (alreadyInTarget) {
        // Si ya está en el grupo, quitarla (toggle off)
        didChange = true;
        return prev.map((g) =>
          g.id === groupId
            ? { ...g, companies: g.companies.filter((k) => k !== companyKey) }
            : g
        );
      }

      const assignedGroup = prev.find(
        (g) => g.id !== groupId && g.companies.includes(companyKey)
      );

      if (assignedGroup) {
        const companyName =
          availableCompanies.find((c) => c.key === companyKey)?.name ??
          "Esta empresa";
        warning = `${companyName} ya está asignada al grupo "${assignedGroup.name}". Elimina esa asignación antes de moverla.`;
        return prev;
      }

      didChange = true;
      return prev.map((g) =>
        g.id === groupId ? { ...g, companies: [...g.companies, companyKey] } : g
      );
    });

    setCompanyAssignmentWarning(didChange ? null : warning);
  };

  const removeCompanyFromAllGroups = (companyKey: CompanyKey) => {
    setCompanyGroups((prev) =>
      prev.map((g) => ({
        ...g,
        companies: g.companies.filter((k) => k !== companyKey),
      }))
    );
  };

  const groupedBreakdown = useMemo(() => {
    if (!results) return null;
    const byKey = new Map<
      CompanyKey,
      { name: string; hours: number; amount: number }
    >();
    availableCompanies.forEach((c) =>
      byKey.set(c.key, { name: c.name, hours: c.hours, amount: c.amount })
    );

    const used = new Set<CompanyKey>();
    const groups = companyGroups.map((g) => {
      let hours = 0;
      let amount = 0;
      const items: Array<{ name: string; hours: number; amount: number }> = [];
      g.companies.forEach((k) => {
        const v = byKey.get(k);
        if (v) {
          hours += v.hours;
          amount += v.amount;
          used.add(k);
          items.push({ name: v.name, hours: v.hours, amount: v.amount });
        }
      });
      return {
        id: g.id,
        name: g.name,
        color: g.color,
        hours,
        amount,
        companies: g.companies.map((k) => byKey.get(k)?.name || k),
        paymentMethod: g.paymentMethod ?? "bank",
        items,
      };
    });

    const remaining = availableCompanies
      .filter((c) => !used.has(c.key))
      .map((c) => ({ name: c.name, hours: c.hours, amount: c.amount }));

    return { groups, remaining };
  }, [results, availableCompanies, companyGroups]);

  // Expand/collapse state for result groups
  const [expandedResultGroups, setExpandedResultGroups] = useState<
    Record<string, boolean>
  >({});

  // Persist and restore company groups per worker
  useEffect(() => {
    const wid = selectedWorker?.id ?? null;
    const stored = getGroups(wid);
    if (stored && stored.length > 0) {
      setCompanyGroups(stored);
    } else {
      setCompanyGroups([]);
    }
  }, [selectedWorker?.id]);

  useEffect(() => {
    const wid = selectedWorker?.id ?? null;
    setGroups(wid, companyGroups);
  }, [companyGroups, selectedWorker?.id]);

  // Calculation form data
  const [calculationData, setCalculationData] = useState<CalculationFormState>({
    baseSalary: "",
    hoursWorked: "",
    overtimeHours: "",
    bonuses: "",
    deductions: "",
    period: "monthly",
    notes: "",
    companyContractInputs: {},
  });

  // Calculation results moved earlier
  const [copyFeedback, setCopyFeedback] = useState<{
    type: "email" | "phone";
    message: string;
    target?: string;
  } | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autoFilledContractKeysRef = useRef<Map<string, Set<string>>>(new Map());
  const manualHoursOverrideRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchAllWorkers();
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      const worker = workers.find((w) => w.id === selectedWorkerId);
      setSelectedWorker(worker || null);
      setExpandedCompany(null);
      if (worker) {
        const now = new Date();
        setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
        // Al seleccionar trabajador: abrir todos los módulos
        setIsCalcDataCollapsed(false);
        setIsCalendarCollapsed(false);
        setIsOtherOpsCollapsed(false);
        setIsResultsCollapsed(false);
      }

      // Pre-fill with worker's base salary if available
      manualHoursOverrideRef.current.clear();
      autoFilledContractKeysRef.current = new Map();
      setAutoFillHoursMap({});
      setExpandedCompanyInputs({});
      setCalculationData((prev) => ({
        ...prev,
        baseSalary: worker?.baseSalary ? worker.baseSalary.toString() : "",
        companyContractInputs: {},
      }));
    } else {
      setSelectedWorker(null);
      setExpandedCompany(null);
      manualHoursOverrideRef.current.clear();
      autoFilledContractKeysRef.current = new Map();
      setAutoFillHoursMap({});
      setExpandedCompanyInputs({});
      setCalculationData((prev) => ({
        ...prev,
        baseSalary: "",
        companyContractInputs: {},
      }));
    }
  }, [selectedWorkerId, workers]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const formatDateKey = useCallback((date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  }, []);

  const fetchWorkerHoursForMonth = useCallback(
    async (workerId: string, month: Date) => {
      if (!externalJwt) {
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL;
      if (!apiUrl) {
        console.error("API URL not configured");
        return;
      }

      const fromDate = new Date(
        Date.UTC(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0)
      );
      const toDate = new Date(
        Date.UTC(month.getFullYear(), month.getMonth() + 1, 0, 3, 59, 59, 999)
      );

      const baseRequestPayload = {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        parametersId: [workerId],
        companiesId: [],
      };

      const fetchScheduleEntries = async (types: number[]) => {
        const response = await fetch(`${apiUrl}/ControlSchedule/List`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${externalJwt}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...baseRequestPayload,
            types,
          }),
        });

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

      setIsCalendarLoading(true);
      setCalendarError(null);

      try {
        const hourEntries = await fetchScheduleEntries([1]);
        let noteEntries: any[] = [];
        try {
          noteEntries = await fetchScheduleEntries([7]);
        } catch (notesError) {
          console.error("Error fetching worker notes:", notesError);
        }

        type MutableDailyAggregate = {
          totalHours: number;
          notes: Set<string>;
          companies: Record<
            string,
            {
              companyId?: string;
              name?: string;
              hours: number;
            }
          >;
        };

        const dailyAggregates: Record<string, MutableDailyAggregate> = {};

        const registerNote = (collector: Set<string>, value: unknown) => {
          if (!value) {
            return;
          }

          if (Array.isArray(value)) {
            value.forEach((item) => registerNote(collector, item));
            return;
          }

          if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length > 0) {
              collector.add(trimmed);
            }
          }
        };

        const ensureAggregate = (key: string) => {
          if (!dailyAggregates[key]) {
            dailyAggregates[key] = {
              totalHours: 0,
              notes: new Set<string>(),
              companies: {},
            };
          }
          return dailyAggregates[key];
        };

        hourEntries.forEach((entry: any) => {
          if (!entry) {
            return;
          }

          const date = entry?.dateTime ? new Date(entry.dateTime) : null;
          if (!date || Number.isNaN(date.getTime())) {
            return;
          }

          // Adjust timezone offset (records are stored 2 hours behind GMT+2)
          date.setHours(date.getHours() + 2);
          const key = formatDateKey(date);

          const aggregateForNotes = ensureAggregate(key);
          registerNote(aggregateForNotes.notes, entry?.notes);
          registerNote(aggregateForNotes.notes, entry?.note);
          registerNote(aggregateForNotes.notes, entry?.comment);
          registerNote(aggregateForNotes.notes, entry?.comments);
          registerNote(aggregateForNotes.notes, entry?.observation);
          registerNote(aggregateForNotes.notes, entry?.observations);
          registerNote(aggregateForNotes.notes, entry?.description);

          let hours = 0;
          const valueNum =
            entry?.value !== undefined ? parseFloat(entry.value) : NaN;
          if (!Number.isNaN(valueNum) && Number.isFinite(valueNum)) {
            hours = valueNum;
          }

          if (hours === 0 && Array.isArray(entry?.workShifts)) {
            const shiftsTotal = entry.workShifts.reduce(
              (acc: number, shift: any) => {
                if (!shift?.workStart || !shift?.workEnd) {
                  return acc;
                }
                const start = new Date(`2000-01-01T${shift.workStart}`);
                const end = new Date(`2000-01-01T${shift.workEnd}`);
                if (
                  Number.isNaN(start.getTime()) ||
                  Number.isNaN(end.getTime())
                ) {
                  return acc;
                }
                let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                if (diff < 0) {
                  diff = 0;
                }
                return acc + diff;
              },
              0
            );
            if (shiftsTotal > 0) {
              hours = shiftsTotal;
            }
          }

          if (Number.isNaN(hours) || !Number.isFinite(hours)) {
            hours = 0;
          }

          if (hours > 0) {
            const aggregate = ensureAggregate(key);
            aggregate.totalHours += hours;

            const companyId =
              typeof entry?.companyId === "string"
                ? entry.companyId
                : typeof entry?.company_id === "string"
                ? entry.company_id
                : typeof entry?.company?.id === "string"
                ? entry.company.id
                : typeof entry?.companyID === "string"
                ? entry.companyID
                : typeof entry?.companyIdContract === "string"
                ? entry.companyIdContract
                : undefined;

            const companyNameCandidate =
              typeof entry?.companyName === "string"
                ? entry.companyName
                : typeof entry?.company_name === "string"
                ? entry.company_name
                : typeof entry?.company?.name === "string"
                ? entry.company.name
                : typeof entry?.company === "string"
                ? entry.company
                : undefined;

            const resolvedCompanyName =
              companyNameCandidate?.trim() ||
              (companyId ? companyLookup[companyId] : undefined);

            const companyKey =
              companyId ?? resolvedCompanyName ?? `sin-empresa-${key}`;

            if (!aggregate.companies[companyKey]) {
              aggregate.companies[companyKey] = {
                companyId: companyId ?? undefined,
                name: resolvedCompanyName ?? undefined,
                hours: 0,
              };
            }

            const companyEntry = aggregate.companies[companyKey];
            if (!companyEntry.name || companyEntry.name.trim().length === 0) {
              companyEntry.name =
                resolvedCompanyName ??
                (companyEntry.companyId
                  ? companyLookup[companyEntry.companyId]
                  : undefined) ??
                companyEntry.companyId ??
                "Sin empresa";
            }
            companyEntry.hours += hours;
          }
        });

        noteEntries.forEach((entry: any) => {
          if (!entry) {
            return;
          }

          const date = entry?.dateTime
            ? new Date(entry.dateTime)
            : entry?.date
            ? new Date(entry.date)
            : null;

          if (!date || Number.isNaN(date.getTime())) {
            return;
          }

          date.setHours(date.getHours() + 2);
          const key = formatDateKey(date);

          const aggregate = ensureAggregate(key);
          registerNote(aggregate.notes, entry?.notes);
          registerNote(aggregate.notes, entry?.note);
          registerNote(aggregate.notes, entry?.comment);
          registerNote(aggregate.notes, entry?.comments);
          registerNote(aggregate.notes, entry?.observation);
          registerNote(aggregate.notes, entry?.observations);
          registerNote(aggregate.notes, entry?.description);
          registerNote(aggregate.notes, entry?.value);
        });

        const formattedTotals: Record<string, DayHoursSummary> = {};

        Object.entries(dailyAggregates).forEach(([key, aggregate]) => {
          if (
            aggregate.totalHours === 0 &&
            aggregate.notes.size === 0 &&
            Object.keys(aggregate.companies).length === 0
          ) {
            return;
          }

          const companies = Object.values(aggregate.companies).map(
            (company) => ({
              ...company,
              name:
                company.name?.trim() ||
                (company.companyId
                  ? companyLookup[company.companyId]
                  : undefined) ||
                (company.companyId ?? "Sin empresa"),
            })
          );

          companies.sort((a, b) =>
            (a.name ?? "").localeCompare(b.name ?? "", "es", {
              sensitivity: "base",
            })
          );

          formattedTotals[key] = {
            totalHours: aggregate.totalHours,
            notes: Array.from(aggregate.notes),
            companies,
          };
        });

        setCalendarHours(formattedTotals);
      } catch (error) {
        console.error("Error fetching worker hours:", error);
        setCalendarError("No se pudieron cargar las horas del trabajador.");
        setCalendarHours({});
      } finally {
        setIsCalendarLoading(false);
      }
    },
    [companyLookup, externalJwt, formatDateKey]
  );

  useEffect(() => {
    if (!selectedWorker) {
      setCalendarHours({});
      return;
    }

    void fetchWorkerHoursForMonth(selectedWorker.id, calendarMonth);
  }, [
    selectedWorker?.id,
    calendarMonth,
    fetchWorkerHoursForMonth,
    selectedWorker,
  ]);

  const handleCalendarMonthChange = useCallback((next: Date) => {
    setCalendarMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }, []);

  const handleCompanyGroupToggle = useCallback((companyKey: string) => {
    setExpandedCompanyInputs((prev) => ({
      ...prev,
      [companyKey]: !(prev[companyKey] ?? false),
    }));
  }, []);

  const handleContractInputChange = useCallback(
    (
      contractKey: string,
      field: keyof CompanyContractInputState,
      value: string
    ) => {
      setCalculationData((prev) => {
        const nextInputs = { ...prev.companyContractInputs };
        const existing = nextInputs[contractKey] ?? {
          hours: "",
          baseSalary: "",
        };

        nextInputs[contractKey] = {
          ...existing,
          [field]: value,
        };

        return {
          ...prev,
          companyContractInputs: nextInputs,
        };
      });

      if (field === "hours") {
        manualHoursOverrideRef.current.add(contractKey);
        const keysToPrune: string[] = [];
        autoFilledContractKeysRef.current.forEach((filledKeys, groupKey) => {
          if (filledKeys.delete(contractKey) && filledKeys.size === 0) {
            keysToPrune.push(groupKey);
          }
        });
        keysToPrune.forEach((key) => {
          autoFilledContractKeysRef.current.delete(key);
        });
      }
    },
    [setCalculationData]
  );

  const showCopyFeedback = (
    type: "email" | "phone",
    message: string,
    target?: string
  ) => {
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
    }
    setCopyFeedback({ type, message, target });
    copyFeedbackTimeoutRef.current = setTimeout(() => {
      setCopyFeedback(null);
      copyFeedbackTimeoutRef.current = null;
    }, 2000);
  };

  const handleEmailCopy = async (emailToCopy?: string | null) => {
    const targetEmail = emailToCopy ?? selectedWorker?.email ?? null;
    if (!targetEmail || targetEmail === "Email no disponible") {
      return;
    }

    const copied = await copyTextToClipboard(targetEmail);
    if (copied) {
      showCopyFeedback("email", "Email copiado", targetEmail);
    }
  };

  const handlePhoneCopy = async () => {
    if (!selectedWorker?.phone) {
      return;
    }

    const copied = await copyTextToClipboard(selectedWorker.phone);
    if (copied) {
      showCopyFeedback("phone", "Teléfono copiado", selectedWorker.phone);
    }
  };

  const fetchAllWorkers = async () => {
    setIsLoading(true);
    try {
      if (!externalJwt) {
        console.error("No JWT token available");
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL;
      if (!apiUrl) {
        console.error("API URL not configured");
        return;
      }

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

      const commonHeaders = {
        Authorization: `Bearer ${externalJwt}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      let companyLookupFromApi: Record<string, string> = {};
      let contractLookupFromApi: Record<
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
      let workerSecondaryEmailLookup: Record<string, string> = {};

      try {
        const enableUsersLookup =
          (import.meta as any).env?.VITE_ENABLE_USERS_LOOKUP === "true";
        if (enableUsersLookup) {
          const url = `${apiUrl}/User/GetAll`;
          const resp = await fetch(url, {
            method: "GET",
            headers: commonHeaders,
          });
          if (resp.ok) {
            const usersData = await resp.json();
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
              "No se pudieron cargar usuarios (omitiendo correo secundario)"
            );
          }
        }
      } catch (usersError) {
        console.warn("Error no crítico al cargar usuarios:", usersError);
      }

      try {
        const companiesResponse = await fetch(
          `${apiUrl}/parameter/list?types=1`,
          {
            method: "GET",
            headers: commonHeaders,
          }
        );

        if (!companiesResponse.ok) {
          throw new Error(
            `Error fetching companies: ${companiesResponse.status} - ${companiesResponse.statusText}`
          );
        }

        const companiesData = await companiesResponse.json();
        if (Array.isArray(companiesData)) {
          companyLookupFromApi = companiesData.reduce(
            (acc: Record<string, string>, company: any) => {
              const companyId = company.id || company.companyId || null;
              const companyName =
                pickString(
                  company.name,
                  company.commercialName,
                  company.businessName,
                  company.alias,
                  company.description
                ) || "";

              if (companyId && companyName) {
                acc[companyId] = companyName;
              }

              return acc;
            },
            {} as Record<string, string>
          );
        }

        setCompanyLookup(companyLookupFromApi);
      } catch (companyError) {
        console.error("Error fetching companies from API:", companyError);
      }

      try {
        const contractsResponse = await fetch(
          `${apiUrl}/parameter/list?types=7`,
          {
            method: "GET",
            headers: commonHeaders,
          }
        );

        if (!contractsResponse.ok) {
          throw new Error(
            `Error fetching contracts: ${contractsResponse.status} - ${contractsResponse.statusText}`
          );
        }

        const contractsData = await contractsResponse.json();
        if (Array.isArray(contractsData)) {
          contractLookupFromApi = contractsData.reduce(
            (acc: typeof contractLookupFromApi, contract: any) => {
              const relationId = pickString(
                contract.id,
                contract.parameterRelationId,
                contract.contractId,
                contract.relationId
              );

              if (!relationId) {
                return acc;
              }

              const companyId = pickString(
                contract.companyIdContract,
                contract.companyId,
                contract.company_id,
                contract.company
              );

              acc[relationId] = {
                companyId: companyId ?? undefined,
                companyName:
                  pickString(
                    contract.companyName,
                    contract.company_name,
                    contract.company,
                    companyId && companyLookupFromApi[companyId]
                  ) ?? undefined,
                relationType:
                  parseRelationType(
                    contract.type,
                    contract.contractType,
                    contract.typeId,
                    contract.type_id
                  ) ?? undefined,
                label:
                  pickString(
                    contract.name,
                    contract.contractName,
                    contract.title,
                    contract.alias
                  ) ?? undefined,
                description:
                  pickString(
                    contract.description,
                    contract.contractDescription,
                    contract.notes
                  ) ?? undefined,
                status:
                  pickString(
                    contract.status,
                    contract.state,
                    contract.contractStatus
                  ) ?? undefined,
                typeLabel:
                  pickString(
                    contract.contractTypeName,
                    contract.typeName,
                    contract.typeDescription,
                    contract.contractTypeLabel
                  ) ?? undefined,
                hourlyRate:
                  parseNumeric(
                    contract.amount ??
                      contract.hourlyRate ??
                      contract.rate ??
                      contract.price ??
                      contract.weeklyHours ??
                      contract.hoursPerWeek ??
                      contract.hours_week
                  ) ?? undefined,
                startDate:
                  pickString(
                    contract.startDate,
                    contract.contractStartDate,
                    contract.dateStart,
                    contract.beginDate
                  ) ?? undefined,
                endDate:
                  pickString(
                    contract.endDate,
                    contract.contractEndDate,
                    contract.dateEnd,
                    contract.finishDate
                  ) ?? undefined,
              };

              return acc;
            },
            {} as typeof contractLookupFromApi
          );
        }
      } catch (contractsError) {
        console.error("Error fetching contracts from API:", contractsError);
      }

      const workersResponse = await fetch(
        `${apiUrl}/parameter/list?types[0]=5&types[1]=4&situation=0`,
        {
          method: "GET",
          headers: commonHeaders,
        }
      );

      if (!workersResponse.ok) {
        throw new Error(
          `Error fetching workers: ${workersResponse.status} - ${workersResponse.statusText}`
        );
      }

      const workersData = await workersResponse.json();
      // Transform API data to match our Worker interface
      const transformedWorkers: Worker[] = workersData.map((apiWorker: any) => {
        const companyContractsMap: Record<string, WorkerCompanyContract[]> = {};
        const companyStatsMap: Record<string, WorkerCompanyStats> = {};
        const companyNamesSet = new Set<string>();

        if (Array.isArray(apiWorker.parameterRelations)) {
          apiWorker.parameterRelations.forEach(
            (relation: any, relationIndex: number) => {
              const relationIdentifier = pickString(
                relation?.parameterRelationId,
                relation?.relationId,
                relation?.id
              );
              const contractMeta = relationIdentifier
                ? contractLookupFromApi[relationIdentifier]
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

              const workerIdentifier =
                (typeof apiWorker?.id === "string" &&
                apiWorker.id.trim().length > 0
                  ? apiWorker.id
                  : undefined) ??
                (typeof apiWorker?.workerId === "string" &&
                apiWorker.workerId.trim().length > 0
                  ? apiWorker.workerId
                  : undefined);

              let candidateCompanyId = pickString(
                contractMeta?.companyId,
                relation?.companyId,
                relation?.company_id,
                relation?.companyIdContract
              );
              const relationCompanyPointer =
                typeof relation?.parameterRelationId === "string" &&
                relation.parameterRelationId.trim().length > 0
                  ? relation.parameterRelationId.trim()
                  : undefined;

              if (
                candidateCompanyId &&
                workerIdentifier &&
                candidateCompanyId === workerIdentifier
              ) {
                candidateCompanyId = null;
              }

              let relationCompanyId =
                candidateCompanyId ?? relationCompanyPointer ?? null;

              let resolvedCompanyName =
                (relationCompanyId &&
                  companyLookupFromApi[relationCompanyId]) ||
                contractMeta?.companyName ||
                pickString(
                  relation?.companyName,
                  relation?.name,
                  relation?.company,
                  relation?.commercialName,
                  relation?.businessName
                ) ||
                "Empresa sin nombre";

              if (
                relationCompanyId &&
                resolvedCompanyName === "Empresa sin nombre"
              ) {
                const existingEntry = Object.entries(companyStatsMap).find(
                  ([, stats]) => stats.companyId === relationCompanyId
                );
                if (existingEntry) {
                  resolvedCompanyName = existingEntry[0];
                }
              }

              if (
                resolvedCompanyName === "Empresa sin nombre" &&
                !relationCompanyId &&
                !(contractMeta?.companyName && contractMeta.companyName.trim())
              ) {
                return;
              }

              companyNamesSet.add(resolvedCompanyName);

              if (!companyStatsMap[resolvedCompanyName]) {
                companyStatsMap[resolvedCompanyName] = {
                  companyId:
                    relationCompanyId ??
                    (typeof contractMeta?.companyId === "string" &&
                    contractMeta.companyId.trim().length > 0
                      ? contractMeta.companyId
                      : undefined),
                  contractCount: 0,
                  assignmentCount: 0,
                };
              } else if (
                relationCompanyId &&
                !companyStatsMap[resolvedCompanyName].companyId
              ) {
                companyStatsMap[resolvedCompanyName].companyId =
                  relationCompanyId;
              }

              const companyStatsEntry = companyStatsMap[resolvedCompanyName];
              if (hasContract) {
                companyStatsEntry.contractCount += 1;
              } else {
                companyStatsEntry.assignmentCount += 1;
              }

              const fallbackRelationId = `${
                apiWorker?.id ?? "worker"
              }-relation-${relationIndex}`;
              const contractIdValue =
                relationIdentifier ||
                pickString(
                  relation?.contractId,
                  relation?.contractID,
                  relation?.idContract,
                  relation?.id
                ) ||
                fallbackRelationId;

              const hourlyRate =
                parseNumeric(
                  relation?.amount ??
                    relation?.hourlyRate ??
                    relation?.rate ??
                    relation?.price ??
                    relation?.hours ??
                    relation?.weeklyHours ??
                    relation?.hoursPerWeek ??
                    relation?.hours_week
                ) ?? contractMeta?.hourlyRate;

              const positionValue =
                pickString(
                  relation?.position,
                  relation?.jobTitle,
                  relation?.roleName,
                  relation?.contractName
                ) || contractMeta?.label;

              const descriptionValue =
                contractMeta?.description ??
                pickString(
                  relation?.contractDescription,
                  relation?.description,
                  relation?.notes
                );

              const statusValue =
                contractMeta?.status ??
                pickString(
                  relation?.status,
                  relation?.state,
                  relation?.contractStatus
                );

              const startDateValue =
                contractMeta?.startDate ??
                pickString(
                  relation?.startDate,
                  relation?.contractStartDate,
                  relation?.dateStart,
                  relation?.beginDate
                );

              const endDateValue =
                contractMeta?.endDate ??
                pickString(
                  relation?.endDate,
                  relation?.contractEndDate,
                  relation?.dateEnd,
                  relation?.finishDate
                );

              const typeLabel =
                contractMeta?.typeLabel ??
                pickString(
                  relation?.contractTypeName,
                  relation?.typeName,
                  relation?.typeDescription,
                  typeof relationType === "number"
                    ? relationType.toString()
                    : null
                );

              const labelValue =
                contractMeta?.label ??
                pickString(
                  relation?.contractTitle,
                  relation?.title,
                  relation?.alias,
                  positionValue,
                  descriptionValue
                );

              const contractEntry: WorkerCompanyContract = {
                id: contractIdValue,
                hasContract,
                relationType: relationType ?? undefined,
                typeLabel: typeLabel ?? undefined,
                hourlyRate: hourlyRate ?? undefined,
                companyId: relationCompanyId ?? undefined,
                companyName: resolvedCompanyName,
                label: labelValue ?? undefined,
                position: positionValue ?? undefined,
                description: descriptionValue ?? undefined,
                status: statusValue ?? undefined,
                startDate: startDateValue ?? undefined,
                endDate: endDateValue ?? undefined,
              };

              if (!companyContractsMap[resolvedCompanyName]) {
                companyContractsMap[resolvedCompanyName] = [];
              }

              companyContractsMap[resolvedCompanyName].push(contractEntry);
            }
          );
        }

        const uniqueCompanyNames = Array.from(companyNamesSet).sort((a, b) =>
          a.localeCompare(b, "es", { sensitivity: "base" })
        );

        // Resolve emails (primary from worker, secondary from users lookup via worker relation id)
        const primaryEmail =
          pickString(
            apiWorker.email,
            apiWorker.providerEmail,
            apiWorker.contactEmail,
            apiWorker.userEmail,
            apiWorker?.user?.email
          ) || "Email no disponible";
        const workerRelationKey = pickString(
          apiWorker.workerIdRelation,
          apiWorker.workerRelationId,
          apiWorker.workerId,
          apiWorker.id
        );
        const lookedUpSecondary = workerRelationKey
          ? workerSecondaryEmailLookup[workerRelationKey]
          : undefined;
        const normalizedPrimary =
          typeof primaryEmail === "string"
            ? primaryEmail.trim().toLowerCase()
            : "";
        const normalizedSecondary =
          typeof lookedUpSecondary === "string"
            ? lookedUpSecondary.trim().toLowerCase()
            : "";
        const secondaryEmailFinal =
          lookedUpSecondary &&
          normalizedSecondary &&
          normalizedSecondary !== normalizedPrimary
            ? lookedUpSecondary
            : null;

        return {
          id:
            apiWorker.id ||
            apiWorker.workerId ||
            Math.random().toString(36).substr(2, 9),
          name:
            pickString(
              apiWorker.name,
              apiWorker.fullName,
              apiWorker.commercialName
            ) || "Nombre no disponible",
          email: primaryEmail,
          secondaryEmail: secondaryEmailFinal,
          role:
            (pickString(
              apiWorker.role,
              apiWorker.userRole
            ) as Worker["role"]) || "tecnico",
          phone: pickString(
            apiWorker.phone,
            apiWorker.phoneNumber,
            apiWorker.contactPhone,
            apiWorker.providerPhone
          ),
          createdAt:
            pickString(apiWorker.createdAt, apiWorker.dateCreated) ||
            new Date().toISOString(),
          updatedAt: pickString(apiWorker.updatedAt, apiWorker.dateModified),
          avatarUrl: pickString(
            apiWorker.avatarUrl,
            apiWorker.profileImage,
            apiWorker?.user?.avatarUrl
          ),
          baseSalary: apiWorker.baseSalary || apiWorker.salary || 0,
          hourlyRate: apiWorker.hourlyRate || apiWorker.hourRate || 0,
          contractType: apiWorker.contractType || "full_time",
          department: pickString(apiWorker.department, apiWorker.area) || "",
          position: pickString(apiWorker.position, apiWorker.jobTitle) || "",
          companies: uniqueCompanyNames.length
            ? uniqueCompanyNames.join(", ")
            : null,
          companyNames: uniqueCompanyNames,
          companyContracts:
            Object.keys(companyContractsMap).length > 0
              ? companyContractsMap
              : undefined,
          companyStats:
            Object.keys(companyStatsMap).length > 0
              ? companyStatsMap
              : undefined,
        };
      });

      setAllWorkers(transformedWorkers);
      setWorkers(
        transformedWorkers.sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        )
      );
      setLastFetchTime(new Date());

      // Store in localStorage for offline access
      localStorage.setItem(
        "cached_workers",
        JSON.stringify({
          data: transformedWorkers,
          companyLookup: companyLookupFromApi,
          contractLookup: contractLookupFromApi,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error("Error fetching workers from API:", error);

      // Try to load from localStorage as fallback
      const cachedData = localStorage.getItem("cached_workers");
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const sortedData = (parsed.data || []).sort((a, b) =>
            a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          );

          const normalizedData = sortedData.map((worker: Worker) => {
            if (!worker.companyContracts) {
              return worker;
            }

            const normalizedContracts = Object.entries(
              worker.companyContracts
            ).reduce((acc, [companyName, contracts]) => {
              acc[companyName] = contracts.map((contract) => {
                if (
                  typeof contract.hourlyRate === "number" ||
                  typeof (contract as any).hoursPerWeek !== "number"
                ) {
                  return contract;
                }

                const legacyRate = (contract as any).hoursPerWeek;
                return {
                  ...contract,
                  hourlyRate: legacyRate,
                };
              });
              return acc;
            }, {} as Record<string, WorkerCompanyContract[]>);

            const statsFromContracts = Object.entries(
              normalizedContracts
            ).reduce((acc, [companyName, contracts]) => {
              const baseStats: WorkerCompanyStats = {
                companyId:
                  contracts.find((contract) => contract.companyId)?.companyId ??
                  worker.companyStats?.[companyName]?.companyId,
                contractCount: 0,
                assignmentCount: 0,
              };

              contracts.forEach((contract) => {
                if (contract.hasContract) {
                  baseStats.contractCount += 1;
                } else {
                  baseStats.assignmentCount += 1;
                }

                if (!baseStats.companyId && contract.companyId) {
                  baseStats.companyId = contract.companyId;
                }
              });

              acc[companyName] = baseStats;
              return acc;
            }, {} as Record<string, WorkerCompanyStats>);

            return {
              ...worker,
              companyContracts: normalizedContracts,
              companyStats:
                Object.keys(statsFromContracts).length > 0
                  ? statsFromContracts
                  : worker.companyStats,
            };
          });

          setAllWorkers(normalizedData);
          setWorkers(normalizedData);
          if (parsed.companyLookup) {
            setCompanyLookup(parsed.companyLookup);
          }
          if (parsed.timestamp) {
            setLastFetchTime(new Date(parsed.timestamp));
          }
        } catch (cacheError) {
          console.error("Error loading cached workers:", cacheError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWorkers = async () => {
    setIsRefreshing(true);
    await fetchAllWorkers();
    setIsRefreshing(false);
  };

  const handleCalculate = async () => {
    if (!selectedWorker) {
      alert("Por favor selecciona un trabajador");
      return;
    }

    setIsCalculating(true);
    try {
      calculateSalary();

      // Optionally save calculation to local storage
      // localStorage.setItem('lastCalculation', JSON.stringify(results));
    } catch (error) {
      console.error("Error calculating salary:", error);
      alert("Error al calcular el sueldo");
    } finally {
      setIsCalculating(false);
    }
  };

  const resetCalculation = () => {
    setAutoFillHoursMap({});
    setExpandedCompanyInputs({});
    autoFilledContractKeysRef.current = new Map();
    manualHoursOverrideRef.current.clear();
    setCalculationData({
      baseSalary: "",
      hoursWorked: "",
      overtimeHours: "",
      bonuses: "",
      deductions: "",
      period: "monthly",
      notes: "",
      companyContractInputs: {},
    });
    setOtherPayments(createEmptyOtherPaymentsState());
    setIsOtherPaymentsCollapsed(true);
    setSplitConfigs({});
    setIsSplitPaymentsCollapsed(true);
    setResults(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    const rounded = Math.round(hours * 100) / 100;
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(rounded);
  };

  const calendarCompanyTotals = useMemo(() => {
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

        const companyId = company.companyId;
        const normalizedName =
          typeof company.name === "string"
            ? company.name.trim().toLowerCase()
            : "";
        const nameKey = normalizedName || "sin-empresa";
        const key = companyId ?? `name:${nameKey}`;

        const existing = totals.get(key);
        if (existing) {
          existing.hours += company.hours;
        } else {
          totals.set(key, {
            companyId,
            companyName: company.name ?? undefined,
            normalizedName,
            hours: company.hours,
          });
        }
      });
    });

    return totals;
  }, [calendarHours]);

  const getCalendarHoursForCompany = useCallback(
    (companyId?: string, companyName?: string) => {
      if (calendarCompanyTotals.size === 0) {
        return 0;
      }

      if (companyId) {
        for (const entry of calendarCompanyTotals.values()) {
          if (entry.companyId && entry.companyId === companyId) {
            return entry.hours;
          }
        }
      }

      if (companyName) {
        const normalized = companyName.trim().toLowerCase();
        if (normalized.length > 0) {
          for (const entry of calendarCompanyTotals.values()) {
            if (entry.normalizedName === normalized) {
              return entry.hours;
            }
          }
        }
      }

      return 0;
    },
    [calendarCompanyTotals]
  );

  const companyContractStructure = useMemo(() => {
    if (!selectedWorker) {
      return {
        groups: [] as Array<{
          companyKey: string;
          companyId?: string;
          companyName: string;
          entries: Array<{
            contractKey: string;
            label: string;
            description?: string;
            hasContract: boolean;
          }>;
        }>,
        contractMap: new Map<
          string,
          {
            companyId?: string;
            companyName: string;
            contractLabel: string;
            hasContract: boolean;
            hourlyRate?: number;
          }
        >(),
      };
    }

    const groups: Array<{
      companyKey: string;
      companyId?: string;
      companyName: string;
      entries: Array<{
        contractKey: string;
        label: string;
        description?: string;
        hasContract: boolean;
      }>;
    }> = [];

    const contractMap = new Map<
      string,
      {
        companyId?: string;
        companyName: string;
        contractLabel: string;
        hasContract: boolean;
        hourlyRate?: number;
      }
    >();

    const companyContracts = selectedWorker.companyContracts ?? {};
    const companyStats = selectedWorker.companyStats ?? {};
    const knownCompanyNames = new Set<string>();

    if (Array.isArray(selectedWorker.companyNames)) {
      selectedWorker.companyNames.forEach((name) => {
        if (
          typeof name === "string" &&
          name.trim().length > 0 &&
          isValidCompanyName(name)
        ) {
          knownCompanyNames.add(name);
        }
      });
    }

    Object.keys(companyContracts).forEach((name) => {
      if (
        typeof name === "string" &&
        name.trim().length > 0 &&
        isValidCompanyName(name)
      ) {
        knownCompanyNames.add(name);
      }
    });

    Object.keys(companyStats).forEach((name) => {
      if (
        typeof name === "string" &&
        name.trim().length > 0 &&
        isValidCompanyName(name)
      ) {
        knownCompanyNames.add(name);
      }
    });

    // No fallback company; only include real companies with contratos (type:1)

    Array.from(knownCompanyNames)
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .forEach((companyName, index) => {
        const trimmedName = companyName?.trim() ?? "";
        // Consider only entries with hasContract=true (type:1)
        const contractsForCompany = (
          companyContracts[companyName] ?? []
        ).filter((c) => c.hasContract === true);
        const statsForCompany = companyStats[companyName];

        const preferredCompanyId = statsForCompany?.companyId;
        const resolvedCompanyName =
          (trimmedName.length > 0 ? trimmedName : undefined) ??
          (preferredCompanyId ? companyLookup[preferredCompanyId] : undefined);

        if (!isValidCompanyName(resolvedCompanyName)) {
          // Skip unnamed companies entirely
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
          // Skip companies without contratos; ignore type 0 assignments
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
  }, [companyLookup, selectedWorker]);

  useEffect(() => {
    setExpandedCompanyInputs((prev) => {
      const next = { ...prev };
      let changed = false;

      companyContractStructure.groups.forEach((group) => {
        if (next[group.companyKey] === undefined) {
          // Keep company sections collapsed by default
          next[group.companyKey] = false;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [companyContractStructure]);

  // Enable "Usar registro" por defecto en todas las empresas
  useEffect(() => {
    setAutoFillHoursMap((prev) => {
      // Si ya hay preferencia del usuario, no la sobreescribimos
      if (Object.keys(prev).length > 0) {
        return prev;
      }

      const next: Record<string, boolean> = {};
      companyContractStructure.groups.forEach((group) => {
        next[group.companyKey] = true;
        // Evitar que un override manual bloquee el autocompletado inicial
        group.entries.forEach((entry) =>
          manualHoursOverrideRef.current.delete(entry.contractKey)
        );
      });
      return next;
    });
  }, [companyContractStructure]);

  const manualContractAggregates = useMemo(() => {
    const contractMap = companyContractStructure.contractMap;
    const perCompany = new Map<
      string,
      {
        companyId?: string;
        companyName: string;
        hours: number;
        baseAmount: number;
      }
    >();

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

      // If base not filled, derive from hours * hourlyRate when both are valid
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
  }, [
    calculationData.companyContractInputs,
    companyContractStructure.contractMap,
  ]);

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
    [setCalculationData]
  );

  const applyAutoFillHoursForGroup = useCallback(
    (group: (typeof companyContractStructure)["groups"][number]) => {
      const calendarHours = getCalendarHoursForCompany(
        group.companyId,
        group.companyName
      );

      if (!calendarHours || calendarHours <= 0) {
        clearAutoFilledHoursForGroup(group.companyKey);
        return;
      }

      if (group.entries.length === 0) {
        clearAutoFilledHoursForGroup(group.companyKey);
        return;
      }

      const hoursPerEntry = calendarHours / group.entries.length;
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
    [
      clearAutoFilledHoursForGroup,
      getCalendarHoursForCompany,
      setCalculationData,
    ]
  );

  useEffect(() => {
    companyContractStructure.groups.forEach((group) => {
      if (autoFillHoursMap[group.companyKey]) {
        applyAutoFillHoursForGroup(group);
      }
    });
  }, [
    autoFillHoursMap,
    calendarHours,
    companyContractStructure,
    applyAutoFillHoursForGroup,
  ]);

  const handleAutoFillHoursToggle = useCallback(
    (
      group: (typeof companyContractStructure)["groups"][number],
      enabled: boolean
    ) => {
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
      applyAutoFillHoursForGroup,
      clearAutoFilledHoursForGroup,
      setAutoFillHoursMap,
    ]
  );

  const handleToggleAllAutoFill = useCallback(
    (enable: boolean) => {
      const groups = companyContractStructure.groups;
      if (enable) {
        // Enable for all groups without expanding them
        const nextMap: Record<string, boolean> = {};
        groups.forEach((group) => {
          nextMap[group.companyKey] = true;
          // Remove manual overrides for contracts in the group
          group.entries.forEach((entry) =>
            manualHoursOverrideRef.current.delete(entry.contractKey)
          );
          applyAutoFillHoursForGroup(group);
        });
        setAutoFillHoursMap(nextMap);
      } else {
        // Disable for all groups and clear auto-filled values
        setAutoFillHoursMap({});
        groups.forEach((group) => {
          clearAutoFilledHoursForGroup(group.companyKey);
        });
      }
    },
    [
      companyContractStructure.groups,
      applyAutoFillHoursForGroup,
      clearAutoFilledHoursForGroup,
      setAutoFillHoursMap,
    ]
  );

  const calculateSalary = () => {
    const overtimeHours = parseFloat(calculationData.overtimeHours) || 0;
    const baseBonuses = parseFloat(calculationData.bonuses) || 0;
    const baseDeductions = parseFloat(calculationData.deductions) || 0;
    const bonuses = baseBonuses + otherPaymentsTotals.additions;
    const deductions = baseDeductions + otherPaymentsTotals.subtractions;

    if (manualContractAggregates.hasEntries) {
      // Recalcular solo con empresas con nombre válido
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

      const companyCount = filteredCompanies.length;

      const companyBreakdown = filteredCompanies.map((company) => {
        const baseShare = company.baseAmount;
        const hoursShare = company.hours;

        let weight = 0;
        if (baseAmountTotal > 0) {
          weight = baseShare / baseAmountTotal;
        } else if (regularHours > 0) {
          weight = hoursShare / regularHours;
        } else if (companyCount > 0) {
          weight = 1 / companyCount;
        }

        const amount = baseShare + extras * weight;

        return {
          companyId: company.companyId,
          name: company.companyName,
          hours: hoursShare,
          amount,
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

      const totalHours = regularHours + overtimeHours;

      setResults({
        totalAmount,
        totalHours,
        regularHours,
        overtimeHours,
        companyBreakdown,
        usesCalendarHours: false,
      });
      return;
    }

    const baseSalary = parseFloat(calculationData.baseSalary) || 0;
    const hoursWorked = parseFloat(calculationData.hoursWorked) || 0;

    const regularPay = baseSalary;
    const overtimePay =
      overtimeHours * (baseSalary > 0 ? (baseSalary / 160) * 1.5 : 0);
    const totalAmount = regularPay + overtimePay + bonuses - deductions;

    const companyHoursMap = new Map<
      string,
      { companyId?: string; name?: string; hours: number }
    >();

    Object.values(calendarHours).forEach((daySummary) => {
      daySummary?.companies.forEach((company) => {
        if (!company || company.hours <= 0) {
          return;
        }

        // Resolve a usable name from id lookup or provided name
        const resolvedName =
          company.name?.trim() ||
          (company.companyId ? companyLookup[company.companyId] : undefined);
        if (!isValidCompanyName(resolvedName)) {
          // Ignore unnamed companies completely (do not count hours)
          return;
        }

        const mapKey = company.companyId ?? resolvedName;
        if (!companyHoursMap.has(mapKey)) {
          companyHoursMap.set(mapKey, {
            companyId: company.companyId ?? undefined,
            name: resolvedName,
            hours: 0,
          });
        }

        const entry = companyHoursMap.get(mapKey);
        if (!entry) {
          return;
        }

        entry.hours += company.hours;

        if (!entry.name || entry.name.trim().length === 0) {
          entry.name = resolvedName;
        }
      });
    });

    const companyHoursList = Array.from(companyHoursMap.values()).filter(
      (item) => item.hours > 0 && isValidCompanyName(item.name)
    );

    companyHoursList.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "es", {
        sensitivity: "base",
      })
    );

    const totalCompanyHours = companyHoursList.reduce(
      (acc, item) => acc + item.hours,
      0
    );

    const regularHours =
      totalCompanyHours > 0 ? totalCompanyHours : hoursWorked;
    const totalHours = regularHours + overtimeHours;
    const usesCalendarHours = totalCompanyHours > 0;

    const breakdownSource = usesCalendarHours ? companyHoursList : [];

    const companyBreakdown = breakdownSource.map((item) => ({
      ...item,
      amount: regularHours > 0 ? (item.hours / regularHours) * totalAmount : 0,
    }));

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
      regularHours,
      overtimeHours,
      companyBreakdown,
      usesCalendarHours,
    });
  };

  const expandedCompanyContracts =
    expandedCompany && selectedWorker?.companyContracts
      ? selectedWorker.companyContracts[expandedCompany] ?? []
      : [];

  const expandedContractsWithContract = expandedCompanyContracts.filter(
    (contract) => contract.hasContract
  );
  const expandedAssignmentsWithoutContract = expandedCompanyContracts.filter(
    (contract) => !contract.hasContract
  );

  const expandedCompanyStats = expandedCompany
    ? selectedWorker?.companyStats?.[expandedCompany]
    : undefined;
  const expandedAssignmentCount =
    expandedCompanyStats?.assignmentCount ??
    expandedAssignmentsWithoutContract.length;
  const expandedContractCount =
    expandedCompanyStats?.contractCount ?? expandedContractsWithContract.length;

  const formatMaybeDate = (value?: string | null) => {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return formatDate(value);
  };

  const canLinkEmail =
    selectedWorker?.email && selectedWorker.email !== "Email no disponible";
  const selectedWorkerTelHref = selectedWorker?.phone
    ? sanitizeTelHref(selectedWorker.phone)
    : null;
  const selectedWorkerWhatsappHref = selectedWorker?.phone
    ? buildWhatsAppLink(selectedWorker.phone)
    : null;

  const openEmailClient = () => {
    if (!selectedWorker?.email) {
      return;
    }
    window.location.href = `mailto:${selectedWorker.email}`;
  };

  const openPhoneDialer = () => {
    if (!selectedWorkerTelHref) {
      return;
    }
    window.location.href = selectedWorkerTelHref;
  };

  const openWhatsAppConversation = () => {
    if (!selectedWorkerWhatsappHref) {
      return;
    }
    window.open(selectedWorkerWhatsappHref, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Calculadora de Sueldos"
        description="Calcula sueldos individuales de trabajadores"
        actionLabel="Limpiar"
        onAction={resetCalculation}
        actionIcon={<Calculator size={18} />}
      />

      <div className="space-y-6">
        {/* Worker Selection and Input Form */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <User
                    size={20}
                    className="mr-2 text-blue-600 dark:text-blue-400"
                  />
                  Selección de Trabajador
                </h2>
                {lastFetchTime && (
                  <div className="inline-flex max-w-[255px] items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 px-3 py-1 text-sm text-gray-600 dark:text-gray-300">
                    Actualizado: {lastFetchTime.toLocaleString("es-ES")}
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
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Combined Search and Select */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  Cargando trabajadores...
                </span>
              </div>
            ) : (
              <WorkerSearchSelect
                workers={allWorkers}
                selectedWorkerId={selectedWorkerId}
                onWorkerSelect={setSelectedWorkerId}
                placeholder="Buscar y seleccionar trabajador..."
              />
            )}

            {/* Selected Worker Info */}
            {selectedWorker && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  {selectedWorker.name}
                </h3>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="space-y-1">
                      <div>
                        <span className="mr-1">Email:</span>
                        {selectedWorker.email ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleEmailCopy(selectedWorker.email);
                            }}
                            className="font-medium text-blue-800 dark:text-blue-200 underline hover:text-blue-900 dark:hover:text-blue-100"
                          >
                            {selectedWorker.email}
                          </button>
                        ) : (
                          "No disponible"
                        )}
                      </div>
                      {selectedWorker.secondaryEmail && (
                        <div>
                          <span className="mr-1">Email 2:</span>
                          <button
                            type="button"
                            onClick={() => {
                              void handleEmailCopy(
                                selectedWorker.secondaryEmail
                              );
                            }}
                            className="font-medium text-blue-800 dark:text-blue-200 underline hover:text-blue-900 dark:hover:text-blue-100"
                          >
                            {selectedWorker.secondaryEmail}
                          </button>
                        </div>
                      )}
                      {copyFeedback?.type === "email" && (
                        <span className="ml-2 text-xs text-green-600 dark:text-green-300 inline-block">
                          {copyFeedback.message}
                          {copyFeedback.target
                            ? ` (${copyFeedback.target})`
                            : ""}
                        </span>
                      )}
                    </div>
                    {canLinkEmail && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Mail size={14} />}
                        onClick={openEmailClient}
                      >
                        Enviar email
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="mr-1">Teléfono:</span>
                      {selectedWorker.phone ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handlePhoneCopy();
                          }}
                          className="font-medium text-blue-800 dark:text-blue-200 underline hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          {selectedWorker.phone}
                        </button>
                      ) : (
                        "No disponible"
                      )}
                      {copyFeedback?.type === "phone" && (
                        <span className="ml-2 text-xs text-green-600 dark:text-green-300">
                          {copyFeedback.message}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedWorkerTelHref && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          leftIcon={<Phone size={14} />}
                          onClick={openPhoneDialer}
                        >
                          Llamar
                        </Button>
                      )}
                      {selectedWorkerWhatsappHref && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          leftIcon={<MessageCircle size={14} />}
                          onClick={openWhatsAppConversation}
                        >
                          WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedWorker.companyNames &&
                  selectedWorker.companyNames.filter(
                    (name) =>
                      (selectedWorker.companyStats?.[name]?.contractCount ??
                        0) > 0
                  ).length > 0 && (
                    <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                      <span className="mr-1 text-blue-900 dark:text-blue-100">
                        Empresas asignadas:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {selectedWorker.companyNames
                          .filter(
                            (name) =>
                              isValidCompanyName(name) &&
                              (selectedWorker.companyStats?.[name]
                                ?.contractCount ?? 0) > 0
                          )
                          .map((companyName) => {
                            const isActive = expandedCompany === companyName;
                            const companyStats =
                              selectedWorker.companyStats?.[companyName];
                            const contractCount =
                              companyStats?.contractCount ?? 0;
                            const assignmentCount =
                              companyStats?.assignmentCount ?? 0;
                            const hasContracts = contractCount > 0;
                            const isAssignmentOnly =
                              !hasContracts && assignmentCount > 0;

                            const inactiveClass = isAssignmentOnly
                              ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-500/60 dark:bg-amber-900/30 dark:text-amber-200"
                              : "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60";
                            const activeClass = isAssignmentOnly
                              ? "border-amber-500 bg-amber-500 text-white shadow-sm dark:border-amber-400 dark:bg-amber-500/80"
                              : "border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-500 dark:bg-blue-500";

                            return (
                              <button
                                key={companyName}
                                type="button"
                                onClick={() =>
                                  setExpandedCompany((current) =>
                                    current === companyName ? null : companyName
                                  )
                                }
                                aria-pressed={isActive}
                                aria-expanded={isActive}
                                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 ${
                                  isActive ? activeClass : inactiveClass
                                }`}
                              >
                                <span>{companyName}</span>
                                {hasContracts && (
                                  <span
                                    title={
                                      contractCount === 1
                                        ? "1 contrato"
                                        : `${contractCount} contratos`
                                    }
                                    className={`ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                      isActive
                                        ? "bg-white/20 text-white"
                                        : "bg-blue-200 text-blue-800 dark:bg-blue-900/70 dark:text-blue-100"
                                    }`}
                                  >
                                    {contractCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>

                      {expandedCompany && (
                        <div className="mt-3 rounded-lg border border-blue-200 bg-white/70 p-3 text-sm text-blue-900 shadow-sm dark:border-blue-700/80 dark:bg-blue-900/20 dark:text-blue-100">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-semibold">
                              Contratos en {expandedCompany}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedCompany(null)}
                              className="text-xs text-blue-500 underline transition hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200"
                            >
                              Cerrar
                            </button>
                          </div>
                          {expandedCompanyContracts.length === 0 ? (
                            <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                              No hay información de contratos para esta empresa.
                            </div>
                          ) : (
                            <>
                              {expandedContractsWithContract.length > 0 && (
                                <div className="space-y-3">
                                  {expandedContractsWithContract.map(
                                    (contract, index) => {
                                      const startDateText = formatMaybeDate(
                                        contract.startDate
                                      );
                                      const endDateText = formatMaybeDate(
                                        contract.endDate
                                      );
                                      const contractLabel = `Contrato ${
                                        index + 1
                                      }`;
                                      const contractTypeText =
                                        contract.position || contract.label;

                                      return (
                                        <div
                                          key={`${expandedCompany}-${contract.id}`}
                                          className="rounded-md border border-blue-100 bg-white/80 p-3 text-xs shadow-sm dark:border-blue-700/60 dark:bg-blue-900/40"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold">
                                              {contractLabel}
                                            </span>
                                            {contract.status && (
                                              <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:bg-blue-800/70 dark:text-blue-200">
                                                {contract.status}
                                              </span>
                                            )}
                                          </div>
                                          <div className="mt-2 space-y-1 text-blue-800 dark:text-blue-100">
                                            <div>
                                              <span className="font-medium">
                                                Precio por hora:
                                              </span>{" "}
                                              {typeof contract.hourlyRate ===
                                              "number"
                                                ? formatCurrency(
                                                    contract.hourlyRate
                                                  )
                                                : "No especificado"}
                                            </div>
                                            {contractTypeText && (
                                              <div>
                                                <span className="font-medium">
                                                  Contrato:
                                                </span>{" "}
                                                {contractTypeText}
                                              </div>
                                            )}
                                            {startDateText && (
                                              <div>
                                                <span className="font-medium">
                                                  Inicio:
                                                </span>{" "}
                                                {startDateText}
                                              </div>
                                            )}
                                            {endDateText && (
                                              <div>
                                                <span className="font-medium">
                                                  Fin:
                                                </span>{" "}
                                                {endDateText}
                                              </div>
                                            )}
                                            {contract.description && (
                                              <div>
                                                <span className="font-medium">
                                                  Descripción:
                                                </span>{" "}
                                                {contract.description}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}

                              {expandedContractCount === 0 &&
                                expandedAssignmentCount > 0 && (
                                  <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                                    Esta empresa está asignada pero no tiene
                                    contrato asociado.
                                  </div>
                                )}

                              {expandedContractCount > 0 &&
                                expandedAssignmentCount > 0 && (
                                  <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                                    Además, hay {expandedAssignmentCount}{" "}
                                    {expandedAssignmentCount === 1
                                      ? "asignación"
                                      : "asignaciones"}{" "}
                                    sin contrato asociado.
                                  </div>
                                )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {selectedWorker.department && (
                  <p>Departamento: {selectedWorker.department}</p>
                )}
                {selectedWorker.position && (
                  <p>Posición: {selectedWorker.position}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 items-start lg:grid-cols-2 lg:[&>*]:min-w-0">
          {/* Calculation Form */}
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
                  onClick={() => setIsCalcDataCollapsed((v) => !v)}
                  className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
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
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
                    <div className="min-w-0 flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setIsContractInputsOpen((current) => !current)
                        }
                        className="flex items-center justify-center mt-3 rounded-full border border-gray-300 p-0.5 text-gray-500 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                        aria-label={
                          isContractInputsOpen ? "Contraer" : "Desplegar"
                        }
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
                            ? `Total horas: ${formatHours(
                                manualContractAggregates.totalHours
                              )}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const groups = companyContractStructure.groups;
                      const allEnabled =
                        groups.length > 0 &&
                        groups.every((g) =>
                          Boolean(autoFillHoursMap[g.companyKey])
                        );
                      return (
                        <label
                          className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-gray-700 dark:text-gray-200"
                          title={
                            allEnabled
                              ? "Desactivar 'Usar registro' en todas"
                              : "Activar 'Usar registro' en todas"
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            aria-label="Usar registro en todas"
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
                        ? `Total: ${formatCurrency(
                            manualContractAggregates.totalBaseAmount
                          )}`
                        : ""}
                    </p>
                  </div>
                  {isContractInputsOpen && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      {companyContractStructure.groups.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                          No hay empresas asignadas al trabajador. Añade las
                          horas y sueldos manualmente cuando estén disponibles.
                        </div>
                      ) : (
                        <div className="space-y-4 px-4 py-5">
                          {companyContractStructure.groups
                            .filter((g) => isValidCompanyName(g.companyName))
                            .map((group) => {
                              const summary =
                                manualContractAggregates.companyList.find(
                                  (company) =>
                                    (group.companyId &&
                                      company.companyId === group.companyId) ||
                                    company.companyName === group.companyName
                                );

                              const totalCompanyHours = summary?.hours ?? 0;
                              const totalCompanyBase = summary?.baseAmount ?? 0;
                              const isAutoFillEnabled = Boolean(
                                autoFillHoursMap[group.companyKey]
                              );
                              const calendarHoursForGroup =
                                getCalendarHoursForCompany(
                                  group.companyId,
                                  group.companyName
                                );
                              const isExpanded =
                                expandedCompanyInputs[group.companyKey] ??
                                false;

                              return (
                                <div
                                  key={group.companyKey}
                                  className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                                >
                                  <div
                                    className="border-b border-gray-200 px-4 py-3 dark:border-gray-700 cursor-pointer"
                                    onClick={() =>
                                      handleCompanyGroupToggle(group.companyKey)
                                    }
                                  >
                                    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,160px)] items-center gap-4">
                                      <div className="flex items-start gap-2 min-w-[220px]">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCompanyGroupToggle(
                                              group.companyKey
                                            );
                                          }}
                                          className="flex items-center justify-center rounded-full border border-gray-300 p-1 text-gray-500 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                          aria-expanded={isExpanded}
                                          aria-label={
                                            isExpanded
                                              ? "Contraer empresa"
                                              : "Expandir empresa"
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
                                          {(() => {
                                            const isHoursDifferent =
                                              calendarHoursForGroup > 0 &&
                                              Math.abs(
                                                totalCompanyHours -
                                                  calendarHoursForGroup
                                              ) > 0.001;
                                            const hoursClass = isHoursDifferent
                                              ? "text-amber-700 dark:text-amber-300"
                                              : "text-gray-600 dark:text-gray-300";
                                            return (
                                              <p
                                                className={`text-xs font-medium mt-0.5 ${hoursClass}`}
                                              >
                                                {formatHours(totalCompanyHours)}{" "}
                                                Horas
                                              </p>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                      <div
                                        className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 min-w-[180px] justify-center"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={isAutoFillEnabled}
                                            onChange={(event) =>
                                              handleAutoFillHoursToggle(
                                                group,
                                                event.target.checked
                                              )
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <span>Usar registro</span>
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
                                        const contractInput = calculationData
                                          .companyContractInputs[
                                          entry.contractKey
                                        ] ?? {
                                          hours: "",
                                          baseSalary: "",
                                        };
                                        const contractMeta =
                                          companyContractStructure.contractMap.get(
                                            entry.contractKey
                                          );

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
                                                  (typeof contractMeta?.hourlyRate ===
                                                  "number"
                                                    ? String(
                                                        contractMeta.hourlyRate
                                                      )
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

                <Input
                  label="Notas"
                  value={calculationData.notes}
                  onChange={(e) =>
                    setCalculationData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Notas adicionales..."
                  fullWidth
                />

                <Button
                  onClick={handleCalculate}
                  disabled={
                    !selectedWorker ||
                    (!manualContractAggregates.hasEntries &&
                      (!calculationData.baseSalary ||
                        calculationData.baseSalary.trim().length === 0))
                  }
                  isLoading={isCalculating}
                  leftIcon={<Calculator size={18} />}
                  className="w-full"
                >
                  Calcular Sueldo
                </Button>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <Clock
                    size={20}
                    className="mr-2 text-blue-600 dark:text-blue-400"
                  />
                  Calendario de horas
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCalendarCollapsed((v) => !v)}
                  className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                >
                  <ChevronDown
                    size={18}
                    className={`text-gray-600 dark:text-gray-300 transition-transform ${
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
                    worker={selectedWorker}
                    selectedMonth={calendarMonth}
                    hoursByDate={calendarHours}
                    onMonthChange={handleCalendarMonthChange}
                    isLoading={isCalendarLoading}
                    hideTitle
                  />
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Other Operations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Calculator
                  size={20}
                  className="mr-2 text-yellow-600 dark:text-yellow-400"
                />
                Otras operaciones
              </h2>
              <button
                type="button"
                onClick={() => setIsOtherOpsCollapsed((v) => !v)}
                className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
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
            <CardContent>
              {!results ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Calcula primero para ver empresas a agrupar.
                </p>
              ) : (
                <div className="space-y-4">
                  {companyAssignmentWarning && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/60 dark:bg-amber-900/30 dark:text-amber-100">
                      <AlertTriangle size={16} className="mt-0.5" />
                      <div className="flex-1 leading-snug">
                        {companyAssignmentWarning}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompanyAssignmentWarning(null)}
                        className="rounded-md p-1 text-amber-700 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 dark:text-amber-100 dark:hover:bg-amber-800/40 dark:focus:ring-offset-gray-900"
                        aria-label="Cerrar aviso"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {companyAssignments.size > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Las empresas en gris ya pertenecen a otro grupo. Quítalas
                      antes de asignarlas a uno nuevo.
                    </p>
                  )}

                  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 shadow-sm">
                    <div
                      className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 py-4 ${
                        isGroupManagerCollapsed
                          ? ""
                          : "border-b border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          Agrupar Pagos
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Agrupa pagos de distintas empresas bajo un mismo
                          nombre y asigna una forma de cobro.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                            <span className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-300" />
                            {availableCompanies.length} empresas detectadas
                          </span>
                          {companyGroups.length > 0 && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                              <span className="h-2 w-2 rounded-full bg-indigo-400 dark:bg-indigo-300" />
                              {companyGroups.length} grupos configurados
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={addEmptyGroup}>
                          Crear grupo
                        </Button>
                        <button
                          type="button"
                          onClick={() =>
                            setIsGroupManagerCollapsed((prev) => !prev)
                          }
                          className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                          aria-label="Mostrar u ocultar agrupaciones"
                        >
                          <ChevronDown
                            size={18}
                            className={`text-gray-600 dark:text-gray-300 transition-transform ${
                              isGroupManagerCollapsed ? "" : "rotate-180"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    {!isGroupManagerCollapsed && (
                      <div className="px-4 py-4 space-y-6">
                        <div className="grid gap-3 md:grid-cols-2">
                          {companyGroups.length > 0 &&
                            companyGroups.map((g) => (
                              <div
                                key={g.id}
                                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 shadow-sm"
                              >
                                <div
                                  className="flex items-start justify-between gap-3 px-3 py-3"
                                  style={{ borderTop: `4px solid ${g.color}` }}
                                >
                                  <div className="flex flex-col gap-1 flex-1">
                                    <input
                                      value={g.name}
                                      onChange={(e) =>
                                        setCompanyGroups((prev) =>
                                          prev.map((x) =>
                                            x.id === g.id
                                              ? { ...x, name: e.target.value }
                                              : x
                                          )
                                        )
                                      }
                                      className="bg-transparent font-semibold text-gray-900 dark:text-gray-100 outline-none focus:ring-0"
                                    />
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                      <span className="inline-flex items-center gap-1">
                                        <span
                                          className="h-2 w-2 rounded-full"
                                          style={{ backgroundColor: g.color }}
                                        />
                                        {g.companies.length} empresas en el
                                        grupo
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={g.color}
                                      onChange={(e) =>
                                        setCompanyGroups((prev) =>
                                          prev.map((x) =>
                                            x.id === g.id
                                              ? { ...x, color: e.target.value }
                                              : x
                                          )
                                        )
                                      }
                                      title="Color del grupo"
                                      className="h-8 w-8 cursor-pointer rounded-md border border-gray-200 bg-transparent dark:border-gray-700"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeGroup(g.id)}
                                    >
                                      Eliminar
                                    </Button>
                                  </div>
                                </div>
                                <div className="px-3 pb-3">
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="text-gray-600 dark:text-gray-300">
                                      Forma de pago
                                    </span>
                                    <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCompanyGroups((prev) =>
                                            prev.map((x) =>
                                              x.id === g.id
                                                ? {
                                                    ...x,
                                                    paymentMethod: "bank",
                                                  }
                                                : x
                                            )
                                          )
                                        }
                                        className={`px-2 py-1 flex items-center gap-1 ${
                                          g.paymentMethod !== "cash"
                                            ? "bg-blue-600 text-white"
                                            : "bg-transparent text-gray-700 dark:text-gray-300"
                                        }`}
                                        title="Banco"
                                      >
                                        <Landmark size={14} /> Banco
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCompanyGroups((prev) =>
                                            prev.map((x) =>
                                              x.id === g.id
                                                ? {
                                                    ...x,
                                                    paymentMethod: "cash",
                                                  }
                                                : x
                                            )
                                          )
                                        }
                                        className={`px-2 py-1 flex items-center gap-1 ${
                                          g.paymentMethod === "cash"
                                            ? "bg-blue-600 text-white"
                                            : "bg-transparent text-gray-700 dark:text-gray-300"
                                        }`}
                                        title="Efectivo"
                                      >
                                        <Banknote size={14} /> Efectivo
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {availableCompanies.map((c) => {
                                      const assignedGroup =
                                        companyAssignments.get(c.key);
                                      const isInCurrentGroup =
                                        g.companies.includes(c.key);
                                      const isAssignedElsewhere = Boolean(
                                        assignedGroup &&
                                          assignedGroup.id !== g.id
                                      );
                                      const buttonClasses = `px-2.5 py-1 rounded-full border text-xs transition ${
                                        isInCurrentGroup
                                          ? "border-transparent text-white"
                                          : "border-gray-300 text-gray-700 dark:text-gray-300"
                                      } ${
                                        isAssignedElsewhere && !isInCurrentGroup
                                          ? "cursor-not-allowed opacity-60 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                                          : ""
                                      }`;

                                      return (
                                        <button
                                          type="button"
                                          key={`${g.id}-${c.key}`}
                                          onClick={() =>
                                            toggleCompanyInGroup(g.id, c.key)
                                          }
                                          disabled={isAssignedElsewhere}
                                          className={buttonClasses}
                                          style={
                                            isInCurrentGroup
                                              ? { backgroundColor: g.color }
                                              : undefined
                                          }
                                          title={
                                            isAssignedElsewhere && assignedGroup
                                              ? `Ya está en "${assignedGroup.name}"`
                                              : isInCurrentGroup
                                              ? "Quitar del grupo"
                                              : "Añadir al grupo"
                                          }
                                        >
                                          <span>{c.name}</span>
                                          {isAssignedElsewhere &&
                                            assignedGroup && (
                                              <span className="ml-1 text-[10px] text-gray-500 dark:text-gray-400">
                                                ({assignedGroup.name})
                                              </span>
                                            )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                        {groupedBreakdown && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              Vista previa de agrupaciones
                            </h4>
                            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                              {groupedBreakdown.groups.map((g) => (
                                <div
                                  key={g.id}
                                  className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                                >
                                  <div
                                    className="px-3 py-2 text-white font-semibold"
                                    style={{ backgroundColor: g.color }}
                                  >
                                    <input
                                      value={g.name}
                                      onChange={(e) =>
                                        setCompanyGroups((prev) =>
                                          prev.map((x) =>
                                            x.id === g.id
                                              ? { ...x, name: e.target.value }
                                              : x
                                          )
                                        )
                                      }
                                      className="w-full bg-transparent text-white placeholder:text-white/70 outline-none focus:ring-0"
                                      aria-label="Nombre del grupo"
                                    />
                                  </div>
                                  <div className="p-3 space-y-2">
                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                      {g.companies.join(", ")}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Horas</span>
                                      <span className="font-medium">
                                        {formatHours(g.hours)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Importe</span>
                                      <span className="font-semibold">
                                        {formatCurrency(g.amount)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {groupedBreakdown.remaining.map((c, idx) => (
                                <div
                                  key={`r-${idx}`}
                                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
                                >
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                                    {c.name}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between text-sm">
                                    <span>Horas</span>
                                    <span className="font-medium">
                                      {formatHours(c.hours)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span>Importe</span>
                                    <span className="font-semibold">
                                      {formatCurrency(c.amount)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 shadow-sm">
                    <div
                      className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 py-4 ${
                        isOtherPaymentsCollapsed
                          ? ""
                          : "border-b border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          Otros pagos
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Añade suplementos, bonificaciones y ajustes negativos
                          como descuentos o deudas.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {otherPaymentsTotals.additions > 0 && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                              <span className="h-2 w-2 rounded-full bg-emerald-400 dark:bg-emerald-300" />
                              +{formatCurrency(otherPaymentsTotals.additions)}{" "}
                              extras
                            </span>
                          )}
                          {otherPaymentsTotals.subtractions > 0 && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                              <span className="h-2 w-2 rounded-full bg-rose-400 dark:bg-rose-300" />
                              {formatCurrency(
                                -otherPaymentsTotals.subtractions
                              )}{" "}
                              ajustes
                            </span>
                          )}
                          {otherPaymentsTotals.additions === 0 &&
                            otherPaymentsTotals.subtractions === 0 && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-500 dark:bg-gray-800/40 dark:text-gray-300">
                                <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                                Sin ajustes registrados
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setIsOtherPaymentsCollapsed((prev) => !prev)
                          }
                          className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                          aria-label="Mostrar u ocultar otros pagos"
                        >
                          <ChevronDown
                            size={18}
                            className={`text-gray-600 dark:text-gray-300 transition-transform ${
                              isOtherPaymentsCollapsed ? "" : "rotate-180"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    {!isOtherPaymentsCollapsed && (
                      <div className="px-4 py-4 space-y-6">
                        {OTHER_PAYMENTS_CATEGORY_ORDER.map((category) => {
                          const items = otherPayments[category];
                          const categoryTotal = items.reduce((acc, item) => {
                            const amount = parseFloat(
                              item.amount.replace(",", ".")
                            );
                            if (!Number.isFinite(amount)) return acc;
                            return acc + amount;
                          }, 0);
                          const isCredit = CREDIT_CATEGORIES.includes(category);

                          return (
                            <div key={category} className="space-y-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {OTHER_PAYMENTS_LABELS[category]}
                                  </h5>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {isCredit
                                      ? "Suma al cálculo final"
                                      : "Se descuenta del cálculo final"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {items.length > 0 && (
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                      Total:{" "}
                                      {formatCurrency(
                                        isCredit
                                          ? categoryTotal
                                          : -categoryTotal
                                      )}
                                    </span>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addOtherPayment(category)}
                                  >
                                    Añadir
                                  </Button>
                                </div>
                              </div>
                              {items.length === 0 ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  No hay registros en esta categoría.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 md:flex-row md:items-center md:gap-3"
                                    >
                                      <input
                                        value={item.label}
                                        onChange={(e) =>
                                          updateOtherPayment(
                                            category,
                                            item.id,
                                            "label",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Concepto"
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                                      />
                                      <div className="flex items-center gap-2 md:ml-auto">
                                        <input
                                          type="number"
                                          inputMode="decimal"
                                          step="0.01"
                                          value={item.amount}
                                          onChange={(e) =>
                                            updateOtherPayment(
                                              category,
                                              item.id,
                                              "amount",
                                              e.target.value
                                            )
                                          }
                                          placeholder="0,00"
                                          className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeOtherPayment(
                                              category,
                                              item.id
                                            )
                                          }
                                          className="inline-flex items-center justify-center rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/20"
                                          title="Eliminar movimiento"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {renderSplitPaymentsSection()}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Results */}
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
                onClick={() => setIsResultsCollapsed((v) => !v)}
                className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
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
            <CardContent>
              {!results ? (
                <div className="text-center py-8">
                  <Calculator
                    size={48}
                    className="mx-auto text-gray-400 mb-4"
                  />
                  <p className="text-gray-500 dark:text-gray-400">
                    Selecciona un trabajador y completa los datos para ver los
                    resultados
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedWorker && (
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedWorker.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Cálculo{" "}
                        {calculationData.period === "monthly"
                          ? "mensual"
                          : calculationData.period === "weekly"
                          ? "semanal"
                          : "diario"}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                      <div>
                        <span className="font-medium text-green-800 dark:text-green-300">
                          Importe calculado
                        </span>
                      </div>
                      <span className="text-xl font-bold text-green-900 dark:text-green-100">
                        {formatCurrency(results.totalAmount)}
                      </span>
                    </div>

                    <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Detalle por empresa
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {results.usesCalendarHours
                            ? "Horas provenientes del calendario del mes"
                            : "Horas distribuidas manualmente por contrato"}
                        </span>
                      </div>

                      {results.companyBreakdown.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No hay horas registradas para este período.
                        </p>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-4 gap-2 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            <span>Empresa</span>
                            <span className="text-right">Horas</span>
                            <span className="text-center">Forma</span>
                            <span className="text-right">Importe</span>
                          </div>
                          {(() => {
                            const haveGroups =
                              companyGroups.length > 0 && groupedBreakdown;
                            const rows = haveGroups
                              ? [
                                  ...groupedBreakdown!.groups.map((g) => ({
                                    id: g.id,
                                    name: g.name,
                                    hours: g.hours,
                                    amount: g.amount,
                                    method: g.paymentMethod,
                                    isGroup: true,
                                    color: g.color,
                                    items: g.items,
                                  })),
                                  ...groupedBreakdown!.remaining.map((r) => ({
                                    name: r.name,
                                    hours: r.hours,
                                    amount: r.amount,
                                    method: undefined,
                                    isGroup: false,
                                  })),
                                ]
                              : results.companyBreakdown
                                  .filter((c) => isValidCompanyName(c.name))
                                  .map((c) => ({
                                    name: c.name ?? "",
                                    hours: c.hours,
                                    amount: c.amount,
                                    method: undefined,
                                    isGroup: false,
                                  }));
                            return rows.flatMap((company, idx) => {
                              const isGroup = company.isGroup;
                              const groupId = (company as any).id as
                                | string
                                | undefined;
                              const expanded = groupId
                                ? expandedResultGroups[groupId]
                                : false;
                              const mainRow = (
                                <div
                                  key={`row-${idx}-${company.name}`}
                                  className={`grid grid-cols-4 gap-2 border-t border-gray-100 px-3 py-2 text-sm dark:border-gray-700/70 ${
                                    isGroup
                                      ? "bg-gray-50/60 dark:bg-gray-800/40"
                                      : ""
                                  }`}
                                >
                                  <span className="text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                    {isGroup ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          groupId &&
                                          setExpandedResultGroups((p) => ({
                                            ...p,
                                            [groupId]: !p[groupId],
                                          }))
                                        }
                                        className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-200 hover:text-gray-900"
                                        title={
                                          expanded ? "Contraer" : "Desplegar"
                                        }
                                      >
                                        {expanded ? (
                                          <ChevronUp size={16} />
                                        ) : (
                                          <ChevronDown size={16} />
                                        )}
                                        <span className="font-semibold">
                                          {company.name}
                                        </span>
                                      </button>
                                    ) : (
                                      <span>{company.name}</span>
                                    )}
                                  </span>
                                  <span className="text-right text-gray-700 dark:text-gray-200">
                                    {formatHours(company.hours)}
                                  </span>
                                  <span className="text-center">
                                    {company.method === "bank" ? (
                                      <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                                        <Landmark size={16} /> Banco
                                      </span>
                                    ) : company.method === "cash" ? (
                                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                        <Banknote size={16} /> Efectivo
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </span>
                                  <span className="text-right font-medium text-gray-900 dark:text-gray-100">
                                    {formatCurrency(company.amount)}
                                  </span>
                                </div>
                              );

                              if (!isGroup || !expanded) {
                                return [mainRow];
                              }

                              // Detail rows for group members
                              const detail = (
                                <div
                                  key={`row-${idx}-${company.name}-detail`}
                                  className="border-t border-gray-100 dark:border-gray-700/70 px-3 py-2"
                                  style={{
                                    background: `${
                                      (company as any).color ?? "#2563eb"
                                    }10`,
                                  }}
                                >
                                  <div
                                    className="pl-3 border-l-4"
                                    style={{
                                      borderLeftColor:
                                        (company as any).color || "#2563eb",
                                    }}
                                  >
                                    <div className="grid grid-cols-4 gap-2 text-sm">
                                      <span className="font-medium text-gray-700 dark:text-gray-200">
                                        Empresa
                                      </span>
                                      <span className="text-right font-medium text-gray-700 dark:text-gray-200">
                                        Horas
                                      </span>
                                      <span></span>
                                      <span className="text-right font-medium text-gray-700 dark:text-gray-200">
                                        Importe
                                      </span>
                                      {(company as any).items?.map(
                                        (it: any, i: number) => (
                                          <React.Fragment
                                            key={`it-${i}-${it.name}`}
                                          >
                                            <span className="text-gray-700 dark:text-gray-200">
                                              {it.name}
                                            </span>
                                            <span className="text-right text-gray-700 dark:text-gray-200">
                                              {formatHours(it.hours)}
                                            </span>
                                            <span></span>
                                            <span className="text-right text-gray-900 dark:text-gray-100">
                                              {formatCurrency(it.amount)}
                                            </span>
                                          </React.Fragment>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                              return [mainRow, detail];
                            });
                          })()}
                          <div className="grid grid-cols-4 gap-2 bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                            <span>Total</span>
                            <span className="text-right">
                              {formatHours(results.totalHours)}
                            </span>
                            <span />
                            <span className="text-right">
                              {formatCurrency(results.totalAmount)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                      <h4 className="mb-3 font-medium text-gray-900 dark:text-white">
                        Resumen
                      </h4>
                      <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Horas regulares:
                          </span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {formatHours(results.regularHours)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Horas extra:
                          </span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {formatHours(results.overtimeHours)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Horas totales:
                          </span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {formatHours(results.totalHours)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Importe total:
                          </span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(results.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Período:
                          </span>
                          <p className="font-medium capitalize text-gray-900 dark:text-gray-100">
                            {calculationData.period === "monthly"
                              ? "Mensual"
                              : calculationData.period === "weekly"
                              ? "Semanal"
                              : "Diario"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Fecha:
                          </span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {formatDate(new Date().toISOString())}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      {results && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                leftIcon={<FileText size={16} />}
                onClick={() => {
                  ensureSeedTemplates();
                  setSelectedTemplateId((prev) => {
                    if (prev) return prev;
                    return templates[0]?.id ?? null;
                  });
                  setShowTemplateModal(true);
                }}
              >
                Exportar PDF
              </Button>

              <Button
                variant="outline"
                leftIcon={<Calculator size={16} />}
                onClick={() => {
                  // TODO: Save calculation
                  alert("Función de guardar cálculo próximamente");
                }}
              >
                Guardar Cálculo
              </Button>

              <Button variant="outline" onClick={resetCalculation}>
                Nuevo Cálculo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={showTemplateModal}
        title="Seleccionar plantilla para PDF"
        description={
          <div className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Generando plantillas de prueba...
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 rounded-md border border-gray-200 dark:border-gray-700">
                {templates.map((tpl) => (
                  <label
                    key={tpl.id}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="radio"
                      name="tpl"
                      checked={selectedTemplateId === tpl.id}
                      onChange={() => setSelectedTemplateId(tpl.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded"
                          style={{ backgroundColor: tpl.accentColor }}
                        />
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {tpl.name}
                        </span>
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {tpl.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {tpl.pageSize} · {tpl.orientation}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        }
        confirmLabel="Generar PDF"
        cancelLabel="Cancelar"
        onCancel={() => setShowTemplateModal(false)}
        onConfirm={() => {
          if (selectedTemplateId) {
            setActiveTemplate(selectedTemplateId);
          }
          const template = templates.find(
            (tpl) => tpl.id === selectedTemplateId
          );
          exportResultsToPdf(template);
          setShowTemplateModal(false);
          alert("PDF generado. Revisa tus descargas.");
        }}
      />
    </div>
  );
};
