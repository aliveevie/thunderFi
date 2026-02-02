import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

/**
 * Middleware factory for request validation
 */
export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Common validation schemas
export const schemas = {
  // Session schemas
  createSession: z.object({
    allowance: z.string().min(1, 'Allowance is required'),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  }),

  activateSession: z.object({
    depositTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  }),

  // Action schemas
  createAction: z.object({
    type: z.enum(['PLACE_ORDER', 'CANCEL_ORDER', 'MODIFY_ORDER', 'MICRO_TIP']),
    payload: z.record(z.unknown()),
    signature: z.string().optional(),
  }),

  placeOrderPayload: z.object({
    pair: z.string().min(1),
    side: z.enum(['buy', 'sell']),
    amount: z.string().min(1),
    price: z.string().min(1),
    orderType: z.enum(['limit', 'market']).optional().default('limit'),
  }),

  cancelOrderPayload: z.object({
    orderId: z.string().uuid(),
  }),

  microTipPayload: z.object({
    recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    amount: z.string().min(1),
    message: z.string().optional(),
  }),

  // Payout schemas
  createPayout: z.object({
    recipients: z.array(
      z.object({
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        chain: z.string().min(1),
        amount: z.string().min(1),
      })
    ).min(1, 'At least one recipient is required'),
  }),

  // Pagination
  pagination: z.object({
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
    offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
  }),

  // UUID param
  uuidParam: z.object({
    id: z.string().uuid(),
  }),

  sessionIdParam: z.object({
    sessionId: z.string().uuid(),
  }),
};
