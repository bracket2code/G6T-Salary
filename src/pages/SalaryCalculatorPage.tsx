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
  DollarSign,
  FileText,
  RefreshCw,
  ChevronDown,
  X,
  Check,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  Worker,
  SalaryCalculation,
  WorkerCompanyContract,
  WorkerCompanyStats,
} from "../types/salary";
import { formatDate } from "../lib/utils";
import { useAuthStore } from "../store/authStore";
import {
  WorkerHoursCalendar,
  type DayHoursSummary,
} from "../components/WorkerHoursCalendar";

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

// Combined Search and Select Component
interface WorkerSearchSelectProps {
  workers: Worker[];
  selectedWorkerId: string;
  onWorkerSelect: (workerId: string) => void;
  placeholder?: string;
}

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
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
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

  // Calculation form data
  const [calculationData, setCalculationData] = useState({
    baseSalary: "",
    hoursWorked: "",
    overtimeHours: "",
    bonuses: "",
    deductions: "",
    period: "monthly",
    notes: "",
  });

  // Calculation results
  const [results, setResults] = useState<{
    grossSalary: number;
    netSalary: number;
    taxes: number;
    socialSecurity: number;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{
    type: "email" | "phone";
    message: string;
    target?: string;
  } | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

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
      }

      // Pre-fill with worker's base salary if available
      if (worker?.baseSalary) {
        setCalculationData((prev) => ({
          ...prev,
          baseSalary: worker.baseSalary.toString(),
        }));
      }
    } else {
      setSelectedWorker(null);
      setExpandedCompany(null);
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
        let usersResponse = await fetch(`${apiUrl}/User/GetAll`, {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify({}),
        });

        if (!usersResponse.ok) {
          usersResponse = await fetch(`${apiUrl}/User/GetAll`, {
            method: "GET",
            headers: commonHeaders,
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

            if (!workerRelationId || !emailCandidate) {
              return;
            }

            workerSecondaryEmailLookup[workerRelationId] = emailCandidate;
          });
        } else {
          throw new Error(
            `Error fetching users: ${usersResponse.status} - ${usersResponse.statusText}`
          );
        }
      } catch (usersError) {
        console.error("Error fetching users from API:", usersError);
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

  const calculateSalary = () => {
    const baseSalary = parseFloat(calculationData.baseSalary) || 0;
    const hoursWorked = parseFloat(calculationData.hoursWorked) || 0;
    const overtimeHours = parseFloat(calculationData.overtimeHours) || 0;
    const bonuses = parseFloat(calculationData.bonuses) || 0;
    const deductions = parseFloat(calculationData.deductions) || 0;

    // Basic calculation logic (can be customized based on your needs)
    const regularPay = baseSalary;
    const overtimePay = overtimeHours * (baseSalary / 160) * 1.5; // Assuming 160 hours/month, 1.5x overtime
    const grossSalary = regularPay + overtimePay + bonuses;

    // Tax calculations (simplified - adjust based on your tax rules)
    const taxRate = 0.21; // 21% tax rate
    const socialSecurityRate = 0.063; // 6.3% social security

    const taxes = grossSalary * taxRate;
    const socialSecurity = grossSalary * socialSecurityRate;
    const netSalary = grossSalary - taxes - socialSecurity - deductions;

    setResults({
      grossSalary,
      netSalary,
      taxes,
      socialSecurity,
    });
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
    setCalculationData({
      baseSalary: "",
      hoursWorked: "",
      overtimeHours: "",
      bonuses: "",
      deductions: "",
      period: "monthly",
      notes: "",
    });
    setResults(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
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
        <div className="grid gap-6 items-start xl:grid-cols-[minmax(0,1fr)_minmax(540px,1.3fr)] xl:[&>*]:min-w-0">
          {/* Worker Selection and Input Form */}
          <Card className="h-full">
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <User
                      size={20}
                      className="mr-2 text-blue-600 dark:text-blue-400"
                    />
                    Selección de Trabajador
                  </h2>
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
                {lastFetchTime && (
                  <div className="inline-flex items-center gap-2 max-w-full text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg">
                    Actualizado: {lastFetchTime.toLocaleString("es-ES")}
                  </div>
                )}
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
                    selectedWorker.companyNames.length > 0 && (
                      <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                        <span className="mr-1 text-blue-900 dark:text-blue-100">
                          Empresas asignadas:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {selectedWorker.companyNames.map((companyName) => {
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
                                No hay información de contratos para esta
                                empresa.
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

              {/* Calculation Form */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Datos para Cálculo
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="number"
                    label="Sueldo Base (€)"
                    value={calculationData.baseSalary}
                    onChange={(e) =>
                      setCalculationData((prev) => ({
                        ...prev,
                        baseSalary: e.target.value,
                      }))
                    }
                    placeholder="1500"
                    fullWidth
                  />

                  <Select
                    label="Período"
                    value={calculationData.period}
                    onChange={(value) =>
                      setCalculationData((prev) => ({ ...prev, period: value }))
                    }
                    options={[
                      { value: "monthly", label: "Mensual" },
                      { value: "weekly", label: "Semanal" },
                      { value: "daily", label: "Diario" },
                    ]}
                    fullWidth
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="number"
                    label="Horas Trabajadas"
                    value={calculationData.hoursWorked}
                    onChange={(e) =>
                      setCalculationData((prev) => ({
                        ...prev,
                        hoursWorked: e.target.value,
                      }))
                    }
                    placeholder="160"
                    fullWidth
                  />

                  <Input
                    type="number"
                    label="Horas Extra"
                    value={calculationData.overtimeHours}
                    onChange={(e) =>
                      setCalculationData((prev) => ({
                        ...prev,
                        overtimeHours: e.target.value,
                      }))
                    }
                    placeholder="0"
                    fullWidth
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="number"
                    label="Bonificaciones (€)"
                    value={calculationData.bonuses}
                    onChange={(e) =>
                      setCalculationData((prev) => ({
                        ...prev,
                        bonuses: e.target.value,
                      }))
                    }
                    placeholder="0"
                    fullWidth
                  />

                  <Input
                    type="number"
                    label="Deducciones (€)"
                    value={calculationData.deductions}
                    onChange={(e) =>
                      setCalculationData((prev) => ({
                        ...prev,
                        deductions: e.target.value,
                      }))
                    }
                    placeholder="0"
                    fullWidth
                  />
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
                  disabled={!selectedWorker || !calculationData.baseSalary}
                  isLoading={isCalculating}
                  leftIcon={<Calculator size={18} />}
                  className="w-full"
                >
                  Calcular Sueldo
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="min-w-0 h-full">
            <WorkerHoursCalendar
              worker={selectedWorker}
              selectedMonth={calendarMonth}
              hoursByDate={calendarHours}
              onMonthChange={handleCalendarMonthChange}
              isLoading={isCalendarLoading}
            />
          </div>
        </div>

        {/* Results */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <DollarSign
                size={20}
                className="mr-2 text-green-600 dark:text-green-400"
              />
              Resultados del Cálculo
            </h2>
          </CardHeader>
          <CardContent>
            {!results ? (
              <div className="text-center py-8">
                <Calculator size={48} className="mx-auto text-gray-400 mb-4" />
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

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="font-medium text-green-800 dark:text-green-300">
                      Sueldo Bruto
                    </span>
                    <span className="text-xl font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(results.grossSalary)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="font-medium text-blue-800 dark:text-blue-300">
                      Sueldo Neto
                    </span>
                    <span className="text-xl font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(results.netSalary)}
                    </span>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Desglose:
                    </h4>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Impuestos (21%)
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        -{formatCurrency(results.taxes)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Seguridad Social (6.3%)
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        -{formatCurrency(results.socialSecurity)}
                      </span>
                    </div>

                    {parseFloat(calculationData.deductions) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Otras Deducciones
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          -
                          {formatCurrency(
                            parseFloat(calculationData.deductions)
                          )}
                        </span>
                      </div>
                    )}

                    {parseFloat(calculationData.bonuses) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Bonificaciones
                        </span>
                        <span className="text-green-600 dark:text-green-400">
                          +{formatCurrency(parseFloat(calculationData.bonuses))}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Summary Card */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      Resumen:
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Horas Regulares:
                        </span>
                        <p className="font-medium">
                          {calculationData.hoursWorked || "0"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Horas Extra:
                        </span>
                        <p className="font-medium">
                          {calculationData.overtimeHours || "0"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Período:
                        </span>
                        <p className="font-medium capitalize">
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
                        <p className="font-medium">
                          {formatDate(new Date().toISOString())}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
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
                  // TODO: Generate PDF report
                  alert("Función de exportar PDF próximamente");
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
    </div>
  );
};
