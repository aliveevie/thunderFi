import { create } from 'zustand';
import type { Payout, PayoutRecipient } from '@/types';
import { generateId } from '@/lib/utils';

interface PayoutState {
  payouts: Payout[];
  isProcessing: boolean;

  createPayout: (recipients: Omit<PayoutRecipient, 'status' | 'txHash'>[]) => Promise<Payout>;
  processPayout: (payoutId: string) => Promise<void>;
}

export const usePayoutStore = create<PayoutState>((set, get) => ({
  payouts: [],
  isProcessing: false,

  createPayout: async (recipientData) => {
    const recipients: PayoutRecipient[] = recipientData.map((r) => ({
      ...r,
      status: 'pending',
    }));

    const totalAmount = recipients
      .reduce((sum, r) => sum + parseFloat(r.amount), 0)
      .toFixed(2);

    const payout: Payout = {
      id: generateId(),
      recipients,
      totalAmount,
      status: 'pending',
      createdAt: new Date(),
    };

    set((state) => ({
      payouts: [payout, ...state.payouts],
    }));

    return payout;
  },

  processPayout: async (payoutId) => {
    set({ isProcessing: true });

    // Simulate processing each recipient
    const payout = get().payouts.find((p) => p.id === payoutId);
    if (!payout) return;

    // Update status to processing
    set((state) => ({
      payouts: state.payouts.map((p) =>
        p.id === payoutId ? { ...p, status: 'processing' } : p
      ),
    }));

    // Process each recipient with a delay
    for (let i = 0; i < payout.recipients.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      set((state) => ({
        payouts: state.payouts.map((p) => {
          if (p.id !== payoutId) return p;
          const newRecipients = [...p.recipients];
          newRecipients[i] = {
            ...newRecipients[i],
            status: 'confirmed',
            txHash: '0x' + generateId() + generateId(),
          };
          return { ...p, recipients: newRecipients };
        }),
      }));
    }

    // Mark as completed
    set((state) => ({
      payouts: state.payouts.map((p) =>
        p.id === payoutId ? { ...p, status: 'completed' } : p
      ),
      isProcessing: false,
    }));
  },
}));
