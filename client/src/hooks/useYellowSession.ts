/**
 * Yellow Session Management Hook
 * Handles creation, management, and closure of Yellow Network sessions
 */

import { useState, useCallback } from 'react';
import { useYellow } from '@/contexts';
import type { AppSession } from '@/lib/yellow';

interface UseYellowSessionOptions {
  autoConnect?: boolean;
}

interface CreateSessionParams {
  allowance: string;
  protocol?: string;
}

interface SessionStats {
  totalActions: number;
  pendingActions: number;
  settledActions: number;
  gasEstimateSaved: string;
}

export function useYellowSession(_options: UseYellowSessionOptions = {}) {
  const {
    service,
    isConnected,
    isConnecting,
    connect: connectYellow,
    activeSession,
    setActiveSession,
    sessions,
  } = useYellow();

  const [isCreating, setIsCreating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalActions: 0,
    pendingActions: 0,
    settledActions: 0,
    gasEstimateSaved: '0',
  });

  /**
   * Create a new trading session
   */
  const createSession = useCallback(
    async (params: CreateSessionParams): Promise<AppSession> => {
      if (!service) {
        throw new Error('Yellow service not initialized');
      }

      setIsCreating(true);
      setError(null);

      try {
        // Ensure connected to Yellow Network
        if (!isConnected) {
          await connectYellow();
        }

        // Create the trading session
        const session = await service.createTradingSession(params.allowance);

        // Set as active session
        setActiveSession(session.id);

        // Reset stats for new session
        setSessionStats({
          totalActions: 0,
          pendingActions: 0,
          settledActions: 0,
          gasEstimateSaved: '0',
        });

        return session;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create session';
        setError(message);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [service, isConnected, connectYellow, setActiveSession]
  );

  /**
   * Execute a trade action within the current session
   */
  const executeAction = useCallback(
    async (action: {
      type: 'buy' | 'sell';
      pair: string;
      amount: string;
      price?: string;
    }) => {
      if (!service || !activeSession) {
        throw new Error('No active session');
      }

      try {
        const result = await service.executeTradeAction(activeSession.id, action);

        // Update stats
        setSessionStats((prev) => ({
          ...prev,
          totalActions: prev.totalActions + 1,
          pendingActions: prev.pendingActions + 1,
          // Estimate ~$1.50 gas saved per action
          gasEstimateSaved: (parseFloat(prev.gasEstimateSaved) + 1.5).toFixed(2),
        }));

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        throw err;
      }
    },
    [service, activeSession]
  );

  /**
   * Request settlement of pending actions
   */
  const requestSettlement = useCallback(async () => {
    if (!service || !activeSession) {
      throw new Error('No active session');
    }

    setIsSettling(true);
    setError(null);

    try {
      const result = await service.requestSettlement(activeSession.id);

      // Update stats after settlement
      setSessionStats((prev) => ({
        ...prev,
        settledActions: prev.settledActions + result.actionsCount,
        pendingActions: 0,
      }));

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Settlement failed';
      setError(message);
      throw err;
    } finally {
      setIsSettling(false);
    }
  }, [service, activeSession]);

  /**
   * Get pending actions for the current session
   */
  const getPendingActions = useCallback(async () => {
    if (!service || !activeSession) {
      return [];
    }

    try {
      return await service.getPendingActions(activeSession.id);
    } catch (err) {
      console.error('Failed to get pending actions:', err);
      return [];
    }
  }, [service, activeSession]);

  /**
   * Close the current session
   */
  const closeSession = useCallback(async () => {
    if (!service || !activeSession) {
      throw new Error('No active session');
    }

    setIsClosing(true);
    setError(null);

    try {
      const result = await service.closeSession(activeSession.id);
      setActiveSession(null);

      // Reset stats
      setSessionStats({
        totalActions: 0,
        pendingActions: 0,
        settledActions: 0,
        gasEstimateSaved: '0',
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close session';
      setError(message);
      throw err;
    } finally {
      setIsClosing(false);
    }
  }, [service, activeSession, setActiveSession]);

  /**
   * Calculate remaining allowance
   */
  const getRemainingAllowance = useCallback((): string => {
    if (!activeSession) return '0';

    const userAllocation = activeSession.allocations.find(
      (a) => a.participant === activeSession.participants[0]
    );
    return userAllocation?.amount || '0';
  }, [activeSession]);

  return {
    // State
    session: activeSession,
    sessions,
    isConnected,
    isConnecting,
    isCreating,
    isClosing,
    isSettling,
    error,
    stats: sessionStats,

    // Actions
    createSession,
    executeAction,
    requestSettlement,
    getPendingActions,
    closeSession,
    getRemainingAllowance,

    // Clear error
    clearError: () => setError(null),
  };
}
