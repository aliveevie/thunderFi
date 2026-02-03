/**
 * Yellow Network Service
 * High-level API for state channel sessions and off-chain payments
 */

import { ClearNodeConnection } from './clearnode';
import type {
  YellowConfig,
  AppSession,
  SessionConfig,
  SessionAllocation,
  PaymentIntent,
  PaymentResult,
  LedgerBalance,
  MessageSigner,
  YellowConnectionState,
  YellowEventMap,
  YellowEventHandler,
} from './types';

export interface CreateSessionParams {
  protocol: string;
  counterparty: string;
  allocation: {
    self: string;
    counterparty: string;
  };
  asset?: string;
}

export interface YellowServiceConfig extends YellowConfig {
  defaultAsset?: string;
}

export class YellowService {
  private connection: ClearNodeConnection;
  private config: YellowServiceConfig;
  private address: string | null = null;
  private activeSessions = new Map<string, AppSession>();

  constructor(config: YellowServiceConfig) {
    this.config = {
      defaultAsset: 'usdc',
      ...config,
    };
    this.connection = new ClearNodeConnection(config);

    // Listen for session updates
    this.connection.on('sessionUpdate', (session) => {
      this.activeSessions.set(session.id, session);
    });
  }

  /**
   * Initialize connection with wallet
   */
  async connect(address: string, signer: MessageSigner): Promise<void> {
    this.address = address;
    await this.connection.connect(address, signer);
  }

  /**
   * Disconnect from Yellow Network
   */
  disconnect(): void {
    this.address = null;
    this.activeSessions.clear();
    this.connection.disconnect();
  }

  /**
   * Get connection state
   */
  getConnectionState(): YellowConnectionState {
    return this.connection.getState();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection.getState().status === 'connected';
  }

  /**
   * Subscribe to Yellow events
   */
  on<K extends keyof YellowEventMap>(
    event: K,
    handler: YellowEventHandler<K>
  ): () => void {
    return this.connection.on(event, handler);
  }

  /**
   * Get ledger balances
   */
  async getBalances(): Promise<LedgerBalance[]> {
    const response = await this.connection.request<{ balances: LedgerBalance[] }>(
      'get_ledger_balances',
      { participant: this.address }
    );
    return response.balances;
  }

  /**
   * Create a new app session for off-chain interactions
   */
  async createSession(params: CreateSessionParams): Promise<AppSession> {
    if (!this.address) {
      throw new Error('Not connected');
    }

    const asset = params.asset || this.config.defaultAsset!;
    const nonce = Date.now();

    const sessionConfig: SessionConfig = {
      definition: {
        protocol: params.protocol,
        participants: [this.address, params.counterparty],
        weights: [50, 50],
        quorum: 100,
        challenge: 0,
        nonce,
      },
      allocations: [
        {
          participant: this.address,
          asset,
          amount: params.allocation.self,
        },
        {
          participant: params.counterparty,
          asset,
          amount: params.allocation.counterparty,
        },
      ],
    };

    const response = await this.connection.request<{ session: AppSession }>(
      'create_app_session',
      { config: sessionConfig }
    );

    this.activeSessions.set(response.session.id, response.session);
    return response.session;
  }

  /**
   * Create a session for thunderFi trading
   * Specialized for the thunderFi use case with single-user sessions
   */
  async createTradingSession(allowanceAmount: string): Promise<AppSession> {
    if (!this.address) {
      throw new Error('Not connected');
    }

    // For thunderFi, we create a session with the clearnode as counterparty
    // This enables instant off-chain trading within the allowance
    const clearnodeAddress = await this.getClearnodeAddress();

    return this.createSession({
      protocol: 'thunderfi-trading-v1',
      counterparty: clearnodeAddress,
      allocation: {
        self: allowanceAmount,
        counterparty: '0', // Clearnode doesn't need allocation
      },
      asset: 'usdc',
    });
  }

