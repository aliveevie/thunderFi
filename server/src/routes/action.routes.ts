import { Router } from 'express';
import { actionController } from '../controllers/ActionController';
import { validate, schemas } from '../middleware/validate';
import { actionLimiter } from '../middleware/rateLimit';

const router = Router({ mergeParams: true });

// Execute action (with higher rate limit for demo)
router.post(
  '/',
  actionLimiter,
  validate({
    params: schemas.sessionIdParam,
    body: schemas.createAction,
  }),
  actionController.createAction.bind(actionController)
);

// Get actions
router.get(
  '/',
  validate({ params: schemas.sessionIdParam }),
  actionController.getActions.bind(actionController)
);

// Get unsettled actions
router.get(
  '/unsettled',
  validate({ params: schemas.sessionIdParam }),
  actionController.getUnsettledActions.bind(actionController)
);

export default router;
