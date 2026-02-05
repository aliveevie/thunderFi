import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse, WalletBalanceResponse } from '../types';
import { circleService, arcService } from '../services/circle';
import type { CircleWalletInfo, CircleTokenBalance } from '../services/circle/types';

export class WalletController {
  /**
   * POST /api/v1/wallets/create
   * Create Circle developer-controlled wallets for the authenticated user.
   */
  async createWallets(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<CircleWalletInfo[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { chains } = req.body;

      const wallets = await circleService.createUserWallets(userId, chains);

      res.status(201).json({
        success: true,
        data: wallets,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/wallets
   * Get all wallets for the authenticated user.
   */
  async getWallets(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const wallets = await circleService.getUserWallets(userId);

      res.json({
        success: true,
        data: wallets,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/wallets/balance
   * Get token balances across all chains for the authenticated user.
   */
  async getAllBalances(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Record<string, CircleTokenBalance[]>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const balances = await circleService.getAllBalances(userId);

      res.json({
        success: true,
        data: balances,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/wallets/balance/:chain
   * Get token balance for a specific chain.
   */
  async getChainBalance(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<CircleTokenBalance[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { chain } = req.params;

      const balances = await circleService.getWalletBalance(userId, chain);

      res.json({
        success: true,
        data: balances,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/wallets/faucet
   * Request testnet USDC + native tokens for a specific chain.
   */
  async requestFaucet(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { chain } = req.body;

      await circleService.requestTestnetTokens(userId, chain);

      res.json({
        success: true,
        data: { message: `Testnet tokens requested for ${chain}` },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/wallets/arc/info
   * Get Arc chain metadata.
   */
  async getArcInfo(
    _req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const info = arcService.getChainInfo();

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const walletController = new WalletController();
