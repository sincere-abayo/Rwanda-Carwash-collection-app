import { create } from 'zustand';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  setOnline: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  setLastSyncTime: (time: string) => void;
  setPendingCount: (count: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncTime: null,
  pendingCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
}));
