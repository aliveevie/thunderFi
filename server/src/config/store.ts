/**
 * In-Memory Data Store
 * Replaces Prisma/PostgreSQL for minimal MVP — all data lives in memory.
 * Data is lost on server restart.
 */

import { v4 as uuidv4 } from 'uuid';

// ---- Enums (replace @prisma/client enums) ----

export const SessionStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SETTLING: 'SETTLING',
  CLOSED: 'CLOSED',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const ActionType = {
  PLACE_ORDER: 'PLACE_ORDER',
  CANCEL_ORDER: 'CANCEL_ORDER',
  MODIFY_ORDER: 'MODIFY_ORDER',
  MICRO_TIP: 'MICRO_TIP',
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export const ActionStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  SETTLED: 'SETTLED',
  FAILED: 'FAILED',
} as const;
export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];

export const BatchStatus = {
  BUILDING: 'BUILDING',
  COMMITTED: 'COMMITTED',
  REVEALED: 'REVEALED',
  SETTLED: 'SETTLED',
  FAILED: 'FAILED',
} as const;
export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];

export const PayoutStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

// ---- Data Models ----

export interface User {
  id: string;
  walletAddress: string;
  circleUserId?: string;
  createdAt: Date;
}

export interface CircleWallet {
  id: string;
  userId: string;
  circleWalletId: string;
  walletSetId: string;
  chain: string;
  address: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  yellowSessionId: string | null;
  userId: string;
  initialAllowance: string;
  spentAmount: string;
  status: SessionStatus;
  depositTxHash: string | null;
  settlementTxHash: string | null;
  createdAt: Date;
  activatedAt: Date | null;
  closedAt: Date | null;
}

export interface Action {
  id: string;
  sessionId: string;
  type: ActionType;
  payload: unknown;
  signature: string | null;
  fee: string;
  status: ActionStatus;
  receipt: unknown;
  batchId: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  settledAt: Date | null;
}

export interface SettlementBatch {
  id: string;
  sessionId: string;
  batchHash: string | null;
  salt: string | null;
  actionCount: number;
  netAmount: string;
  gasCost: string | null;
  commitTxHash: string | null;
  revealTxHash: string | null;
  status: BatchStatus;
  createdAt: Date;
  committedAt: Date | null;
  revealedAt: Date | null;
  settledAt: Date | null;
}

export interface Payout {
  id: string;
  sessionId: string;
  totalAmount: string;
  sourceChain: string;
  status: PayoutStatus;
  gatewayTransferId: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface PayoutRecipient {
  id: string;
  payoutId: string;
  address: string;
  chain: string;
  amount: string;
  status: string;
  txHash: string | null;
  createdAt: Date;
}

// ---- Store ----

class Store {
  users = new Map<string, User>();
  circleWallets = new Map<string, CircleWallet>();
  sessions = new Map<string, Session>();
  actions = new Map<string, Action>();
  batches = new Map<string, SettlementBatch>();
  payouts = new Map<string, Payout>();
  payoutRecipients = new Map<string, PayoutRecipient>();

  // Indexes for quick lookups
  private userByWallet = new Map<string, string>(); // walletAddress -> userId
  private walletByUserChain = new Map<string, string>(); // `${userId}:${chain}` -> walletId
  private walletByCircleId = new Map<string, string>(); // circleWalletId -> id

  // ---- Users ----

  createUser(data: { walletAddress: string; circleUserId?: string }): User {
    const user: User = {
      id: uuidv4(),
      walletAddress: data.walletAddress,
      circleUserId: data.circleUserId,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.userByWallet.set(user.walletAddress, user.id);
    return user;
  }

  findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  findUserByWallet(walletAddress: string): User | undefined {
    const id = this.userByWallet.get(walletAddress);
    return id ? this.users.get(id) : undefined;
  }

  // ---- Circle Wallets ----

  upsertCircleWallet(data: {
    userId: string;
    circleWalletId: string;
    walletSetId: string;
    chain: string;
    address: string;
  }): CircleWallet {
    const key = `${data.userId}:${data.chain}`;
    const existingId = this.walletByUserChain.get(key);

    if (existingId) {
      const existing = this.circleWallets.get(existingId)!;
      existing.circleWalletId = data.circleWalletId;
      existing.address = data.address;
      this.walletByCircleId.set(data.circleWalletId, existing.id);
      return existing;
    }

    const wallet: CircleWallet = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
    };
    this.circleWallets.set(wallet.id, wallet);
    this.walletByUserChain.set(key, wallet.id);
    this.walletByCircleId.set(data.circleWalletId, wallet.id);
    return wallet;
  }

  findCircleWalletByUserChain(userId: string, chain: string): CircleWallet | undefined {
    const id = this.walletByUserChain.get(`${userId}:${chain}`);
    return id ? this.circleWallets.get(id) : undefined;
  }

  findFirstCircleWallet(userId: string): CircleWallet | undefined {
    for (const w of this.circleWallets.values()) {
      if (w.userId === userId) return w;
    }
    return undefined;
  }

