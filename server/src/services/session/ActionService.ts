import { prisma } from '../../config/database';
import { ActionStatus, ActionType, SessionStatus } from '@prisma/client';
import { generateId, hashData, sleep } from '../../utils/helpers';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { ActionResponse, CreateActionInput, ActionReceipt } from '../../types';
import { logger } from '../../utils/logger';

// Fee per action (in smallest unit, e.g., 0.001 USDC = 1000 if 6 decimals)
const ACTION_FEE = '1000';

export class ActionService {
  /**
   * Execute an off-chain action
   */
  async executeAction(sessionId: string, input: CreateActionInput): Promise<ActionResponse> {
    // Verify session is active
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== SessionStatus.ACTIVE) {
      throw new ValidationError('Session is not active');
    }

    // Check allowance
    const remaining = BigInt(session.initialAllowance.toString()) - BigInt(session.spentAmount.toString());
    if (remaining < BigInt(ACTION_FEE)) {
      throw new ValidationError('Insufficient allowance');
    }

    // Get action count for sequence number
    const actionCount = await prisma.action.count({
      where: { sessionId },
    });

    // Simulate instant off-chain execution
    await sleep(50); // 50ms simulated latency

    // Create action
    const action = await prisma.action.create({
      data: {
        sessionId,
        type: input.type as ActionType,
        payload: input.payload as object,
        signature: input.signature,
        fee: ACTION_FEE,
        status: ActionStatus.CONFIRMED,
        confirmedAt: new Date(),
        receipt: {
          actionId: generateId(),
          sequenceNumber: actionCount + 1,
          stateHash: hashData({ sessionId, actionCount, payload: input.payload }),
          timestamp: Date.now(),
        },
      },
    });

    // Update session spent amount
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        spentAmount: (BigInt(session.spentAmount.toString()) + BigInt(ACTION_FEE)).toString(),
      },
    });

    logger.debug(`Action executed: ${action.id} (${input.type})`);

    return this.formatAction(action);
  }

  /**
   * Get actions for a session
   */
  async getActions(sessionId: string, options?: {
    status?: ActionStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ actions: ActionResponse[]; total: number }> {
    const where = {
      sessionId,
      ...(options?.status && { status: options.status }),
    };

    const [actions, total] = await Promise.all([
      prisma.action.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.action.count({ where }),
    ]);

    return {
      actions: actions.map(a => this.formatAction(a)),
      total,
    };
  }

  /**
   * Get unsettled actions for a session
   */
  async getUnsettledActions(sessionId: string): Promise<ActionResponse[]> {
    const actions = await prisma.action.findMany({
      where: {
        sessionId,
        status: ActionStatus.CONFIRMED,
        batchId: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return actions.map(a => this.formatAction(a));
  }

  /**
   * Mark actions as settled
   */
  async settleActions(actionIds: string[], batchId: string): Promise<void> {
    await prisma.action.updateMany({
      where: { id: { in: actionIds } },
      data: {
        status: ActionStatus.SETTLED,
        batchId,
        settledAt: new Date(),
      },
    });
  }

  /**
   * Format action for API response
   */
  private formatAction(action: {
    id: string;
    type: ActionType;
    payload: unknown;
    fee: { toString(): string };
    status: ActionStatus;
    receipt: unknown;
    createdAt: Date;
  }): ActionResponse {
    return {
      id: action.id,
      type: action.type,
      payload: action.payload,
      fee: action.fee.toString(),
      status: action.status,
      receipt: action.receipt as ActionReceipt | null,
      createdAt: action.createdAt,
    };
  }
}

export const actionService = new ActionService();
