/**
 * Circle Gateway Service — Cross-chain USDC transfers via CCTP
 * Uses Circle's Cross-Chain Transfer Protocol to burn USDC on the source chain
 * and mint on the destination chain.
 */

import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import type { GatewayTransferRequest, GatewayTransferResult } from './types';
import { CHAIN_TO_CIRCLE_BLOCKCHAIN } from './types';

const CIRCLE_API_BASE = 'https://api.circle.com/v1';

export class GatewayService {
  private apiKey: string | null = null;
  private initialized = false;

  /**
   * Initialize the Gateway service with Circle API credentials.
   */
  initialize(): void {
    if (!env.CIRCLE_API_KEY) {
      logger.warn('[GatewayService] Not configured — CIRCLE_API_KEY missing');
      return;
    }

    this.apiKey = env.CIRCLE_API_KEY;
    this.initialized = true;
    logger.info('[GatewayService] Initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.apiKey) {
      throw new AppError('Gateway service not initialized', 503, 'GATEWAY_NOT_INITIALIZED');
    }
  }

  /**
   * Make an authenticated request to the Circle API.
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    this.ensureInitialized();

    const response = await fetch(`${CIRCLE_API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`[GatewayService] API error ${response.status}: ${errorBody}`);
      throw new AppError(
        `Circle API error: ${response.status}`,
        response.status,
        'CIRCLE_API_ERROR'
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Initiate a cross-chain USDC transfer via CCTP.
   * Burns USDC on the source chain and mints on the destination chain.
   */
  async initiateTransfer(params: GatewayTransferRequest): Promise<GatewayTransferResult> {
    this.ensureInitialized();

    const sourceBlockchain = CHAIN_TO_CIRCLE_BLOCKCHAIN[params.sourceChain];
    const destBlockchain = CHAIN_TO_CIRCLE_BLOCKCHAIN[params.destinationChain];

    if (!sourceBlockchain) {
      throw new AppError(`Unsupported source chain: ${params.sourceChain}`, 400, 'INVALID_CHAIN');
    }
    if (!destBlockchain) {
      throw new AppError(`Unsupported destination chain: ${params.destinationChain}`, 400, 'INVALID_CHAIN');
    }

    const idempotencyKey = params.idempotencyKey || uuidv4();

    const response = await this.request<{ data: { transfer: GatewayTransferResult } }>(
      'POST',
      '/w3s/crosschain/transfers',
      {
        idempotencyKey,
        source: {
          blockchain: sourceBlockchain,
          address: params.sourceAddress,
        },
        destination: {
          blockchain: destBlockchain,
          address: params.destinationAddress,
        },
        amount: {
          amount: params.amount,
          currency: 'USD',
        },
      }
    );

    const transfer = response.data?.transfer;
    if (!transfer) {
      throw new AppError('Failed to initiate cross-chain transfer', 500, 'GATEWAY_TRANSFER_ERROR');
    }

    logger.info(
      `[GatewayService] Transfer initiated: ${transfer.id} ` +
      `(${params.sourceChain} → ${params.destinationChain}, ${params.amount} USDC)`
    );

    return transfer;
  }

  /**
   * Poll a cross-chain transfer until it reaches a terminal state.
   */
  async waitForTransfer(transferId: string, timeoutMs = 180000): Promise<GatewayTransferResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await this.request<{ data: { transfer: GatewayTransferResult } }>(
        'GET',
        `/w3s/crosschain/transfers/${transferId}`
      );

      const transfer = response.data?.transfer;
      if (!transfer) {
        throw new AppError('Transfer not found', 404, 'TRANSFER_NOT_FOUND');
      }

      if (transfer.state === 'COMPLETE') {
        logger.info(`[GatewayService] Transfer completed: ${transfer.id} txHash: ${transfer.txHash}`);
        return transfer;
      }

      if (transfer.state === 'FAILED') {
        throw new AppError(
          `Cross-chain transfer failed: ${transfer.id}`,
          500,
          'GATEWAY_TRANSFER_FAILED'
        );
      }

      // CCTP transfers can take longer — poll every 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new AppError('Cross-chain transfer timeout', 504, 'GATEWAY_TRANSFER_TIMEOUT');
  }
}

export const gatewayService = new GatewayService();
