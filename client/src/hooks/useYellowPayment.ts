/**
 * Yellow Payment Hook
 * Handles instant off-chain payments within Yellow Network sessions
 */

import { useState, useCallback, useEffect } from 'react';
import { useYellow } from '@/contexts';
import type { PaymentResult, LedgerBalance } from '@/lib/yellow';

interface PaymentParams {
  recipient: string;
  amount: string;
  asset?: string;
  metadata?: Record<string, unknown>;
}

interface PaymentHistoryItem extends PaymentResult {
  direction: 'sent' | 'received';
}

export function useYellowPayment() {
  const {
    service,
    isConnected,
    activeSession,
    balances,
    refreshBalances,
  } = useYellow();

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [lastPayment, setLastPayment] = useState<PaymentResult | null>(null);

  /**
   * Send an instant off-chain payment
   */
  const sendPayment = useCallback(
    async (params: PaymentParams): Promise<PaymentResult> => {
      if (!service || !activeSession) {
        throw new Error('No active session');
      }

      setIsSending(true);
      setError(null);

      try {
        const result = await service.sendPayment(activeSession.id, {
          recipient: params.recipient,
          amount: params.amount,
          asset: params.asset || 'usdc',
          metadata: params.metadata,
        });

        // Add to history
        setPaymentHistory((prev) => [
          { ...result, direction: 'sent' },
          ...prev,
        ]);

        setLastPayment(result);

        // Refresh balances after payment
        await refreshBalances();

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed';
        setError(message);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [service, activeSession, refreshBalances]
  );

  /**
   * Get balance for a specific asset
   */
  const getBalance = useCallback(
    (asset: string = 'usdc'): LedgerBalance | undefined => {
      return balances.find((b) => b.asset.toLowerCase() === asset.toLowerCase());
    },
    [balances]
  );

  /**
   * Get available balance for a specific asset
   */
  const getAvailableBalance = useCallback(
    (asset: string = 'usdc'): string => {
      const balance = getBalance(asset);
      return balance?.available || '0';
    },
    [getBalance]
  );

  /**
   * Check if user has sufficient balance for a payment
   */
  const hasSufficientBalance = useCallback(
    (amount: string, asset: string = 'usdc'): boolean => {
      const available = parseFloat(getAvailableBalance(asset));
      const requested = parseFloat(amount);
      return available >= requested;
    },
    [getAvailableBalance]
  );

  /**
   * Format amount for display (convert from smallest unit)
   */
  const formatAmount = useCallback(
    (amount: string, asset: string = 'usdc'): string => {
      // USDC has 6 decimals
      const decimals = asset.toLowerCase() === 'usdc' ? 6 : 18;
      const value = parseFloat(amount) / Math.pow(10, decimals);
      return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals,
      });
    },
    []
  );

  /**
   * Parse amount from display format to smallest unit
   */
  const parseAmount = useCallback(
    (displayAmount: string, asset: string = 'usdc'): string => {
      const decimals = asset.toLowerCase() === 'usdc' ? 6 : 18;
      const value = parseFloat(displayAmount) * Math.pow(10, decimals);
      return Math.floor(value).toString();
    },
    []
  );

  // Listen for incoming payments
  useEffect(() => {
    if (!service) return;

    const unsubscribe = service.on('paymentReceived', (payment) => {
      setPaymentHistory((prev) => [
        { ...payment, direction: 'received' },
        ...prev,
      ]);
    });

    return unsubscribe;
  }, [service]);

  return {
    // State
    isSending,
    error,
    balances,
    paymentHistory,
    lastPayment,
    isConnected,
    hasActiveSession: !!activeSession,

    // Actions
    sendPayment,
    refreshBalances,

    // Helpers
    getBalance,
    getAvailableBalance,
    hasSufficientBalance,
    formatAmount,
    parseAmount,

    // Clear error
    clearError: () => setError(null),
  };
}
