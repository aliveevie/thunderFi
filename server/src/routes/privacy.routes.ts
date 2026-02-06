import { Router } from 'express';
import { privacyAuctionController } from '../controllers/PrivacyAuctionController';

const router = Router();

// Service status and chain info
router.get(
  '/status',
  privacyAuctionController.getStatus.bind(privacyAuctionController)
);

// Get phase enum values
router.get(
  '/phases',
  privacyAuctionController.getPhases.bind(privacyAuctionController)
);

// Get current auction ID
router.get(
  '/auctions/current',
  privacyAuctionController.getCurrentAuctionId.bind(privacyAuctionController)
);

// Get auction by ID
router.get(
  '/auctions/:id',
  privacyAuctionController.getAuction.bind(privacyAuctionController)
);

// Get order by ID
router.get(
  '/auctions/:auctionId/orders/:orderId',
  privacyAuctionController.getOrder.bind(privacyAuctionController)
);

// Generate commitment (local computation)
router.post(
  '/commitment',
  privacyAuctionController.generateCommitment.bind(privacyAuctionController)
);

// Create auction (requires operator key on server)
router.post(
  '/auctions',
  privacyAuctionController.createAuction.bind(privacyAuctionController)
);

export default router;
