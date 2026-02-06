import { Request, Response, NextFunction } from 'express';
import { privacyAuctionService, AuctionInfo, OrderInfo, AuctionPhase } from '../services/privacy/PrivacyAuctionService';
import { logger } from '../utils/logger';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class PrivacyAuctionController {
  /**
   * GET /api/v1/privacy/status
   * Get service status and chain info
   */
  async getStatus(
    _req: Request,
    res: Response<ApiResponse<{
      initialized: boolean;
      chainInfo: ReturnType<typeof privacyAuctionService.getChainInfo>;
      currentAuctionId: number | null;
    }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const initialized = privacyAuctionService.isInitialized();
      const chainInfo = privacyAuctionService.getChainInfo();
      let currentAuctionId: number | null = null;

      if (initialized) {
        currentAuctionId = await privacyAuctionService.getCurrentAuctionId();
      }

      res.json({
        success: true,
        data: {
          initialized,
          chainInfo,
          currentAuctionId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/privacy/auctions/current
   * Get current auction ID
   */
  async getCurrentAuctionId(
    _req: Request,
    res: Response<ApiResponse<{ auctionId: number }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!privacyAuctionService.isInitialized()) {
        res.status(503).json({
          success: false,
          error: 'Privacy auction service not initialized',
        });
        return;
      }

      const auctionId = await privacyAuctionService.getCurrentAuctionId();

      res.json({
        success: true,
        data: { auctionId },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/privacy/auctions/:id
   * Get auction by ID
   */
  async getAuction(
    req: Request,
    res: Response<ApiResponse<AuctionInfo>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!privacyAuctionService.isInitialized()) {
        res.status(503).json({
          success: false,
          error: 'Privacy auction service not initialized',
        });
        return;
      }

      const auctionId = parseInt(req.params.id, 10);
      if (isNaN(auctionId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid auction ID',
        });
        return;
      }

      const auction = await privacyAuctionService.getAuction(auctionId);

      if (!auction) {
        res.status(404).json({
          success: false,
          error: 'Auction not found',
        });
        return;
      }

      res.json({
        success: true,
        data: auction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/privacy/auctions/:auctionId/orders/:orderId
   * Get order by ID
   */
  async getOrder(
    req: Request,
    res: Response<ApiResponse<OrderInfo>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!privacyAuctionService.isInitialized()) {
        res.status(503).json({
          success: false,
          error: 'Privacy auction service not initialized',
        });
        return;
      }

      const auctionId = parseInt(req.params.auctionId, 10);
      const orderId = parseInt(req.params.orderId, 10);

      if (isNaN(auctionId) || isNaN(orderId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid auction ID or order ID',
        });
        return;
      }

      const order = await privacyAuctionService.getOrder(auctionId, orderId);

      if (!order) {
        res.status(404).json({
          success: false,
          error: 'Order not found',
        });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/privacy/commitment
   * Generate a commitment hash locally (no on-chain call)
   */
  async generateCommitment(
    req: Request,
    res: Response<ApiResponse<{ commitment: string; salt: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { trader, amount, limitPrice } = req.body;

      if (!trader || !amount || !limitPrice) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: trader, amount, limitPrice',
        });
        return;
      }

      // Generate a random salt
      const salt = privacyAuctionService.generateSalt();

      // Generate commitment locally (no RPC call needed)
      const commitment = privacyAuctionService.generateCommitmentLocal(
        trader,
        amount,
        limitPrice,
        salt
      );

      logger.info(`[PrivacyAuction] Generated commitment for ${trader}`);

      res.json({
        success: true,
        data: { commitment, salt },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/privacy/auctions
   * Create a new auction (server-side, requires operator key)
   */
  async createAuction(
    req: Request,
    res: Response<ApiResponse<{ auctionId: number; txHash: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!privacyAuctionService.isInitialized()) {
        res.status(503).json({
          success: false,
          error: 'Privacy auction service not initialized',
        });
        return;
      }

      const { token0, token1, collectionDurationSeconds } = req.body;

      if (!token0 || !token1 || !collectionDurationSeconds) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: token0, token1, collectionDurationSeconds',
        });
        return;
      }

      const result = await privacyAuctionService.createAuction(
        token0,
        token1,
        collectionDurationSeconds
      );

      if (!result) {
        res.status(500).json({
          success: false,
          error: 'Failed to create auction',
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/privacy/phases
   * Get enum mapping for auction phases
   */
  async getPhases(
    _req: Request,
    res: Response<ApiResponse<Record<string, number>>>,
    _next: NextFunction
  ): Promise<void> {
    res.json({
      success: true,
      data: {
        NOT_STARTED: AuctionPhase.NOT_STARTED,
        COLLECTION: AuctionPhase.COLLECTION,
        REVEAL: AuctionPhase.REVEAL,
        SETTLEMENT: AuctionPhase.SETTLEMENT,
        COMPLETED: AuctionPhase.COMPLETED,
      },
    });
  }
}

export const privacyAuctionController = new PrivacyAuctionController();
