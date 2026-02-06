import { store, SessionStatus } from '../../config/store';
import { generateId, generateHex, sleep } from '../../utils/helpers';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { SessionResponse, CreateSessionInput } from '../../types';
import { logger } from '../../utils/logger';

export class SessionService {
  /**
   * Create a new trading session
   */
  async createSession(input: CreateSessionInput, userId: string): Promise<SessionResponse> {
    logger.info(`Creating session for user ${userId} with allowance ${input.allowance}`);

    // Validate allowance
    const allowance = BigInt(input.allowance);
    if (allowance <= 0n) {
      throw new ValidationError('Allowance must be greater than 0');
    }

    // Create session
    const session = store.createSession({
      userId,
      initialAllowance: input.allowance,
      spentAmount: '0',
      status: SessionStatus.PENDING,
      yellowSessionId: null,
      depositTxHash: null,
      settlementTxHash: null,
    });

    // Simulate Yellow SDK session creation
    await sleep(100);
    const yellowSessionId = `yellow_${generateId()}`;

    // Update with Yellow session ID
    store.updateSession(session.id, { yellowSessionId });

    logger.info(`Session created: ${session.id}`);

    return this.formatSession({ ...session, yellowSessionId });
  }

  /**
   * Activate session after deposit
   */
  async activateSession(sessionId: string, depositTxHash: string): Promise<SessionResponse> {
    const session = store.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== SessionStatus.PENDING) {
      throw new ValidationError('Session is not pending');
    }

    // Simulate deposit verification
    await sleep(200);

    const updated = store.updateSession(sessionId, {
      status: SessionStatus.ACTIVE,
      depositTxHash,
      activatedAt: new Date(),
    });

    logger.info(`Session activated: ${sessionId}`);

    return this.formatSession(updated);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionResponse> {
    const session = store.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    return this.formatSession(session);
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionResponse[]> {
    const sessions = store.findSessionsByUser(userId);
    return sessions.map(s => this.formatSession(s));
  }

  /**
   * Update spent amount
   */
  async updateSpent(sessionId: string, amount: string): Promise<void> {
    const session = store.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    const newSpent = BigInt(session.spentAmount) + BigInt(amount);

    store.updateSession(sessionId, { spentAmount: newSpent.toString() });
  }

  /**
   * Close session
   */
  async closeSession(sessionId: string): Promise<SessionResponse> {
    const session = store.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status === SessionStatus.CLOSED) {
      throw new ValidationError('Session is already closed');
    }

    // Simulate settlement
    await sleep(500);
    const settlementTxHash = generateHex(32);

    const updated = store.updateSession(sessionId, {
      status: SessionStatus.CLOSED,
      settlementTxHash,
      closedAt: new Date(),
    });

    logger.info(`Session closed: ${sessionId}`);

    return this.formatSession(updated);
  }

  /**
   * Format session for API response
   */
  private formatSession(session: {
    id: string;
    yellowSessionId: string | null;
    status: SessionStatus;
    initialAllowance: string;
    spentAmount: string;
    depositTxHash: string | null;
    createdAt: Date;
  }): SessionResponse {
    const initial = BigInt(session.initialAllowance);
    const spent = BigInt(session.spentAmount);
    const remaining = initial - spent;

    return {
      id: session.id,
      yellowSessionId: session.yellowSessionId,
      status: session.status,
      initialAllowance: initial.toString(),
      spentAmount: spent.toString(),
      remainingAllowance: remaining.toString(),
      actionsCount: store.countSessionActions(session.id),
      depositTxHash: session.depositTxHash,
      createdAt: session.createdAt,
    };
  }
}

export const sessionService = new SessionService();
