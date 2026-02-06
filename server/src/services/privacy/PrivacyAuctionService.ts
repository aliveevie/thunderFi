/**
 * Privacy Auction Service
 *
 * Connects to the deployed ThunderBatchAuction contract on Sepolia
 * to provide privacy-preserving batch auction functionality.
 *
 * Deployed Contracts (Sepolia):
 * - ThunderBatchAuction: 0x48f50f4166a9f10d13d0119590B71a724B5CE8AA
 * - ThunderPrivacyHook:  0xBa4149aCEFddE4eDa3752e03D3785336565260C0
 * - PrivacyRouter:       0xbcB1178BDc04fa7aBefb1bd43a750c432F8A299B
 * - PoolManager:         0xE03A1074c86CFeDd5C142C4F04F1a1536e203543
 * Network: Sepolia (chainId: 11155111)
 */

import { ethers } from 'ethers';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ThunderBatchAuction ABI - only the functions we need
const BATCH_AUCTION_ABI = [
  // Read functions
  'function currentAuctionId() view returns (uint256)',
  'function getAuction(uint256 auctionId) view returns (tuple(address token0, address token1, uint256 collectionEndTime, uint256 revealEndTime, uint256 settlementEndTime, uint256 clearingPrice, uint256 totalBidVolume, uint256 totalAskVolume, uint256 matchedVolume, bool cleared, uint256 orderCount))',
  'function getOrder(uint256 auctionId, uint256 orderId) view returns (tuple(address trader, bytes32 commitment, bool isBid, uint256 amount, uint256 limitPrice, uint256 deposit, bool revealed, bool filled, uint256 filledAmount))',
  'function getAuctionPhase(uint256 auctionId) view returns (uint8)',
  'function generateCommitment(address trader, uint256 amount, uint256 limitPrice, bytes32 salt) pure returns (bytes32)',

  // Write functions (require signer)
  'function createAuction(address token0, address token1, uint256 collectionDuration) returns (uint256)',
  'function submitOrder(uint256 auctionId, bool isBid, bytes32 commitment, uint256 deposit) returns (uint256)',
  'function revealOrder(uint256 auctionId, uint256 orderId, uint256 amount, uint256 limitPrice, bytes32 salt)',
  'function clearAuction(uint256 auctionId)',
  'function settleOrder(uint256 auctionId, uint256 orderId)',

  // Events
  'event AuctionCreated(uint256 indexed auctionId, address indexed token0, address indexed token1, uint256 endTime)',
  'event OrderSubmitted(uint256 indexed auctionId, uint256 indexed orderId, address indexed trader, bool isBid, bytes32 commitment)',
  'event OrderRevealed(uint256 indexed auctionId, uint256 indexed orderId, uint256 amount, uint256 limitPrice)',
  'event AuctionCleared(uint256 indexed auctionId, uint256 clearingPrice, uint256 totalBidVolume, uint256 totalAskVolume, uint256 matchedVolume)',
  'event OrderFilled(uint256 indexed auctionId, uint256 indexed orderId, address indexed trader, uint256 filledAmount, uint256 price)',
];

// Auction phases
export enum AuctionPhase {
  NOT_STARTED = 0,
  COLLECTION = 1,
  REVEAL = 2,
  SETTLEMENT = 3,
  COMPLETED = 4,
}

export interface AuctionInfo {
  id: number;
  token0: string;
  token1: string;
  collectionEndTime: number;
  revealEndTime: number;
  settlementEndTime: number;
  clearingPrice: string;
  totalBidVolume: string;
  totalAskVolume: string;
  matchedVolume: string;
  cleared: boolean;
  orderCount: number;
  phase: AuctionPhase;
}

export interface OrderInfo {
  trader: string;
  commitment: string;
  isBid: boolean;
  amount: string;
  limitPrice: string;
  deposit: string;
  revealed: boolean;
  filled: boolean;
  filledAmount: string;
}

export class PrivacyAuctionService {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private signer: ethers.Wallet | null = null;
  private initialized = false;

