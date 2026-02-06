import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, SessionStats } from '@/types';
import { generateId } from '@/lib/utils';
import * as api from '@/services/api';

interface SessionState {
  session: Session | null;
  stats: SessionStats;
  isCreating: boolean;
  isClosing: boolean;
  isYellowSession: boolean;
  yellowSessionId: string | null;

  // Core actions
  createSession: (allowance: string, walletAddress?: string) => Promise<void>;
  closeSession: () => Promise<void>;
  updateSpent: (amount: string) => void;
  incrementActions: () => void;

  // Yellow integration
  setYellowSession: (sessionId: string, allowance: string, walletAddress?: string) => Promise<void>;
  syncYellowSession: (data: {
    remaining: string;
    actionsCount: number;
    status: 'active' | 'settling' | 'closed';
  }) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(persist((set) => ({
  session: null,
  stats: {
    totalActions: 0,
    gasSaved: '0',
    totalFeesPaid: '0',
    netPnL: '0',
  },
  isCreating: false,
  isClosing: false,
  isYellowSession: false,
  yellowSessionId: null,

  createSession: async (allowance: string, walletAddress?: string) => {
    set({ isCreating: true });

    try {
      let sessionId = generateId();

      // Register with server to get JWT (needed for payout/wallet APIs)
      if (walletAddress) {
        try {
          const serverSession = await api.createServerSession(walletAddress, allowance);
          sessionId = serverSession.id;
        } catch (err) {
          console.warn('[Session] Server registration failed, using local session:', err);
        }
      }

      const session: Session = {
        id: sessionId,
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
        isYellowSession: false,
        stats: {
          totalActions: 0,
          gasSaved: '0',
          totalFeesPaid: '0',
          netPnL: '0',
        },
      });
    } catch {
      set({ isCreating: false });
    }
  },

  closeSession: async () => {
    set({ isClosing: true });
    await new Promise((resolve) => setTimeout(resolve, 1000));

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

  // Set session from Yellow Network
  setYellowSession: async (sessionId: string, allowance: string, walletAddress?: string) => {
    // Register with server to get JWT + server session UUID for payout/wallet APIs
    let serverSessionId = sessionId;
    if (walletAddress) {
      try {
        const serverSession = await api.createServerSession(walletAddress, allowance);
        serverSessionId = serverSession.id;
      } catch (err) {
        console.warn('[Session] Server registration failed, using Yellow session ID:', err);
      }
    }

    const session: Session = {
      id: serverSessionId,
      status: 'active',
      allowance,
      spent: '0',
      remaining: allowance,
      actionsCount: 0,
      createdAt: new Date(),
    };

    set({
      session,
      isCreating: false,
      isYellowSession: true,
      yellowSessionId: sessionId,
      stats: {
        totalActions: 0,
        gasSaved: '0',
        totalFeesPaid: '0',
        netPnL: '0',
      },
    });
  },

  // Sync state from Yellow session updates
  syncYellowSession: (data) => {
    set((state) => {
      if (!state.session) return state;

      const gasSaved = (data.actionsCount * 1.5).toFixed(2);
      const totalFeesPaid = (data.actionsCount * 0.001).toFixed(4);

      return {
        session: {
          ...state.session,
          remaining: data.remaining,
          spent: (parseFloat(state.session.allowance) - parseFloat(data.remaining)).toFixed(4),
          actionsCount: data.actionsCount,
          status: data.status,
        },
        stats: {
          ...state.stats,
          totalActions: data.actionsCount,
          gasSaved,
          totalFeesPaid,
        },
      };
    });
  },

  clearSession: () => {
    api.setAuthToken(null);
    set({
      session: null,
      isYellowSession: false,
      yellowSessionId: null,
      stats: {
        totalActions: 0,
        gasSaved: '0',
        totalFeesPaid: '0',
        netPnL: '0',
      },
    });
  },
}), {
  name: 'thunderfi-session',
  partialize: (state) => ({
    session: state.session,
    stats: state.stats,
    isYellowSession: state.isYellowSession,
    yellowSessionId: state.yellowSessionId,
  }),
}));
