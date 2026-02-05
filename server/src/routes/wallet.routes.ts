import { Router } from 'express';
import { walletController } from '../controllers/WalletController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// POST /wallets/create — create wallets on specified chains
router.post(
  '/create',
  validate({
    body: z.object({
      chains: z.array(z.string()).min(1).default(['arc', 'arbitrum', 'base']),
    }),
  }),
  walletController.createWallets.bind(walletController)
);

// POST /wallets/faucet — request testnet tokens
router.post(
  '/faucet',
  validate({
    body: z.object({
      chain: z.string().min(1),
    }),
  }),
  walletController.requestFaucet.bind(walletController)
);

// GET /wallets — list all user wallets
router.get('/', walletController.getWallets.bind(walletController));

// GET /wallets/balance — get balances across all chains
router.get('/balance', walletController.getAllBalances.bind(walletController));

// GET /wallets/balance/:chain — get balance for a specific chain
router.get('/balance/:chain', walletController.getChainBalance.bind(walletController));

// GET /wallets/arc/info — get Arc chain metadata
router.get('/arc/info', walletController.getArcInfo.bind(walletController));

export default router;
