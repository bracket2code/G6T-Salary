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
  X,
  Check
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

interface HourEntryForm {
  workerId: string;
  workerName: string;
  date: string;
  regularHours: string;
  overtimeHours: string;
  description: string;
}

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
  const [hourEntries, setHourEntries] = useState<HourEntryForm[]>([]);
  const [recentEntries, setRecentEntries] = useState<HourEntry[]>([]);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(true);
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
  const [copyFeedback, setCopyFeedback] = useState<
    { type: 'email' | 'phone'; message: string; target?: string }
  | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedWorkerId = selectedWorkerIds[0] || '';
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
    const today = new Date().toISOString().split('T')[0];
    setHourEntries(prevEntries =>
      selectedWorkerIds.map(workerId => {
        const worker = allWorkers.find(w => w.id === workerId);
        const existingEntry = prevEntries.find(entry => entry.workerId === workerId);

        return existingEntry ?? {
          workerId,
          workerName: worker?.name || 'Trabajador desconocido',
          date: today,
          regularHours: '8',
          overtimeHours: '0',
          description: ''
        };
      })
    );
  }, [selectedWorkerIds, allWorkers]);

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
    setCalendarMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }, []);

  const refreshWorkers = useCallback(async () => {
    setIsRefreshing(true);
    await fetchWorkers();
    setIsRefreshing(false);
  }, [fetchWorkers]);

  const updateHourEntry = (workerId: string, field: string, value: string) => {
    setHourEntries(prev => 
      prev.map(entry => 
        entry.workerId === workerId 
          ? { ...entry, [field]: value }
          : entry
      )
    );
  };

  const handleSaveAll = async () => {
    if (isSaving) {
      return;
    }

    if (hourEntries.length === 0) {
      alert('No hay entradas de horas para guardar');
      return;
    }

    // Validate entries
    const invalidEntries = hourEntries.filter(entry => 
      !entry.regularHours || parseFloat(entry.regularHours) < 0
    );

    if (invalidEntries.length > 0) {
      alert('Por favor completa todas las horas regulares con valores válidos');
      return;
    }

    setIsSaving(true);
    try {
      // Simulate saving to local storage
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const savedEntries = hourEntries.map(entry => ({
        id: Math.random().toString(36).substr(2, 9),
        workerId: entry.workerId,
        workerName: entry.workerName,
        date: entry.date,
        regularHours: parseFloat(entry.regularHours),
        overtimeHours: parseFloat(entry.overtimeHours) || 0,
        description: entry.description,
        approved: false,
        createdAt: new Date().toISOString()
      }));

      // Add to recent entries
      setRecentEntries(prev => [...savedEntries, ...prev].slice(0, 10));
      
      alert('Horas registradas exitosamente');
      
      // Reset form
      setHourEntries([]);
      setSelectedWorkerIds([]);
    } catch (error) {
      console.error('Error saving hour entries:', error);
      alert('Error al guardar las horas');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Registro Individual"
        description="Registra las horas trabajadas por un empleado a la vez"
        actionLabel={isSaving ? 'Guardando...' : 'Guardar Todo'}
        onAction={handleSaveAll}
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

      {/* Calendario de horas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Clock size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
              Calendario de horas
            </h2>
            <button
              type="button"
              onClick={() => setIsCalendarCollapsed(prev => !prev)}
              className="p-1 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              <ChevronDown
                size={18}
                className={`text-gray-600 dark:text-gray-300 transition-transform ${
                  isCalendarCollapsed ? '' : 'rotate-180'
                }`}
              />
            </button>
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

      {/* Empty State */}
      {hourEntries.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Selecciona un trabajador para registrar horas
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Usa el buscador superior para elegir a quién deseas asignar las horas trabajadas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
