import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse, SessionResponse } from '../types';
import { sessionService } from '../services/session/SessionService';
import { prisma } from '../config/database';
import { generateToken } from '../middleware/auth';

export class SessionController {
  /**
   * POST /api/v1/sessions
   * Create a new session
   */
  async createSession(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<SessionResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { allowance, walletAddress } = req.body;

      // Get or create user
      let user = await prisma.user.findUnique({
        where: { walletAddress },
      });

      if (!user) {
        user = await prisma.user.create({
          data: { walletAddress },
        });
      }

      const session = await sessionService.createSession(
        { allowance, walletAddress },
        user.id
      );

      // Generate token for subsequent requests
      const token = generateToken(user.id, walletAddress);

      res.status(201).json({
        success: true,
        data: {
          ...session,
          token,
        } as SessionResponse & { token: string },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sessions/:id
   * Get session by ID
   */
  async getSession(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<SessionResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const session = await sessionService.getSession(id);

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sessions/:id/activate
   * Activate session after deposit
   */
  async activateSession(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<SessionResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { depositTxHash } = req.body;

      const session = await sessionService.activateSession(id, depositTxHash);

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sessions/:id/close
   * Close session
   */
  async closeSession(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<SessionResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const session = await sessionService.closeSession(id);

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sessions/:id/stats
   * Get session statistics
   */
  async getSessionStats(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const session = await sessionService.getSession(id);

      // Calculate stats
      const totalActions = session.actionsCount;
      const gasSaved = (totalActions * 1.5).toFixed(2); // ~$1.50 saved per action
      const totalFeesPaid = (totalActions * 0.001).toFixed(4);

      res.json({
        success: true,
        data: {
          totalActions,
          gasSaved,
          totalFeesPaid,
          netPnL: '0', // Would calculate from actual trades
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const sessionController = new SessionController();
