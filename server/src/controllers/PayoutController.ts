import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse, PayoutResponse } from '../types';
import { payoutService } from '../services/payout/PayoutService';

export class PayoutController {
  /**
   * POST /api/v1/sessions/:sessionId/payouts
   * Create a payout
   */
  async createPayout(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<PayoutResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { recipients } = req.body;

      const payout = await payoutService.createPayout(sessionId, { recipients });

      res.status(201).json({
        success: true,
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payouts/:payoutId/process
   * Process a payout
   */
  async processPayout(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<PayoutResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { payoutId } = req.params;
      const payout = await payoutService.processPayout(payoutId);

      res.json({
        success: true,
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sessions/:sessionId/payouts
   * Get all payouts for a session
   */
  async getPayouts(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<PayoutResponse[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const payouts = await payoutService.getSessionPayouts(sessionId);

      res.json({
        success: true,
        data: payouts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payouts/:payoutId
   * Get payout by ID
   */
  async getPayout(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<PayoutResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { payoutId } = req.params;
      const payout = await payoutService.getPayout(payoutId);

      res.json({
        success: true,
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const payoutController = new PayoutController();
