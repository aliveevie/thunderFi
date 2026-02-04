/**
 * Yellow SDK Types for ThunderFi
 * State channel types and interfaces for off-chain transactions
 */

export interface YellowConfig {
  clearNodeUrl: string;
  chainId: number;
  environment: 'sandbox' | 'production';
}

export interface ChannelParticipant {
  address: string;
  balance: string;
}

export interface YellowChannel {
  id: string;
  participants: ChannelParticipant[];
  status: ChannelStatus;
  chainId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ChannelStatus =
  | 'pending'
  | 'open'
  | 'active'
  | 'closing'
  | 'closed'
  | 'disputed';

export interface AppSession {
  id: string;
  channelId: string;
  protocol: string;
  participants: string[];
  allocations: SessionAllocation[];
  status: SessionStatus;
  nonce: number;
  createdAt: Date;
}

export type SessionStatus =
  | 'creating'
  | 'open'
  | 'active'
  | 'closing'
  | 'closed';

export interface SessionAllocation {
  participant: string;
  asset: string;
  amount: string;
}

export interface PaymentIntent {
  recipient: string;
  amount: string;
  asset: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  id: string;
  sessionId: string;
  sender: string;
  recipient: string;
  amount: string;
  asset: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface LedgerBalance {
  asset: string;
  available: string;
  locked: string;
  total: string;
}

export interface YellowConnectionState {
  status: 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';
  error?: string;
  jwt?: string;
}

export interface ClearNodeMessage {
  jsonrpc: '2.0';
  id: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface AuthChallenge {
  challenge: string;
  scope: string;
  sessionKey: string;
  expiration: number;
}

export interface AppDefinition {
  protocol: string;
  participants: string[];
  weights: number[];
  quorum: number;
  challenge: number;
  nonce: number;
}

export interface SessionConfig {
  definition: AppDefinition;
  allocations: SessionAllocation[];
}

export interface YellowEventMap {
  connected: void;
  disconnected: void;
  error: Error;
  balanceUpdate: LedgerBalance[];
  sessionUpdate: AppSession;
  paymentReceived: PaymentResult;
  stateUpdate: { sessionId: string; state: unknown };
}

export type YellowEventHandler<K extends keyof YellowEventMap> = (
  data: YellowEventMap[K]
) => void;
