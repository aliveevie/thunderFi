import { create } from 'zustand';
import type { SettlementBatch } from '@/types';
import { generateId } from '@/lib/utils';

interface SettlementState {
  batches: SettlementBatch[];
  currentBatch: SettlementBatch | null;
  isSettling: boolean;

  createBatch: (actionsCount: number) => Promise<SettlementBatch>;
  commitBatch: (batchId: string) => Promise<void>;
  revealBatch: (batchId: string) => Promise<void>;
}

export const useSettlementStore = create<SettlementState>((set) => ({
  batches: [],
  currentBatch: null,
  isSettling: false,

  createBatch: async (actionsCount) => {
    const batch: SettlementBatch = {
      id: generateId(),
      actionsCount,
      status: 'building',
      netAmount: (Math.random() * 100 - 50).toFixed(2), // Random P&L
      createdAt: new Date(),
    };

    set((state) => ({
      batches: [batch, ...state.batches],
      currentBatch: batch,
    }));

    return batch;
  },

  commitBatch: async (batchId) => {
    set({ isSettling: true });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const commitTxHash = '0x' + generateId() + generateId() + generateId();

    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId
          ? { ...b, status: 'committed', commitTxHash }
          : b
      ),
      currentBatch: state.currentBatch?.id === batchId
        ? { ...state.currentBatch, status: 'committed', commitTxHash }
        : state.currentBatch,
      isSettling: false,
    }));
  },

  revealBatch: async (batchId) => {
    set({ isSettling: true });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const revealTxHash = '0x' + generateId() + generateId() + generateId();
    const gasCost = (Math.random() * 5 + 2).toFixed(2);

    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId
          ? { ...b, status: 'settled', revealTxHash, gasCost }
          : b
      ),
      currentBatch: null,
      isSettling: false,
    }));
  },
}));
