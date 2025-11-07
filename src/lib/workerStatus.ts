import { Worker } from "../types/salary";

export const isWorkerActive = (worker?: Worker): boolean => {
  if (!worker) {
    return false;
  }
  return (worker.situation ?? 0) !== 1 && worker.isActive !== false;
};

export const countWorkersByActivity = (
  memberIds: string[] | undefined,
  workersById: Map<string, Worker>
): { active: number; inactive: number } => {
  let active = 0;
  let inactive = 0;

  (memberIds ?? []).forEach((memberId) => {
    const worker = workersById.get(memberId);
    if (!worker) {
      return;
    }
    if (isWorkerActive(worker)) {
      active += 1;
    } else {
      inactive += 1;
    }
  });

  return { active, inactive };
};
