import { create } from 'zustand';

// Auction phases from the contract
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

export interface ChainInfo {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  contractAddress: string;
  blockExplorer: string;
}

interface PrivacyAuctionState {
  // Status
  isInitialized: boolean;
  chainInfo: ChainInfo | null;
  currentAuctionId: number | null;

  // Current auction data
  auction: AuctionInfo | null;

  // User's pending order (before submitting)
  pendingOrder: {
    isBid: boolean;
    amount: string;
    limitPrice: string;
    commitment: string | null;
    salt: string | null;
  } | null;

  // Loading states
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Actions
  fetchStatus: () => Promise<void>;
  fetchAuction: (auctionId: number) => Promise<void>;
  generateCommitment: (trader: string, amount: string, limitPrice: string, isBid: boolean) => Promise<void>;
  clearPendingOrder: () => void;
  setError: (error: string | null) => void;
}

const API_BASE = '/api/v1/privacy';

export const usePrivacyAuctionStore = create<PrivacyAuctionState>((set, get) => ({
  // Initial state
  isInitialized: false,
  chainInfo: null,
  currentAuctionId: null,
  auction: null,
  pendingOrder: null,
  isLoading: false,
  isSubmitting: false,
  error: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/status`);
      const data = await response.json();

      if (data.success) {
        set({
          isInitialized: data.data.initialized,
          chainInfo: data.data.chainInfo,
          currentAuctionId: data.data.currentAuctionId,
          isLoading: false,
        });

        // If there's a current auction, fetch its data
        if (data.data.currentAuctionId && data.data.currentAuctionId > 0) {
          get().fetchAuction(data.data.currentAuctionId);
        }
      } else {
        set({ error: data.error || 'Failed to fetch status', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Failed to connect to server', isLoading: false });
    }
  },

  fetchAuction: async (auctionId: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/auctions/${auctionId}`);
      const data = await response.json();

      if (data.success) {
        set({ auction: data.data, isLoading: false });
      } else {
        set({ error: data.error || 'Failed to fetch auction', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Failed to fetch auction data', isLoading: false });
    }
  },

  generateCommitment: async (trader: string, amount: string, limitPrice: string, isBid: boolean) => {
    set({ isSubmitting: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/commitment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trader, amount, limitPrice }),
      });
      const data = await response.json();

      if (data.success) {
        set({
          pendingOrder: {
            isBid,
            amount,
            limitPrice,
            commitment: data.data.commitment,
            salt: data.data.salt,
          },
          isSubmitting: false,
        });
      } else {
        set({ error: data.error || 'Failed to generate commitment', isSubmitting: false });
      }
    } catch (error) {
      set({ error: 'Failed to generate commitment', isSubmitting: false });
    }
  },

  clearPendingOrder: () => {
    set({ pendingOrder: null });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
