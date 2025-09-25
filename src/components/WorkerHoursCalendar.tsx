import React, { useMemo } from "react";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import type { Worker } from "../types/salary";

interface WorkerHoursCalendarProps {
  worker: Worker | null;
  selectedMonth: Date;
  hoursByDate: Record<string, number>;
  onMonthChange: (date: Date) => void;
  isLoading?: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  hours: number | null;
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
  const { days, totalWorkingDays, totalHours } = useMemo(() => {
    const startOfMonth = getStartOfMonth(selectedMonth);
    const endOfMonth = getEndOfMonth(selectedMonth);

    const firstDayIndex = (startOfMonth.getDay() + 6) % 7; // Lunes = 0
    const totalCells = 42;

    const cells: CalendarDay[] = [];

    // Días del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const date = new Date(startOfMonth);
      date.setDate(startOfMonth.getDate() - (i + 1));
      cells.push({
        date,
        isCurrentMonth: false,
        isWeekend: isWeekend(date),
        isToday: false,
        hours: null,
      });
    }

    // Días del mes actual
    for (let day = 1; day <= endOfMonth.getDate(); day++) {
      const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
      cells.push({
        date,
        isCurrentMonth: true,
        isWeekend: isWeekend(date),
        isToday: date.toDateString() === new Date().toDateString(),
        hours: hoursByDate[formatDateKey(date)] ?? 0,
      });
    }

    // Días del mes siguiente hasta completar grilla
    while (cells.length < totalCells) {
      const last = cells[cells.length - 1].date;
      const date = new Date(last);
      date.setDate(last.getDate() + 1);
      cells.push({
        date,
        isCurrentMonth: false,
        isWeekend: isWeekend(date),
        isToday: false,
        hours: null,
      });
    }

    const workingDays = cells.filter((cell) => cell.isCurrentMonth && !cell.isWeekend);
    const totalHours = Object.values(hoursByDate).reduce((acc, value) => acc + (value || 0), 0);

    return {
      days: cells,
      totalWorkingDays: workingDays.length,
      totalHours,
    };
  }, [selectedMonth, hoursByDate]);

  const goToPreviousMonth = () => {
    onMonthChange(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    onMonthChange(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
  };

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
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 uppercase">
              {weekDayLabels.map((label) => (
                <div key={label} className="py-2">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 text-xs border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
              {days.map((day, index) => (
                <div
                  key={`${day.date.toISOString()}-${index}`}
                  className={`min-h-[70px] p-2 border-b border-r border-gray-100 dark:border-gray-700 flex flex-col gap-1 ${
                    day.isCurrentMonth ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900/40"
                  } ${day.isToday ? "ring-1 ring-blue-500" : ""} ${day.isWeekend ? "bg-gray-50 dark:bg-gray-900/70" : ""}`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      day.isCurrentMonth
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-600"
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {day.hours !== null ? `${day.hours.toFixed(1)} h` : "-"}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-800 dark:text-blue-200">
              <div className="flex flex-wrap gap-4">
                <span>Total horas registradas: {totalHours.toFixed(1)} h</span>
                <span>Jornadas registradas: {totalWorkingDays}</span>
              </div>
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
