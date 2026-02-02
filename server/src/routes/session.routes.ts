import { Router } from 'express';
import { sessionController } from '../controllers/SessionController';
import { validate, schemas } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Create session
router.post(
  '/',
  optionalAuth,
  validate({ body: schemas.createSession }),
  sessionController.createSession.bind(sessionController)
);

// Get session by ID
router.get(
  '/:id',
  validate({ params: schemas.uuidParam }),
  sessionController.getSession.bind(sessionController)
);

// Activate session
router.post(
  '/:id/activate',
  validate({
    params: schemas.uuidParam,
    body: schemas.activateSession,
  }),
  sessionController.activateSession.bind(sessionController)
);

// Close session
router.post(
  '/:id/close',
  validate({ params: schemas.uuidParam }),
  sessionController.closeSession.bind(sessionController)
);

// Get session stats
router.get(
  '/:id/stats',
  validate({ params: schemas.uuidParam }),
  sessionController.getSessionStats.bind(sessionController)
);

export default router;