  findCircleWalletsByUser(userId: string): CircleWallet[] {
    return [...this.circleWallets.values()]
      .filter(w => w.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // ---- Sessions ----

  createSession(data: Omit<Session, 'id' | 'createdAt' | 'activatedAt' | 'closedAt'>): Session {
    const session: Session = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      activatedAt: null,
      closedAt: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  findSessionById(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  findSessionsByUser(userId: string): Session[] {
    return [...this.sessions.values()]
      .filter(s => s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateSession(id: string, data: Partial<Session>): Session {
    const session = this.sessions.get(id)!;
    Object.assign(session, data);
    return session;
  }

  countSessionActions(sessionId: string): number {
    let count = 0;
    for (const a of this.actions.values()) {
      if (a.sessionId === sessionId) count++;
    }
    return count;
  }

  // ---- Actions ----

  createAction(data: Omit<Action, 'id' | 'createdAt'>): Action {
    const action: Action = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
    };
    this.actions.set(action.id, action);
    return action;
  }

  findActionsBySession(sessionId: string, opts?: {
    status?: ActionStatus;
    limit?: number;
    offset?: number;
    orderDesc?: boolean;
  }): Action[] {
    let results = [...this.actions.values()].filter(a => a.sessionId === sessionId);
    if (opts?.status) results = results.filter(a => a.status === opts.status);

    results.sort((a, b) => opts?.orderDesc !== false
      ? b.createdAt.getTime() - a.createdAt.getTime()
      : a.createdAt.getTime() - b.createdAt.getTime());

    const offset = opts?.offset || 0;
    const limit = opts?.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  countActions(sessionId: string, status?: ActionStatus): number {
    let count = 0;
    for (const a of this.actions.values()) {
      if (a.sessionId === sessionId && (!status || a.status === status)) count++;
    }
    return count;
  }

  findUnsettledActions(sessionId: string): Action[] {
    return [...this.actions.values()]
      .filter(a => a.sessionId === sessionId && a.status === ActionStatus.CONFIRMED && !a.batchId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  updateManyActions(ids: string[], data: Partial<Action>): void {
    for (const id of ids) {
      const action = this.actions.get(id);
      if (action) Object.assign(action, data);
    }
  }

  // ---- Settlement Batches ----

  createBatch(data: Omit<SettlementBatch, 'id' | 'createdAt' | 'committedAt' | 'revealedAt' | 'settledAt'>): SettlementBatch {
    const batch: SettlementBatch = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      committedAt: null,
      revealedAt: null,
      settledAt: null,
    };
    this.batches.set(batch.id, batch);
    return batch;
  }

  findBatchById(id: string): SettlementBatch | undefined {
    return this.batches.get(id);
  }

  findBatchesBySession(sessionId: string): SettlementBatch[] {
    return [...this.batches.values()]
      .filter(b => b.sessionId === sessionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateBatch(id: string, data: Partial<SettlementBatch>): SettlementBatch {
    const batch = this.batches.get(id)!;
    Object.assign(batch, data);
    return batch;
  }

  // ---- Payouts ----

  createPayout(data: {
    sessionId: string;
    totalAmount: string;
    status: PayoutStatus;
    recipients: { address: string; chain: string; amount: string; status: string }[];
  }): Payout & { recipients: PayoutRecipient[] } {
    const payout: Payout = {
      id: uuidv4(),
      sessionId: data.sessionId,
      totalAmount: data.totalAmount,
      sourceChain: 'arc',
      status: data.status,
      gatewayTransferId: null,
      completedAt: null,
      createdAt: new Date(),
    };
    this.payouts.set(payout.id, payout);

    const recipients: PayoutRecipient[] = data.recipients.map(r => {
      const recipient: PayoutRecipient = {
        id: uuidv4(),
        payoutId: payout.id,
        address: r.address,
        chain: r.chain,
        amount: r.amount,
        status: r.status,
        txHash: null,
        createdAt: new Date(),
      };
      this.payoutRecipients.set(recipient.id, recipient);
      return recipient;
    });

    return { ...payout, recipients };
  }

  findPayoutById(id: string): (Payout & { recipients: PayoutRecipient[] }) | undefined {
    const payout = this.payouts.get(id);
    if (!payout) return undefined;
    return { ...payout, recipients: this.findPayoutRecipients(id) };
  }

  findPayoutWithSession(id: string): (Payout & { recipients: PayoutRecipient[]; session: Session }) | undefined {
    const payout = this.payouts.get(id);
    if (!payout) return undefined;
    const session = this.sessions.get(payout.sessionId);
    if (!session) return undefined;
    return { ...payout, recipients: this.findPayoutRecipients(id), session };
  }

  findPayoutsBySession(sessionId: string): (Payout & { recipients: PayoutRecipient[] })[] {
    return [...this.payouts.values()]
      .filter(p => p.sessionId === sessionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(p => ({ ...p, recipients: this.findPayoutRecipients(p.id) }));
  }

  updatePayout(id: string, data: Partial<Payout>): Payout {
    const payout = this.payouts.get(id)!;
    Object.assign(payout, data);
    return payout;
  }

  findPayoutRecipients(payoutId: string): PayoutRecipient[] {
    return [...this.payoutRecipients.values()].filter(r => r.payoutId === payoutId);
  }

  updatePayoutRecipient(id: string, data: Partial<PayoutRecipient>): PayoutRecipient {
    const recipient = this.payoutRecipients.get(id)!;
    Object.assign(recipient, data);
    return recipient;
  }
}

export const store = new Store();
