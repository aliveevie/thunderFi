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
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import {
  YellowService,
  getYellowService,
  type YellowConnectionState,
  type LedgerBalance,
  type AppSession,
  type WalletBalances,
  type DepositResult,
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

  // Deposits & Faucet
  walletBalances: WalletBalances | null;
  isDepositing: boolean;
  deposit: (amount: string) => Promise<DepositResult>;
  refreshWalletBalances: () => Promise<void>;
  ensureCorrectChain: () => Promise<void>;
  requestFaucetTokens: () => Promise<void>;
  isRequestingFaucet: boolean;

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

// Required chain for Yellow Network sandbox
const YELLOW_CHAIN_ID = baseSepolia.id; // 84532

export function YellowProvider({
  children,
  environment = 'sandbox',
}: YellowProviderProps) {
  const { address, isConnected: walletConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();

  const [service] = useState(() => getYellowService(environment));
  const [connectionState, setConnectionState] = useState<YellowConnectionState>({
    status: 'disconnected',
  });
  const [balances, setBalances] = useState<LedgerBalance[]>([]);
  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useState<WalletBalances | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isRequestingFaucet, setIsRequestingFaucet] = useState(false);

  // Ensure wallet is on Base Sepolia - call before any Yellow operation
  const ensureCorrectChain = useCallback(async () => {
    if (chainId !== YELLOW_CHAIN_ID) {
      console.log('[YellowContext] Switching to Base Sepolia (chain', YELLOW_CHAIN_ID, ')');
      await switchChainAsync({ chainId: YELLOW_CHAIN_ID });
      // Wait for the chain switch to propagate through wagmi
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, [chainId, switchChainAsync]);

  // Connect to Yellow Network
  const connect = useCallback(async () => {
    if (!address || !walletConnected) {
      throw new Error('Wallet not connected');
    }

    if (!walletClient) {
      throw new Error('Wallet client not available');
    }

    setConnectionState({ status: 'connecting' });

    try {
      // Always ensure on Base Sepolia before connecting
      await ensureCorrectChain();

      // Pass walletClient and publicClient - the connection will create the signer internally
      // with synchronized auth params (critical for EIP-712 signature verification)
      await service.connect(address, walletClient, publicClient);
      setConnectionState(service.getConnectionState());

      // Fetch initial balances
      const initialBalances = await service.getBalances();
      setBalances(initialBalances);
    } catch (error) {
      console.error('[YellowContext] Connection failed:', error);
      setConnectionState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }, [address, walletConnected, walletClient, publicClient, service, ensureCorrectChain]);

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

  // Refresh wallet balances (wallet, custody, ledger)
  const refreshWalletBalances = useCallback(async () => {
    if (!publicClient) return;

    try {
      // Switch to Base Sepolia if not on it
      await ensureCorrectChain();

      // Set public client if not already set
      service.setPublicClient(publicClient);
      const newBalances = await service.getWalletBalances(YELLOW_CHAIN_ID);
      console.log('[YellowContext] Wallet balances:', newBalances);
      setWalletBalances(newBalances);
    } catch (error) {
      console.error('Failed to refresh wallet balances:', error);
    }
  }, [service, publicClient, ensureCorrectChain]);

  // Deposit to custody contract
  const deposit = useCallback(async (amount: string): Promise<DepositResult> => {
    if (!publicClient) {
      throw new Error('Public client not available');
    }

    // Ensure on Base Sepolia before depositing
    await ensureCorrectChain();

    setIsDepositing(true);
    try {
      service.setPublicClient(publicClient);
      const result = await service.deposit({ amount });

      // Wait for deposit to be processed by ClearNode
      console.log('[YellowContext] Deposit tx complete, waiting for ClearNode to process...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Refresh balances after deposit
      await refreshWalletBalances();
      await refreshBalances();

      return result;
    } finally {
      setIsDepositing(false);
    }
  }, [service, publicClient, ensureCorrectChain, refreshWalletBalances, refreshBalances]);

  // Request test tokens from faucet (sandbox only)
  // This is a simple HTTP POST - does NOT require Yellow connection or signing
  const requestFaucetTokens = useCallback(async () => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsRequestingFaucet(true);
    try {
      await service.requestFaucetTokens(address);

      // Wait for faucet to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Only refresh balances if already connected to Yellow
      if (service.isConnected()) {
        await refreshBalances();
        await refreshWalletBalances();
      }
    } finally {
      setIsRequestingFaucet(false);
    }
  }, [service, address, refreshBalances, refreshWalletBalances]);

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
      walletBalances,
      isDepositing,
      deposit,
      refreshWalletBalances,
      ensureCorrectChain,
      requestFaucetTokens,
      isRequestingFaucet,
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
      walletBalances,
      isDepositing,
      deposit,
      refreshWalletBalances,
      ensureCorrectChain,
      requestFaucetTokens,
      isRequestingFaucet,
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
