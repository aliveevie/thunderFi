import { create } from 'zustand';
import type { Session, SessionStats } from '@/types';
import { generateId } from '@/lib/utils';

interface SessionState {
  session: Session | null;
  stats: SessionStats;
  isCreating: boolean;
  isClosing: boolean;

  createSession: (allowance: string) => Promise<void>;
  closeSession: () => Promise<void>;
  updateSpent: (amount: string) => void;
  incrementActions: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  stats: {
    totalActions: 0,
    gasSaved: '0',
    totalFeesPaid: '0',
    netPnL: '0',
  },
  isCreating: false,
  isClosing: false,

  createSession: async (allowance: string) => {
    set({ isCreating: true });
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const session: Session = {
      id: generateId(),
      status: 'active',
      allowance,
      spent: '0',
      remaining: allowance,
      actionsCount: 0,
      depositTxHash: '0x' + generateId() + generateId(),
      createdAt: new Date(),
    };

    set({
      session,
      isCreating: false,
      stats: {
        totalActions: 0,
        gasSaved: '0',
        totalFeesPaid: '0',
        netPnL: '0',
      },
    });
  },

  closeSession: async () => {
    set({ isClosing: true });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    set((state) => ({
      session: state.session
        ? { ...state.session, status: 'closed' }
        : null,
      isClosing: false,
    }));
  },

  updateSpent: (amount: string) => {
    set((state) => {
      if (!state.session) return state;
      const newSpent = (parseFloat(state.session.spent) + parseFloat(amount)).toFixed(4);
      const newRemaining = (parseFloat(state.session.allowance) - parseFloat(newSpent)).toFixed(4);
      return {
        session: {
          ...state.session,
          spent: newSpent,
          remaining: newRemaining,
        },
      };
    });
  },

  incrementActions: () => {
    set((state) => {
      if (!state.session) return state;
      const newActionsCount = state.session.actionsCount + 1;
      // Estimate gas saved per action (~$1.50 on average)
      const gasSaved = (newActionsCount * 1.5).toFixed(2);
      // Small fee per action (~$0.001)
      const totalFeesPaid = (newActionsCount * 0.001).toFixed(4);

      return {
        session: {
          ...state.session,
          actionsCount: newActionsCount,
        },
        stats: {
          ...state.stats,
          totalActions: newActionsCount,
          gasSaved,
          totalFeesPaid,
        },
      };
    });
  },
}));
