/**
 * Hook for interacting with ThunderBatchAuction contract
 * Users create auctions and submit orders directly from their wallet
 *
 * IMPORTANT: The contract uses ERC20 token deposits, NOT ETH!
 * - For BID orders (buying USDC with WETH): deposit WETH
 * - For ASK orders (selling USDC for WETH): deposit USDC
 */

import { useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { parseUnits, formatUnits } from 'viem';

// ThunderBatchAuction contract address on Sepolia
const THUNDER_BATCH_AUCTION_ADDRESS = '0x48f50f4166a9f10d13d0119590B71a724B5CE8AA' as const;

// Contract ABI - matches the actual Solidity contract
const THUNDER_BATCH_AUCTION_ABI = [
  {
    name: 'createAuction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'collectionDuration', type: 'uint256' },
    ],
    outputs: [{ name: 'auctionId', type: 'uint256' }],
  },
  {
    name: 'submitOrder',
    type: 'function',
    stateMutability: 'nonpayable', // NOT payable - uses ERC20 transferFrom
    inputs: [
      { name: 'auctionId', type: 'uint256' },
      { name: 'isBid', type: 'bool' },
      { name: 'commitment', type: 'bytes32' },
      { name: 'deposit', type: 'uint256' },
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }],
  },
  {
    name: 'revealOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'auctionId', type: 'uint256' },
      { name: 'orderId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'limitPrice', type: 'uint256' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'generateCommitment',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'trader', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'limitPrice', type: 'uint256' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

// Test token addresses on Sepolia
export const SEPOLIA_TOKENS = {
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Circle USDC (6 decimals) - token0
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // WETH (18 decimals) - token1
} as const;

// Token decimals
export const TOKEN_DECIMALS = {
  USDC: 6,
  WETH: 18,
} as const;

export function useCreateAuction() {
  const { switchChain } = useSwitchChain();

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createAuction = async (
    token0: string,
    token1: string,
    collectionDurationSeconds: number
  ) => {
    // Ensure we're on Sepolia
    try {
      await switchChain({ chainId: sepolia.id });
    } catch {
      // User might reject or already on correct chain
    }

    writeContract({
      address: THUNDER_BATCH_AUCTION_ADDRESS,
      abi: THUNDER_BATCH_AUCTION_ABI,
      functionName: 'createAuction',
      args: [token0 as `0x${string}`, token1 as `0x${string}`, BigInt(collectionDurationSeconds)],
      chainId: sepolia.id,
    });
  };

  return {
    createAuction,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// Hook to check token balance and allowance
export function useTokenBalance(tokenAddress: `0x${string}`, userAddress: `0x${string}` | undefined, decimals: number = 6) {
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: !!userAddress,
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, THUNDER_BATCH_AUCTION_ADDRESS] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: !!userAddress,
    },
  });

  const formattedBalance = balance ? formatUnits(balance, decimals) : '0';
  const formattedAllowance = allowance ? formatUnits(allowance, decimals) : '0';

  return {
    balance: balance ?? BigInt(0),
    formattedBalance,
    allowance: allowance ?? BigInt(0),
    formattedAllowance,
    refetch: () => {
      refetchBalance();
      refetchAllowance();
    },
  };
}

