import { prisma } from '../../config/database';
import { PayoutStatus, SessionStatus } from '@prisma/client';
import { generateHex, sleep } from '../../utils/helpers';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { PayoutResponse, CreatePayoutInput, PayoutRecipientInput } from '../../types';
import { logger } from '../../utils/logger';

export class PayoutService {
  /**
   * Create a payout request
   */
  async createPayout(sessionId: string, input: CreatePayoutInput): Promise<PayoutResponse> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.CLOSED) {
      throw new ValidationError('Session must be active or closed to create payouts');
    }

    // Calculate total amount
    const totalAmount = input.recipients.reduce(
      (sum, r) => sum + BigInt(r.amount),
      0n
    );

    // Create payout with recipients
    const payout = await prisma.payout.create({
      data: {
        sessionId,
        totalAmount: totalAmount.toString(),
        status: PayoutStatus.PENDING,
        recipients: {
          create: input.recipients.map((r: PayoutRecipientInput) => ({
            address: r.address,
            chain: r.chain,
            amount: r.amount,
            status: 'pending',
          })),
        },
      },
      include: {
        recipients: true,
      },
    });

    logger.info(`Payout created: ${payout.id} with ${input.recipients.length} recipients`);

    return this.formatPayout(payout);
  }

  /**
   * Process a payout (simulate Circle Gateway)
   */
  async processPayout(payoutId: string): Promise<PayoutResponse> {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: { recipients: true },
    });

    if (!payout) {
      throw new NotFoundError('Payout');
    }

    if (payout.status !== PayoutStatus.PENDING) {
      throw new ValidationError('Payout is not pending');
    }

    // Update status to processing
    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PROCESSING },
    });

    logger.info(`Processing payout: ${payoutId}`);

    // Process each recipient
    for (const recipient of payout.recipients) {
      // Simulate Circle Gateway routing
      await sleep(1500);

      const txHash = generateHex(32);

      await prisma.payoutRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'confirmed',
          txHash,
        },
      });

      logger.debug(`Recipient processed: ${recipient.address} on ${recipient.chain}`);
    }

    // Mark payout as completed
    const updated = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: { recipients: true },
    });

    logger.info(`Payout completed: ${payoutId}`);

    return this.formatPayout(updated);
  }

  /**
   * Get payout by ID
   */
  async getPayout(payoutId: string): Promise<PayoutResponse> {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: { recipients: true },
    });

    if (!payout) {
      throw new NotFoundError('Payout');
    }

    return this.formatPayout(payout);
  }

  /**
   * Get payouts for a session
   */
  async getSessionPayouts(sessionId: string): Promise<PayoutResponse[]> {
    const payouts = await prisma.payout.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      include: { recipients: true },
    });

    return payouts.map(p => this.formatPayout(p));
  }

  /**
   * Format payout for API response
   */
  private formatPayout(payout: {
    id: string;
    sessionId: string;
    totalAmount: { toString(): string };
    status: PayoutStatus;
    createdAt: Date;
    recipients: Array<{
      address: string;
      chain: string;
      amount: { toString(): string };
      status: string;
      txHash: string | null;
    }>;
  }): PayoutResponse {
    return {
      id: payout.id,
      sessionId: payout.sessionId,
      totalAmount: payout.totalAmount.toString(),
      status: payout.status,
      createdAt: payout.createdAt,
      recipients: payout.recipients.map(r => ({
        address: r.address,
        chain: r.chain,
        amount: r.amount.toString(),
        status: r.status,
        txHash: r.txHash,
      })),
    };
  }
}

export const payoutService = new PayoutService();
