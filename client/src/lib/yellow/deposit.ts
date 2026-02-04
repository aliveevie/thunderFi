/**
 * Yellow Network Deposit Service
 * Handles on-chain deposits using NitroliteClient
 */

import { type Hash, type Address, parseUnits, formatUnits } from 'viem';
import {
  NitroliteClient,
  WalletStateSigner,
  type ContractAddresses,
  type NitroliteClientConfig,
} from '@erc7824/nitrolite';
import type { PublicClient, WalletClient, Chain, Transport, Account, ParseAccount } from 'viem';

export interface DepositServiceConfig {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  chainId: number;
  contractAddresses: ContractAddresses;
  challengeDuration?: bigint;
}

export interface DepositInfo {
  tokenAddress: Address;
  amount: string;
  decimals: number;
}

export interface DepositResult {
  approvalTxHash?: Hash;
  depositTxHash: Hash;
  amount: string;
  tokenAddress: Address;
}

/**
 * Contract addresses for different networks
 * From ClearNode get_config response
 */
export const NETWORK_CONTRACTS: Record<number, ContractAddresses> = {
  // Polygon Amoy Testnet (supported by sandbox)
  80002: {
    custody: '0x019B65A265EB3363822f2752141b3dF16131b262' as Address,
    adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' as Address,
  },
  // Base Sepolia Testnet (supported by sandbox)
  // Same custody contract as Polygon Amoy in sandbox environment
  84532: {
    custody: '0x019B65A265EB3363822f2752141b3dF16131b262' as Address,
    adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' as Address,
  },
  // Mainnet
  1: {
    custody: '0x0000000000000000000000000000000000000000' as Address,
    adjudicator: '0x0000000000000000000000000000000000000000' as Address,
  },
};

/**
 * Common token addresses
 * For testnet USDC, get tokens from:
 * - Base Sepolia: https://faucet.circle.com/ (select Base Sepolia)
 * - Polygon Amoy: https://faucet.polygon.technology/
 */
export const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
  // Polygon Amoy Testnet
  80002: {
    USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' as Address, // Polygon Amoy USDC
  },
  // Base Sepolia Testnet
  84532: {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address, // Base Sepolia USDC from Circle
  },
  // Mainnet
  1: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address,
  },
};

export class DepositService {
  private client: NitroliteClient | null = null;
  private config: DepositServiceConfig;

  constructor(config: DepositServiceConfig) {
    this.config = config;
  }

  /**
   * Initialize the NitroliteClient
   * Call this after getting contract addresses from ClearNode
   */
  async initialize(contractAddresses?: ContractAddresses): Promise<void> {
    const addresses = contractAddresses || this.config.contractAddresses;

    if (!addresses.custody || addresses.custody === '0x0000000000000000000000000000000000000000') {
      throw new Error('Custody contract address not configured');
    }

    const clientConfig: NitroliteClientConfig = {
      publicClient: this.config.publicClient,
      walletClient: this.config.walletClient as WalletClient<Transport, Chain, ParseAccount<Account>>,
      stateSigner: new WalletStateSigner(this.config.walletClient as WalletClient<Transport, Chain, ParseAccount<Account>>),
      addresses,
      chainId: this.config.chainId,
      challengeDuration: this.config.challengeDuration || BigInt(86400), // 1 day default
    };

    this.client = new NitroliteClient(clientConfig);
  }

  /**
   * Update contract addresses (e.g., from ClearNode config)
   */
  updateContractAddresses(addresses: ContractAddresses): void {
    this.config.contractAddresses = addresses;
    this.client = null; // Reset client to force re-initialization
  }

  /**
   * Get the custody contract address
   */
  getCustodyAddress(): Address {
    return this.config.contractAddresses.custody;
  }

  /**
   * Get token balance in wallet
   */
  async getWalletTokenBalance(tokenAddress: Address): Promise<bigint> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!.getTokenBalance(tokenAddress);
  }

  /**
   * Get current allowance for custody contract
   */
  async getAllowance(tokenAddress: Address): Promise<bigint> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!.getTokenAllowance(tokenAddress);
  }

  /**
   * Get balance in custody contract
   */
  async getCustodyBalance(tokenAddress: Address): Promise<bigint> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!.getAccountBalance(tokenAddress);
  }

  /**
   * Approve tokens for deposit to custody contract
   * This is step 1 of the deposit flow
   */
  async approveTokens(tokenAddress: Address, amount: bigint): Promise<Hash> {
    if (!this.client) {
      await this.initialize();
    }
    console.log(`[DepositService] Approving ${amount} tokens for custody contract`);
    return this.client!.approveTokens(tokenAddress, amount);
  }

  /**
   * Deposit tokens to custody contract
   * This is step 2 of the deposit flow (requires prior approval)
   */
  async deposit(tokenAddress: Address, amount: bigint): Promise<Hash> {
    if (!this.client) {
      await this.initialize();
    }
    console.log(`[DepositService] Depositing ${amount} tokens to custody contract`);
    return this.client!.deposit(tokenAddress, amount);
  }

  /**
   * Approve and deposit in one flow
   * Handles checking allowance and approving if needed
   */
  async approveAndDeposit(depositInfo: DepositInfo): Promise<DepositResult> {
    if (!this.client) {
      await this.initialize();
    }

    const amountBigInt = parseUnits(depositInfo.amount, depositInfo.decimals);

    console.log(`[DepositService] Starting deposit flow for ${depositInfo.amount} tokens`);

    // Check current allowance
    const currentAllowance = await this.getAllowance(depositInfo.tokenAddress);
    console.log(`[DepositService] Current allowance: ${formatUnits(currentAllowance, depositInfo.decimals)}`);

    let approvalTxHash: Hash | undefined;

    // Approve if needed
    if (currentAllowance < amountBigInt) {
      console.log(`[DepositService] Approving tokens...`);
      approvalTxHash = await this.approveTokens(depositInfo.tokenAddress, amountBigInt);
      console.log(`[DepositService] Approval tx: ${approvalTxHash}`);
    }

    // Deposit
    console.log(`[DepositService] Depositing tokens...`);
    const depositTxHash = await this.deposit(depositInfo.tokenAddress, amountBigInt);
    console.log(`[DepositService] Deposit tx: ${depositTxHash}`);

    return {
      approvalTxHash,
      depositTxHash,
      amount: depositInfo.amount,
      tokenAddress: depositInfo.tokenAddress,
    };
  }

  /**
   * Withdraw tokens from custody contract
   */
  async withdraw(tokenAddress: Address, amount: bigint): Promise<Hash> {
    if (!this.client) {
      await this.initialize();
    }
    console.log(`[DepositService] Withdrawing ${amount} tokens from custody contract`);
    return this.client!.withdrawal(tokenAddress, amount);
  }

  /**
   * Get formatted balances
   */
  async getBalances(tokenAddress: Address, decimals: number = 6): Promise<{
    wallet: string;
    custody: string;
    allowance: string;
  }> {
    const [wallet, custody, allowance] = await Promise.all([
      this.getWalletTokenBalance(tokenAddress),
      this.getCustodyBalance(tokenAddress),
      this.getAllowance(tokenAddress),
    ]);

    return {
      wallet: formatUnits(wallet, decimals),
      custody: formatUnits(custody, decimals),
      allowance: formatUnits(allowance, decimals),
    };
  }
}

/**
 * Create a deposit service instance
 */
export function createDepositService(config: DepositServiceConfig): DepositService {
  return new DepositService(config);
}
