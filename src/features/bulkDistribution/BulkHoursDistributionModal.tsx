import React, { useEffect, useMemo, useState } from "react";
import { MessageSquareWarning, X } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { formatDate } from "../../lib/utils";
import type {
  Assignment,
  AssignmentTotalsContext,
  DayDescriptor,
} from "../../pages/HoursRegistryPage";
import type { DistributionViewMode } from "./useBulkDistribution";

const HOURS_COMPARISON_EPSILON = 0.01;

const percentFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type DistributionMode = "hours" | "percentage";

export interface BulkHoursDistributionModalProps {
  isOpen: boolean;
  targetDay: DayDescriptor | null;
  groupName: string;
  viewMode: DistributionViewMode;
  assignments: Assignment[];
  totalsContext: AssignmentTotalsContext;
  resolveAssignmentHourValue: (
    assignment: Assignment,
    dateKey: string,
    context: AssignmentTotalsContext
  ) => number;
  formatHours: (value: number) => string;
  hoursFormatter: Intl.NumberFormat;
  onClose: () => void;
  onApply: (payload: {
    dayKey: string;
    updates: Record<string, number>;
    description?: string;
    viewMode: DistributionViewMode;
  }) => void;
}

export const BulkHoursDistributionModal: React.FC<
  BulkHoursDistributionModalProps
