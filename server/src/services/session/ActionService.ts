import { store, ActionStatus, ActionType, SessionStatus } from '../../config/store';
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
    const session = store.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== SessionStatus.ACTIVE) {
      throw new ValidationError('Session is not active');
    }

    // Check allowance
    const remaining = BigInt(session.initialAllowance) - BigInt(session.spentAmount);
    if (remaining < BigInt(ACTION_FEE)) {
      throw new ValidationError('Insufficient allowance');
    }

    // Get action count for sequence number
    const actionCount = store.countActions(sessionId);

    // Simulate instant off-chain execution
    await sleep(50); // 50ms simulated latency

    // Create action
    const action = store.createAction({
      sessionId,
      type: input.type as ActionType,
      payload: input.payload as object,
      signature: input.signature || null,
      fee: ACTION_FEE,
      status: ActionStatus.CONFIRMED,
      confirmedAt: new Date(),
      settledAt: null,
      batchId: null,
      receipt: {
        actionId: generateId(),
        sequenceNumber: actionCount + 1,
        stateHash: hashData({ sessionId, actionCount, payload: input.payload }),
        timestamp: Date.now(),
      },
    });

    // Update session spent amount
    store.updateSession(sessionId, {
      spentAmount: (BigInt(session.spentAmount) + BigInt(ACTION_FEE)).toString(),
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
    const actions = store.findActionsBySession(sessionId, {
      status: options?.status,
      limit: options?.limit,
      offset: options?.offset,
      orderDesc: true,
    });

    const total = store.countActions(sessionId, options?.status);

    return {
      actions: actions.map(a => this.formatAction(a)),
      total,
    };
  }

  /**
   * Get unsettled actions for a session
   */
  async getUnsettledActions(sessionId: string): Promise<ActionResponse[]> {
    const actions = store.findUnsettledActions(sessionId);
    return actions.map(a => this.formatAction(a));
  }

  /**
   * Mark actions as settled
   */
  async settleActions(actionIds: string[], batchId: string): Promise<void> {
    store.updateManyActions(actionIds, {
      status: ActionStatus.SETTLED,
      batchId,
      settledAt: new Date(),
    });
  }

  /**
   * Format action for API response
   */
  private formatAction(action: {
    id: string;
    type: ActionType;
    payload: unknown;
    fee: string;
    status: ActionStatus;
    receipt: unknown;
    createdAt: Date;
  }): ActionResponse {
    return {
      id: action.id,
      type: action.type,
      payload: action.payload,
      fee: action.fee,
      status: action.status,
      receipt: action.receipt as ActionReceipt | null,
      createdAt: action.createdAt,
    };
  }
}

export const actionService = new ActionService();
