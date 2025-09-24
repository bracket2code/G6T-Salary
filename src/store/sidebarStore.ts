import { create } from 'zustand';

interface SidebarState {
}

interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  open: () => void;
  setInitialState: () => void;
}

const getInitialState = () => window.innerWidth >= 768;

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: getInitialState(),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),
  open: () => set({ isOpen: true }),
  setInitialState: () => set({ isOpen: getInitialState() }),
}));