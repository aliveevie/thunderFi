import { store, PayoutStatus, SessionStatus } from '../../config/store';
import { NotFoundError, ValidationError, AppError } from '../../middleware/errorHandler';
import { PayoutResponse, CreatePayoutInput, PayoutRecipientInput } from '../../types';
import { logger } from '../../utils/logger';
import { circleService } from '../circle';
import { CHAIN_TO_CIRCLE_BLOCKCHAIN, HUB_CHAIN } from '../circle/types';

export class PayoutService {
  /**
   * Create a payout request
   */
  async createPayout(sessionId: string, input: CreatePayoutInput): Promise<PayoutResponse> {
    const session = store.findSessionById(sessionId);

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
    const payout = store.createPayout({
      sessionId,
      totalAmount: totalAmount.toString(),
      status: PayoutStatus.PENDING,
      recipients: input.recipients.map((r: PayoutRecipientInput) => ({
        address: r.address,
        chain: r.chain,
        amount: r.amount,
        status: 'pending',
      })),
    });

    logger.info(`Payout created: ${payout.id} with ${input.recipients.length} recipients`);

    return this.formatPayout(payout);
  }

  /**
   * Process a payout — sends real USDC via Circle Developer-Controlled Wallets.
   * All payouts originate from the Arc hub wallet.
   * Same-chain (Arc→Arc) and cross-chain (Arc→spoke) both use the
   * Developer-Controlled Wallets SDK `createTransaction`.
   * In production, cross-chain transfers would use CCTP (Bridge Kit)
   * to burn USDC on Arc and mint on the destination chain.
   */
  async processPayout(payoutId: string): Promise<PayoutResponse> {
    const payout = store.findPayoutWithSession(payoutId);

    if (!payout) {
      throw new NotFoundError('Payout');
    }

    if (payout.status !== PayoutStatus.PENDING) {
      throw new ValidationError('Payout is not pending');
    }

    if (!circleService.isInitialized()) {
      throw new AppError('Circle SDK not initialized', 503, 'CIRCLE_NOT_INITIALIZED');
    }

    const userId = payout.session.userId;

    // Update status to processing
    store.updatePayout(payoutId, { status: PayoutStatus.PROCESSING });

    logger.info(`Processing payout: ${payoutId} for user ${userId}`);

    let allSucceeded = true;

    // Process each recipient
    for (const recipient of payout.recipients) {
      try {
        const recipientChain = recipient.chain;

        // All payouts originate from the Arc hub wallet
        const sourceChain = await this.resolveSourceChain(userId, recipientChain);
        const walletId = await circleService.getWalletId(userId, sourceChain);

        // Use Arc blockchain for the transaction (hub-and-spoke model).
        // In production, cross-chain recipients would use CCTP/Bridge Kit
        // to burn on Arc and mint on the destination chain.
        const circleBlockchain = CHAIN_TO_CIRCLE_BLOCKCHAIN[HUB_CHAIN];
        if (!circleBlockchain) {
          throw new AppError(`No Circle blockchain mapping for hub chain: ${HUB_CHAIN}`, 400, 'INVALID_CHAIN');
        }

        if (sourceChain !== recipientChain) {
          logger.info(
            `[Hub→Spoke] Cross-chain payout: Arc → ${recipientChain}. ` +
            `Sending from Arc hub wallet. In production, CCTP would bridge to ${recipientChain}.`
          );
        }

        const tx = await circleService.sendTransaction({
          walletId,
          destinationAddress: recipient.address,
          amount: recipient.amount,
          blockchain: circleBlockchain,
        });

        // Wait for transaction confirmation
        const confirmedTx = await circleService.waitForTransaction(tx.id);
        const txHash = confirmedTx.txHash;

        // Update recipient with real transaction hash
        store.updatePayoutRecipient(recipient.id, {
          status: 'confirmed',
          txHash: txHash || null,
        });

        logger.info(
          `Recipient processed: ${recipient.address} on ${recipientChain} ` +
          `(txHash: ${txHash}, source: ${HUB_CHAIN})`
        );

      } catch (err) {
        allSucceeded = false;
        const errorMsg = err instanceof Error ? err.message : String(err);

        store.updatePayoutRecipient(recipient.id, { status: 'failed' });

        logger.error(`Failed to process recipient ${recipient.address}: ${errorMsg}`);
      }
    }

    // Mark payout as completed or failed
    const finalStatus = allSucceeded ? PayoutStatus.COMPLETED : PayoutStatus.FAILED;
    store.updatePayout(payoutId, {
      status: finalStatus,
      completedAt: new Date(),
    });

    const updated = store.findPayoutById(payoutId)!;

    logger.info(`Payout ${finalStatus.toLowerCase()}: ${payoutId}`);

    return this.formatPayout(updated);
  }

  /**
   * Resolve source chain — Arc is ALWAYS the liquidity hub.
   * All payouts originate from the user's Arc wallet, then route
   * via same-chain transfer (if dest=arc) or CCTP (if dest=other chain).
   */
  private async resolveSourceChain(userId: string, _destinationChain: string): Promise<string> {
    const arcWallet = store.findCircleWalletByUserChain(userId, HUB_CHAIN);

    if (!arcWallet) {
      throw new ValidationError(
        'No Arc hub wallet found. Arc is the liquidity hub — create an Arc wallet first.'
      );
    }

    // Always route through Arc as the hub
    return HUB_CHAIN;
  }

  /**
   * Get payout by ID
   */
  async getPayout(payoutId: string): Promise<PayoutResponse> {
    const payout = store.findPayoutById(payoutId);

    if (!payout) {
      throw new NotFoundError('Payout');
    }

    return this.formatPayout(payout);
  }

  /**
   * Get payouts for a session
   */
  async getSessionPayouts(sessionId: string): Promise<PayoutResponse[]> {
    const payouts = store.findPayoutsBySession(sessionId);
    return payouts.map(p => this.formatPayout(p));
  }

  /**
   * Format payout for API response
   */
  private formatPayout(payout: {
    id: string;
    sessionId: string;
    totalAmount: string;
    status: PayoutStatus;
    createdAt: Date;
    recipients: Array<{
      address: string;
      chain: string;
      amount: string;
      status: string;
      txHash: string | null;
    }>;
  }): PayoutResponse {
    return {
      id: payout.id,
      sessionId: payout.sessionId,
      totalAmount: payout.totalAmount,
      status: payout.status,
      createdAt: payout.createdAt,
      recipients: payout.recipients.map(r => ({
        address: r.address,
        chain: r.chain,
        amount: r.amount,
        status: r.status,
        txHash: r.txHash,
      })),
    };
  }
}

export const payoutService = new PayoutService();
