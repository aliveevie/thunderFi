import { Router } from 'express';
import { settlementController } from '../controllers/SettlementController';
import { validate, schemas } from '../middleware/validate';

const router = Router({ mergeParams: true });

// Preview settlement
router.post(
  '/preview',
  validate({ params: schemas.sessionIdParam }),
  settlementController.previewSettlement.bind(settlementController)
);

// Commit batch
router.post(
  '/commit',
  validate({ params: schemas.sessionIdParam }),
  settlementController.commitBatch.bind(settlementController)
);

// Reveal batch
router.post(
  '/reveal',
  validate({ params: schemas.sessionIdParam }),
  settlementController.revealBatch.bind(settlementController)
);

// Get batches for session
router.get(
  '/batches',
  validate({ params: schemas.sessionIdParam }),
  settlementController.getBatches.bind(settlementController)
);

export default router;
