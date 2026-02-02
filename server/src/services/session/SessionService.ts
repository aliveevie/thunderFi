import { prisma } from '../../config/database';
import { SessionStatus } from '@prisma/client';
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
    const session = await prisma.session.create({
      data: {
        userId,
        initialAllowance: input.allowance,
        spentAmount: '0',
        status: SessionStatus.PENDING,
      },
      include: {
        _count: {
          select: { actions: true },
        },
      },
    });

    // Simulate Yellow SDK session creation
    await sleep(100);
    const yellowSessionId = `yellow_${generateId()}`;

    // Update with Yellow session ID
    await prisma.session.update({
      where: { id: session.id },
      data: { yellowSessionId },
    });

    logger.info(`Session created: ${session.id}`);

    return this.formatSession({
      ...session,
      yellowSessionId,
      _count: session._count,
    });
  }

  /**
   * Activate session after deposit
   */
  async activateSession(sessionId: string, depositTxHash: string): Promise<SessionResponse> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        _count: { select: { actions: true } },
      },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== SessionStatus.PENDING) {
      throw new ValidationError('Session is not pending');
    }

    // Simulate deposit verification
    await sleep(200);

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ACTIVE,
        depositTxHash,
        activatedAt: new Date(),
      },
      include: {
        _count: { select: { actions: true } },
      },
    });

    logger.info(`Session activated: ${sessionId}`);

    return this.formatSession(updated);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionResponse> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        _count: { select: { actions: true } },
      },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    return this.formatSession(session);
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionResponse[]> {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { actions: true } },
      },
    });

    return sessions.map(s => this.formatSession(s));
  }

  /**
   * Update spent amount
   */
  async updateSpent(sessionId: string, amount: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    const newSpent = BigInt(session.spentAmount.toString()) + BigInt(amount);

    await prisma.session.update({
      where: { id: sessionId },
      data: { spentAmount: newSpent.toString() },
    });
  }

  /**
   * Close session
   */
  async closeSession(sessionId: string): Promise<SessionResponse> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        _count: { select: { actions: true } },
      },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status === SessionStatus.CLOSED) {
      throw new ValidationError('Session is already closed');
    }

    // Simulate settlement
    await sleep(500);
    const settlementTxHash = generateHex(32);

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.CLOSED,
        settlementTxHash,
        closedAt: new Date(),
      },
      include: {
        _count: { select: { actions: true } },
      },
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
    initialAllowance: { toString(): string };
    spentAmount: { toString(): string };
    depositTxHash: string | null;
    createdAt: Date;
    _count: { actions: number };
  }): SessionResponse {
    const initial = BigInt(session.initialAllowance.toString());
    const spent = BigInt(session.spentAmount.toString());
    const remaining = initial - spent;

    return {
      id: session.id,
      yellowSessionId: session.yellowSessionId,
      status: session.status,
      initialAllowance: initial.toString(),
      spentAmount: spent.toString(),
      remainingAllowance: remaining.toString(),
      actionsCount: session._count.actions,
      depositTxHash: session.depositTxHash,
      createdAt: session.createdAt,
    };
  }
}

export const sessionService = new SessionService();
