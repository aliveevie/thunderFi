import { Router } from 'express';
import { payoutController } from '../controllers/PayoutController';
import { validate, schemas } from '../middleware/validate';

const router = Router({ mergeParams: true });

// Create payout
router.post(
  '/',
  validate({
    params: schemas.sessionIdParam,
    body: schemas.createPayout,
  }),
  payoutController.createPayout.bind(payoutController)
);

// Get payouts for session
router.get(
  '/',
  validate({ params: schemas.sessionIdParam }),
  payoutController.getPayouts.bind(payoutController)
);

export default router;

// Standalone payout routes (mounted separately)
export const payoutStandaloneRouter = Router();

// Get payout by ID
payoutStandaloneRouter.get(
  '/:payoutId',
  payoutController.getPayout.bind(payoutController)
);

// Process payout
payoutStandaloneRouter.post(
  '/:payoutId/process',
  payoutController.processPayout.bind(payoutController)
);