  /**
   * Send off-chain payment within a session
   */
  async sendPayment(
    sessionId: string,
    payment: PaymentIntent
  ): Promise<PaymentResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const response = await this.connection.request<{ payment: PaymentResult }>(
      'send_payment',
      {
        sessionId,
        recipient: payment.recipient,
        amount: payment.amount,
        asset: payment.asset || this.config.defaultAsset,
        metadata: payment.metadata,
      }
    );

    return response.payment;
  }

  /**
   * Execute a trade action within a session
   * This is an off-chain intent that will be batched and settled later
   */
  async executeTradeAction(
    sessionId: string,
    action: {
      type: 'buy' | 'sell';
      pair: string;
      amount: string;
      price?: string;
    }
  ): Promise<{
    actionId: string;
    status: 'confirmed';
    timestamp: Date;
  }> {
    const response = await this.connection.request<{
      actionId: string;
      status: 'confirmed';
      timestamp: string;
    }>('execute_action', {
      sessionId,
      action: {
        type: action.type,
        pair: action.pair,
        amount: action.amount,
        price: action.price,
      },
    });

    return {
      actionId: response.actionId,
      status: response.status,
      timestamp: new Date(response.timestamp),
    };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AppSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AppSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (s) => s.status === 'active' || s.status === 'open'
    );
  }

  /**
   * Close a session and initiate on-chain settlement
   */
  async closeSession(sessionId: string): Promise<{
    finalAllocations: SessionAllocation[];
    settlementTx?: string;
  }> {
    const response = await this.connection.request<{
      finalAllocations: SessionAllocation[];
      settlementTx?: string;
    }>('close_app_session', { sessionId });

    this.activeSessions.delete(sessionId);
    return response;
  }

  /**
   * Request settlement of pending actions
   * This triggers the commit-reveal process for batch settlement
   */
  async requestSettlement(sessionId: string): Promise<{
    batchId: string;
    actionsCount: number;
    status: 'committed' | 'pending';
    commitTx?: string;
  }> {
    const response = await this.connection.request<{
      batchId: string;
      actionsCount: number;
      status: 'committed' | 'pending';
      commitTx?: string;
    }>('request_settlement', { sessionId });

    return response;
  }

  /**
   * Get pending actions for a session
   */
  async getPendingActions(sessionId: string): Promise<
    Array<{
      id: string;
      type: string;
      amount: string;
      timestamp: Date;
      status: 'pending' | 'committed' | 'settled';
    }>
  > {
    const response = await this.connection.request<{
      actions: Array<{
        id: string;
        type: string;
        amount: string;
        timestamp: string;
        status: 'pending' | 'committed' | 'settled';
      }>;
    }>('get_pending_actions', { sessionId });

    return response.actions.map((a) => ({
      ...a,
      timestamp: new Date(a.timestamp),
    }));
  }

  /**
   * Get the clearnode address for session creation
   */
  private async getClearnodeAddress(): Promise<string> {
    const response = await this.connection.request<{ address: string }>(
      'get_clearnode_info'
    );
    return response.address;
  }
}

// Default configuration for different environments
export const YELLOW_CONFIGS: Record<'sandbox' | 'production', YellowConfig> = {
  sandbox: {
    clearNodeUrl: 'wss://clearnet-sandbox.yellow.com/ws',
    chainId: 11155111, // Sepolia
    environment: 'sandbox',
  },
  production: {
    clearNodeUrl: 'wss://clearnet.yellow.com/ws',
    chainId: 1, // Mainnet
    environment: 'production',
  },
};

// Singleton instance factory
let serviceInstance: YellowService | null = null;

export function getYellowService(
  environment: 'sandbox' | 'production' = 'sandbox'
): YellowService {
  if (!serviceInstance) {
    serviceInstance = new YellowService({
      ...YELLOW_CONFIGS[environment],
      defaultAsset: 'usdc',
    });
  }
  return serviceInstance;
}

export function resetYellowService(): void {
  if (serviceInstance) {
    serviceInstance.disconnect();
    serviceInstance = null;
  }
}
