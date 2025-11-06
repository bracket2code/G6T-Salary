import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import type { HourSegment } from "../types/hourSegment";
import {
  calculateSegmentsTotalMinutes,
  formatMinutesToHoursLabel,
  parseTimeToMinutes,
} from "../lib/hours";
import { generateUuid } from "../lib/generateUuid";

interface CompanyOption {
  assignmentId: string;
  companyName: string;
  workerName?: string;
}

export interface MultiHourSegmentsModalProps {
  isOpen: boolean;
  dayLabel: string;
  onClose: () => void;
  companyOptions: CompanyOption[];
  initialSegments: HourSegment[];
  onSaveByAssignment: (segments: Record<string, HourSegment[]>) => void;
  defaultAssignmentId?: string;
}

const createEmptySegment = (assignmentId: string): HourSegment => ({
  id: generateUuid(),
  assignmentId,
  start: "",
  end: "",
  total: "",
  description: "",
});

export const MultiHourSegmentsModal: React.FC<MultiHourSegmentsModalProps> = ({
  isOpen,
  dayLabel,
  onClose,
  companyOptions,
  initialSegments,
  onSaveByAssignment,
  defaultAssignmentId,
}) => {
  const fallbackAssignmentId =
    defaultAssignmentId ?? companyOptions[0]?.assignmentId ?? "";
  const [segments, setSegments] = useState<HourSegment[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (initialSegments.length > 0) {
      setSegments(
        initialSegments.map((segment) => ({
          ...segment,
          assignmentId: segment.assignmentId ?? fallbackAssignmentId,
        }))
      );
      return;
    }
    setSegments([createEmptySegment(fallbackAssignmentId)]);
  }, [initialSegments, isOpen, fallbackAssignmentId]);

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
    field: "start" | "end" | "total" | "description" | "assignmentId",
    value: string
  ) => {
    setSegments((prev) =>
      prev.map((segment) => {
        if (segment.id !== id) {
          return segment;
        }
        if (field === "assignmentId") {
          return {
            ...segment,
            assignmentId: value,
          };
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
            nextSegment.total = hours
              .toFixed(2)
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
      if (!next.length) {
        return [createEmptySegment(fallbackAssignmentId)];
      }
      return next;
    });
  };

  const handleAddSegment = () => {
    setSegments((prev) => [...prev, createEmptySegment(fallbackAssignmentId)]);
  };

  const handleSave = () => {
    const assignmentMap: Record<string, HourSegment[]> = {};
    companyOptions.forEach((option) => {
      assignmentMap[option.assignmentId] = [];
    });

    segments.forEach((segment) => {
      if (!segment.start || !segment.end) {
        return;
      }
      const start = parseTimeToMinutes(segment.start);
      const end = parseTimeToMinutes(segment.end);
      if (start === null || end === null || end <= start) {
        return;
      }
      const assignmentId =
        segment.assignmentId ?? fallbackAssignmentId ?? companyOptions[0]?.assignmentId;
      if (!assignmentId) {
        return;
      }
      assignmentMap[assignmentId] = assignmentMap[assignmentId] ?? [];
      assignmentMap[assignmentId].push({
        ...segment,
        assignmentId: undefined,
      });
    });

    onSaveByAssignment(assignmentMap);
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Turnos multiempresa
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {dayLabel}
              </p>
            </div>
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
              <Select
                label="Empresa"
                size="sm"
                fullWidth
                value={segment.assignmentId ?? fallbackAssignmentId}
                options={companyOptions.map((option) => ({
                  value: option.assignmentId,
                  label: option.companyName,
                }))}
                onChange={(value) =>
                  handleSegmentChange(segment.id, "assignmentId", value)
                }
                className="mt-3"
              />
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
