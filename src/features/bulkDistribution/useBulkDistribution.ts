import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DayNoteEntry } from "../../components/WorkerHoursCalendar";
import type {
  Assignment,
  DayDescriptor,
} from "../../pages/HoursRegistryPage";

export type DistributionViewMode = "worker" | "company";

export interface BulkDistributionTarget {
  groupId: string;
  groupName: string;
  assignmentIds: string[];
  day: DayDescriptor;
  viewMode: DistributionViewMode;
}

interface UseBulkDistributionOptions {
  assignments: Assignment[];
  resolveDayNotes: (workerId: string, dateKey: string) => DayNoteEntry[];
  setAssignments: Dispatch<SetStateAction<Assignment[]>>;
  setNoteDraftsByDay: Dispatch<
    SetStateAction<Record<string, DayNoteEntry[]>>
  >;
  formatHours: (value: number) => string;
  hoursFormatter: Intl.NumberFormat;
  buildNotesStateKey: (workerId: string, dateKey: string) => string;
  generateUuid: () => string;
}

interface ApplyPayload {
  dayKey: string;
  updates: Record<string, number>;
  description?: string;
  viewMode: DistributionViewMode;
}

export const useBulkDistribution = ({
  assignments,
  resolveDayNotes,
  setAssignments,
  setNoteDraftsByDay,
  formatHours,
  hoursFormatter,
  buildNotesStateKey,
  generateUuid,
}: UseBulkDistributionOptions) => {
  const [bulkDistributionTarget, setBulkDistributionTarget] =
    useState<BulkDistributionTarget | null>(null);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, Assignment>();
    assignments.forEach((assignment) => {
      map.set(assignment.id, assignment);
    });
    return map;
  }, [assignments]);

  const bulkDistributionAssignments = useMemo(() => {
    if (!bulkDistributionTarget) {
      return [] as Assignment[];
    }
    return bulkDistributionTarget.assignmentIds
      .map((assignmentId) => assignmentMap.get(assignmentId) ?? null)
      .filter(
        (assignment): assignment is Assignment => assignment !== null
      );
  }, [assignmentMap, bulkDistributionTarget]);

  const closeBulkDistributionModal = useCallback(() => {
    setBulkDistributionTarget(null);
  }, []);

  const openBulkDistributionModal = useCallback(
    (payload: BulkDistributionTarget) => {
      if (!payload.assignmentIds.length) {
        return;
      }
      setBulkDistributionTarget(payload);
    },
    []
  );

  const handleBulkDistributionApply = useCallback(
    (payload: ApplyPayload) => {
      setAssignments((prev) =>
        prev.map((assignment) => {
          const nextValue = payload.updates[assignment.id];
          if (nextValue === undefined) {
            return assignment;
          }

          const formattedValue =
            nextValue > 0 ? hoursFormatter.format(nextValue) : "";

          return {
            ...assignment,
            hours: {
              ...assignment.hours,
              [payload.dayKey]: formattedValue,
            },
          };
        })
      );

      if (
        payload.description &&
        payload.viewMode === "worker" &&
        Object.keys(payload.updates).length > 0
      ) {
        const assignmentEntries = Object.entries(payload.updates)
          .map(([assignmentId, hours]) => {
            const assignment = assignmentMap.get(assignmentId);
            return assignment ? { assignment, hours } : null;
          })
          .filter(
            (
              entry
            ): entry is { assignment: Assignment; hours: number } =>
              entry !== null
          );

        const firstEntry = assignmentEntries[0];

        if (firstEntry) {
          const workerId = firstEntry.assignment.workerId;
          const key = buildNotesStateKey(workerId, payload.dayKey);
          const existingNotes = resolveDayNotes(workerId, payload.dayKey);
          const baseEntry = existingNotes[0];

          const summarySegments = assignmentEntries
            .filter((entry) => entry.hours > 0)
            .map(
              (entry) =>
                `${entry.assignment.companyName}: ${formatHours(entry.hours)}`
            );

          if (summarySegments.length) {
            const summaryLine = `${payload.description.trim()} → ${summarySegments.join(
              ", "
            )}`;
            const mergedText = baseEntry?.text?.trim()
              ? `${baseEntry.text.trim()}\n${summaryLine}`
              : summaryLine;

            const nextNotes = baseEntry
              ? [{ ...baseEntry, text: mergedText }]
              : [
                  {
                    id: generateUuid(),
                    text: mergedText,
                    origin: "description" as DayNoteEntry["origin"],
                    companyId: firstEntry.assignment.companyId,
                    companyName: firstEntry.assignment.companyName,
                  },
                ];

            setNoteDraftsByDay((prev) => ({
              ...prev,
              [key]: nextNotes,
            }));
          }
        }
      }

      setBulkDistributionTarget(null);
    },
    [
      assignmentMap,
      buildNotesStateKey,
      formatHours,
      generateUuid,
      hoursFormatter,
      resolveDayNotes,
      setAssignments,
      setNoteDraftsByDay,
    ]
  );

  return {
    bulkDistributionAssignments,
    bulkDistributionTarget,
    closeBulkDistributionModal,
    handleBulkDistributionApply,
    openBulkDistributionModal,
  };
};
