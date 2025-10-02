import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
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
  ChevronDown,
  X,
  Check,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Worker, WorkerCompanyContract } from '../types/salary';
import { formatDate } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { fetchWorkersData } from '../lib/salaryData';

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

const formatCurrencyValue = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

const getContractTypeLabel = (
  type: Worker['contractType'] | undefined
) => {
  switch (type) {
    case 'full_time':
      return 'Tiempo completo';
    case 'part_time':
      return 'Tiempo parcial';
    case 'freelance':
      return 'Freelance';
    default:
      return 'No especificado';
  }
};

export const WorkerQueriesPage: React.FC = () => {
  const { externalJwt } = useAuthStore();
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<
    { type: 'email' | 'phone'; message: string; target?: string }
  | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
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

  const handleWorkerSelectionChange = useCallback((workerId: string) => {
    setSelectedWorkerIds(workerId ? [workerId] : []);
    setExpandedCompany(null);
  }, []);

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
      const { workers } = await fetchWorkersData({
        apiUrl,
        token: externalJwt,
      });
      setAllWorkers(workers);
      setLastFetchTime(new Date());
    } catch (error) {
      console.error('Error fetching workers:', error);
      setWorkersError('No se pudieron cargar los trabajadores');
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
      case 'admin':
        return 'Administrador';
      case 'supervisor':
        return 'Supervisor';
      case 'tecnico':
        return 'Técnico';
      default:
        return 'Usuario';
    }
  }, []);

  const roleCounts = useMemo(() => {
    return allWorkers.reduce(
      (acc, worker) => {
        acc[worker.role] = (acc[worker.role] ?? 0) + 1;
        return acc;
      },
      { admin: 0, supervisor: 0, tecnico: 0 } as Record<Worker['role'], number>
    );
  }, [allWorkers]);

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
                <User size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
                Selección de Trabajador
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex max-w-[255px] items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 px-3 py-1 text-sm text-gray-600 dark:text-gray-300">
                  Actualizado: {lastFetchTime ? lastFetchTime.toLocaleString('es-ES') : 'Sin sincronizar'}
                </div>
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
                      {selectedWorker.companyNames.map((companyName) => {
                        const contracts = selectedWorker.companyContracts?.[companyName] ?? [];
                        const contractCount = contracts.filter((contract) => contract.hasContract).length;
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
                              setExpandedCompany((prev) =>
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
                            const contractsWithContract = contracts.filter((contract) => contract.hasContract);
                            const assignmentsWithoutContract = contracts.filter((contract) => !contract.hasContract);

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
                                    key={`contract-${contract.id ?? index}`}
                                    className="rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-blue-900 shadow-sm dark:border-blue-700/70 dark:bg-blue-900/30 dark:text-blue-100"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold">{contract.label ?? contract.position ?? 'Contrato'}</span>
                                      {contract.typeLabel && (
                                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 dark:bg-blue-900/50 dark:text-blue-100">
                                          {contract.typeLabel}
                                        </span>
                                      )}
                                    </div>
                                    {contract.description && (
                                      <p className="mt-1 text-[11px] text-blue-800/80 dark:text-blue-100/80">
                                        {contract.description}
                                      </p>
                                    )}
                                    <div className="mt-2 grid gap-1 text-[11px] text-blue-800/80 dark:text-blue-100/80">
                                      {contract.startDate && (
                                        <span>Inicio: {formatDate(contract.startDate)}</span>
                                      )}
                                      {contract.endDate && (
                                        <span>Fin: {formatDate(contract.endDate)}</span>
                                      )}
                                      {contract.status && <span>Estado: {contract.status}</span>}
                                    </div>
                                  </div>
                                ))}

                                {assignmentsWithoutContract.length > 0 && (
                                  <div className="rounded-md border border-dashed border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-800 dark:border-blue-700/60 dark:bg-blue-900/20 dark:text-blue-200">
                                    <span className="font-semibold">Asignaciones sin contrato:</span>
                                    <ul className="mt-1 list-disc pl-4 space-y-1">
                                      {assignmentsWithoutContract.map((assignment, index) => (
                                        <li key={`assignment-${assignment.id ?? index}`}>
                                          {assignment.label ?? 'Sin descripción'}
                                        </li>
                                      ))}
                                    </ul>
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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FileText size={20} className="mr-2 text-green-600 dark:text-green-400" />
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
                    <Avatar name={selectedWorker.name} src={selectedWorker.avatarUrl} size="lg" />
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
                        <span className="text-gray-600 dark:text-gray-400">Email:</span>
                        {selectedWorker.email ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleEmailCopy(selectedWorker.email);
                            }}
                            className="font-medium text-blue-700 underline transition hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
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
                          size="xs"
                          variant="outline"
                          onClick={openEmailClient}
                          disabled={!selectedWorker.email}
                        >
                          Enviar email
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            void handleEmailCopy(selectedWorker.email);
                          }}
                          disabled={!selectedWorker.email}
                        >
                          Copiar email
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Phone size={16} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">Teléfono:</span>
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
                          size="xs"
                          variant="outline"
                          onClick={openPhoneDialer}
                          disabled={!selectedWorkerTelHref}
                        >
                          Llamar
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={openWhatsAppConversation}
                          disabled={!selectedWorkerWhatsappHref}
                        >
                          WhatsApp
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            void handlePhoneCopy();
                          }}
                          disabled={!selectedWorker.phone}
                        >
                          Copiar teléfono
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">Fecha de alta:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatDate(selectedWorker.createdAt)}
                      </span>
                    </div>

                    {selectedWorker.department && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Building2 size={16} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">Departamento:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedWorker.department}
                        </span>
                      </div>
                    )}

                    {selectedWorker.position && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Users size={16} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">Puesto:</span>
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
                    <span className="font-medium text-gray-900 dark:text-white">Tipo de contrato:</span>
                    <span className="ml-2">{getContractTypeLabel(selectedWorker.contractType)}</span>
                  </div>

                  {selectedWorker.startDate && (
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">Fecha de ingreso:</span>
                      <span className="ml-2">{formatDate(selectedWorker.startDate)}</span>
                    </div>
                  )}

                  {selectedWorker.companyNames && selectedWorker.companyNames.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">Empresas asignadas:</span>
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
                      <p className="text-sm text-green-700 dark:text-green-300">Sueldo Base</p>
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
                      <p className="text-sm text-blue-700 dark:text-blue-300">Tarifa por Hora</p>
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
                    <Building2 size={24} className="mx-auto text-gray-400 mb-2" />
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
                              {contract.label ?? contract.position ?? contract.companyName}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Empresa: {contract.companyName}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                              contract.hasContract
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                            }`}
                          >
                            {contract.hasContract ? 'Contrato' : 'Asignación'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {contract.typeLabel && <p>Tipo: {contract.typeLabel}</p>}
                          {contract.position && <p>Puesto: {contract.position}</p>}
                          {contract.hourlyRate !== undefined && (
                            <p>Tarifa: {formatCurrencyValue(contract.hourlyRate)}</p>
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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FileText size={20} className="mr-2 text-purple-600 dark:text-purple-400" />
            Estadísticas Generales
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Users size={24} className="mx-auto text-blue-600 dark:text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {allWorkers.length}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Total Trabajadores
              </p>
            </div>

            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <User size={24} className="mx-auto text-green-600 dark:text-green-400 mb-2" />
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {roleCounts.admin ?? 0}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Administradores
              </p>
            </div>

            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <User size={24} className="mx-auto text-yellow-600 dark:text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                {roleCounts.supervisor ?? 0}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Supervisores
              </p>
            </div>

            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <User size={24} className="mx-auto text-purple-600 dark:text-purple-400 mb-2" />
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {roleCounts.tecnico ?? 0}
              </p>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Técnicos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
