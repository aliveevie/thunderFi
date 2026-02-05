// Session Types
export interface Session {
  id: string;
  status: SessionStatus;
  allowance: string;
  spent: string;
  remaining: string;
  actionsCount: number;
  depositTxHash?: string;
  createdAt: Date;
}

export type SessionStatus = 'pending' | 'active' | 'settling' | 'closed';

// Action Types
export interface Action {
  id: string;
  type: ActionType;
  timestamp: Date;
  amount?: string;
  pair?: string;
  side?: 'buy' | 'sell';
  price?: string;
  status: ActionStatus;
  fee: string;
}

export type ActionType = 'place_order' | 'cancel_order' | 'modify_order' | 'micro_tip';
export type ActionStatus = 'pending' | 'confirmed' | 'settled';

// Order Types
export interface Order {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: Date;
}

// Settlement Types
export interface SettlementBatch {
  id: string;
  actionsCount: number;
  status: BatchStatus;
  netAmount: string;
  gasCost?: string;
  commitTxHash?: string;
  revealTxHash?: string;
  createdAt: Date;
}

export type BatchStatus = 'building' | 'committed' | 'revealed' | 'settled' | 'failed';

// Payout Types
export interface Payout {
  id: string;
  sessionId?: string;
  recipients: PayoutRecipient[];
  totalAmount: string;
  status: PayoutStatus;
  createdAt: Date;
}

export interface PayoutRecipient {
  address: string;
  chain: string;
  amount: string;
  status: 'pending' | 'sent' | 'confirmed' | 'failed';
  txHash?: string;
}

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Stats Types
export interface SessionStats {
  totalActions: number;
  gasSaved: string;
  totalFeesPaid: string;
  netPnL: string;
}

// Wallet Types
export interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
}
