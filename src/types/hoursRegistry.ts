import type {
  DayNoteEntry,
  DayScheduleEntry,
} from "../components/WorkerHoursCalendar";

export interface DayDescriptor {
  date: Date;
  dateKey: string;
  label: string;
  shortLabel: string;
  compactLabel: string;
  dayOfMonth: number;
}

export interface Assignment {
  id: string;
  workerId: string;
  workerName: string;
  companyId: string;
  companyName: string;
  hours: Record<string, string>;
}

export interface WorkerWeeklyDayData {
  totalHours: number;
  companyHours: Record<
    string,
    {
      companyId?: string;
      name?: string;
      hours: number;
    }
  >;
  entries?: DayScheduleEntry[];
  noteEntries?: DayNoteEntry[];
}

export interface WorkerWeeklyData {
  days: Record<string, WorkerWeeklyDayData>;
}

export interface AssignmentTotalsContext {
  workerWeekData: Record<string, WorkerWeeklyData>;
}

