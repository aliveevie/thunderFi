/**
 * ClearNode WebSocket Connection Manager
 * Real integration with Yellow Network using @erc7824/nitrolite SDK
 */

import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createPingMessageV2,
  createECDSAMessageSigner,
} from '@erc7824/nitrolite';
import type { AuthChallengeResponse, MessageSigner } from '@erc7824/nitrolite';
import type { WalletClient, Address, Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type {
  YellowConfig,
  YellowConnectionState,
  YellowEventMap,
  YellowEventHandler,
  LedgerBalance,
} from './types';
import { createWalletMessageSigner } from './wallet-signer';

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const REQUEST_TIMEOUT = 30000;

interface PendingRequest {
  resolve: (result: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// Re-export SDK signer type for convenience
export type SDKSigner = MessageSigner;

// Auth params that are synchronized between signer and auth_request
export interface AuthParams {
  scope: string;
  sessionKey: Address;
  expiresAt: bigint;
  allowances: Array<{ asset: string; amount: string }>;
  application: string;
}

export interface ClearNodeAsset {
  token: string;
  chain_id: number;
  symbol: string;
  decimals: number;
}

export class ClearNodeConnection {
  private ws: WebSocket | null = null;
  private config: YellowConfig;
  private sdkSigner: SDKSigner | null = null;
  private walletClient: WalletClient | null = null;
  private address: string | null = null;
  private authParams: AuthParams | null = null;
  private sessionKeyPrivateKey: Hex | null = null; // Session key for ECDSA signing
  private state: YellowConnectionState = { status: 'disconnected' };
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private eventHandlers = new Map<keyof YellowEventMap, Set<YellowEventHandler<keyof YellowEventMap>>>();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private supportedAssets: ClearNodeAsset[] = [];

  constructor(config: YellowConfig) {
    this.config = config;
  }

  /**
   * Connect to ClearNode with wallet authentication
   * Now accepts WalletClient directly to ensure auth params synchronization
   * @param address - The wallet address
   * @param walletClient - Viem WalletClient for signing
   */
  async connect(address: string, walletClient: WalletClient): Promise<void> {
    if (this.state.status === 'connected' || this.state.status === 'connecting') {
      return;
    }

    this.address = address;
    this.walletClient = walletClient;
    this.updateState({ status: 'connecting' });

    return new Promise((resolve, reject) => {
      try {
        console.log('[ClearNode] Connecting to:', this.config.clearNodeUrl);
        this.ws = new WebSocket(this.config.clearNodeUrl);

        this.ws.onopen = async () => {
          console.log('[ClearNode] WebSocket connected');
          this.reconnectAttempts = 0;
          this.updateState({ status: 'authenticating' });

          try {
            await this.authenticate();
            this.startHeartbeat();
            this.updateState({ status: 'connected' });
            this.emit('connected', undefined);
            resolve();
          } catch (error) {
            console.error('[ClearNode] Authentication failed:', error);
            this.updateState({
              status: 'error',
              error: error instanceof Error ? error.message : 'Authentication failed',
            });
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (event) => {
          console.error('[ClearNode] WebSocket error:', event);
          this.emit('error', new Error('WebSocket connection error'));
        };

        this.ws.onclose = (event) => {
          console.log('[ClearNode] WebSocket closed:', event.code, event.reason);
          this.stopHeartbeat();
          this.updateState({ status: 'disconnected' });
          this.emit('disconnected', undefined);

          // Reject pending requests
          this.pendingRequests.forEach((pending) => {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Connection closed'));
          });
          this.pendingRequests.clear();

          // Only reconnect if we were previously connected
          if (this.address && this.walletClient) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.updateState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Connection failed',
        });
        reject(error);
      }
    });
  }

  /**
   * Disconnect from ClearNode
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.address = null;
    this.walletClient = null;
    this.sdkSigner = null;
    this.authParams = null;
    this.sessionKeyPrivateKey = null;
    this.updateState({ status: 'disconnected' });
  }

  /**
   * Send a message (as string) and wait for response
   */
  async sendMessage(messageStr: string): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to ClearNode');
    }

    // Parse message to extract request ID
    const message = JSON.parse(messageStr);
    let requestId: number;

    // Handle different message formats from SDK
    if (message.req && Array.isArray(message.req)) {
      requestId = message.req[0] as number;
    } else if (Array.isArray(message) && message.length >= 1) {
      requestId = message[0] as number;
    } else {
      requestId = ++this.requestId;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout for ID: ${requestId}`));
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      console.log('[ClearNode] Sending:', messageStr.substring(0, 300));
      this.ws!.send(messageStr);
    });
  }

  /**
   * Get next request ID
   */
  getNextRequestId(): number {
    return ++this.requestId;
  }

  /**
   * Get current connection state
   */
  getState(): YellowConnectionState {
    return { ...this.state };
  }

  /**
   * Get connected address
   */
  getAddress(): string | null {
    return this.address;
  }

  /**
   * Get the SDK-compatible signer for use with SDK functions
   */
  getSigner(): SDKSigner | null {
    return this.sdkSigner;
  }

  /**
   * Get the SDK-compatible signer (alias)
   */
  getSDKSigner(): SDKSigner | null {
    return this.sdkSigner;
  }

  /**
   * Get supported assets from ClearNode broadcast
   */
  getSupportedAssets(): ClearNodeAsset[] {
    return this.supportedAssets;
  }

  /**
   * Get the token address for a specific chain from ClearNode assets
   * Returns the first USD-like token for the given chain
   */
  getTokenForChain(chainId: number): ClearNodeAsset | null {
    return this.supportedAssets.find(a => a.chain_id === chainId) || null;
  }

  /**
   * Subscribe to events
   */
  on<K extends keyof YellowEventMap>(
    event: K,
    handler: YellowEventHandler<K>
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as YellowEventHandler<keyof YellowEventMap>);

    return () => {
      this.eventHandlers.get(event)?.delete(handler as YellowEventHandler<keyof YellowEventMap>);
    };
  }

  /**
   * Authenticate with ClearNode using the real Nitrolite SDK
   * Uses a session key architecture:
   * 1. Generate a random session key (private key)
   * 2. Wallet signs EIP-712 auth message authorizing the session key
   * 3. Session key signs all subsequent RPC messages with raw ECDSA
   */
  private async authenticate(): Promise<void> {
    if (!this.walletClient || !this.address) {
      throw new Error('WalletClient and address required for authentication');
    }

    console.log('[ClearNode] Starting authentication for:', this.address);

    const walletAddress = this.address as `0x${string}`;

    // Generate a session key (random private key) for signing subsequent messages
    // This is required because ClearNode expects raw ECDSA signatures (not personal_sign)
    this.sessionKeyPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(this.sessionKeyPrivateKey);
    const sessionKeyAddress = sessionKeyAccount.address;

    console.log('[ClearNode] Generated session key:', sessionKeyAddress);

    // CRITICAL: Create auth params ONCE and use for both auth signer and auth_request
    // The expires_at MUST be identical in both places or ClearNode will reject the signature
    // Values from official SDK integration tests: application='clearnode', scope='console'
    this.authParams = {
      scope: 'console', // From SDK integration test
      sessionKey: sessionKeyAddress, // Use generated session key address
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600), // Unix timestamp: 1 hour from now
      allowances: [],
      application: 'clearnode', // Must match domain name; 'clearnode' is registered on sandbox
    };

    console.log('[ClearNode] Auth params created with expiresAt:', this.authParams.expiresAt.toString());

    // Create auth signer using wallet (EIP-712) for auth_verify only
    const authSigner = createWalletMessageSigner(this.walletClient, {
      scope: this.authParams.scope,
      sessionKey: this.authParams.sessionKey,
      expiresAt: this.authParams.expiresAt,
      allowances: this.authParams.allowances,
      application: this.authParams.application, // Domain name for EIP-712
    });

    // Create ECDSA signer using the session key for all subsequent messages
    // This is required because ClearNode expects raw ECDSA (keccak256 hash, no prefix)
    this.sdkSigner = createECDSAMessageSigner(this.sessionKeyPrivateKey);

    // Step 1: Send auth_request using SDK with the SAME params
    const authRequestMsg = await createAuthRequestMessage(
      {
        address: walletAddress,
        session_key: this.authParams.sessionKey,
        application: this.authParams.application,
        allowances: this.authParams.allowances,
        expires_at: this.authParams.expiresAt,
        scope: this.authParams.scope,
      },
      this.getNextRequestId(),
      Date.now()
    );

    console.log('[ClearNode] Sending auth_request');
    const authChallengeResponseStr = await this.sendMessage(authRequestMsg);
    console.log('[ClearNode] Received auth_challenge:', authChallengeResponseStr.substring(0, 200));

    // Parse the challenge response
    const rawResponse = JSON.parse(authChallengeResponseStr);

    // Check for error response
    if (rawResponse.res && rawResponse.res[1] === 'error') {
      throw new Error(`Auth request failed: ${JSON.stringify(rawResponse.res[2])}`);
    }

    // Convert Nitrolite RPC format to SDK's expected AuthChallengeResponse format
    // RPC format: { res: [requestId, method, params, timestamp], sig: [...] }
    // SDK format: { method: RPCMethod.AuthChallenge, params: { challengeMessage: string } }
    const challengeParams = rawResponse.res?.[2] || {};
    const challengeMessage = challengeParams.challenge_message || challengeParams.challengeMessage || '';

    if (!challengeMessage) {
      throw new Error('No challenge message received from ClearNode');
    }

    console.log('[ClearNode] Challenge received:', challengeMessage.substring(0, 50));

    // Cast to AuthChallengeResponse type expected by SDK
    const challengeResponse = {
      params: {
        challengeMessage,
      },
    } as AuthChallengeResponse;

    // Step 2: Sign the challenge and send auth_verify
    // Use the auth signer (wallet EIP-712) to authorize the session key
    const authVerifyMsg = await createAuthVerifyMessage(
      authSigner,
      challengeResponse,
      this.getNextRequestId(),
      Date.now()
    );

    console.log('[ClearNode] Sending auth_verify');
    const authResultStr = await this.sendMessage(authVerifyMsg);
    console.log('[ClearNode] Auth result:', authResultStr.substring(0, 200));

    // Parse auth result
    const authResult = JSON.parse(authResultStr);

    // Check for error in auth result
    if (authResult.res && authResult.res[1] === 'error') {
      throw new Error(`Authentication failed: ${JSON.stringify(authResult.res[2])}`);
    }

    // Extract JWT if provided
    if (authResult.res && authResult.res[2] && authResult.res[2].jwt) {
      this.state.jwt = authResult.res[2].jwt;
    }

    console.log('[ClearNode] Authentication successful');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      console.log('[ClearNode] Received:', data.substring(0, 300));
      const message = JSON.parse(data);

      // Nitrolite message format: { req?: RPCData, res?: RPCData, sig?: Hex[] }
      let requestId: number | undefined;

      if (message.res && Array.isArray(message.res)) {
        requestId = message.res[0] as number;
      } else if (message.req && Array.isArray(message.req)) {
        requestId = message.req[0] as number;
      }

      // Check if this is a response to a pending request
      if (requestId !== undefined && this.pendingRequests.has(requestId)) {
        const pending = this.pendingRequests.get(requestId)!;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);
        pending.resolve(data);
        return;
      }

      // Handle server broadcast messages (res with id=0)
      if (message.res && Array.isArray(message.res) && message.res[0] === 0) {
        const method = message.res[1] as string;
        this.handleBroadcast(method, message.res[2]);
      }

      // Handle server-initiated notifications (req format)
      if (message.req && Array.isArray(message.req)) {
        const method = message.req[1] as string;
        this.handleNotification(method, message);
      }
    } catch (error) {
      console.error('[ClearNode] Failed to parse message:', error);
    }
  }

  /**
   * Handle server broadcast messages (res with id=0)
   */
  private handleBroadcast(method: string, params: Record<string, unknown>): void {
    switch (method) {
      case 'assets': {
        const assets = params?.assets as ClearNodeAsset[] | undefined;
        if (assets && Array.isArray(assets)) {
          this.supportedAssets = assets;
          console.log('[ClearNode] Received supported assets:', assets.length, 'tokens');
          console.log('[ClearNode] Assets per chain:', JSON.stringify(
            assets.reduce((acc, a) => {
              acc[a.chain_id] = { symbol: a.symbol, token: a.token };
              return acc;
            }, {} as Record<number, { symbol: string; token: string }>)
          ));
        }
        break;
      }
      case 'channels':
        console.log('[ClearNode] Received channels broadcast');
        break;
      case 'bu':
        console.log('[ClearNode] Received balance updates broadcast');
        if (params?.balance_updates && Array.isArray(params.balance_updates) && params.balance_updates.length > 0) {
          this.emit('balanceUpdate', params.balance_updates as LedgerBalance[]);
        }
        break;
      default:
        console.log('[ClearNode] Unknown broadcast:', method);
    }
  }

  /**
   * Handle server notifications
   */
  private handleNotification(method: string, message: { req?: unknown[] }): void {
    console.log('[ClearNode] Notification:', method);

    const params = message.req?.[2];

    switch (method) {
      case 'balance_update':
        this.emit('balanceUpdate', params as LedgerBalance[]);
        break;
      case 'session_update':
        this.emit('sessionUpdate', params as YellowEventMap['sessionUpdate']);
        break;
      case 'payment_received':
        this.emit('paymentReceived', params as YellowEventMap['paymentReceived']);
        break;
      case 'app_message':
      case 'state_update':
        this.emit('stateUpdate', params as YellowEventMap['stateUpdate']);
        break;
      default:
        console.log('[ClearNode] Unknown notification:', method, params);
    }
  }

  /**
   * Emit event to handlers
   */
  private emit<K extends keyof YellowEventMap>(
    event: K,
    data: YellowEventMap[K]
  ): void {
    this.eventHandlers.get(event)?.forEach((handler) => {
      try {
        (handler as YellowEventHandler<K>)(data);
      } catch (error) {
        console.error(`[ClearNode] Event handler error for ${event}:`, error);
      }
    });
  }

  /**
   * Update connection state
   */
  private updateState(partial: Partial<YellowConnectionState>): void {
    this.state = { ...this.state, ...partial };
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (!this.address || !this.walletClient) return;

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts++;

    console.log(`[ClearNode] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.address && this.walletClient) {
        this.connect(this.address, this.walletClient).catch((error) => {
          console.error('[ClearNode] Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          const pingMsg = createPingMessageV2(this.getNextRequestId(), Date.now());
          await this.sendMessage(pingMsg);
        } catch (error) {
          console.warn('[ClearNode] Ping failed:', error);
        }
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
