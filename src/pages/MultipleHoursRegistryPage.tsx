import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Save, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { HourEntry } from '../types/salary';
import { formatDate } from '../lib/utils';

const weekDays = [
  { key: 'monday', label: 'Lunes', shortLabel: 'Lun' },
  { key: 'tuesday', label: 'Martes', shortLabel: 'Mar' },
  { key: 'wednesday', label: 'Miércoles', shortLabel: 'Mié' },
  { key: 'thursday', label: 'Jueves', shortLabel: 'Jue' },
  { key: 'friday', label: 'Viernes', shortLabel: 'Vie' },
] as const;

type WeekDayKey = typeof weekDays[number]['key'];

interface Assignment {
  id: string;
  workerId: string;
  workerName: string;
  companyId: string;
  companyName: string;
  hours: Record<WeekDayKey, string>;
}

interface GroupView {
  id: string;
  name: string;
  assignments: Assignment[];
  totals: Record<WeekDayKey, number>;
}

const hoursFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const layoutOptions = [
  {
    value: 'groups',
    label: 'Grupos de personal…',
    description: 'Elegir subcategorías y guardar combinaciones favoritas.',
    disabled: true,
  },
  {
    value: 'weekly',
    label: 'Vista semanal',
    description: 'Planificar asignaciones semanales con arrastrar y soltar.',
    disabled: true,
  },
  {
    value: 'table',
    label: 'Formato tabla con dos vistas',
    description:
      'Vista por empresas o por trabajadores sin perder los totales diarios.',
    disabled: false,
  },
] as const;

type LayoutOptionValue = typeof layoutOptions[number]['value'];

const initialAssignments: Assignment[] = [
  {
    id: 'c1-w1',
    workerId: 'w1',
    workerName: 'Luis Martínez',
    companyId: 'c1',
    companyName: 'Mombassa',
    hours: {
      monday: '5',
      tuesday: '3',
      wednesday: '2',
      thursday: '7',
      friday: '1,5',
    },
  },
  {
    id: 'c1-w2',
    workerId: 'w2',
    workerName: 'Pablo Ortega',
    companyId: 'c1',
    companyName: 'Mombassa',
    hours: {
      monday: '1',
      tuesday: '1,5',
      wednesday: '3',
      thursday: '1',
      friday: '2,5',
    },
  },
  {
    id: 'c1-w3',
    workerId: 'w3',
    workerName: 'Juan Álvarez',
    companyId: 'c1',
    companyName: 'Mombassa',
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    },
  },
  {
    id: 'c1-w4',
    workerId: 'w4',
    workerName: 'Jose Miguel',
    companyId: 'c1',
    companyName: 'Mombassa',
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    },
  },
  {
    id: 'c1-w5',
    workerId: 'w5',
    workerName: 'Álvaro Jiménez',
    companyId: 'c1',
    companyName: 'Mombassa',
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    },
  },
  {
    id: 'c1-w6',
    workerId: 'w6',
    workerName: 'Marcos Díaz',
    companyId: 'c1',
    companyName: 'Mombassa',
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    },
  },
  {
    id: 'c1-w7',
    workerId: 'w7',
    workerName: 'Jorge Torres',
    companyId: 'c1',
    companyName: 'Mombassa',
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    },
  },
  {
    id: 'c2-w1',
    workerId: 'w1',
    workerName: 'Luis Martínez',
    companyId: 'c2',
    companyName: 'Tetería',
    hours: {
      monday: '1',
      tuesday: '6',
      wednesday: '2',
      thursday: '3',
      friday: '4',
    },
  },
  {
    id: 'c2-w3',
    workerId: 'w3',
    workerName: 'Juan Álvarez',
    companyId: 'c2',
    companyName: 'Tetería',
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    },
  },
  {
    id: 'c3-w2',
    workerId: 'w2',
    workerName: 'Pablo Ortega',
    companyId: 'c3',
    companyName: 'Cafetería Central',
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    },
  },
];

