import { create } from 'zustand';
import type { Payout, PayoutRecipient } from '@/types';
import * as api from '@/services/api';

interface PayoutState {
  payouts: Payout[];
  isProcessing: boolean;
  isLoading: boolean;
  error: string | null;

  // Wallet state
  wallets: api.WalletRecord[];
  walletBalances: Record<string, api.CircleTokenBalance[]>;
  isLoadingBalances: boolean;

  createPayout: (sessionId: string, recipients: Omit<PayoutRecipient, 'status' | 'txHash'>[]) => Promise<Payout>;
  processPayout: (payoutId: string) => Promise<void>;
  fetchPayouts: (sessionId: string) => Promise<void>;

  // Wallet actions
  createWallets: (chains?: string[]) => Promise<void>;
  fetchWallets: () => Promise<void>;
  fetchWalletBalances: () => Promise<void>;

  clearError: () => void;
}

function apiPayoutToLocal(p: api.PayoutResponse): Payout {
  return {
    id: p.id,
    sessionId: p.sessionId,
    totalAmount: p.totalAmount,
    status: p.status as Payout['status'],
    createdAt: new Date(p.createdAt),
    recipients: p.recipients.map(r => ({
      address: r.address,
      chain: r.chain,
      amount: r.amount,
      status: r.status as PayoutRecipient['status'],
      txHash: r.txHash ?? undefined,
    })),
  };
}

export const usePayoutStore = create<PayoutState>((set, get) => ({
  payouts: [],
  isProcessing: false,
  isLoading: false,
  error: null,

  wallets: [],
  walletBalances: {},
  isLoadingBalances: false,

  createPayout: async (sessionId, recipientData) => {
    set({ error: null });

    const apiRecipients: api.PayoutRecipientInput[] = recipientData.map(r => ({
      address: r.address,
      chain: r.chain,
      amount: r.amount,
    }));

    const result = await api.createPayout(sessionId, apiRecipients);
    const payout = apiPayoutToLocal(result);

    set((state) => ({
      payouts: [payout, ...state.payouts],
    }));

    return payout;
  },

  processPayout: async (payoutId) => {
    set({ isProcessing: true, error: null });

    try {
      const result = await api.processPayout(payoutId);
      const updated = apiPayoutToLocal(result);

      set((state) => ({
        payouts: state.payouts.map(p => p.id === payoutId ? updated : p),
        isProcessing: false,
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to process payout';
      set({ isProcessing: false, error: errorMsg });
    }
  },

  fetchPayouts: async (sessionId) => {
    set({ isLoading: true, error: null });

    try {
      const results = await api.getPayouts(sessionId);
      const payouts = results.map(apiPayoutToLocal);

      set({ payouts, isLoading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch payouts';
      set({ isLoading: false, error: errorMsg });
    }
  },

  createWallets: async (chains = ['arc', 'arbitrum', 'base']) => {
    set({ error: null });

    try {
      await api.createWallets(chains);
      await get().fetchWallets();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create wallets';
      set({ error: errorMsg });
    }
  },

  fetchWallets: async () => {
    try {
      const wallets = await api.getWallets();
      set({ wallets });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch wallets';
      set({ error: errorMsg });
    }
  },

  fetchWalletBalances: async () => {
    set({ isLoadingBalances: true });

    try {
      const balances = await api.getAllBalances();
      set({ walletBalances: balances, isLoadingBalances: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch balances';
      set({ isLoadingBalances: false, error: errorMsg });
    }
  },

  clearError: () => set({ error: null }),
}));
