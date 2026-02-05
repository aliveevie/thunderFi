/**
 * Circle Integration Type Definitions
 * Chain mappings, token config, and shared interfaces
 */

// Circle SDK Blockchain identifiers (from @circle-fin/developer-controlled-wallets)
// Arc is the central liquidity hub — all payouts originate from Arc
export const CHAIN_TO_CIRCLE_BLOCKCHAIN: Record<string, string> = {
  'arc': 'ARC-TESTNET',
  'arbitrum': 'ARB-SEPOLIA',
  'base': 'BASE-SEPOLIA',
  'optimism': 'OP-SEPOLIA',
  'polygon': 'MATIC-AMOY',
  'ethereum': 'ETH-SEPOLIA',
};

// The hub chain — all liquidity is sourced from Arc
export const HUB_CHAIN = 'arc' as const;

// Arc testnet config
export const ARC_TESTNET = {
  chainId: 5042002,
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.testnet.arc.network',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  blockExplorer: 'https://testnet.arcscan.app',
} as const;

// Block explorer URLs per chain (testnet)
export const EXPLORER_MAP: Record<string, string> = {
  arc: 'https://testnet.arcscan.app/tx/',
  arbitrum: 'https://sepolia.arbiscan.io/tx/',
  base: 'https://sepolia.basescan.org/tx/',
  optimism: 'https://sepolia-optimism.etherscan.io/tx/',
  polygon: 'https://amoy.polygonscan.com/tx/',
  ethereum: 'https://sepolia.etherscan.io/tx/',
};

// Supported destination chains for payouts
export const SUPPORTED_CHAINS = [
  { id: 'arc', name: 'Arc (Hub)', circleBlockchain: 'ARC-TESTNET' },
  { id: 'arbitrum', name: 'Arbitrum', circleBlockchain: 'ARB-SEPOLIA' },
  { id: 'base', name: 'Base', circleBlockchain: 'BASE-SEPOLIA' },
  { id: 'optimism', name: 'Optimism', circleBlockchain: 'OP-SEPOLIA' },
  { id: 'polygon', name: 'Polygon', circleBlockchain: 'MATIC-AMOY' },
] as const;

// ---- Response / Data Interfaces ----

export interface CircleWalletInfo {
  id: string;
  address: string;
  blockchain: string;
  state: string;
  walletSetId: string;
  createDate?: string;
}

export interface CircleTokenBalance {
  token: {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    blockchain: string;
  };
  amount: string;
}

export interface CircleTransactionResult {
  id: string;
  state: string;
  txHash?: string;
  blockchain?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amounts?: string[];
  createDate?: string;
  errorReason?: string;
}

export interface GatewayTransferRequest {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  sourceAddress: string;
  destinationAddress: string;
  idempotencyKey?: string;
}

export interface GatewayTransferResult {
  id: string;
  state: string;
  sourceChain: string;
  destinationChain: string;
  amount: string;
  txHash?: string;
}
