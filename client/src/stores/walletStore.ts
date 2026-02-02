import { create } from 'zustand';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  isConnected: false,
  chainId: null,
  isConnecting: false,

  connect: async () => {
    set({ isConnecting: true });
    // Simulate wallet connection
    await new Promise((resolve) => setTimeout(resolve, 1000));
    set({
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE21',
      isConnected: true,
      chainId: 1,
      isConnecting: false,
    });
  },

  disconnect: () => {
    set({
      address: null,
      isConnected: false,
      chainId: null,
    });
  },
}));
