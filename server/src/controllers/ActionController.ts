import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse, ActionResponse } from '../types';
import { actionService } from '../services/session/ActionService';
import { ActionStatus } from '../config/store';

export class ActionController {
  /**
   * POST /api/v1/sessions/:sessionId/actions
   * Execute an off-chain action
   */
  async createAction(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<ActionResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { type, payload, signature } = req.body;

      const action = await actionService.executeAction(sessionId, {
        type,
        payload,
        signature,
      });

      res.status(201).json({
        success: true,
        data: action,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sessions/:sessionId/actions
   * Get all actions for a session
   */
  async getActions(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<{ actions: ActionResponse[]; total: number }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { status, limit, offset } = req.query;

      const result = await actionService.getActions(sessionId, {
        status: status as ActionStatus | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sessions/:sessionId/actions/unsettled
   * Get unsettled actions for a session
   */
  async getUnsettledActions(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<ActionResponse[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const actions = await actionService.getUnsettledActions(sessionId);

      res.json({
        success: true,
        data: actions,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const actionController = new ActionController();
