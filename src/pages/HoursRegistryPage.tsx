import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Clock,
  Search,
  Save,
  User,
  RefreshCw,
  Mail,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  CalendarDays
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Worker, HourEntry } from '../types/salary';
import { formatDate } from '../lib/utils';
import {
  WorkerHoursCalendar,
  type DayHoursSummary
} from '../components/WorkerHoursCalendar';
import { useAuthStore } from '../store/authStore';
import { fetchWorkersData, fetchWorkerHoursSummary } from '../lib/salaryData';

interface DayRegistrationEntry {
  id: string;
  company: string;
  startTime: string;
  endTime: string;
  hours: string;
  description: string;
}

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const computeEntryHours = (entry: DayRegistrationEntry): number => {
  const normalize = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/[^0-9,.-]/g, '').replace(',', '.');
      const parsed = Number(normalized);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  };

  const direct = normalize(entry.hours);
  if (direct !== null) {
    return direct;
  }

  if (entry.startTime && entry.endTime) {
    const start = new Date(`2000-01-01T${entry.startTime}`);
    const end = new Date(`2000-01-01T${entry.endTime}`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (Number.isFinite(diff) && diff > 0) {
        return diff;
      }
    }
  }

  return 0;
};

const sanitizeTelHref = (phone: string) => {
  const sanitized = phone.replace(/[^+\d]/g, '');
  return sanitized.length > 0 ? `tel:${sanitized}` : null;
};

