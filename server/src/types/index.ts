import { Request } from 'express';

// Extend Express Request
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
  };
  sessionId?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Session types
export interface CreateSessionInput {
  allowance: string;
  walletAddress: string;
}

export interface SessionResponse {
  id: string;
  yellowSessionId: string | null;
  status: string;
  initialAllowance: string;
  spentAmount: string;
  remainingAllowance: string;
  actionsCount: number;
  depositTxHash: string | null;
  createdAt: Date;
}

// Action types
export interface CreateActionInput {
  type: 'PLACE_ORDER' | 'CANCEL_ORDER' | 'MODIFY_ORDER' | 'MICRO_TIP';
  payload: PlaceOrderPayload | CancelOrderPayload | MicroTipPayload;
  signature?: string;
}

export interface PlaceOrderPayload {
  pair: string;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  orderType?: 'limit' | 'market';
}

export interface CancelOrderPayload {
  orderId: string;
}

export interface MicroTipPayload {
  recipient: string;
  amount: string;
  message?: string;
}

export interface ActionResponse {
  id: string;
  type: string;
  payload: unknown;
  fee: string;
  status: string;
  receipt: ActionReceipt | null;
  createdAt: Date;
}

export interface ActionReceipt {
  actionId: string;
  sequenceNumber: number;
  stateHash: string;
  timestamp: number;
  signature?: string;
}

// Settlement types
export interface SettlementPreview {
  actionsToSettle: number;
  estimatedGas: string;
  netAmount: string;
  batchHash: string;
}

export interface BatchResponse {
  id: string;
  sessionId: string;
  actionCount: number;
  status: string;
  netAmount: string;
  gasCost: string | null;
  commitTxHash: string | null;
  revealTxHash: string | null;
  createdAt: Date;
}

// Payout types
export interface CreatePayoutInput {
  recipients: PayoutRecipientInput[];
}

export interface PayoutRecipientInput {
  address: string;
  chain: string;
  amount: string;
}

export interface PayoutResponse {
  id: string;
  sessionId: string;
  recipients: PayoutRecipientResponse[];
  totalAmount: string;
  status: string;
  createdAt: Date;
}

export interface PayoutRecipientResponse {
  address: string;
  chain: string;
  amount: string;
  status: string;
  txHash: string | null;
}

// Wallet types
export interface WalletInfo {
  id: string;
  circleWalletId: string;
  chain: string;
  address: string;
  createdAt: Date;
}

export interface WalletBalanceResponse {
  chain: string;
  balances: {
    token: string;
    symbol: string;
    amount: string;
  }[];
}

// WebSocket event types
export interface WSEvents {
  'session:updated': SessionResponse;
  'session:activated': SessionResponse;
  'session:closed': SessionResponse;
  'action:confirmed': ActionResponse;
  'action:settled': ActionResponse;
  'balance:updated': { sessionId: string; remaining: string; spent: string };
  'settlement:committed': { batchId: string; txHash: string };
  'settlement:revealed': { batchId: string; txHash: string };
  'settlement:complete': { batchId: string; settledCount: number };
  'payout:processing': { payoutId: string };
  'payout:complete': { payoutId: string; txHashes: string[] };
  'error': { code: string; message: string };
}
