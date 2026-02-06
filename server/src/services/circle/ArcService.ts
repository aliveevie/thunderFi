/**
 * Arc Blockchain Service
 * Provides direct interaction with the Arc testnet via ethers.js.
 * Arc acts as the liquidity hub — native gas on Arc is USDC.
 */

import { ethers } from 'ethers';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ARC_TESTNET } from './types';

export class ArcService {
  private provider: ethers.JsonRpcProvider | null = null;
  private initialized = false;

  /**
   * Initialize the Arc blockchain provider.
   */
  initialize(): void {
    const rpcUrl = env.ARC_RPC_URL || ARC_TESTNET.rpcUrl;

    this.provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: ARC_TESTNET.chainId,
      name: ARC_TESTNET.name,
    });

    this.initialized = true;
    logger.info(`[ArcService] Initialized with RPC: ${rpcUrl}`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private ensureProvider(): ethers.JsonRpcProvider {
    if (!this.initialized || !this.provider) {
      throw new AppError('Arc service not initialized', 503, 'ARC_NOT_INITIALIZED');
    }
    return this.provider;
  }

  /**
   * Get the native USDC balance for an address on Arc.
   * On Arc, the native gas token IS USDC (6 decimals).
   */
  async getBalance(address: string): Promise<string> {
    const provider = this.ensureProvider();

    const balanceWei = await provider.getBalance(address);
    // Arc native currency = USDC with 6 decimals
    return ethers.formatUnits(balanceWei, ARC_TESTNET.nativeCurrency.decimals);
  }

  /**
   * Get the current block number on Arc testnet.
   */
  async getBlockNumber(): Promise<number> {
    const provider = this.ensureProvider();
    return provider.getBlockNumber();
  }

  /**
   * Get transaction receipt from Arc testnet.
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    const provider = this.ensureProvider();
    return provider.getTransactionReceipt(txHash);
  }

  /**
   * Get Arc chain metadata for display.
   */
  getChainInfo() {
    return {
      chainId: ARC_TESTNET.chainId,
      name: ARC_TESTNET.name,
      rpcUrl: ARC_TESTNET.rpcUrl,
      nativeCurrency: ARC_TESTNET.nativeCurrency,
      blockExplorer: ARC_TESTNET.blockExplorer,
    };
  }
}

export const arcService = new ArcService();
