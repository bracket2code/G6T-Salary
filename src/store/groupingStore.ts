import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CompanyGroup {
  id: string;
  name: string;
  color: string;
  companies: string[]; // company keys
  // Forma de pago del grupo
  paymentMethod?: 'bank' | 'cash';
}

interface GroupingState {
  groupsByWorkerId: Record<string, CompanyGroup[]>;
  getGroups: (workerId: string | null | undefined) => CompanyGroup[];
  setGroups: (workerId: string | null | undefined, groups: CompanyGroup[]) => void;
  clearGroups: (workerId: string | null | undefined) => void;
}

export const useGroupingStore = create<GroupingState>()(
  persist(
    (set, get) => ({
      groupsByWorkerId: {},
      getGroups: (workerId) => {
        if (!workerId) return [];
        return get().groupsByWorkerId[workerId] ?? [];
      },
      setGroups: (workerId, groups) => {
        if (!workerId) return;
        set((state) => ({
          groupsByWorkerId: { ...state.groupsByWorkerId, [workerId]: groups },
        }));
      },
      clearGroups: (workerId) => {
        if (!workerId) return;
        set((state) => {
          const next = { ...state.groupsByWorkerId };
          delete next[workerId];
          return { groupsByWorkerId: next };
        });
      },
    }),
    { name: "g6t-salary-company-groups" }
  )
);
