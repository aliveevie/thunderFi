/**
 * Yellow Network React Context
 * Provides Yellow SDK service and connection state to the app
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import {
  YellowService,
  getYellowService,
  type YellowConnectionState,
  type LedgerBalance,
  type AppSession,
} from '@/lib/yellow';

interface YellowContextValue {
  // Connection
  service: YellowService | null;
  connectionState: YellowConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;

  // Balances
  balances: LedgerBalance[];
  refreshBalances: () => Promise<void>;

  // Sessions
  sessions: AppSession[];
  activeSession: AppSession | null;
  setActiveSession: (sessionId: string | null) => void;
}

const YellowContext = createContext<YellowContextValue | null>(null);

interface YellowProviderProps {
  children: ReactNode;
  environment?: 'sandbox' | 'production';
}

export function YellowProvider({
  children,
  environment = 'sandbox',
}: YellowProviderProps) {
  const { address, isConnected: walletConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [service] = useState(() => getYellowService(environment));
  const [connectionState, setConnectionState] = useState<YellowConnectionState>({
    status: 'disconnected',
  });
  const [balances, setBalances] = useState<LedgerBalance[]>([]);
  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Message signer using wagmi
  const messageSigner = useCallback(
    async (message: string): Promise<string> => {
      return signMessageAsync({ message });
    },
    [signMessageAsync]
  );

  // Connect to Yellow Network
  const connect = useCallback(async () => {
    if (!address || !walletConnected) {
      throw new Error('Wallet not connected');
    }

    setConnectionState({ status: 'connecting' });

    try {
      await service.connect(address, messageSigner);
      setConnectionState(service.getConnectionState());

      // Fetch initial balances
      const initialBalances = await service.getBalances();
      setBalances(initialBalances);
    } catch (error) {
      setConnectionState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }, [address, walletConnected, service, messageSigner]);

  // Disconnect from Yellow Network
  const disconnect = useCallback(() => {
    service.disconnect();
    setConnectionState({ status: 'disconnected' });
    setBalances([]);
    setSessions([]);
    setActiveSessionId(null);
  }, [service]);

  // Refresh balances
  const refreshBalances = useCallback(async () => {
    if (!service.isConnected()) return;

    try {
      const newBalances = await service.getBalances();
      setBalances(newBalances);
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  }, [service]);

  // Set active session
  const setActiveSession = useCallback((sessionId: string | null) => {
    setActiveSessionId(sessionId);
  }, []);

  // Subscribe to Yellow events
  useEffect(() => {
    const unsubscribeConnected = service.on('connected', () => {
      setConnectionState(service.getConnectionState());
    });

    const unsubscribeDisconnected = service.on('disconnected', () => {
      setConnectionState({ status: 'disconnected' });
    });

    const unsubscribeError = service.on('error', (error) => {
      console.error('[Yellow] Error:', error);
      setConnectionState({
        status: 'error',
        error: error.message,
      });
    });

    const unsubscribeBalance = service.on('balanceUpdate', (newBalances) => {
      setBalances(newBalances);
    });

    const unsubscribeSession = service.on('sessionUpdate', (session) => {
      setSessions((prev) => {
        const index = prev.findIndex((s) => s.id === session.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = session;
          return updated;
        }
        return [...prev, session];
      });
    });

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeError();
      unsubscribeBalance();
      unsubscribeSession();
    };
  }, [service]);

  // Disconnect when wallet disconnects
  useEffect(() => {
    if (!walletConnected && connectionState.status === 'connected') {
      disconnect();
    }
  }, [walletConnected, connectionState.status, disconnect]);

  // Get active session
  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [activeSessionId, sessions]);

  const value = useMemo<YellowContextValue>(
    () => ({
      service,
      connectionState,
      isConnected: connectionState.status === 'connected',
      isConnecting:
        connectionState.status === 'connecting' ||
        connectionState.status === 'authenticating',
      connect,
      disconnect,
      balances,
      refreshBalances,
      sessions,
      activeSession,
      setActiveSession,
    }),
    [
      service,
      connectionState,
      connect,
      disconnect,
      balances,
      refreshBalances,
      sessions,
      activeSession,
      setActiveSession,
    ]
  );

  return (
    <YellowContext.Provider value={value}>{children}</YellowContext.Provider>
  );
}

export function useYellow(): YellowContextValue {
  const context = useContext(YellowContext);
  if (!context) {
    throw new Error('useYellow must be used within a YellowProvider');
  }
  return context;
}
