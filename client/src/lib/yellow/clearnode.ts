/**
 * ClearNode WebSocket Connection Manager
 * Handles connection, authentication, and message routing for Yellow Network
 */

import type {
  YellowConfig,
  YellowConnectionState,
  ClearNodeMessage,
  AuthChallenge,
  MessageSigner,
  YellowEventMap,
  YellowEventHandler,
} from './types';

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export class ClearNodeConnection {
  private ws: WebSocket | null = null;
  private config: YellowConfig;
  private signer: MessageSigner | null = null;
  private address: string | null = null;
  private state: YellowConnectionState = { status: 'disconnected' };
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private eventHandlers = new Map<keyof YellowEventMap, Set<YellowEventHandler<keyof YellowEventMap>>>();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: YellowConfig) {
    this.config = config;
  }

  /**
   * Connect to ClearNode with wallet authentication
   */
  async connect(address: string, signer: MessageSigner): Promise<void> {
    if (this.state.status === 'connected' || this.state.status === 'connecting') {
      return;
    }

    this.address = address;
    this.signer = signer;
    this.updateState({ status: 'connecting' });

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.clearNodeUrl);

        this.ws.onopen = async () => {
          this.reconnectAttempts = 0;
          this.updateState({ status: 'authenticating' });

          try {
            await this.authenticate();
            this.startHeartbeat();
            this.updateState({ status: 'connected' });
            this.emit('connected', undefined);
            resolve();
          } catch (error) {
            this.updateState({
              status: 'error',
              error: error instanceof Error ? error.message : 'Authentication failed'
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

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.updateState({ status: 'disconnected' });
          this.emit('disconnected', undefined);
          this.scheduleReconnect();
        };
      } catch (error) {
        this.updateState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Connection failed'
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
      this.ws.close();
      this.ws = null;
    }
    this.updateState({ status: 'disconnected' });
  }

  /**
   * Send RPC request and wait for response
   */
  async request<T>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.state.status !== 'connected') {
      throw new Error('Not connected to ClearNode');
    }

    const id = ++this.messageId;
    const message: ClearNodeMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  /**
   * Get current connection state
   */
  getState(): YellowConnectionState {
    return { ...this.state };
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
   * Authenticate with ClearNode using EIP-712 signature
   */
  private async authenticate(): Promise<void> {
    if (!this.signer || !this.address) {
      throw new Error('Signer and address required for authentication');
    }

    // Request authentication challenge
    const authRequest = await this.request<{ challenge: AuthChallenge }>('auth_request', {
      participant: this.address,
    });

    // Sign the challenge
    const challengeData = JSON.stringify({
      challenge: authRequest.challenge.challenge,
      scope: authRequest.challenge.scope,
      sessionKey: authRequest.challenge.sessionKey,
      expiration: authRequest.challenge.expiration,
    });

    const signature = await this.signer(challengeData);

    // Complete authentication
    const authResponse = await this.request<{ jwt: string }>('auth_verify', {
      participant: this.address,
      signature,
    });

    this.state.jwt = authResponse.jwt;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message: ClearNodeMessage = JSON.parse(data);

      // Handle RPC response
      if (message.id && this.pendingRequests.has(message.id)) {
        const pending = this.pendingRequests.get(message.id)!;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      // Handle server-initiated notifications
      if (message.method) {
        this.handleNotification(message.method, message.params);
      }
    } catch (error) {
      console.error('[ClearNode] Failed to parse message:', error);
    }
  }

  /**
   * Handle server notifications
   */
  private handleNotification(method: string, params: unknown): void {
    switch (method) {
      case 'balance_update':
        this.emit('balanceUpdate', params as YellowEventMap['balanceUpdate']);
        break;
      case 'session_update':
        this.emit('sessionUpdate', params as YellowEventMap['sessionUpdate']);
        break;
      case 'payment_received':
        this.emit('paymentReceived', params as YellowEventMap['paymentReceived']);
        break;
      case 'state_update':
        this.emit('stateUpdate', params as YellowEventMap['stateUpdate']);
        break;
      default:
        console.log('[ClearNode] Unknown notification:', method);
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
    if (!this.address || !this.signer) return;

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts++;

    console.log(`[ClearNode] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.address && this.signer) {
        this.connect(this.address, this.signer).catch((error) => {
          console.error('[ClearNode] Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.request('ping').catch(() => {
          // Ignore ping failures, connection will be handled by onclose
        });
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
