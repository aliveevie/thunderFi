/**
 * Circle Developer-Controlled Wallets Service
 * Manages wallet creation, balance queries, and USDC transfers
 * using the @circle-fin/developer-controlled-wallets SDK.
 */

import {
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';
import type {
  Blockchain,
} from '@circle-fin/developer-controlled-wallets';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { store } from '../../config/store';
import { logger } from '../../utils/logger';
import { AppError, ValidationError } from '../../middleware/errorHandler';
import {
  CHAIN_TO_CIRCLE_BLOCKCHAIN,
  type CircleWalletInfo,
  type CircleTokenBalance,
  type CircleTransactionResult,
} from './types';

type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;

export class CircleService {
  private client: CircleClient | null = null;
  private initialized = false;

  /**
   * Initialize the Circle SDK client.
   * Must be called once at server startup before any wallet operations.
   */
  async initialize(): Promise<void> {
    if (!env.CIRCLE_API_KEY || !env.CIRCLE_ENTITY_SECRET) {
      logger.warn('[CircleService] Not configured — CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET missing');
      return;
    }

    this.client = initiateDeveloperControlledWalletsClient({
      apiKey: env.CIRCLE_API_KEY,
      entitySecret: env.CIRCLE_ENTITY_SECRET,
    });

    this.initialized = true;
    logger.info('[CircleService] SDK initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private ensureClient(): CircleClient {
    if (!this.initialized || !this.client) {
      throw new AppError('Circle SDK not initialized', 503, 'CIRCLE_NOT_INITIALIZED');
    }
    return this.client;
  }

  // ---- Wallet Sets ----

  /**
   * Get the configured wallet set ID or create a new one.
   */
  async getOrCreateWalletSet(): Promise<string> {
    if (env.CIRCLE_WALLET_SET_ID) {
      return env.CIRCLE_WALLET_SET_ID;
    }

    const client = this.ensureClient();
    const response = await client.createWalletSet({
      idempotencyKey: uuidv4(),
      name: 'thunderFi-wallets',
    });

    const walletSetId = response.data?.walletSet?.id;
    if (!walletSetId) {
      throw new AppError('Failed to create wallet set', 500, 'CIRCLE_WALLET_SET_ERROR');
    }

    logger.info(`[CircleService] Created wallet set: ${walletSetId}`);
    return walletSetId;
  }

  // ---- Wallet Creation ----

  /**
   * Create developer-controlled wallets for a user on the specified chains.
   * Wallets are persisted to the CircleWallet table for future lookups.
   */
  async createUserWallets(
    userId: string,
    chains: string[] = ['arbitrum']
  ): Promise<CircleWalletInfo[]> {
    const client = this.ensureClient();
    const walletSetId = await this.getOrCreateWalletSet();

    // Map internal chain names to Circle blockchain identifiers
    const circleBlockchains = chains
      .map(c => CHAIN_TO_CIRCLE_BLOCKCHAIN[c])
      .filter(Boolean) as Blockchain[];

    if (circleBlockchains.length === 0) {
      throw new ValidationError(`No supported Circle blockchains for chains: ${chains.join(', ')}`);
    }

    const response = await client.createWallets({
      idempotencyKey: uuidv4(),
      walletSetId,
      blockchains: circleBlockchains,
      count: 1,
      accountType: 'SCA',
    });

    const wallets = (response.data?.wallets || []) as CircleWalletInfo[];

    // Persist wallets to database
    for (const wallet of wallets) {
      // Reverse-map Circle blockchain back to our internal chain name
      const chainKey = Object.entries(CHAIN_TO_CIRCLE_BLOCKCHAIN).find(
        ([, circleId]) => circleId === wallet.blockchain
      )?.[0];

      if (chainKey) {
        store.upsertCircleWallet({
          userId,
          circleWalletId: wallet.id,
          walletSetId,
          chain: chainKey,
          address: wallet.address,
        });
      }
    }

    logger.info(`[CircleService] Created ${wallets.length} wallets for user ${userId}`);
    return wallets;
  }

  // ---- Balance Queries ----

  /**
   * Get token balances for a user's wallet on a specific chain.
   */
  async getWalletBalance(userId: string, chain: string): Promise<CircleTokenBalance[]> {
    const client = this.ensureClient();

    const circleWallet = store.findCircleWalletByUserChain(userId, chain);

    if (!circleWallet) {
      throw new ValidationError(`No wallet found for user on ${chain}`);
    }

    const response = await client.getWalletTokenBalance({
      id: circleWallet.circleWalletId,
    });

    return (response.data?.tokenBalances || []) as CircleTokenBalance[];
  }

  /**
   * Get balances across all chains for a user.
   */
  async getAllBalances(userId: string): Promise<Record<string, CircleTokenBalance[]>> {
    const wallets = store.findCircleWalletsByUser(userId);

    const balances: Record<string, CircleTokenBalance[]> = {};

    for (const wallet of wallets) {
      try {
        const tokenBalances = await this.getWalletBalance(userId, wallet.chain);
        balances[wallet.chain] = tokenBalances;
      } catch (err) {
        logger.warn(`[CircleService] Failed to get balance for ${wallet.chain}: ${err}`);
        balances[wallet.chain] = [];
      }
    }

    return balances;
  }

  // ---- Transactions ----

  /**
   * Send USDC from a user's wallet to a destination address on the same chain.
   */
  async sendTransaction(params: {
    walletId: string;
    destinationAddress: string;
    amount: string;
    blockchain: string;
    tokenAddress?: string;
  }): Promise<CircleTransactionResult> {
    const client = this.ensureClient();

    const input: {
      idempotencyKey: string;
      walletId: string;
      destinationAddress: string;
      amount: string[];
      blockchain: string;
      tokenAddress?: string;
      fee: { type: 'level'; config: { feeLevel: 'MEDIUM' } };
    } = {
      idempotencyKey: uuidv4(),
      walletId: params.walletId,
      destinationAddress: params.destinationAddress,
      amount: [params.amount],
      blockchain: params.blockchain,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    };

    if (params.tokenAddress) {
      (input as Record<string, unknown>).tokenAddress = params.tokenAddress;
    }

    const response = await client.createTransaction(input as never);
    const txData = response.data;

    if (!txData) {
      throw new AppError('Failed to create transaction', 500, 'CIRCLE_TX_ERROR');
    }

    logger.info(`[CircleService] Transaction created: ${txData.id} (state: ${txData.state})`);
    return { id: txData.id, state: String(txData.state) } as CircleTransactionResult;
  }

  /**
   * Poll a transaction until it reaches a terminal state.
   */
  async waitForTransaction(transactionId: string, timeoutMs = 120000): Promise<CircleTransactionResult> {
    const client = this.ensureClient();
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await client.getTransaction({ id: transactionId });
      const tx = response.data?.transaction;

      if (!tx) {
        throw new AppError('Transaction not found', 404, 'TX_NOT_FOUND');
      }

      if (tx.state === 'COMPLETE') {
        logger.info(`[CircleService] Transaction completed: ${tx.id} txHash: ${tx.txHash}`);
        return tx as CircleTransactionResult;
      }

      if (tx.state === 'FAILED' || tx.state === 'CANCELLED') {
        throw new AppError(
          `Transaction ${tx.state}: ${tx.id} (${tx.errorReason || 'unknown'})`,
          500,
          'TX_FAILED'
        );
      }

      // Poll every 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new AppError('Transaction timeout', 504, 'TX_TIMEOUT');
  }

  // ---- Faucet (Testnet Only) ----

  /**
   * Request testnet USDC for a wallet on a specific chain.
   */
  async requestTestnetTokens(userId: string, chain: string): Promise<void> {
    const client = this.ensureClient();

    const wallet = store.findCircleWalletByUserChain(userId, chain);
    if (!wallet) {
      throw new ValidationError(`No wallet found for user on ${chain}`);
    }

    const circleBlockchain = CHAIN_TO_CIRCLE_BLOCKCHAIN[chain];
    if (!circleBlockchain) {
      throw new ValidationError(`Chain ${chain} not supported for faucet`);
    }

    // Arc's native currency is USDC, so skip native token request for Arc
    const requestNative = chain !== 'arc';

    await client.requestTestnetTokens({
      address: wallet.address,
      blockchain: circleBlockchain as never,
      usdc: true,
      native: requestNative,
    });

    logger.info(`[CircleService] Requested testnet tokens for ${wallet.address} on ${circleBlockchain}`);
  }

  // ---- Wallet Lookups ----

  /**
   * Get the Circle wallet ID for a user on a given chain.
   */
  async getWalletId(userId: string, chain: string): Promise<string> {
    const wallet = store.findCircleWalletByUserChain(userId, chain);

    if (!wallet) {
      throw new ValidationError(`No wallet found for user ${userId} on chain ${chain}`);
    }

    return wallet.circleWalletId;
  }

  /**
   * Get the on-chain address for a user's wallet on a given chain.
   */
  async getWalletAddress(userId: string, chain: string): Promise<string> {
    const wallet = store.findCircleWalletByUserChain(userId, chain);

    if (!wallet) {
      throw new ValidationError(`No wallet found for user ${userId} on chain ${chain}`);
    }

    return wallet.address;
  }

  /**
   * Get all wallets for a user.
   */
  async getUserWallets(userId: string) {
    return store.findCircleWalletsByUser(userId);
  }
}

export const circleService = new CircleService();
