import { Router } from 'express';
import sessionRoutes from './session.routes';
import actionRoutes from './action.routes';
import settlementRoutes from './settlement.routes';
import payoutRoutes, { payoutStandaloneRouter } from './payout.routes';
import privacyRoutes from './privacy.routes';
import walletRoutes from './wallet.routes';
import { settlementController } from '../controllers/SettlementController';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Session routes
router.use('/sessions', sessionRoutes);

// Nested routes under sessions
router.use('/sessions/:sessionId/actions', actionRoutes);
router.use('/sessions/:sessionId/settlement', settlementRoutes);
router.use('/sessions/:sessionId/payouts', payoutRoutes);

// Standalone routes
router.use('/payouts', payoutStandaloneRouter);
router.use('/wallets', walletRoutes);
router.get('/batches/:batchId', settlementController.getBatch.bind(settlementController));

// Privacy auction routes (Uniswap v4 integration)
router.use('/privacy', privacyRoutes);

export default router;