const buildWhatsAppLink = (phone: string) => {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly ? `https://wa.me/${digitsOnly}` : null;
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.error('Clipboard API write failed:', error);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const selectedRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textarea.select();
    const copied = document.execCommand('copy');

    document.body.removeChild(textarea);

    if (selectedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }

    return copied;
  } catch (error) {
    console.error('Fallback clipboard copy failed:', error);
    return false;
  }
};

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
  placeholder = 'Buscar trabajador...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const selectedWorker = useMemo(
    () => workers.find((w) => w.id === selectedWorkerId),
    [workers, selectedWorkerId]
  );

  const filteredWorkers = useMemo(
    () =>
      workers
        .filter((worker) => {
          const query = searchQuery.toLowerCase();
          return (
            worker.name.toLowerCase().includes(query) ||
            worker.email.toLowerCase().includes(query) ||
            (worker.phone && worker.phone.toLowerCase().includes(query)) ||
            (worker.department &&
              worker.department.toLowerCase().includes(query)) ||
            (worker.position && worker.position.toLowerCase().includes(query)) ||
            (worker.companyNames &&
              worker.companyNames.some((company) =>
                company.toLowerCase().includes(query)
              ))
          );
        })
        .sort((a, b) =>
          a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        ),
    [workers, searchQuery]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedWorker) {
          setInputValue(selectedWorker.name);
        } else {
          setInputValue('');
        }
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedWorker]);

  useEffect(() => {
    if (selectedWorker) {
      setInputValue(selectedWorker.name);
    } else {
      setInputValue('');
    }
  }, [selectedWorker]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, filteredWorkers.length);
  }, [filteredWorkers.length]);

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
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleWorkerSelect = (worker: Worker) => {
    onWorkerSelect(worker.id);
    setInputValue(worker.name);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onWorkerSelect('');
    setInputValue('');
    setSearchQuery('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    setSearchQuery(value);
    setIsOpen(true);
    setHighlightedIndex(-1);

    if (value === '') {
      onWorkerSelect('');
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (selectedWorker) {
      setInputValue('');
      setSearchQuery('');
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
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (selectedWorker) {
        setInputValue(selectedWorker.name);
      }
      return;
    }

    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true);
    }

    if (!filteredWorkers.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= filteredWorkers.length || prev === -1) {
          return 0;
        }
        return nextIndex;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev <= 0) {
          return filteredWorkers.length - 1;
        }
        return prev - 1;
      });
    } else if (event.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredWorkers.length) {
        event.preventDefault();
        handleWorkerSelect(filteredWorkers[highlightedIndex]);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Trabajador
      </label>

      <div
        className={`
          min-h-[42px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
          rounded-md flex items-center
          hover:border-gray-400 dark:hover:border-gray-500
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : ''}
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
              isOpen ? 'rotate-180' : ''
            }`}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>

      {isOpen && (
        <div className="w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filteredWorkers.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery
                  ? `No se encontraron trabajadores con "${searchQuery}"`
                  : 'Escribe para buscar trabajadores'}
              </div>
            ) : (
              <>
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                  {searchQuery
                    ? `${filteredWorkers.length} de ${workers.length} trabajadores`
                    : `${workers.length} trabajadores disponibles`}
                </div>

                {filteredWorkers.map((worker, index) => {
                  const isHighlighted = highlightedIndex === index;
                  const isSelected = selectedWorkerId === worker.id;
                  const baseClasses = `px-3 py-3 cursor-pointer flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700`;
                  const highlightClass = isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : isHighlighted
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : '';

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
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {worker.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {worker.companyNames && worker.companyNames.length > 0
                            ? worker.companyNames.join(', ')
                            : 'Sin empresas asignadas'}
                        </p>
                        {(worker.department || worker.position) && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {[worker.department, worker.position]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        )}
                      </div>
                      {selectedWorkerId === worker.id && (
                        <Check size={16} className="text-blue-600 dark:text-blue-400 ml-2" />
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

export const HoursRegistryPage: React.FC = () => {
  const { externalJwt } = useAuthStore();
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [recentEntries, setRecentEntries] = useState<HourEntry[]>([]);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(true);
  const [isHoursPanelCollapsed, setIsHoursPanelCollapsed] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarHours, setCalendarHours] = useState<Record<string, DayHoursSummary>>({});
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [companyLookup, setCompanyLookup] = useState<Record<string, string>>({});
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [dailyRegistrations, setDailyRegistrations] = useState<
    Record<string, Record<string, DayRegistrationEntry[]>>
  >({});
  const [copyFeedback, setCopyFeedback] = useState<
    { type: 'email' | 'phone'; message: string; target?: string }
  | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedWorkerId = selectedWorkerIds[0] || '';
  const selectedWorker = useMemo(
    () => allWorkers.find((worker) => worker.id === selectedWorkerId) ?? null,
    [allWorkers, selectedWorkerId]
  );
  const availableCompaniesList = useMemo(
    () => selectedWorker?.companyNames ?? [],
    [selectedWorker?.companyNames]
  );
  const selectedWorkerEmail = selectedWorker?.email ?? null;
  const selectedWorkerPhone = selectedWorker?.phone ?? null;
  const selectedWorkerTelHref = useMemo(() => {
    return selectedWorkerPhone ? sanitizeTelHref(selectedWorkerPhone) : null;
  }, [selectedWorkerPhone]);
  const selectedWorkerWhatsappHref = useMemo(() => {
    return selectedWorkerPhone ? buildWhatsAppLink(selectedWorkerPhone) : null;
  }, [selectedWorkerPhone]);

  const fetchWorkers = useCallback(async () => {
    if (!apiUrl || !externalJwt) {
      setWorkersError('Falta configuración de API o token');
      setAllWorkers([]);
      setLastFetchTime(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setWorkersError(null);
    try {
      const { workers, companyLookup: lookup } = await fetchWorkersData({
        apiUrl,
        token: externalJwt,
      });
      setAllWorkers(workers);
      setCompanyLookup(lookup);
      setLastFetchTime(new Date());
    } catch (error) {
      console.error('Error fetching workers:', error);
      setWorkersError('No se pudieron cargar los trabajadores');
      setAllWorkers([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, externalJwt]);

  useEffect(() => {
    void fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    if (!selectedWorkerId) {
      setSelectedDayKey(null);
      setIsHoursPanelCollapsed(true);
      setDailyRegistrations({});
      setHoursPanelExpandedCompanies({});
      return;
    }

    setIsHoursPanelCollapsed(false);

    if (!selectedDayKey) {
      const today = new Date();
      if (
        today.getFullYear() === calendarMonth.getFullYear() &&
        today.getMonth() === calendarMonth.getMonth()
      ) {
        setSelectedDayKey(formatDateKey(today));
      } else {
        const firstDayOfMonth = new Date(
          calendarMonth.getFullYear(),
          calendarMonth.getMonth(),
          1
        );
        setSelectedDayKey(formatDateKey(firstDayOfMonth));
      }
    }
  }, [selectedWorkerId, calendarMonth, selectedDayKey]);

  useEffect(() => {
    if (!selectedWorkerId || selectedDayKey) {
      return;
    }

    const keys = Object.keys(calendarHours);
    if (keys.length > 0) {
      const firstKey = keys.sort()[0];
      setSelectedDayKey(firstKey);
    }
  }, [calendarHours, selectedWorkerId, selectedDayKey]);

  useEffect(() => () => {
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
    }
  }, []);

  const showCopyFeedback = useCallback(
    (type: 'email' | 'phone', message: string, target?: string) => {
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

  const handleEmailCopy = useCallback(
    async (emailToCopy?: string | null) => {
      const targetEmail = emailToCopy ?? selectedWorkerEmail;
      if (!targetEmail) {
        return;
      }

      const copied = await copyTextToClipboard(targetEmail);
      if (copied) {
        showCopyFeedback('email', 'Email copiado', targetEmail);
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
      showCopyFeedback('phone', 'Teléfono copiado', selectedWorkerPhone);
    }
  }, [selectedWorkerPhone, showCopyFeedback]);

  const loadWorkerHours = useCallback(
    async (workerId: string, workerName: string, targetMonth: Date) => {
      if (!workerId) {
        setCalendarHours({});
        setRecentEntries([]);
        setExpandedCompany(null);
        return;
      }

      if (!apiUrl || !externalJwt) {
        setCalendarHours({});
        setRecentEntries([]);
        setCalendarError('Falta configuración de API o token');
        setExpandedCompany(null);
        return;
      }

      setIsCalendarLoading(true);
      setCalendarError(null);

      try {
        const summary = await fetchWorkerHoursSummary({
          apiUrl,
          token: externalJwt,
          workerId,
          month: targetMonth,
          companyLookup,
        });

        setCalendarHours(summary.hoursByDate);

        const mappedEntries: HourEntry[] = Object.entries(summary.hoursByDate)
          .map(([date, detail]) => {
            const safeDetail = detail ?? { totalHours: 0, notes: [], companies: [] };
            const notes = Array.isArray(safeDetail.notes)
              ? safeDetail.notes
                  .map(note => (typeof note === 'string' ? note.trim() : ''))
                  .filter(note => note.length > 0)
              : [];

            let createdAt: string;
            const parsedDate = new Date(date);
            if (Number.isNaN(parsedDate.getTime())) {
              createdAt = new Date().toISOString();
            } else {
              createdAt = parsedDate.toISOString();
            }

            return {
              id: `${workerId}-${date}`,
              workerId,
              workerName,
              date,
              regularHours: safeDetail.totalHours ?? 0,
              overtimeHours: 0,
              description: notes.join(' • '),
              approved: false,
              createdAt,
            };
          })
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .slice(0, 10);

        setRecentEntries(mappedEntries);
      } catch (error) {
        console.error('Error fetching worker hours summary:', error);
        setCalendarHours({});
        setRecentEntries([]);
        setCalendarError('No se pudieron obtener las horas registradas');
      } finally {
        setIsCalendarLoading(false);
      }
    },
    [apiUrl, externalJwt, companyLookup]
  );

  useEffect(() => {
    if (!selectedWorkerId) {
      setCalendarHours({});
      setRecentEntries([]);
      setCalendarError(null);
      return;
    }

    const workerName = selectedWorker?.name ?? 'Trabajador sin nombre';
    void loadWorkerHours(selectedWorkerId, workerName, calendarMonth);
  }, [selectedWorkerId, selectedWorker?.name, calendarMonth, loadWorkerHours]);

  const openEmailClient = useCallback(() => {
    if (!selectedWorkerEmail || typeof window === 'undefined') {
      return;
    }
    window.location.href = `mailto:${selectedWorkerEmail}`;
  }, [selectedWorkerEmail]);

  const openPhoneDialer = useCallback(() => {
    if (!selectedWorkerTelHref || typeof window === 'undefined') {
      return;
    }
    window.location.href = selectedWorkerTelHref;
  }, [selectedWorkerTelHref]);

  const openWhatsAppConversation = useCallback(() => {
    if (!selectedWorkerWhatsappHref || typeof window === 'undefined') {
      return;
    }
    window.open(selectedWorkerWhatsappHref, '_blank', 'noopener');
  }, [selectedWorkerWhatsappHref]);

  const handleWorkerSelectionChange = useCallback(
    (workerId: string) => {
      setSelectedWorkerIds(workerId ? [workerId] : []);
    },
    [setSelectedWorkerIds]
  );

  const handleCalendarMonthChange = useCallback((next: Date) => {
    const normalized = new Date(next.getFullYear(), next.getMonth(), 1);
    setCalendarMonth(normalized);
    setSelectedDayKey(prev => {
      if (!prev) {
        return formatDateKey(normalized);
      }
      const prevDate = new Date(prev);
      if (
        prevDate.getFullYear() === normalized.getFullYear() &&
        prevDate.getMonth() === normalized.getMonth()
      ) {
        return prev;
      }
      return formatDateKey(normalized);
    });
  }, []);

  const refreshWorkers = useCallback(async () => {
    setIsRefreshing(true);
    await fetchWorkers();
    setIsRefreshing(false);
  }, [fetchWorkers]);

  const selectedDaySummary = useMemo(() => (
    selectedDayKey ? calendarHours[selectedDayKey] ?? null : null
  ), [calendarHours, selectedDayKey]);

  const currentDayRegistrations = useMemo(() => {
    if (!selectedDayKey) {
      return {} as Record<string, DayRegistrationEntry[]>;
    }
    return dailyRegistrations[selectedDayKey] ?? {};
  }, [dailyRegistrations, selectedDayKey]);

  const companiesForRegistration = useMemo(() => {
    const companySet = new Set<string>();
    availableCompaniesList.forEach(name => {
      if (name && name.trim()) {
        companySet.add(name);
      }
    });

    Object.keys(currentDayRegistrations).forEach(name => {
      if (name && name.trim()) {
        companySet.add(name);
      }
    });

    if (companySet.size === 0) {
      companySet.add('Sin empresa');
    }

    return Array.from(companySet).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }, [availableCompaniesList, currentDayRegistrations]);

  const [hoursPanelExpandedCompanies, setHoursPanelExpandedCompanies] = useState<Record<string, boolean>>({});

  const calendarCompanyTotals = useMemo(() => {
    const map = new Map<string, number>();
    selectedDaySummary?.companies?.forEach(company => {
      const key = company.name?.trim() || company.companyId || 'Sin empresa';
      map.set(key, company.hours ?? 0);
    });
    return map;
  }, [selectedDaySummary]);

  const localTotalRegisteredHours = useMemo(() => {
    return Object.values(currentDayRegistrations).reduce((acc, entries) =>
      acc + entries.reduce((sum, entry) => sum + computeEntryHours(entry), 0),
    0);
  }, [currentDayRegistrations]);

  const displayTotalRegisteredHours = localTotalRegisteredHours > 0
    ? localTotalRegisteredHours
    : (selectedDaySummary?.totalHours ?? 0);

  useEffect(() => {
    if (!selectedWorkerId || !selectedDayKey) {
      return;
    }

    const companies = companiesForRegistration.length > 0
      ? companiesForRegistration
      : ['Sin empresa'];

    setDailyRegistrations(prev => {
      const dayMap = prev[selectedDayKey] ?? {};
      const nextDay: Record<string, DayRegistrationEntry[]> = { ...dayMap };
      let changed = false;

      companies.forEach(name => {
        const key = name && name.trim().length > 0 ? name : 'Sin empresa';
        if (!nextDay[key] || nextDay[key].length === 0) {
          nextDay[key] = [
            {
              id: generateId(),
              company: key,
              startTime: '',
              endTime: '',
              hours: '',
              description: '',
            },
          ];
          changed = true;
        }
      });

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        [selectedDayKey]: nextDay,
      };
    });

    setHoursPanelExpandedCompanies(prev => {
      const next: Record<string, boolean> = {};
      let openSet = false;

      companies.forEach((name, index) => {
        const key = name && name.trim().length > 0 ? name : 'Sin empresa';
        const shouldOpen = !openSet && (prev[key] ?? index === 0);
        next[key] = shouldOpen;
        if (shouldOpen) {
          openSet = true;
        }
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const sameLength = prevKeys.length === nextKeys.length;
      const allMatch = sameLength && nextKeys.every(key => prev[key] === next[key]);
      if (allMatch) {
        return prev;
      }

      return next;
    });
  }, [selectedWorkerId, selectedDayKey, companiesForRegistration]);

  const addRegistrationEntry = useCallback(
    (companyName?: string) => {
      if (!selectedDayKey || !selectedWorker) {
        return;
      }

      const fallbackCompany =
        availableCompaniesList.length > 0 ? availableCompaniesList[0] : 'Sin empresa';
      const trimmed = companyName?.trim();
      const targetCompany = trimmed && trimmed.length > 0
        ? trimmed
        : companiesForRegistration[0] ?? fallbackCompany;

      const newEntry: DayRegistrationEntry = {
        id: generateId(),
        company: targetCompany,
        startTime: '',
        endTime: '',
        hours: '',
        description: '',
      };

      setDailyRegistrations(prev => {
        const dayMap = prev[selectedDayKey] ?? {};
        const companyEntries = dayMap[targetCompany] ?? [];
        return {
          ...prev,
          [selectedDayKey]: {
            ...dayMap,
            [targetCompany]: [...companyEntries, newEntry],
          },
        };
      });

      setHoursPanelExpandedCompanies(prev => ({
        ...prev,
        [targetCompany]: true,
      }));
    },
    [selectedDayKey, selectedWorker, availableCompaniesList, companiesForRegistration]
  );

  const updateRegistrationEntry = useCallback(
    (companyName: string, entryId: string, patch: Partial<DayRegistrationEntry>) => {
      if (!selectedDayKey) {
        return;
      }

      setDailyRegistrations(prev => {
        const dayMap = prev[selectedDayKey] ?? {};
        const sourceCompany = companyName || 'Sin empresa';
        const sourceEntries = dayMap[sourceCompany] ?? [];
        const entryIndex = sourceEntries.findIndex(entry => entry.id === entryId);

        if (entryIndex === -1) {
          return prev;
        }

        const originalEntry = sourceEntries[entryIndex];
        let updatedEntry: DayRegistrationEntry = {
          ...originalEntry,
          ...patch,
        };

        if (patch.hours !== undefined) {
          updatedEntry.hours = patch.hours;
          updatedEntry.startTime = '';
          updatedEntry.endTime = '';
        }

        if (patch.startTime !== undefined || patch.endTime !== undefined) {
          const { startTime, endTime } = updatedEntry;
          if (startTime && endTime) {
            const start = new Date(`2000-01-01T${startTime}`);
            const end = new Date(`2000-01-01T${endTime}`);
            const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            if (Number.isFinite(diff) && diff > 0) {
              updatedEntry.hours = diff.toFixed(2);
            } else {
              updatedEntry.hours = '';
            }
          }
        }

        const normalizedTargetCompany = (() => {
          const rawCompany = (patch.company ?? updatedEntry.company ?? '').trim();
          if (rawCompany.length > 0) {
            return rawCompany;
          }
          return availableCompaniesList.length > 0 ? availableCompaniesList[0] : 'Sin empresa';
        })();

        updatedEntry = { ...updatedEntry, company: normalizedTargetCompany };

        const nextDayMap: Record<string, DayRegistrationEntry[]> = { ...dayMap };

        const sourceRemaining = sourceEntries.filter(entry => entry.id !== entryId);
        if (normalizedTargetCompany !== sourceCompany) {
          if (sourceRemaining.length > 0) {
            nextDayMap[sourceCompany] = sourceRemaining;
          } else {
            delete nextDayMap[sourceCompany];
          }

          const targetEntries = nextDayMap[normalizedTargetCompany] ?? [];
          nextDayMap[normalizedTargetCompany] = [...targetEntries, updatedEntry];
        } else {
          nextDayMap[sourceCompany] = [...sourceRemaining, updatedEntry];
        }

        return {
          ...prev,
          [selectedDayKey]: nextDayMap,
        };
      });
    },
    [availableCompaniesList, selectedDayKey]
  );

  const removeRegistrationEntry = useCallback(
    (companyName: string, entryId: string) => {
      if (!selectedDayKey) {
        return;
      }

      setDailyRegistrations(prev => {
        const dayMap = prev[selectedDayKey] ?? {};
        const companyKey = companyName || 'Sin empresa';
        const entries = dayMap[companyKey] ?? [];
        const nextEntries = entries.filter(entry => entry.id !== entryId);

        const nextDayMap = { ...dayMap };
        if (nextEntries.length > 0) {
          nextDayMap[companyKey] = nextEntries;
        } else {
          delete nextDayMap[companyKey];
        }

        if (Object.keys(nextDayMap).length === 0) {
          const nextAll = { ...prev };
          delete nextAll[selectedDayKey];
          return nextAll;
        }

        return {
          ...prev,
          [selectedDayKey]: nextDayMap,
        };
      });
    },
    [selectedDayKey]
  );

  const handleSaveDayEntries = useCallback(async () => {
    if (!selectedWorker || !selectedDayKey) {
      alert('Selecciona un trabajador y un día del calendario');
      return;
    }

    const dayMap = dailyRegistrations[selectedDayKey] ?? {};
    const companyKeys = Object.keys(dayMap);

    if (companyKeys.length === 0) {
      alert('No hay tramos horarios para guardar');
      return;
    }

    const errors: string[] = [];
    const normalized = companyKeys.flatMap(companyName => {
      const entries = dayMap[companyName] ?? [];
      return entries.map((entry, idx) => {
        const labelIndex = `${companyName} - tramo ${idx + 1}`;
        const companyLabel = companyName || 'Sin empresa';
        const parsedHours = Number(entry.hours.replace(',', '.'));
        if (Number.isNaN(parsedHours) || parsedHours <= 0) {
          errors.push(`Horas inválidas en ${labelIndex}`);
        }

        return {
          id: entry.id,
          company: companyLabel,
          hours: Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 0,
          description: entry.description.trim(),
        };
      });
    });

    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 400));

      const savedEntries: HourEntry[] = normalized.map(item => ({
        id: generateId(),
        workerId: selectedWorker.id,
        workerName: selectedWorker.name,
        date: selectedDayKey,
        regularHours: item.hours,
        overtimeHours: 0,
        description: item.description,
        approved: false,
        createdAt: new Date().toISOString(),
      }));

      setRecentEntries(prev => [...savedEntries, ...prev].slice(0, 10));

      setCalendarHours(prev => {
        const previousSummary = prev[selectedDayKey];
        const baseNotes = previousSummary?.notes ? [...previousSummary.notes] : [];
        normalized.forEach(item => {
          if (item.description) {
            baseNotes.push(item.description);
          }
        });

        const companiesMap = new Map<string, { companyId?: string; name?: string; hours: number }>();
        previousSummary?.companies?.forEach(company => {
          const key = company.name ?? company.companyId ?? 'Sin empresa';
          companiesMap.set(key, { ...company });
        });
        normalized.forEach(item => {
          const key = item.company;
          const existing = companiesMap.get(key) ?? {
            name: key,
            hours: 0,
          };
          existing.hours += item.hours;
          companiesMap.set(key, existing);
        });

        const baseTotal = previousSummary?.totalHours ?? 0;
        const addedTotal = normalized.reduce((sum, item) => sum + item.hours, 0);

        return {
          ...prev,
          [selectedDayKey]: {
            totalHours: baseTotal + addedTotal,
            notes: baseNotes,
            companies: Array.from(companiesMap.values()).sort((a, b) =>
              (a.name ?? '').localeCompare(b.name ?? '', 'es', {
                sensitivity: 'base',
              })
            ),
          },
        };
      });

      setDailyRegistrations(prev => ({
        ...prev,
        [selectedDayKey]: {},
      }));
      alert('Registros guardados localmente');
    } catch (error) {
      console.error('Error guardando registros del día:', error);
      alert('No se pudieron guardar los registros');
    } finally {
      setIsSaving(false);
    }
  }, [dailyRegistrations, selectedDayKey, selectedWorker, setRecentEntries, setCalendarHours]);

  const selectedDayInfo = useMemo(() => {
    if (!selectedDayKey) {
      return { label: null as string | null, weekday: null as string | null, date: null as Date | null };
    }

    const targetDate = new Date(selectedDayKey);
    const label = formatDate(selectedDayKey);
    const weekday = targetDate.toLocaleDateString('es-ES', { weekday: 'long' });
    return { label, weekday, date: targetDate };
  }, [selectedDayKey]);

  const totalRegistrationsCount = useMemo(() =>
    Object.values(currentDayRegistrations).reduce((acc, entries) => acc + entries.length, 0)
  , [currentDayRegistrations]);

  const toggleHoursCompany = useCallback((companyName: string) => {
    setHoursPanelExpandedCompanies(prev => {
      const isOpen = prev[companyName] ?? false;
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach(name => {
        next[name] = false;
      });
      next[companyName] = !isOpen;
      return next;
    });
  }, []);

  useEffect(() => {
    if (companiesForRegistration.length === 0) {
      setHoursPanelExpandedCompanies(prev => (Object.keys(prev).length ? {} : prev));
      return;
    }

    setHoursPanelExpandedCompanies(prev => {
      let changed = false;
      const next: Record<string, boolean> = {};

      companiesForRegistration.forEach(name => {
        const existing = prev[name];
        if (existing === undefined) {
          changed = true;
          next[name] = true;
        } else {
          next[name] = existing;
        }
      });

      Object.keys(prev).forEach(name => {
        if (!companiesForRegistration.includes(name)) {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [companiesForRegistration]);

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Registro Individual"
        description="Consulta y registra las horas trabajadas por un empleado día a día"
        actionLabel={isSaving ? 'Guardando...' : 'Guardar registros del día'}
        onAction={handleSaveDayEntries}
        actionIcon={<Save size={18} />}
      />

      {/* Módulo avanzado de selección de trabajador */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                <User size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
                Selección de Trabajador
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {lastFetchTime && (
                  <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 px-3 py-1 text-sm text-gray-600 dark:text-gray-300">
                    Actualizado: {lastFetchTime.toLocaleString('es-ES')}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refreshWorkers}
                  disabled={isRefreshing}
                  leftIcon={
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                  }
                >
                  Actualizar
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Cargando trabajadores...
              </span>
            </div>
          ) : (
            <>
              <WorkerSearchSelect
                workers={allWorkers}
                selectedWorkerId={selectedWorkerId}
                onWorkerSelect={handleWorkerSelectionChange}
                placeholder="Buscar y seleccionar trabajador..."
              />
              {workersError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                  {workersError}
                </p>
              )}
            </>
          )}

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
                      {selectedWorkerEmail ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleEmailCopy(selectedWorkerEmail);
                          }}
                          className="font-medium text-blue-800 dark:text-blue-200 underline hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          {selectedWorkerEmail}
                        </button>
                      ) : (
                        'No disponible'
                      )}
                    </div>
                    {copyFeedback?.type === 'email' && (
                      <span className="text-xs text-green-600 dark:text-green-300 inline-block">
                        {copyFeedback.message}
                        {copyFeedback.target ? ` (${copyFeedback.target})` : ''}
                      </span>
                    )}
                  </div>
                  <button
                    className="inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm hover:shadow-md dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-sm px-3 py-2 rounded-lg min-w-0"
                    type="button"
                    onClick={openEmailClient}
                    disabled={!selectedWorkerEmail}
                  >
                    <span className="mr-2">
                      <Mail size={14} />
                    </span>
                    Enviar email
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="mr-1">Teléfono:</span>
                    {selectedWorkerPhone ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handlePhoneCopy();
                        }}
                        className="font-medium text-blue-800 dark:text-blue-200 underline hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        {selectedWorkerPhone}
                      </button>
                    ) : (
                      'No disponible'
                    )}
                    {copyFeedback?.type === 'phone' && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-300">
                        {copyFeedback.message}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm hover:shadow-md dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-sm px-3 py-2 rounded-lg min-w-0"
                      type="button"
                      onClick={openPhoneDialer}
                      disabled={!selectedWorkerTelHref}
                    >
                      <span className="mr-2">
                        <Phone size={14} />
                      </span>
                      Llamar
                    </button>
                    <button
                      className="inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm hover:shadow-md dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-sm px-3 py-2 rounded-lg min-w-0"
                      type="button"
                      onClick={openWhatsAppConversation}
                      disabled={!selectedWorkerWhatsappHref}
                    >
                      <span className="mr-2">
                        <MessageCircle size={14} />
                      </span>
                      WhatsApp
                    </button>
                  </div>
                </div>
                {selectedWorker.companyNames && selectedWorker.companyNames.length > 0 && (
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <span className="mr-1 text-blue-900 dark:text-blue-100">Empresas asignadas:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {selectedWorker.companyNames.map(companyName => {
                        const contracts = selectedWorker.companyContracts?.[companyName] ?? [];
                        const contractCount = contracts.filter(contract => contract.hasContract).length;
                        const assignmentCount = contracts.length - contractCount;
                        const countLabel = contractCount > 0 ? contractCount : assignmentCount;
                        const showCount = countLabel > 0;
                        const isActive = expandedCompany === companyName;
                        const baseChipClasses = 'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500';
                        const activeChipClasses = 'border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-500 dark:bg-blue-500';
                        const inactiveChipClasses = 'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60';

                        return (
                          <button
                            key={companyName}
                            type="button"
                            aria-pressed={isActive}
                            aria-expanded={isActive}
                            onClick={() =>
                              setExpandedCompany(prev =>
                                prev === companyName ? null : companyName
                              )
                            }
                            className={`${baseChipClasses} ${
                              isActive ? activeChipClasses : inactiveChipClasses
                            }`}
                          >
                            <span>{companyName}</span>
                            {showCount && (
                              <span
                                title={`${countLabel} contrato`}
                                className={`ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-blue-200 text-blue-800 dark:bg-blue-900/70 dark:text-blue-100'
                                }`}
                              >
                                {countLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {expandedCompany && selectedWorker.companyContracts && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-white/70 p-3 text-sm text-blue-900 shadow-sm dark:border-blue-700/80 dark:bg-blue-900/20 dark:text-blue-100">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold">Contratos en {expandedCompany}</span>
                          <button
                            type="button"
                            className="text-xs text-blue-500 underline transition hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200"
                            onClick={() => setExpandedCompany(null)}
                          >
                            Cerrar
                          </button>
                        </div>
                        <div className="space-y-3">
                          {(() => {
                            const contracts = selectedWorker.companyContracts?.[expandedCompany] ?? [];
                            const contractsWithContract = contracts.filter(contract => contract.hasContract);
                            const assignmentsWithoutContract = contracts.filter(contract => !contract.hasContract);

                            if (contractsWithContract.length === 0 && assignmentsWithoutContract.length === 0) {
                              return (
                                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-200">
                                  No hay información de contratos para esta empresa.
                                </div>
                              );
                            }

                            return (
                              <>
                                {contractsWithContract.map((contract, index) => (
                                  <div
                                    key={`${expandedCompany}-${contract.id}`}
                                    className="rounded-md border border-blue-100 bg-white/80 p-3 text-xs shadow-sm dark:border-blue-700/60 dark:bg-blue-900/40"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold">
                                        {contract.label ?? `Contrato ${index + 1}`}
                                      </span>
                                    </div>
                                    <div className="mt-2 space-y-1 text-blue-800 dark:text-blue-100">
                                      {contract.hourlyRate && (
                                        <div>
                                          <span className="font-medium">Precio por hora:</span>{' '}
                                          {contract.hourlyRate.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                        </div>
                                      )}
                                      {contract.position && (
                                        <div>
                                          <span className="font-medium">Puesto:</span> {contract.position}
                                        </div>
                                      )}
                                      {contract.startDate && (
                                        <div>
                                          <span className="font-medium">Inicio:</span> {formatDate(contract.startDate)}
                                        </div>
                                      )}
                                      {contract.endDate && (
                                        <div>
                                          <span className="font-medium">Fin:</span> {formatDate(contract.endDate)}
                                        </div>
                                      )}
                                      {contract.description && (
                                        <div className="rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-200/80">
                                          {contract.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {assignmentsWithoutContract.length > 0 && (
                                  <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                                    Además, hay {assignmentsWithoutContract.length}{' '}
                                    asignación{assignmentsWithoutContract.length !== 1 ? 'es' : ''} sin contrato asociado.
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsCalendarCollapsed(prev => !prev)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setIsCalendarCollapsed(prev => !prev);
                }
              }}
              aria-expanded={!isCalendarCollapsed}
              className="flex cursor-pointer items-center justify-between rounded-md border border-transparent px-2 py-1 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:hover:border-gray-600 dark:hover:bg-gray-800/40"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <CalendarDays size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
                Calendario de horas
              </h2>
              <ChevronDown
                size={18}
                className={`text-gray-600 dark:text-gray-300 transition-transform ${
                  isCalendarCollapsed ? '' : 'rotate-180'
                }`}
              />
            </div>
          </CardHeader>
          {!isCalendarCollapsed && (
            <CardContent>
              {calendarError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                  {calendarError}
                </div>
              )}
              {selectedWorker ? (
                <div className="min-w-0 text-xs">
                  <WorkerHoursCalendar
                    worker={selectedWorker}
                    selectedMonth={calendarMonth}
                    hoursByDate={calendarHours}
                    onMonthChange={handleCalendarMonthChange}
                    isLoading={isCalendarLoading}
                    hideTitle
                    selectedDayKey={selectedDayKey}
                    onSelectedDayChange={setSelectedDayKey}
                  />
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Selecciona un trabajador para ver su calendario de horas.
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsHoursPanelCollapsed(prev => !prev)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setIsHoursPanelCollapsed(prev => !prev);
                }
              }}
              aria-expanded={!isHoursPanelCollapsed}
              className="flex cursor-pointer items-center justify-between rounded-md border border-transparent px-2 py-1 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:hover:border-gray-600 dark:hover:bg-gray-800/40"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Clock size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
                Registro de horas
              </h2>
              <ChevronDown
                size={18}
                className={`text-gray-600 dark:text-gray-300 transition-transform ${
                  isHoursPanelCollapsed ? '' : 'rotate-180'
                }`}
              />
            </div>
          </CardHeader>
          {!isHoursPanelCollapsed && (
            <CardContent className="space-y-3 pt-4">
              {!selectedWorker ? (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Selecciona un trabajador para registrar horas.
                </div>
              ) : !selectedDayKey ? (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Elige un día en el calendario para comenzar.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Día anterior"
                        onClick={() => {
                          if (!selectedDayInfo.date) {
                            return;
                          }
                          const prevDay = new Date(selectedDayInfo.date);
                          prevDay.setDate(prevDay.getDate() - 1);
                          setSelectedDayKey(formatDateKey(prevDay));
                        }}
                        disabled={!selectedDayInfo.date}
                        className="text-gray-500 transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-400 dark:hover:text-blue-300"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div className="flex flex-col text-center md:text-left">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Día seleccionado
                        </span>
                        <span className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                          {selectedDayInfo.label}
                        </span>
                        {selectedDayInfo.weekday && (
                          <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                            {selectedDayInfo.weekday}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="Día siguiente"
                        onClick={() => {
                          if (!selectedDayInfo.date) {
                            return;
                          }
                          const nextDay = new Date(selectedDayInfo.date);
                          nextDay.setDate(nextDay.getDate() + 1);
                          setSelectedDayKey(formatDateKey(nextDay));
                        }}
                        disabled={!selectedDayInfo.date}
                        className="text-gray-500 transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-400 dark:hover:text-blue-300"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Total registrado: {displayTotalRegisteredHours.toFixed(2)} h
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white text-xs dark:border-gray-700 dark:bg-gray-900/20">
                    {selectedDaySummary?.companies?.length ? (
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            <th className="px-2.5 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-200">Empresa</th>
                            <th className="px-2.5 py-1.5 text-right font-semibold text-gray-700 dark:text-gray-200">Horas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDaySummary.companies.map(company => (
                            <tr key={`${selectedDayKey}-${company.name ?? company.companyId ?? 'empresa'}`} className="border-t border-gray-100 dark:border-gray-700">
                              <td className="px-2.5 py-1.5 text-gray-800 dark:text-gray-100">
                                {company.name?.trim() || 'Sin empresa'}
                              </td>
                              <td className="px-2.5 py-1.5 text-right text-blue-700 dark:text-blue-300">
                                {company.hours.toFixed(2)} h
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                        No hay horas registradas para este día.
                      </p>
                    )}
                  </div>

                  {selectedDaySummary?.notes && selectedDaySummary.notes.length > 0 && (
                    <div className="rounded-md bg-amber-100 dark:bg-amber-900/40 p-2.5 text-xs text-amber-900 dark:text-amber-100">
                      <h4 className="font-semibold">Notas registradas</h4>
                      <ul className="mt-2 space-y-1">
                        {selectedDaySummary.notes.map((note, index) => (
                          <li key={`${selectedDayKey}-summary-note-${index}`}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {companiesForRegistration.map(companyName => {
                      const companyEntries = currentDayRegistrations[companyName] ?? [];
                      const trimmedName = companyName?.trim() ? companyName.trim() : 'Sin empresa';
                      const isExpanded = hoursPanelExpandedCompanies[companyName] ?? true;
                      const summaryBaseHours = calendarCompanyTotals.get(trimmedName) ?? 0;
                      const localCompanyHours = companyEntries.reduce(
                        (sum, entry) => sum + computeEntryHours(entry),
                        0
                      );
                      const totalCompanyHours = summaryBaseHours + localCompanyHours;

                      return (
                        <div
                          key={`${selectedDayKey ?? 'day'}-${companyName || 'sin-empresa'}`}
                          className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/30"
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => toggleHoursCompany(companyName)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                toggleHoursCompany(companyName);
                              }
                            }}
                            className="flex cursor-pointer items-center justify-between px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {companyName || 'Sin empresa'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-300">
                                Total registrado: {totalCompanyHours.toFixed(2)} h
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addRegistrationEntry(companyName);
                                }}
                              >
                                + Tramo
                              </Button>
                              <ChevronDown
                                size={14}
                                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="space-y-2 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
                              {companyEntries.length === 0 ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  No hay tramos registrados para esta empresa.
                                </p>
                              ) : (
                                companyEntries.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                                  >
                                    <div className="flex justify-end">
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => removeRegistrationEntry(companyName, entry.id)}
                                        aria-label="Eliminar tramo"
                                      >
                                        <X size={12} />
                                      </Button>
                                    </div>

                                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      <Input
                                        type="time"
                                        label="Inicio"
                                        value={entry.startTime}
                                        onChange={(e) => updateRegistrationEntry(companyName, entry.id, { startTime: e.target.value })}
                                        fullWidth
                                      />
                                      <Input
                                        type="time"
                                        label="Fin"
                                        value={entry.endTime}
                                        onChange={(e) => updateRegistrationEntry(companyName, entry.id, { endTime: e.target.value })}
                                        fullWidth
                                      />
                                    </div>

                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.25"
                                      label="Total de horas"
                                      value={entry.hours}
                                      onChange={(e) => updateRegistrationEntry(companyName, entry.id, { hours: e.target.value })}
                                      placeholder="Ej: 8"
                                      fullWidth
                                      className="mt-2"
                                    />

                                    <Input
                                      label="Descripción"
                                      value={entry.description}
                                      onChange={(e) => updateRegistrationEntry(companyName, entry.id, { description: e.target.value })}
                                      placeholder="Describe el trabajo realizado..."
                                      fullWidth
                                      className="mt-2"
                                    />
                                  </div>
                                ))
                              )}

                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addRegistrationEntry(companyName)}
                                >
                                  Añadir tramo horario
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSaveDayEntries}
                      disabled={isSaving || totalRegistrationsCount === 0}
                    >
                      {isSaving ? 'Guardando...' : 'Guardar registros'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>
      </div>
      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Clock size={20} className="mr-2 text-purple-600 dark:text-purple-400" />
            Entradas Recientes
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
                Los registros aparecerán aquí una vez que comiences a registrar horas
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {entry.workerName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(entry.date)} - {entry.regularHours}h + {entry.overtimeHours}h extra
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      entry.approved 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                      {entry.approved ? 'Aprobado' : 'Pendiente'}
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