  /**
   * Initialize the service with Sepolia RPC connection
   */
  async initialize(): Promise<void> {
    const rpcUrl = env.SEPOLIA_RPC_URL;
    const contractAddress = env.THUNDER_BATCH_AUCTION_ADDRESS;
    const privateKey = env.OPERATOR_PRIVATE_KEY;

    if (!rpcUrl || !contractAddress) {
      logger.warn('[PrivacyAuction] Missing SEPOLIA_RPC_URL or THUNDER_BATCH_AUCTION_ADDRESS');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Verify connection
      const network = await this.provider.getNetwork();
      if (network.chainId !== 11155111n) {
        logger.warn(`[PrivacyAuction] Connected to wrong network: ${network.chainId}, expected Sepolia (11155111)`);
      }

      // Create contract instance (read-only)
      this.contract = new ethers.Contract(contractAddress, BATCH_AUCTION_ABI, this.provider);

      // If we have a private key, create a signer for write operations
      if (privateKey) {
        this.signer = new ethers.Wallet(privateKey, this.provider);
        this.contract = this.contract.connect(this.signer) as ethers.Contract;
        logger.info(`[PrivacyAuction] Signer initialized: ${this.signer.address}`);
      }

      this.initialized = true;
      logger.info(`[PrivacyAuction] Initialized - Contract: ${contractAddress}`);

      // Log current auction ID
      const currentId = await this.getCurrentAuctionId();
      logger.info(`[PrivacyAuction] Current auction ID: ${currentId}`);

    } catch (error) {
      logger.error(`[PrivacyAuction] Failed to initialize: ${error}`);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current auction ID
   */
  async getCurrentAuctionId(): Promise<number> {
    if (!this.contract) throw new Error('Service not initialized');

    const id = await this.contract.currentAuctionId();
    return Number(id);
  }

  /**
   * Get auction information by ID
   */
  async getAuction(auctionId: number): Promise<AuctionInfo | null> {
    if (!this.contract) throw new Error('Service not initialized');

    try {
      const auction = await this.contract.getAuction(auctionId);
      const phase = await this.contract.getAuctionPhase(auctionId);

      return {
        id: auctionId,
        token0: auction.token0,
        token1: auction.token1,
        collectionEndTime: Number(auction.collectionEndTime),
        revealEndTime: Number(auction.revealEndTime),
        settlementEndTime: Number(auction.settlementEndTime),
        clearingPrice: auction.clearingPrice.toString(),
        totalBidVolume: auction.totalBidVolume.toString(),
        totalAskVolume: auction.totalAskVolume.toString(),
        matchedVolume: auction.matchedVolume.toString(),
        cleared: auction.cleared,
        orderCount: Number(auction.orderCount),
        phase: Number(phase) as AuctionPhase,
      };
    } catch (error) {
      logger.error(`[PrivacyAuction] Failed to get auction ${auctionId}: ${error}`);
      return null;
    }
  }

  /**
   * Get order information
   */
  async getOrder(auctionId: number, orderId: number): Promise<OrderInfo | null> {
    if (!this.contract) throw new Error('Service not initialized');

    try {
      const order = await this.contract.getOrder(auctionId, orderId);

      return {
        trader: order.trader,
        commitment: order.commitment,
        isBid: order.isBid,
        amount: order.amount.toString(),
        limitPrice: order.limitPrice.toString(),
        deposit: order.deposit.toString(),
        revealed: order.revealed,
        filled: order.filled,
        filledAmount: order.filledAmount.toString(),
      };
    } catch (error) {
      logger.error(`[PrivacyAuction] Failed to get order ${auctionId}/${orderId}: ${error}`);
      return null;
    }
  }

  /**
   * Generate a commitment hash (can be done client-side too)
   */
  async generateCommitment(
    trader: string,
    amount: string,
    limitPrice: string,
    salt: string
  ): Promise<string> {
    if (!this.contract) throw new Error('Service not initialized');

    return this.contract.generateCommitment(trader, amount, limitPrice, salt);
  }

  /**
   * Generate commitment locally (no RPC call needed)
   */
  generateCommitmentLocal(
    trader: string,
    amount: string,
    limitPrice: string,
    salt: string
  ): string {
    return ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'bytes32'],
      [trader, amount, limitPrice, salt]
    );
  }

  /**
   * Generate a random salt
   */
  generateSalt(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  /**
   * Create a new auction (requires signer with funds)
   */
  async createAuction(
    token0: string,
    token1: string,
    collectionDurationSeconds: number
  ): Promise<{ auctionId: number; txHash: string } | null> {
    if (!this.contract || !this.signer) {
      throw new Error('Service not initialized or no signer');
    }

    try {
      const tx = await this.contract.createAuction(token0, token1, collectionDurationSeconds);
      const receipt = await tx.wait();

      // Parse the AuctionCreated event
      const event = receipt.logs.find((log: ethers.Log) => {
        try {
          const parsed = this.contract!.interface.parseLog(log);
          return parsed?.name === 'AuctionCreated';
        } catch {
          return false;
        }
      });

      let auctionId = await this.getCurrentAuctionId();
      if (event) {
        const parsed = this.contract.interface.parseLog(event);
        if (parsed) {
          auctionId = Number(parsed.args.auctionId);
        }
      }

      logger.info(`[PrivacyAuction] Created auction ${auctionId} - tx: ${receipt.hash}`);

      return { auctionId, txHash: receipt.hash };
    } catch (error) {
      logger.error(`[PrivacyAuction] Failed to create auction: ${error}`);
      return null;
    }
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return env.THUNDER_BATCH_AUCTION_ADDRESS || '';
  }

  /**
   * Get chain info for client
   */
  getChainInfo() {
    return {
      chainId: 11155111,
      chainName: 'Sepolia',
      rpcUrl: env.SEPOLIA_RPC_URL,
      contractAddress: env.THUNDER_BATCH_AUCTION_ADDRESS,
      blockExplorer: 'https://sepolia.etherscan.io',
    };
  }
}

export const privacyAuctionService = new PrivacyAuctionService();
