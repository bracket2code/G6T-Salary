import React from "react";
import { CalendarClock, NotebookPen, Users } from "lucide-react";
import { Button } from "./ui/Button";
import type { DayDescriptor, Assignment } from "../types/hoursRegistry";
import type { DistributionViewMode } from "../features/bulkDistribution/useBulkDistribution";
import { formatDate } from "../lib/utils";

export interface DayHeaderActionsTarget {
  groupId: string;
  groupName: string;
  assignments: Assignment[];
  day: DayDescriptor;
  viewMode: DistributionViewMode;
  canDistribute: boolean;
}

interface DayHeaderActionsSheetProps {
  target: DayHeaderActionsTarget | null;
  onClose: () => void;
  onSelectNotes: (target: DayHeaderActionsTarget) => void;
  onSelectSegments: (target: DayHeaderActionsTarget) => void;
  onSelectDistribution: (target: DayHeaderActionsTarget) => void;
}

export const DayHeaderActionsSheet: React.FC<DayHeaderActionsSheetProps> = ({
  target,
  onClose,
  onSelectNotes,
  onSelectSegments,
  onSelectDistribution,
}) => {
  if (!target) {
    return null;
  }

  const formattedFullDate =
    formatDate(target.day.dateKey) ??
    `${target.day.label} ${target.day.dayOfMonth}`.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Acciones rápidas
          </h3>
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {target.groupName}
            </p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {formattedFullDate}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onSelectNotes(target)}
            leftIcon={<NotebookPen size={16} />}
          >
            Notas del día
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onSelectSegments(target)}
            leftIcon={<CalendarClock size={16} />}
            disabled={target.assignments.length === 0}
          >
            Turnos horarios
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onSelectDistribution(target)}
            leftIcon={<Users size={16} />}
            disabled={!target.canDistribute}
          >
            Repartir horas
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};
