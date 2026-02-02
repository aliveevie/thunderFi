import { prisma } from '../../config/database';
import { BatchStatus, SessionStatus } from '@prisma/client';
import { generateId, generateHex, hashData, sleep } from '../../utils/helpers';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { BatchResponse, SettlementPreview } from '../../types';
import { actionService } from '../session/ActionService';
import { logger } from '../../utils/logger';

export class SettlementService {
  /**
   * Preview settlement for a session
   */
  async previewSettlement(sessionId: string): Promise<SettlementPreview> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    const unsettledActions = await actionService.getUnsettledActions(sessionId);

    if (unsettledActions.length === 0) {
      throw new ValidationError('No actions to settle');
    }

    // Calculate net amount (simplified mock calculation)
    const netAmount = unsettledActions.reduce((sum, action) => {
      const payload = action.payload as { amount?: string; side?: string };
      if (payload.amount) {
        const amount = BigInt(payload.amount);
        return payload.side === 'buy' ? sum + amount : sum - amount;
      }
      return sum;
    }, 0n);

    // Generate batch hash
    const batchHash = hashData({
      sessionId,
      actions: unsettledActions.map(a => a.id),
      timestamp: Date.now(),
    });

    return {
      actionsToSettle: unsettledActions.length,
      estimatedGas: '3000000', // ~3 USDC equivalent
      netAmount: netAmount.toString(),
      batchHash,
    };
  }

  /**
   * Create and commit a settlement batch
   */
  async commitBatch(sessionId: string): Promise<BatchResponse> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== SessionStatus.ACTIVE) {
      throw new ValidationError('Session is not active');
    }

    const unsettledActions = await actionService.getUnsettledActions(sessionId);

    if (unsettledActions.length === 0) {
      throw new ValidationError('No actions to settle');
    }

    // Create batch
    const batch = await prisma.settlementBatch.create({
      data: {
        sessionId,
        actionCount: unsettledActions.length,
        batchHash: hashData(unsettledActions.map(a => a.id)),
        salt: generateHex(16),
        status: BatchStatus.BUILDING,
      },
    });

    // Update session status
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.SETTLING },
    });

    // Simulate commit transaction
    await sleep(2000);
    const commitTxHash = generateHex(32);

    // Update batch with commit tx
    const updated = await prisma.settlementBatch.update({
      where: { id: batch.id },
      data: {
        status: BatchStatus.COMMITTED,
        commitTxHash,
        committedAt: new Date(),
      },
    });

    logger.info(`Batch committed: ${batch.id}`);

    return this.formatBatch(updated);
  }

  /**
   * Reveal and execute settlement
   */
  async revealBatch(batchId: string): Promise<BatchResponse> {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundError('Batch');
    }

    if (batch.status !== BatchStatus.COMMITTED) {
      throw new ValidationError('Batch is not committed');
    }

    // Get unsettled actions for this session
    const unsettledActions = await actionService.getUnsettledActions(batch.sessionId);

    // Simulate reveal and execute
    await sleep(3000);
    const revealTxHash = generateHex(32);

    // Calculate mock net amount and gas cost
    const netAmount = (Math.random() * 100 - 50).toFixed(2);
    const gasCost = (Math.random() * 3 + 1).toFixed(2);

    // Mark actions as settled
    await actionService.settleActions(
      unsettledActions.map(a => a.id),
      batchId
    );

    // Update batch
    const updated = await prisma.settlementBatch.update({
      where: { id: batchId },
      data: {
        status: BatchStatus.SETTLED,
        revealTxHash,
        revealedAt: new Date(),
        settledAt: new Date(),
        netAmount: parseFloat(netAmount) * 1e6, // Convert to smallest unit
        gasCost: parseFloat(gasCost) * 1e6,
      },
    });

    // Restore session status to active
    await prisma.session.update({
      where: { id: batch.sessionId },
      data: { status: SessionStatus.ACTIVE },
    });

    logger.info(`Batch settled: ${batchId} with ${batch.actionCount} actions`);

    return this.formatBatch(updated);
  }

  /**
   * Get batch by ID
   */
  async getBatch(batchId: string): Promise<BatchResponse> {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundError('Batch');
    }

    return this.formatBatch(batch);
  }

  /**
   * Get batches for a session
   */
  async getSessionBatches(sessionId: string): Promise<BatchResponse[]> {
    const batches = await prisma.settlementBatch.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    return batches.map(b => this.formatBatch(b));
  }

  /**
   * Format batch for API response
   */
  private formatBatch(batch: {
    id: string;
    sessionId: string;
    actionCount: number;
    status: BatchStatus;
    netAmount: { toString(): string };
    gasCost: { toString(): string } | null;
    commitTxHash: string | null;
    revealTxHash: string | null;
    createdAt: Date;
  }): BatchResponse {
    return {
      id: batch.id,
      sessionId: batch.sessionId,
      actionCount: batch.actionCount,
      status: batch.status,
      netAmount: batch.netAmount.toString(),
      gasCost: batch.gasCost?.toString() || null,
      commitTxHash: batch.commitTxHash,
      revealTxHash: batch.revealTxHash,
      createdAt: batch.createdAt,
    };
  }
}

export const settlementService = new SettlementService();
