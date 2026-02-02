import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse, BatchResponse, SettlementPreview } from '../types';
import { settlementService } from '../services/settlement/SettlementService';

export class SettlementController {
  /**
   * POST /api/v1/sessions/:sessionId/settlement/preview
   * Preview settlement
   */
  async previewSettlement(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<SettlementPreview>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const preview = await settlementService.previewSettlement(sessionId);

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sessions/:sessionId/settlement/commit
   * Commit settlement batch
   */
  async commitBatch(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<BatchResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const batch = await settlementService.commitBatch(sessionId);

      res.status(201).json({
        success: true,
        data: batch,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sessions/:sessionId/settlement/reveal
   * Reveal and execute settlement
   */
  async revealBatch(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<BatchResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { batchId } = req.body;
      const batch = await settlementService.revealBatch(batchId);

      res.json({
        success: true,
        data: batch,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sessions/:sessionId/settlement/batches
   * Get all batches for a session
   */
  async getBatches(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<BatchResponse[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const batches = await settlementService.getSessionBatches(sessionId);

      res.json({
        success: true,
        data: batches,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/batches/:batchId
   * Get batch by ID
   */
  async getBatch(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<BatchResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { batchId } = req.params;
      const batch = await settlementService.getBatch(batchId);

      res.json({
        success: true,
        data: batch,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const settlementController = new SettlementController();