const parseHour = (value: string): number => {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createEmptyTotals = (): Record<WeekDayKey, number> => ({
  monday: 0,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
});

const calculateRowTotal = (assignment: Assignment): number =>
  weekDays.reduce((total, day) => total + parseHour(assignment.hours[day.key]), 0);

const calculateTotals = (items: Assignment[]): Record<WeekDayKey, number> => {
  const totals = createEmptyTotals();

  items.forEach((item) => {
    weekDays.forEach((day) => {
      totals[day.key] += parseHour(item.hours[day.key]);
    });
  });

  return totals;
};

const formatHours = (value: number): string => `${hoursFormatter.format(value)} h`;

export const MultipleHoursRegistryPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [selectedLayout, setSelectedLayout] = useState<LayoutOptionValue>('table');
  const [viewMode, setViewMode] = useState<'company' | 'worker'>('company');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [recentEntries, setRecentEntries] = useState<HourEntry[]>([]);

  const weekDateMap = useMemo(() => {
    const now = new Date();
    const today = now.getDay();
    const mondayOffset = today === 0 ? -6 : 1 - today;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + mondayOffset);

    const dates: Record<WeekDayKey, string> = {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
    };

    weekDays.forEach((day, index) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + index);
      dates[day.key] = current.toISOString().split('T')[0];
    });

    return dates;
  }, []);

  const companyGroups = useMemo<GroupView[]>(() => {
    const groups = new Map<string, GroupView>();

    assignments.forEach((assignment) => {
      if (!groups.has(assignment.companyId)) {
        groups.set(assignment.companyId, {
          id: assignment.companyId,
          name: assignment.companyName,
          assignments: [],
          totals: createEmptyTotals(),
        });
      }

      const group = groups.get(assignment.companyId);
      if (group) {
        group.assignments.push(assignment);
      }
    });

    return Array.from(groups.values())
      .map((group) => {
        const sortedAssignments = [...group.assignments].sort((a, b) =>
          a.workerName.localeCompare(b.workerName, 'es', { sensitivity: 'base' }),
        );

        return {
          ...group,
          assignments: sortedAssignments,
          totals: calculateTotals(sortedAssignments),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [assignments]);

  const workerGroups = useMemo<GroupView[]>(() => {
    const groups = new Map<string, GroupView>();

    assignments.forEach((assignment) => {
      if (!groups.has(assignment.workerId)) {
        groups.set(assignment.workerId, {
          id: assignment.workerId,
          name: assignment.workerName,
          assignments: [],
          totals: createEmptyTotals(),
        });
      }

      const group = groups.get(assignment.workerId);
      if (group) {
        group.assignments.push(assignment);
      }
    });

    return Array.from(groups.values())
      .map((group) => {
        const sortedAssignments = [...group.assignments].sort((a, b) =>
          a.companyName.localeCompare(b.companyName, 'es', { sensitivity: 'base' }),
        );

        return {
          ...group,
          assignments: sortedAssignments,
          totals: calculateTotals(sortedAssignments),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [assignments]);

  const currentGroups = viewMode === 'company' ? companyGroups : workerGroups;

  useEffect(() => {
    setExpandedGroups((prev) => {
      let changed = false;
      const next = new Set(prev);

      currentGroups.forEach((group) => {
        if (!next.has(group.id)) {
          next.add(group.id);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [currentGroups]);

  const handleHourChange = useCallback(
    (assignmentId: string, dayKey: WeekDayKey, value: string) => {
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === assignmentId
            ? {
                ...assignment,
                hours: {
                  ...assignment.hours,
                  [dayKey]: value,
                },
              }
            : assignment,
        ),
      );
    },
    [],
  );

  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleSaveAll = useCallback(() => {
    const entriesToSave: HourEntry[] = [];

    assignments.forEach((assignment) => {
      weekDays.forEach((day) => {
        const rawValue = assignment.hours[day.key].trim();
        if (!rawValue) {
          return;
        }

        const hoursValue = parseHour(rawValue);
        if (hoursValue <= 0) {
          return;
        }

        entriesToSave.push({
          id: `${assignment.id}-${day.key}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          workerId: assignment.workerId,
          workerName: assignment.workerName,
          date: weekDateMap[day.key],
          regularHours: hoursValue,
          overtimeHours: 0,
          description: `${assignment.companyName} · ${day.label}`,
          approved: false,
          createdAt: new Date().toISOString(),
        });
      });
    });

    if (entriesToSave.length === 0) {
      alert('No hay horas registradas para guardar');
      return;
    }

    setRecentEntries((prev) => [...entriesToSave, ...prev].slice(0, 12));
    alert('Horas registradas exitosamente');
  }, [assignments, weekDateMap]);

  const fetchRecentEntries = useCallback(() => {
    const mockRecentEntries: HourEntry[] = [
      {
        id: 'recent-1',
        workerId: 'w1',
        workerName: 'Luis Martínez',
        date: weekDateMap.monday,
        regularHours: 7.5,
        overtimeHours: 1,
        description: 'Mombassa · Reparación maquinaria',
        approved: true,
        approvedBy: 'gerencia@mombassa.com',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'recent-2',
        workerId: 'w2',
        workerName: 'Pablo Ortega',
        date: weekDateMap.tuesday,
        regularHours: 6,
        overtimeHours: 0,
        description: 'Cafetería Central · Inventario',
        approved: false,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ];

    setRecentEntries(mockRecentEntries);
  }, [weekDateMap]);

  useEffect(() => {
    fetchRecentEntries();
  }, [fetchRecentEntries]);

  const weeklyTotals = useMemo(() => calculateTotals(assignments), [assignments]);
  const weeklyTotalHours = useMemo(
    () => weekDays.reduce((total, day) => total + weeklyTotals[day.key], 0),
    [weeklyTotals],
  );

  const renderGroupCard = useCallback(
    (group: GroupView) => {
      const isExpanded = expandedGroups.has(group.id);
      const totalByGroup = weekDays.reduce(
        (total, day) => total + group.totals[day.key],
        0,
      );

      return (
        <Card
          key={group.id}
          className="border border-gray-200 shadow-sm dark:border-gray-700"
        >
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleGroupExpansion(group.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:text-blue-300"
                aria-label={isExpanded ? 'Contraer grupo' : 'Expandir grupo'}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {group.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {viewMode === 'company'
                    ? `${group.assignments.length} trabajador${
                        group.assignments.length === 1 ? '' : 'es'
                      }`
                    : `${group.assignments.length} empresa${
                        group.assignments.length === 1 ? '' : 's'
                      }`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
              {weekDays.map((day) => (
                <div key={`${group.id}-${day.key}`} className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {day.shortLabel}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {formatHours(group.totals[day.key])}
                  </span>
                </div>
              ))}
              <div className="flex flex-col items-end text-blue-600 dark:text-blue-300">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Total
                </span>
                <span className="text-sm font-semibold">
                  {formatHours(totalByGroup)}
                </span>
              </div>
            </div>
          </CardHeader>

          {isExpanded && (
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/70">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                        {viewMode === 'company' ? 'Trabajador' : 'Empresa'}
                      </th>
                      {weekDays.map((day) => (
                        <th
                          key={`${group.id}-${day.key}-header`}
                          className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300"
                        >
                          {day.label}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {group.assignments.map((assignment, index) => {
                      const rowTotal = calculateRowTotal(assignment);

                      return (
                        <tr
                          key={assignment.id}
                          className={
                            index % 2 === 0
                              ? 'bg-white dark:bg-gray-900'
                              : 'bg-gray-50 dark:bg-gray-900/70'
                          }
                        >
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                            {viewMode === 'company'
                              ? assignment.workerName
                              : assignment.companyName}
                          </td>
                          {weekDays.map((day) => (
                            <td key={`${assignment.id}-${day.key}`} className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  size="sm"
                                  type="text"
                                  inputMode="decimal"
                                  value={assignment.hours[day.key]}
                                  onChange={(event) =>
                                    handleHourChange(
                                      assignment.id,
                                      day.key,
                                      event.target.value,
                                    )
                                  }
                                  className="w-20 text-center"
                                  placeholder="0"
                                />
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  h
                                </span>
                              </div>
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-200">
                            {formatHours(rowTotal)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-100 dark:bg-gray-800/80">
                      <td className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Total {viewMode === 'company' ? 'empresa' : 'trabajador'}
                      </td>
                      {weekDays.map((day) => (
                        <td
                          key={`${group.id}-${day.key}-total`}
                          className="px-3 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200"
                        >
                          {formatHours(group.totals[day.key])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {formatHours(totalByGroup)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      );
    },
    [expandedGroups, handleHourChange, toggleGroupExpansion, viewMode],
  );

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Registro Múltiple"
        description="Registra y compara las horas semanales por empresa o trabajador sin perder los totales diarios."
        actionLabel="Guardar Todo"
        onAction={handleSaveAll}
        actionIcon={<Save size={18} />}
      />

      <Card>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configura la vista
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Selecciona cómo deseas organizar a los trabajadores antes de registrar horas.
            </p>
          </div>
          <div className="space-y-3">
            {layoutOptions.map((option) => {
              const isSelected = selectedLayout === option.value;

              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:border-blue-500/70 dark:bg-blue-900/20 dark:ring-blue-500/40'
                      : 'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-500'
                  } ${option.disabled ? 'cursor-not-allowed opacity-60 hover:border-gray-200 dark:hover:border-gray-700' : ''}`}
                >
                  <input
                    type="radio"
                    name="layout"
                    value={option.value}
                    checked={isSelected}
                    disabled={option.disabled}
                    onChange={() => setSelectedLayout(option.value)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{option.label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{option.description}</p>
                    {option.disabled && (
                      <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                        Próximamente
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Registro semanal en tabla
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Alterna entre empresas y trabajadores para ver las horas desde las dos perspectivas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
                {[
                  { value: 'company', label: 'Por empresa' },
                  { value: 'worker', label: 'Por trabajador' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setViewMode(option.value as 'company' | 'worker')}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition ${
                      viewMode === option.value
                        ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-300'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setViewMode((prev) => (prev === 'company' ? 'worker' : 'company'))
                }
                leftIcon={<RefreshCw size={16} />}
              >
                Cambiar vista
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No hay trabajadores asignados a esta vista.
            </div>
          ) : (
            <div className="space-y-4">
              {currentGroups.map((group) => renderGroupCard(group))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total semanal
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatHours(weeklyTotalHours)}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sumatoria de todas las horas registradas en la tabla.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-5 lg:w-auto">
            {weekDays.map((day) => (
              <div
                key={`summary-${day.key}`}
                className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {day.label}
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  {formatHours(weeklyTotals[day.key])}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Clock size={20} className="mr-2 text-purple-600 dark:text-purple-400" />
            Entradas recientes
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
                Las entradas aparecerán aquí después de guardar el registro múltiple
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {entry.workerName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(entry.date)} · {entry.regularHours}h · {entry.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.approved
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}
                    >
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
