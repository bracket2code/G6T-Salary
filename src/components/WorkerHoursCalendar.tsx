import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import type { Worker } from "../types/salary";

export interface DayHoursSummary {
  totalHours: number;
  notes: string[];
  companies: Array<{
    companyId?: string;
    name?: string;
    hours: number;
  }>;
}

interface WorkerHoursCalendarProps {
  worker: Worker | null;
  selectedMonth: Date;
  hoursByDate: Record<string, DayHoursSummary>;
  onMonthChange: (date: Date) => void;
  isLoading?: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  hours: number | null;
  hasNotes: boolean;
  dayKey: string;
}

const weekDayLabels = ["L", "M", "X", "J", "V", "S", "D"];

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const getStartOfMonth = (reference: Date) =>
  new Date(reference.getFullYear(), reference.getMonth(), 1);

const getEndOfMonth = (reference: Date) =>
  new Date(reference.getFullYear(), reference.getMonth() + 1, 0);

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const WorkerHoursCalendar: React.FC<WorkerHoursCalendarProps> = ({
  worker,
  selectedMonth,
  hoursByDate,
  onMonthChange,
  isLoading = false,
}) => {
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const { days, totalTrackedDays, totalHours } = useMemo(() => {
    const startOfMonth = getStartOfMonth(selectedMonth);
    const endOfMonth = getEndOfMonth(selectedMonth);

    const firstDayIndex = (startOfMonth.getDay() + 6) % 7; // Lunes = 0
    const totalCells = 42;

    const cells: CalendarDay[] = [];

    // Días del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const date = new Date(startOfMonth);
      date.setDate(startOfMonth.getDate() - (i + 1));
      const dayKey = formatDateKey(date);
      cells.push({
        date,
        isCurrentMonth: false,
        isWeekend: isWeekend(date),
        isToday: false,
        hours: null,
        hasNotes: false,
        dayKey,
      });
    }

    // Días del mes actual
    for (let day = 1; day <= endOfMonth.getDate(); day++) {
      const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
      const dayKey = formatDateKey(date);
      const dayStats = hoursByDate[dayKey];
      const totalDayHours = dayStats ? dayStats.totalHours : 0;
      cells.push({
        date,
        isCurrentMonth: true,
        isWeekend: isWeekend(date),
        isToday: date.toDateString() === new Date().toDateString(),
        hours: totalDayHours,
        hasNotes: Boolean(dayStats?.notes?.length),
        dayKey,
      });
    }

    // Días del mes siguiente hasta completar grilla
    while (cells.length < totalCells) {
      const last = cells[cells.length - 1].date;
      const date = new Date(last);
      date.setDate(last.getDate() + 1);
      const dayKey = formatDateKey(date);
      cells.push({
        date,
        isCurrentMonth: false,
        isWeekend: isWeekend(date),
        isToday: false,
        hours: null,
        hasNotes: false,
        dayKey,
      });
    }

    const trackedDays = Object.values(hoursByDate).reduce((acc, detail) => {
      if (detail && detail.totalHours > 0) {
        return acc + 1;
      }
      return acc;
    }, 0);
    const totalHours = Object.values(hoursByDate).reduce(
      (acc, value) => acc + (value?.totalHours ?? 0),
      0
    );

    return {
      days: cells,
      totalTrackedDays: trackedDays,
      totalHours,
    };
  }, [selectedMonth, hoursByDate]);

  useEffect(() => {
    const firstDayOfMonth = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth(),
      1
    );
    const today = new Date();

    if (
      today.getFullYear() === selectedMonth.getFullYear() &&
      today.getMonth() === selectedMonth.getMonth()
    ) {
      setSelectedDayKey(formatDateKey(today));
      return;
    }

    setSelectedDayKey(formatDateKey(firstDayOfMonth));
  }, [selectedMonth]);

  const goToPreviousMonth = () => {
    onMonthChange(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    onMonthChange(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
  };

  const handleDaySelect = (day: CalendarDay) => {
    if (!day.isCurrentMonth) {
      return;
    }
    setSelectedDayKey(day.dayKey);
  };

  const parseDateKeyToDate = (key: string | null) => {
    if (!key) {
      return null;
    }
    const [year, month, day] = key.split("-").map((part) => Number(part));
    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day)
    ) {
      return null;
    }
    return new Date(year, month - 1, day);
  };

  const selectedDayDetails = selectedDayKey
    ? hoursByDate[selectedDayKey]
    : undefined;
  const selectedDate = parseDateKeyToDate(selectedDayKey);
  const companyColumns = selectedDayDetails?.companies ?? [];

  const selectedNotes = selectedDayDetails?.notes ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-blue-600 dark:text-blue-400" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Calendario de Horas</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Visualiza las horas registradas del trabajador seleccionado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="p-2 rounded-full"
              onClick={goToPreviousMonth}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px] text-center">
              {formatMonthTitle(selectedMonth)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="p-2 rounded-full"
              onClick={goToNextMonth}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!worker ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Selecciona un trabajador para visualizar su calendario de horas.
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Cargando horas...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-7 text-center text-base font-semibold text-gray-500 uppercase">
              {weekDayLabels.map((label) => (
                <div key={label} className="py-2">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 text-base border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
              {days.map((day, index) => (
                <div
                  key={`${day.date.toISOString()}-${index}`}
                  role={day.isCurrentMonth ? "button" : undefined}
                  tabIndex={day.isCurrentMonth ? 0 : -1}
                  onClick={() => handleDaySelect(day)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleDaySelect(day);
                    }
                  }}
                  className={`min-h-[92px] p-3 border-b border-r border-gray-100 dark:border-gray-700 flex flex-col gap-2 transition ${
                    day.isCurrentMonth
                      ? "bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer"
                      : "bg-gray-50 dark:bg-gray-900/40"
                  } ${
                    day.isToday && day.isCurrentMonth ? "ring-1 ring-blue-500" : ""
                  } ${
                    day.isWeekend && day.isCurrentMonth
                      ? "bg-gray-50 dark:bg-gray-900/70"
                      : ""
                  } ${
                    day.hasNotes && day.isCurrentMonth
                      ? "bg-[#FEF3C7] dark:bg-amber-900/40"
                      : ""
                  } ${
                    selectedDayKey === day.dayKey && day.isCurrentMonth
                      ? "ring-2 ring-blue-500"
                      : ""
                  }`}
                >
                  <span
                    className={`text-lg font-semibold leading-none ${
                      day.isCurrentMonth
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-600"
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                  <span className="text-base font-medium text-gray-600 dark:text-gray-300">
                    {day.hours !== null ? `${day.hours.toFixed(1)} h` : "-"}
                  </span>
                  {day.hasNotes && day.isCurrentMonth && (
                    <span className="text-[12px] font-medium text-amber-600 dark:text-amber-300">
                      Nota
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-800 dark:text-blue-200">
              <div className="flex flex-wrap gap-4">
                <span>Total horas registradas: {totalHours.toFixed(1)} h</span>
                <span>Días con registros: {totalTrackedDays}</span>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedDate
                      ? selectedDate.toLocaleDateString("es-ES", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "Selecciona un día"}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Distribución de horas por empresa
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Total día: {selectedDayDetails?.totalHours?.toFixed(1) ?? "0.0"} h
                </span>
              </div>

              {companyColumns.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm text-gray-700 dark:text-gray-200">
                    <thead>
                      <tr>
                        <th className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                          Empresa
                        </th>
                        {companyColumns.map((company) => (
                          <th
                            key={`${company.companyId ?? company.name ?? "sin"}-header`}
                            className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200"
                          >
                            {company.name?.trim() || "Sin empresa"}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                          Horas
                        </th>
                        {companyColumns.map((company) => (
                          <td
                            key={`${company.companyId ?? company.name ?? "sin"}-value`}
                            className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left"
                          >
                            {company.hours.toFixed(2)} h
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  {selectedDate
                    ? "No hay horas registradas para este día."
                    : "Selecciona un día del calendario para ver el detalle."}
                </p>
              )}

              {selectedNotes.length > 0 && (
                <div className="mt-4 rounded-md bg-[#FEF3C7] dark:bg-amber-900/40 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <h4 className="font-semibold">Notas del día</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    {selectedNotes.map((note, index) => (
                      <li key={`${selectedDayKey}-note-${index}`}>• {note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {worker.companyNames && worker.companyNames.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  Empresas asociadas:
                </span>{" "}
                {worker.companyNames.join(", ")}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
