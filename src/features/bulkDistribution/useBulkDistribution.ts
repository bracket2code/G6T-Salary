import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
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
  setAssignments: Dispatch<SetStateAction<Assignment[]>>;
  hoursFormatter: Intl.NumberFormat;
}

interface ApplyPayload {
  dayKey: string;
  updates: Record<string, number>;
  description?: string;
  viewMode: DistributionViewMode;
}

export const useBulkDistribution = ({
  assignments,
  setAssignments,
  hoursFormatter,
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
      setBulkDistributionTarget(null);
    },
    [hoursFormatter, setAssignments]
  );

  return {
    bulkDistributionAssignments,
    bulkDistributionTarget,
    closeBulkDistributionModal,
    handleBulkDistributionApply,
    openBulkDistributionModal,
  };
};