> = ({
  isOpen,
  targetDay,
  groupName,
  viewMode,
  assignments,
  totalsContext,
  resolveAssignmentHourValue,
  formatHours,
  hoursFormatter,
  onClose,
  onApply,
}) => {
  const [description, setDescription] = useState("");
  const [totalHoursInput, setTotalHoursInput] = useState("");
  const [mode, setMode] = useState<DistributionMode>("hours");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoursValues, setHoursValues] = useState<Record<string, string>>({});
  const [percentValues, setPercentValues] = useState<Record<string, string>>(
    {}
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!isOpen || !targetDay) {
      return;
    }

    setDescription("");
    setTotalHoursInput("");
    setMode("hours");
    setSubmitAttempted(false);

    const nextSelection = new Set<string>();
    const nextHours: Record<string, string> = {};

    assignments.forEach((assignment) => {
      nextSelection.add(assignment.id);
      const raw = assignment.hours[targetDay.dateKey];
      if (typeof raw === "string" && raw.trim().length > 0) {
        nextHours[assignment.id] = raw;
      }
    });

    setSelectedIds(nextSelection);
    setHoursValues(nextHours);
    setPercentValues({});
  }, [assignments, isOpen, targetDay]);

  const parseDecimalInput = (value: string | undefined): number | null => {
    if (!value) {
      return null;
    }
    const trimmed = value.replace(/[%h]/gi, "").trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const selectedAssignments = useMemo(
    () => assignments.filter((assignment) => selectedIds.has(assignment.id)),
    [assignments, selectedIds]
  );

  const sanitizedTotalInput = totalHoursInput.trim();
  const parsedTotalHours =
    sanitizedTotalInput.length > 0
      ? parseDecimalInput(totalHoursInput) ?? null
      : null;

  const sumSelectedHours = selectedAssignments.reduce((total, assignment) => {
    const parsed = parseDecimalInput(hoursValues[assignment.id]);
    return total + (parsed ?? 0);
  }, 0);

  const percentSum = selectedAssignments.reduce((total, assignment) => {
    const parsed = parseDecimalInput(percentValues[assignment.id]);
    return total + (parsed ?? 0);
  }, 0);

  const hoursDifference =
    parsedTotalHours === null ? null : parsedTotalHours - sumSelectedHours;

  const hasBlankHourValue = selectedAssignments.some((assignment) => {
    const raw = (hoursValues[assignment.id] ?? "").trim();
    return raw.length === 0;
  });

  const distributionError = useMemo(() => {
    if (!selectedAssignments.length) {
      return "Selecciona al menos una fila para continuar.";
    }
    if (parsedTotalHours === null || parsedTotalHours <= 0) {
      return "Ingresa un total de horas mayor a cero.";
    }
    if (mode === "hours") {
      if (hasBlankHourValue) {
        return "Completa las horas para todas las empresas seleccionadas o desmarca las que no quieras modificar.";
      }
      if (hoursDifference === null) {
        return null;
      }
      if (Math.abs(hoursDifference) > HOURS_COMPARISON_EPSILON) {
        const formattedTotal = formatHours(parsedTotalHours);
        const formattedSum = formatHours(sumSelectedHours);
        return `La suma de horas (${formattedSum}) no coincide con el total indicado (${formattedTotal}).`;
      }
      return null;
    }

    if (parsedTotalHours === null) {
      return "Ingresa el total de horas antes de repartir por porcentaje.";
    }

    if (percentSum <= 0) {
      return "Define el porcentaje para al menos una empresa.";
    }

    if (Math.abs(percentSum - 100) > 0.5) {
      return "La suma de porcentajes debe ser 100%.";
    }

    return null;
  }, [
    hasBlankHourValue,
    hoursDifference,
    mode,
    parsedTotalHours,
    percentSum,
    selectedAssignments.length,
    sumSelectedHours,
    formatHours,
  ]);

  if (!isOpen || !targetDay) {
    return null;
  }

  const dayLabel =
    formatDate(targetDay.dateKey) ??
    `${targetDay.label} ${targetDay.dayOfMonth}`;
  const allSelected =
    assignments.length > 0 && selectedIds.size === assignments.length;

  const handleToggleAll = (checked: boolean) => {
    setSelectedIds(
      checked
        ? new Set(assignments.map((assignment) => assignment.id))
        : new Set()
    );
    setSubmitAttempted(false);
  };

  const handleToggleSelection = (assignmentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) {
        next.delete(assignmentId);
      } else {
        next.add(assignmentId);
      }
      return next;
    });
    setSubmitAttempted(false);
  };

  const handleHoursChange = (assignmentId: string, value: string) => {
    setHoursValues((prev) => ({
      ...prev,
      [assignmentId]: value,
    }));
    setSubmitAttempted(false);
  };

  const handlePercentChange = (assignmentId: string, value: string) => {
    setPercentValues((prev) => ({
      ...prev,
      [assignmentId]: value,
    }));
    setSubmitAttempted(false);
  };

  const handleModeChange = (nextMode: DistributionMode) => {
    if (mode === nextMode) {
      return;
    }
    setMode(nextMode);
    setSubmitAttempted(false);
  };

  const handleEqualDistribution = () => {
    if (!selectedAssignments.length) {
      setSubmitAttempted(true);
      return;
    }

    if (mode === "hours") {
      if (parsedTotalHours === null || parsedTotalHours <= 0) {
        setSubmitAttempted(true);
        return;
      }
      let remaining = parsedTotalHours;
      const base = parsedTotalHours / selectedAssignments.length;
      const next: Record<string, string> = {};
      selectedAssignments.forEach((assignment, index) => {
        const isLast = index === selectedAssignments.length - 1;
        const value = isLast ? remaining : Number(base.toFixed(4));
        remaining -= value;
        next[assignment.id] = hoursFormatter.format(Math.max(value, 0));
      });
      setHoursValues((prev) => ({ ...prev, ...next }));
    } else {
      let remaining = 100;
      const base = 100 / selectedAssignments.length;
      const next: Record<string, string> = {};
      selectedAssignments.forEach((assignment, index) => {
        const isLast = index === selectedAssignments.length - 1;
        const value = isLast ? remaining : Number(base.toFixed(4));
        remaining -= value;
        next[assignment.id] = hoursFormatter.format(Math.max(value, 0));
      });
      setPercentValues((prev) => ({ ...prev, ...next }));
    }
    setSubmitAttempted(false);
  };

  const handleClearSelected = () => {
    if (!selectedAssignments.length) {
      return;
    }
    setHoursValues((prev) => {
      const next = { ...prev };
      selectedAssignments.forEach((assignment) => {
        delete next[assignment.id];
      });
      return next;
    });
    setPercentValues((prev) => {
      const next = { ...prev };
      selectedAssignments.forEach((assignment) => {
        delete next[assignment.id];
      });
      return next;
    });
    setSubmitAttempted(false);
  };

  const handleApply = () => {
    setSubmitAttempted(true);
    if (distributionError) {
      return;
    }

    const updates: Record<string, number> = {};

    if (mode === "hours") {
      selectedAssignments.forEach((assignment) => {
        const parsed = parseDecimalInput(hoursValues[assignment.id]) ?? 0;
        updates[assignment.id] = Math.max(parsed, 0);
      });
    } else {
      const total = parsedTotalHours ?? 0;
      selectedAssignments.forEach((assignment) => {
        const percent = parseDecimalInput(percentValues[assignment.id]) ?? 0;
        const hours = (percent / 100) * total;
        updates[assignment.id] = Math.max(hours, 0);
      });
    }

    onApply({
      dayKey: targetDay.dateKey,
      description: description.trim() || undefined,
      updates,
      viewMode,
    });
  };

  const renderAssignmentRow = (assignment: Assignment) => {
    const isSelected = selectedIds.has(assignment.id);
    const primaryLabel =
      viewMode === "worker" ? assignment.companyName : assignment.workerName;
    const secondaryLabel =
      viewMode === "worker" ? assignment.workerName : assignment.companyName;
    const currentHours = resolveAssignmentHourValue(
      assignment,
      targetDay.dateKey,
      totalsContext
    );
    const percentValue = parseDecimalInput(percentValues[assignment.id]) ?? 0;
    const estimatedHours =
      parsedTotalHours !== null ? (percentValue / 100) * parsedTotalHours : 0;

    return (
      <div
        key={assignment.id}
        className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition dark:border-gray-700 dark:bg-gray-900 ${
          isSelected ? "" : "opacity-60"
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <label className="flex flex-1 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={isSelected}
              onChange={() => handleToggleSelection(assignment.id)}
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                {primaryLabel}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {secondaryLabel}
              </span>
            </span>
          </label>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Actual: {formatHours(currentHours)}
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {mode === "hours" ? (
            <Input
              size="sm"
              label="Horas a aplicar"
              value={hoursValues[assignment.id] ?? ""}
              onChange={(event) =>
                handleHoursChange(assignment.id, event.target.value)
              }
              disabled={!isSelected}
              inputMode="decimal"
              placeholder="Ej. 3,5"
              fullWidth
            />
          ) : (
            <Input
              size="sm"
              label="Porcentaje"
              value={percentValues[assignment.id] ?? ""}
              onChange={(event) =>
                handlePercentChange(assignment.id, event.target.value)
              }
              disabled={!isSelected || parsedTotalHours === null}
              inputMode="decimal"
              placeholder="Ej. 25"
              fullWidth
            />
          )}
          <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
            <span className="font-medium text-gray-700 dark:text-gray-200">
              Resultado estimado
            </span>
            {mode === "hours" ? (
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                {hoursValues[assignment.id]?.trim().length
                  ? `${hoursValues[assignment.id]} h`
                  : "—"}
              </span>
            ) : (
              <div className="text-right">
                <p>
                  {percentValues[assignment.id]?.trim().length
                    ? `${percentValues[assignment.id]} %`
                    : "—"}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {parsedTotalHours === null
                    ? "Ingresa el total para ver horas"
                    : `≈ ${hoursFormatter.format(estimatedHours)} h`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const differenceLabel =
    mode === "hours" && hoursDifference !== null
      ? hoursDifference > 0
        ? `Faltan ${formatHours(hoursDifference)} por asignar`
        : hoursDifference < 0
        ? `Te has pasado ${formatHours(Math.abs(hoursDifference))}`
        : "La suma coincide con el total."
      : null;

  const percentSummary =
    mode === "percentage"
      ? `Total asignado: ${percentFormatter.format(percentSum)} %`
      : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {dayLabel}
            </p>
            <h3 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
              Repartir horas • {groupName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Selecciona las filas que quieres actualizar y define cómo
              distribuir las horas de este día.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Cerrar reparto"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-5 lg:flex-row">
          <div className="w-full space-y-3 lg:w-60">
            <Input
              label="Descripción"
              placeholder="Ej. Proyecto Alfa"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSubmitAttempted(false);
              }}
              fullWidth
            />
            <Input
              label="Total de horas"
              placeholder="Ej. 8"
              value={totalHoursInput}
              onChange={(event) => {
                setTotalHoursInput(event.target.value);
                setSubmitAttempted(false);
              }}
              inputMode="decimal"
              fullWidth
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Forma de reparto
              </p>
              <div className="mt-2 inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 text-xs dark:border-gray-700 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => handleModeChange("hours")}
                  className={`rounded-full px-3 py-1 font-medium transition ${
                    mode === "hours"
                      ? "bg-white text-blue-600 shadow dark:bg-gray-900"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  Horas
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("percentage")}
                  className={`rounded-full px-4 py-1 text-sm font-medium transition ${
                    mode === "percentage"
                      ? "bg-white text-blue-600 shadow dark:bg-gray-900"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                Selección
              </p>
              <div className="mt-2 space-y-2 text-gray-600 dark:text-gray-300">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={allSelected}
                    onChange={(event) =>
                      handleToggleAll(event.target.checked)
                    }
                  />
                  Seleccionar todo ({selectedIds.size}/{assignments.length})
                </label>
                {mode === "hours" && differenceLabel && (
                  <p
                    className={`text-xs ${
                      hoursDifference && Math.abs(hoursDifference) > 0.01
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {differenceLabel}
                  </p>
                )}
                {mode === "percentage" && (
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    {percentSummary}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleEqualDistribution}
                disabled={!selectedAssignments.length}
              >
                Reparto equitativo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearSelected}
                disabled={!selectedAssignments.length}
              >
                Limpiar
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto pr-1">
              {assignments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay filas disponibles para este grupo.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {assignments.map((assignment) =>
                    renderAssignmentRow(assignment)
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {submitAttempted && distributionError && (
          <div className="mx-5 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-100">
            <div className="flex items-center gap-2">
              <MessageSquareWarning size={16} />
              <span>{distributionError}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end dark:border-gray-800">
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
            onClick={handleApply}
            className="w-full sm:w-auto"
          >
            Aplicar reparto
          </Button>
        </div>
      </div>
    </div>
  );
};
