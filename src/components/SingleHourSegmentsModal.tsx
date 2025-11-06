import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import type { DayScheduleEntry } from "./WorkerHoursCalendar";
import type { HourSegment } from "../types/hourSegment";
import {
  calculateSegmentsTotalMinutes,
  formatMinutesToHoursLabel,
  parseTimeToMinutes,
  toInputNumberString,
} from "../lib/hours";
import {
  extractShiftDescription,
  extractObservationText,
} from "../lib/segmentDescriptions";
import { generateUuid } from "../lib/generateUuid";

export interface SingleHourSegmentsModalProps {
  isOpen: boolean;
  workerName: string;
  companyName: string;
  dayLabel: string;
  initialSegments: HourSegment[];
  existingEntries: DayScheduleEntry[];
  onClose: () => void;
  onSave: (segments: HourSegment[]) => void;
}

const createEmptySegment = (): HourSegment => ({
  id: generateUuid(),
  start: "",
  end: "",
  total: "",
  description: "",
});

export const SingleHourSegmentsModal: React.FC<SingleHourSegmentsModalProps> = ({
  isOpen,
  workerName,
  companyName,
  dayLabel,
  initialSegments,
  existingEntries,
  onClose,
  onSave,
}) => {
  const [segments, setSegments] = useState<HourSegment[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialSegments.length > 0) {
      setSegments(
        initialSegments.map((segment) => ({
          ...segment,
          total:
            toInputNumberString(
              segment.total ??
                (segment as { total?: unknown }).total ??
                (segment as { note?: string }).note ??
                undefined
            ) ?? "",
          description: segment.description ?? "",
        }))
      );
      return;
    }

    if (existingEntries.length > 0) {
      const derivedSegments = existingEntries.flatMap((entry) => {
        const entryRaw = (entry as { raw?: unknown }).raw as
          | Record<string, unknown>
          | undefined;
        const observationText = extractObservationText(entryRaw) ?? "";
        const entryTotal =
          toInputNumberString(
            entryRaw?.value ?? entryRaw?.hours ?? entry.hours
          ) ?? "";

        if (Array.isArray(entry.workShifts) && entry.workShifts.length > 0) {
          return entry.workShifts
            .map((shift, index): HourSegment | null => {
              const start = shift.startTime ?? "";
              const end = shift.endTime ?? "";
              if (!start && !end) {
                return null;
              }

              const shiftTotal =
                toInputNumberString(
                  (shift as Record<string, unknown> | undefined)?.value ??
                    shift.hours ??
                    (shift as Record<string, unknown> | undefined)
                      ?.workedHours
                ) ?? entryTotal;

              const shiftDescription =
                extractShiftDescription(shift, observationText) ?? "";

              return {
                id:
                  shift.id ??
                  `existing-shift-${entry.id}-${index}-${Math.random()
                    .toString(36)
                    .slice(2, 6)}`,
                start,
                end,
                total: shiftTotal ?? "",
                description: shiftDescription,
              };
            })
            .filter((segment): segment is HourSegment => segment !== null);
        }

        if (entryTotal) {
          const numericHours =
            typeof entry.hours === "number" && Number.isFinite(entry.hours)
              ? entry.hours
              : (() => {
                  const normalized = String(entryTotal).replace(",", ".");
                  const parsed = Number.parseFloat(normalized);
                  return Number.isFinite(parsed) ? parsed : 0;
                })();
          if (numericHours <= 0) {
            return [];
          }

          const minutes = Math.round(numericHours * 60);
          const startMinutes = 8 * 60;
          const endMinutes = startMinutes + minutes;
          const startLabel = `${String(Math.floor(startMinutes / 60)).padStart(
            2,
            "0"
          )}:${String(startMinutes % 60).padStart(2, "0")}`;
          const endLabel = `${String(Math.floor(endMinutes / 60)).padStart(
            2,
            "0"
          )}:${String(endMinutes % 60).padStart(2, "0")}`;

          return [
            {
              id: `existing-hours-${entry.id}`,
              start: startLabel,
              end: endLabel,
              total: entryTotal,
              description: observationText,
            } satisfies HourSegment,
          ];
        }

        return [];
      });

      if (derivedSegments.length > 0) {
        setSegments(derivedSegments);
        return;
      }
    }

    setSegments([createEmptySegment()]);
  }, [existingEntries, initialSegments, isOpen]);

  const invalidSegments = useMemo(
    () =>
      segments.some((segment) => {
        if (!segment.start && !segment.end) {
          return false;
        }

        if (!segment.start || !segment.end) {
          return true;
        }

        const start = parseTimeToMinutes(segment.start);
        const end = parseTimeToMinutes(segment.end);

        if (start === null || end === null) {
          return true;
        }

        return end <= start;
      }),
    [segments]
  );

  const totalMinutes = useMemo(
    () => calculateSegmentsTotalMinutes(segments),
    [segments]
  );

  const totalLabel = formatMinutesToHoursLabel(totalMinutes);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMinutesRemainder = totalMinutes % 60;

  const handleSegmentChange = (
    id: string,
    field: "start" | "end" | "total" | "description",
    value: string
  ) => {
    setSegments((prev) =>
      prev.map((segment) => {
        if (segment.id !== id) {
          return segment;
        }

        const nextSegment = { ...segment, [field]: value };
        if (field === "start" || field === "end") {
          const startMinutes = parseTimeToMinutes(
            field === "start" ? value : nextSegment.start
          );
          const endMinutes = parseTimeToMinutes(
            field === "end" ? value : nextSegment.end
          );
          if (
            startMinutes !== null &&
            endMinutes !== null &&
            endMinutes > startMinutes
          ) {
            const diffMinutes = endMinutes - startMinutes;
            const hours = diffMinutes / 60;
            const formatted = hours.toFixed(2);
            nextSegment.total = formatted
              .replace(/\.00$/, "")
              .replace(/(\.\d)0$/, "$1");
          }
        }

        return nextSegment;
      })
    );
  };

  const handleRemoveSegment = (id: string) => {
    setSegments((prev) => {
      const next = prev.filter((segment) => segment.id !== id);
      if (next.length === 0) {
        return [createEmptySegment()];
      }
      return next;
    });
  };

  const handleAddSegment = () => {
    setSegments((prev) => [...prev, createEmptySegment()]);
  };

  const handleSave = () => {
    const validSegments = segments.filter((segment) => {
      const start = parseTimeToMinutes(segment.start);
      const end = parseTimeToMinutes(segment.end);
      return (
        segment.start &&
        segment.end &&
        start !== null &&
        end !== null &&
        end > start
      );
    });

    onSave(validSegments.map((segment) => ({ ...segment })));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative z-10 flex w-full max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="border-b border-gray-200 p-4 sm:p-5 dark:border-gray-700">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {companyName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {workerName}
              </p>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {dayLabel}
              </h2>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Cerrar configuración de turnos"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Turno {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSegment(segment.id)}
                  className="px-2 py-1 text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                  leftIcon={<Trash2 size={16} />}
                >
                  Eliminar
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input
                  type="time"
                  size="sm"
                  label="Inicio"
                  value={segment.start}
                  onChange={(event) =>
                    handleSegmentChange(segment.id, "start", event.target.value)
                  }
                  required
                />
                <Input
                  type="time"
                  size="sm"
                  label="Fin"
                  value={segment.end}
                  onChange={(event) =>
                    handleSegmentChange(segment.id, "end", event.target.value)
                  }
                  required
                />
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  label="Descripción"
                  size="sm"
                  value={segment.description ?? ""}
                  onChange={(event) =>
                    handleSegmentChange(
                      segment.id,
                      "description",
                      event.target.value
                    )
                  }
                  fullWidth
                  placeholder="Observaciones del turno"
                />
                <div className="sm:w-[12.5%]">
                  <Input
                    label="Total horas"
                    size="sm"
                    value={segment.total ?? ""}
                    onChange={(event) =>
                      handleSegmentChange(segment.id, "total", event.target.value)
                    }
                    fullWidth
                    inputMode="decimal"
                    placeholder="Ej. 3,5"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSegment}
              leftIcon={<Plus size={16} />}
            >
              Añadir turno
            </Button>
          </div>

          {invalidSegments && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200">
              Revisa los turnos: la hora de fin debe ser posterior a la hora de
              inicio y el formato debe ser HH:MM.
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="font-medium text-gray-700 dark:text-gray-200">
              Horas calculadas
            </p>
            <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
              {totalLabel} h
              {totalMinutes > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({totalHours}h {totalMinutesRemainder}m)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:justify-end sm:gap-4 dark:border-gray-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={invalidSegments}
            className="w-full sm:w-auto"
          >
            Guardar turnos
          </Button>
        </div>
      </div>
    </div>
  );
};