// Hook to approve token spending
export function useApproveToken() {
  const { switchChain } = useSwitchChain();

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async (tokenAddress: `0x${string}`, amount?: string, decimals?: number) => {
    try {
      await switchChain({ chainId: sepolia.id });
    } catch {
      // User might reject or already on correct chain
    }

    // If amount specified, approve exact amount; otherwise approve max
    let approvalAmount: bigint;
    if (amount && decimals) {
      approvalAmount = parseUnits(amount, decimals);
    } else {
      // Approve max uint256 for convenience (user can revoke later)
      approvalAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    }

    console.log('[approve] Approving token:', tokenAddress, 'amount:', approvalAmount.toString());

    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [THUNDER_BATCH_AUCTION_ADDRESS, approvalAmount],
      chainId: sepolia.id,
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useSubmitOrder() {
  const { switchChain } = useSwitchChain();

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Submit order with ERC20 token deposit
   *
   * IMPORTANT: User must have approved the contract to spend the deposit token BEFORE calling this!
   *
   * @param auctionId - The auction ID
   * @param isBid - true for buy order (deposit WETH), false for sell order (deposit USDC)
   * @param commitment - The commitment hash (bytes32)
   * @param depositAmount - Amount to deposit (in wei/smallest unit)
   */
  const submitOrder = async (
    auctionId: number,
    isBid: boolean,
    commitment: `0x${string}`,
    depositAmount: bigint
  ) => {
    console.log('[submitOrder] Starting order submission...', {
      auctionId,
      isBid,
      commitment,
      depositAmount: depositAmount.toString(),
      depositToken: isBid ? 'WETH' : 'USDC'
    });

    try {
      await switchChain({ chainId: sepolia.id });
    } catch (e) {
      console.log('[submitOrder] Chain switch skipped or rejected:', e);
    }

    console.log('[submitOrder] Calling writeContract with:', {
      address: THUNDER_BATCH_AUCTION_ADDRESS,
      auctionId: BigInt(auctionId).toString(),
      isBid,
      commitment,
      depositAmount: depositAmount.toString(),
    });

    try {
      writeContract({
        address: THUNDER_BATCH_AUCTION_ADDRESS,
        abi: THUNDER_BATCH_AUCTION_ABI,
        functionName: 'submitOrder',
        args: [BigInt(auctionId), isBid, commitment, depositAmount],
        chainId: sepolia.id,
      });
      console.log('[submitOrder] writeContract called successfully');
    } catch (e) {
      console.error('[submitOrder] writeContract error:', e);
      throw e;
    }
  };

  return {
    submitOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useRevealOrder() {
  const { switchChain } = useSwitchChain();

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const revealOrder = async (
    auctionId: number,
    orderId: number,
    amount: string,
    limitPrice: string,
    salt: `0x${string}`
  ) => {
    try {
      await switchChain({ chainId: sepolia.id });
    } catch {
      // User might reject or already on correct chain
    }

    console.log('[revealOrder] Revealing order:', {
      auctionId,
      orderId,
      amount,
      limitPrice,
      salt
    });

    writeContract({
      address: THUNDER_BATCH_AUCTION_ADDRESS,
      abi: THUNDER_BATCH_AUCTION_ABI,
      functionName: 'revealOrder',
      args: [BigInt(auctionId), BigInt(orderId), BigInt(amount), BigInt(limitPrice), salt],
      chainId: sepolia.id,
    });
  };

  return {
    revealOrder,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

/**
 * Calculate the required deposit amount for an order
 *
 * For BID (buying USDC with WETH):
 *   deposit = (amount * limitPrice) / PRICE_PRECISION
 *   where amount is in USDC (6 decimals), limitPrice is in WETH per USDC (18 decimals)
 *
 * For ASK (selling USDC for WETH):
 *   deposit = amount (in USDC)
 */
export function calculateRequiredDeposit(
  isBid: boolean,
  amountUsdc: string,  // Human readable USDC amount (e.g., "100")
  limitPriceWethPerUsdc: string // Human readable WETH price per USDC (e.g., "0.0005")
): { depositAmount: bigint; depositToken: string; depositDecimals: number } {
  const PRICE_PRECISION = BigInt(1e18);

  // Convert to smallest units
  const amountWei = parseUnits(amountUsdc, TOKEN_DECIMALS.USDC); // USDC amount in 6 decimals
  const limitPriceWei = parseUnits(limitPriceWethPerUsdc, 18); // Price in 18 decimals

  if (isBid) {
    // BID: deposit WETH = (amount * limitPrice) / PRICE_PRECISION
    // amount is in 6 decimals, limitPrice is in 18 decimals
    // Result should be in 18 decimals (WETH)
    const depositAmount = (amountWei * limitPriceWei) / PRICE_PRECISION;
    return {
      depositAmount,
      depositToken: SEPOLIA_TOKENS.WETH,
      depositDecimals: TOKEN_DECIMALS.WETH,
    };
  } else {
    // ASK: deposit USDC = amount
    return {
      depositAmount: amountWei,
      depositToken: SEPOLIA_TOKENS.USDC,
      depositDecimals: TOKEN_DECIMALS.USDC,
    };
  }
}

export { THUNDER_BATCH_AUCTION_ADDRESS };
