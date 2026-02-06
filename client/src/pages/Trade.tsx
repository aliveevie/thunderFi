import { useState, useEffect } from 'react';
import { Zap, AlertCircle, Shield, ShieldOff, Eye, EyeOff, Gavel, CheckCircle2, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Badge } from '@/components/ui';
import { CreateSessionModal, AllowanceDisplay } from '@/components/session';
import { OrderForm, ActionCounter, OrderBook, ReceiptsPanel } from '@/components/trading';
import { useSessionStore } from '@/stores/sessionStore';
import { useAppKitAccount } from '@reown/appkit/react';
import { usePrivacyAuctionStore, AuctionPhase } from '@/stores/privacyAuctionStore';
import { useCreateAuction, useSubmitOrder, useRevealOrder, useTokenBalance, useApproveToken, calculateRequiredDeposit, SEPOLIA_TOKENS, TOKEN_DECIMALS } from '@/hooks';
import { parseUnits, formatUnits } from 'viem';
import { cn } from '@/lib/utils';

const phaseNames: Record<AuctionPhase, string> = {
  [AuctionPhase.NOT_STARTED]: 'Not Started',
  [AuctionPhase.COLLECTION]: 'Collecting Orders',
  [AuctionPhase.REVEAL]: 'Reveal Phase',
  [AuctionPhase.SETTLEMENT]: 'Settlement',
  [AuctionPhase.COMPLETED]: 'Completed',
};

const phaseIcons: Record<AuctionPhase, React.ReactNode> = {
  [AuctionPhase.NOT_STARTED]: <Clock className="w-4 h-4" />,
  [AuctionPhase.COLLECTION]: <EyeOff className="w-4 h-4" />,
  [AuctionPhase.REVEAL]: <Eye className="w-4 h-4" />,
  [AuctionPhase.SETTLEMENT]: <Gavel className="w-4 h-4" />,
  [AuctionPhase.COMPLETED]: <CheckCircle2 className="w-4 h-4" />,
};

const phaseBadgeVariant: Record<AuctionPhase, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  [AuctionPhase.NOT_STARTED]: 'default',
  [AuctionPhase.COLLECTION]: 'warning',
  [AuctionPhase.REVEAL]: 'info',
  [AuctionPhase.SETTLEMENT]: 'warning',
  [AuctionPhase.COMPLETED]: 'success',
};

// Format wei values (18 decimals) - for ETH/WETH
function formatEther(wei: string): string {
  const value = BigInt(wei);
  const ethValue = Number(value) / 1e18;
  return ethValue.toFixed(4);
}

// Format USDC values (6 decimals)
function formatUsdc(wei: string): string {
  const value = BigInt(wei);
  const usdcValue = Number(value) / 1e6;
  return usdcValue.toFixed(2);
}

function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}

export function Trade() {
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const { session } = useSessionStore();
  const { isConnected, address } = useAppKitAccount();

  // Privacy auction state (read-only from server)
  const {
    currentAuctionId,
    auction,
    pendingOrder,
    isLoading,
    isSubmitting,
    error,
    fetchStatus,
    fetchAuction,
    generateCommitment,
    clearPendingOrder,
    setError,
  } = usePrivacyAuctionStore();

  // Client-side auction creation (user signs with their wallet)
  const {
    createAuction,
    hash: auctionTxHash,
    isPending: isCreatingAuction,
    isConfirming: isConfirmingAuction,
    isSuccess: auctionCreated,
    error: auctionError,
    reset: resetAuctionTx,
  } = useCreateAuction();

  // Client-side order submission
  const {
    submitOrder,
    hash: orderTxHash,
    isPending: isSubmittingOrder,
    isConfirming: isConfirmingOrder,
    isSuccess: orderSubmitted,
    error: orderError,
    reset: resetOrderTx,
  } = useSubmitOrder();

  // Client-side order reveal
  const {
    revealOrder,
    hash: revealTxHash,
    isPending: isRevealingOrder,
    isConfirming: isConfirmingReveal,
    isSuccess: orderRevealed,
    error: revealError,
    reset: resetRevealTx,
  } = useRevealOrder();

  // USDC token balance and allowance (for ASK orders - selling USDC)
  const {
    balance: usdcBalance,
    formattedBalance: usdcFormattedBalance,
    allowance: usdcAllowance,
    formattedAllowance: usdcFormattedAllowance,
    refetch: refetchUsdc,
  } = useTokenBalance(SEPOLIA_TOKENS.USDC as `0x${string}`, address as `0x${string}` | undefined, TOKEN_DECIMALS.USDC);

  // WETH token balance and allowance (for BID orders - buying with WETH)
  const {
    balance: wethBalance,
    formattedBalance: wethFormattedBalance,
    allowance: wethAllowance,
    formattedAllowance: wethFormattedAllowance,
    refetch: refetchWeth,
  } = useTokenBalance(SEPOLIA_TOKENS.WETH as `0x${string}`, address as `0x${string}` | undefined, TOKEN_DECIMALS.WETH);

  // Token approval hook
  const {
    approve: approveToken,
    hash: approveTxHash,
    isPending: isApproving,
    isConfirming: isConfirmingApproval,
    isSuccess: approvalSuccess,
    error: approvalError,
    reset: resetApprovalTx,
  } = useApproveToken();

  // Privacy order form state
  const [orderType, setOrderType] = useState<'bid' | 'ask'>('bid');
  const [privacyAmount, setPrivacyAmount] = useState('');
  const [privacyPrice, setPrivacyPrice] = useState('');

  // Reveal form state
  const [revealOrderId, setRevealOrderId] = useState('');
  const [revealAmount, setRevealAmount] = useState('');
  const [revealPrice, setRevealPrice] = useState('');
  const [revealSalt, setRevealSalt] = useState('');

  const needsSession = isConnected && (!session || session.status !== 'active');

  // Fetch privacy auction status when privacy mode is enabled
  useEffect(() => {
    if (privacyMode) {
      fetchStatus();
    }
  }, [privacyMode, fetchStatus]);

  // Refresh auction data periodically when in privacy mode
  useEffect(() => {
    if (!privacyMode || !currentAuctionId || currentAuctionId === 0) return;

    const interval = setInterval(() => {
      fetchAuction(currentAuctionId);
    }, 10000);

    return () => clearInterval(interval);
  }, [privacyMode, currentAuctionId, fetchAuction]);

  const handleGenerateCommitment = async () => {
    if (!address || !privacyAmount || !privacyPrice) return;

    // Validate inputs are positive numbers
    const amountNum = parseFloat(privacyAmount);
    const priceNum = parseFloat(privacyPrice);

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Price must be a positive number');
      return;
    }

    try {
      // Use USDC decimals (6) for amount, keep price in 18 decimals for consistency
      const amountWei = parseUnits(privacyAmount, TOKEN_DECIMALS.USDC).toString();
      const priceWei = parseUnits(privacyPrice, 18).toString(); // Price in ETH (18 decimals)

      await generateCommitment(address, amountWei, priceWei, orderType === 'bid');
    } catch (e) {
      setError('Invalid amount or price format');
    }
  };

  const handleRefresh = () => {
    fetchStatus();
    refetchUsdc();
    refetchWeth();
    if (currentAuctionId && currentAuctionId > 0) {
      fetchAuction(currentAuctionId);
    }
  };

  // Calculate deposit requirements based on pending order
  const getDepositInfo = () => {
    if (!pendingOrder || !privacyAmount || !privacyPrice) return null;

    try {
      const { depositAmount, depositToken, depositDecimals } = calculateRequiredDeposit(
        pendingOrder.isBid,
        privacyAmount,
        privacyPrice
      );

      const tokenSymbol = pendingOrder.isBid ? 'WETH' : 'USDC';
      const currentBalance = pendingOrder.isBid ? wethBalance : usdcBalance;
      const currentAllowance = pendingOrder.isBid ? wethAllowance : usdcAllowance;

      return {
        depositAmount,
        depositToken: depositToken as `0x${string}`,
        depositDecimals,
        tokenSymbol,
        formattedDeposit: formatUnits(depositAmount, depositDecimals),
        hasInsufficientBalance: currentBalance < depositAmount,
        needsApproval: currentAllowance < depositAmount,
        currentBalance,
        currentAllowance,
      };
    } catch {
      return null;
    }
  };

  const depositInfo = getDepositInfo();

  // Handle token approval
  const handleApproveToken = async () => {
    if (!depositInfo) return;
    await approveToken(depositInfo.depositToken);
  };

  // Refresh auction data after successful creation
  useEffect(() => {
    if (auctionCreated) {
      // Wait a moment for the blockchain to update, then refresh
      const timer = setTimeout(() => {
        fetchStatus();
        resetAuctionTx();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [auctionCreated, fetchStatus, resetAuctionTx]);

  // Handle auction creation errors
  useEffect(() => {
    if (auctionError) {
      setError(auctionError.message || 'Failed to create auction');
    }
  }, [auctionError, setError]);

  // Handle order submission success
  useEffect(() => {
    if (orderSubmitted) {
      // Order submitted successfully - user should save their salt for reveal phase
      const timer = setTimeout(() => {
        fetchStatus();
        if (currentAuctionId) fetchAuction(currentAuctionId);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [orderSubmitted, fetchStatus, fetchAuction, currentAuctionId]);

  // Handle order submission errors
  useEffect(() => {
    if (orderError) {
      setError(orderError.message || 'Failed to submit order');
    }
  }, [orderError, setError]);

  // Handle reveal success
  useEffect(() => {
    if (orderRevealed) {
      // Refresh auction data after successful reveal
      const timer = setTimeout(() => {
        fetchStatus();
        if (currentAuctionId) fetchAuction(currentAuctionId);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [orderRevealed, fetchStatus, fetchAuction, currentAuctionId]);

  // Handle reveal errors
  useEffect(() => {
    if (revealError) {
      setError(revealError.message || 'Failed to reveal order');
    }
  }, [revealError, setError]);

  // Handle approval success - refetch token data
  useEffect(() => {
    if (approvalSuccess) {
      const timer = setTimeout(() => {
        refetchUsdc();
        refetchWeth();
        resetApprovalTx();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [approvalSuccess, refetchUsdc, refetchWeth, resetApprovalTx]);

  // Handle approval errors
  useEffect(() => {
    if (approvalError) {
      setError(approvalError.message || 'Failed to approve USDC');
    }
  }, [approvalError, setError]);

  const handleStartAuction = async () => {
    // Start auction with USDC/WETH pair and 5 minute collection period
    // User will sign this transaction with their connected wallet
    await createAuction(SEPOLIA_TOKENS.USDC, SEPOLIA_TOKENS.WETH, 300);
  };

  const handleSubmitOrder = async () => {
    console.log('[handleSubmitOrder] Called with:', {
      pendingOrderCommitment: pendingOrder?.commitment,
      currentAuctionId,
      depositInfo
    });

    if (!pendingOrder?.commitment || !currentAuctionId || !depositInfo) {
      console.log('[handleSubmitOrder] Early return - missing data');
      return;
    }

    if (depositInfo.needsApproval) {
      setError(`Please approve ${depositInfo.tokenSymbol} first`);
      return;
    }

    try {
      // Submit with ERC20 token deposit
      // For BID: deposit WETH
      // For ASK: deposit USDC
      console.log('[handleSubmitOrder] Calling submitOrder with:', {
        auctionId: currentAuctionId,
        isBid: pendingOrder.isBid,
        commitment: pendingOrder.commitment,
        depositAmount: depositInfo.depositAmount.toString(),
        depositToken: depositInfo.tokenSymbol
      });

      await submitOrder(
        currentAuctionId,
        pendingOrder.isBid,
        pendingOrder.commitment as `0x${string}`,
        depositInfo.depositAmount
      );
      console.log('[handleSubmitOrder] submitOrder completed');
    } catch (e) {
      console.error('[handleSubmitOrder] Error:', e);
    }
  };

  const handleRevealOrder = async () => {
    if (!currentAuctionId || !revealOrderId || !revealAmount || !revealPrice || !revealSalt) return;

    // Convert amounts using proper decimals
    const amountWei = parseUnits(revealAmount, TOKEN_DECIMALS.USDC).toString();
    const priceWei = parseUnits(revealPrice, 18).toString();

    await revealOrder(
      currentAuctionId,
      parseInt(revealOrderId),
      amountWei,
      priceWei,
      revealSalt as `0x${string}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-50">Trade</h1>
          <p className="text-dark-400 text-sm mt-1">
            {privacyMode
              ? 'MEV-protected trading with commit-reveal batch auctions'
              : 'Execute instant, gasless trades off-chain'
            }
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Privacy Mode Toggle */}
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-all border',
              privacyMode
                ? 'bg-thunder-500/20 border-thunder-500/50 text-thunder-400'
                : 'bg-dark-800 border-dark-700 text-dark-400 hover:text-dark-200'
            )}
          >
            {privacyMode ? (
              <>
                <Shield className="w-4 h-4" />
                Privacy Mode
              </>
            ) : (
              <>
                <ShieldOff className="w-4 h-4" />
                Standard Mode
              </>
            )}
          </button>
          {session && !privacyMode && <AllowanceDisplay />}
          {privacyMode && (
            <Button variant="secondary" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Warning Banner - Session Required (only for standard mode) */}
      {!privacyMode && needsSession && (
        <Card className="border-thunder-500/30 bg-thunder-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-thunder-500" />
                <div>
                  <p className="text-dark-200 font-medium">Session Required</p>
                  <p className="text-dark-400 text-sm">
                    Create a trading session to start trading instantly
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowCreateSession(true)}>
                <Zap className="w-4 h-4 mr-2" />
                Create Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Banner (Privacy Mode) */}
      {privacyMode && error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-400">
                  {typeof error === 'string' ? error : (error as { message?: string })?.message || 'An error occurred'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Privacy Mode Banner */}
      {privacyMode && (
        <Card className="border-thunder-500/30 bg-thunder-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-thunder-500" />
              <div className="flex-1">
                <p className="text-dark-200 font-medium">Privacy Mode Active</p>
                <p className="text-dark-400 text-sm">
                  Your orders are hidden until reveal. All matched trades execute at a single clearing price.
                </p>
              </div>
              {auction && (
                <Badge variant={phaseBadgeVariant[auction.phase]}>
                  {phaseIcons[auction.phase]}
                  <span className="ml-1">{phaseNames[auction.phase]}</span>
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Trading Interface */}
      {!privacyMode ? (
        // Standard Trading Mode
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <OrderForm />
          </div>
          <div className="space-y-6">
            <ActionCounter />
            <OrderBook />
          </div>
          <div className="space-y-6">
            <ReceiptsPanel />
          </div>
        </div>
      ) : (
        // Privacy Trading Mode
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Privacy Order Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-thunder-500" />
                Private Order
              </CardTitle>
              <CardDescription>
                Submit a hidden commitment - your order details stay private until reveal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isConnected ? (
                <div className="text-center py-8 text-dark-400">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Connect your wallet to submit orders</p>
                </div>
              ) : auction?.phase === AuctionPhase.REVEAL ? (
                // Reveal Phase - Show reveal form
                <div className="space-y-4">
                  {orderRevealed ? (
                    <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      <p className="text-green-400 font-medium">Order Revealed Successfully!</p>
                      <p className="text-dark-400 text-sm mt-1">
                        Your order is now visible and will be matched in the settlement phase.
                      </p>
                      {revealTxHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${revealTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-thunder-400 hover:text-thunder-300 mt-2"
                        >
                          View transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          resetRevealTx();
                          setRevealOrderId('');
                          setRevealAmount('');
                          setRevealPrice('');
                          setRevealSalt('');
                        }}
                      >
                        Reveal Another Order
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <Eye className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                        <p className="text-blue-400 font-medium">Reveal Phase Active</p>
                        <p className="text-dark-400 text-sm mt-1">
                          If you submitted an order, reveal it now using your saved salt
                        </p>
                      </div>

                      {/* Show pending order details if available for reference */}
                      {pendingOrder && (
                        <div className="p-3 bg-thunder-500/10 border border-thunder-500/30 rounded-lg">
                          <p className="text-xs text-thunder-400 font-medium mb-2">Your Committed Order (for reference):</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-dark-400">Amount:</span>
                              <span className="text-dark-200 font-mono">{formatUsdc(pendingOrder.amount)} USDC</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-dark-400">Limit Price:</span>
                              <span className="text-dark-200 font-mono">{formatEther(pendingOrder.limitPrice)} ETH</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-dark-400">Salt:</span>
                              <span className="text-thunder-400 font-mono text-[10px] truncate max-w-[180px]">{pendingOrder.salt}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 text-xs"
                            onClick={() => {
                              setRevealAmount(formatUsdc(pendingOrder.amount));
                              setRevealPrice(formatEther(pendingOrder.limitPrice));
                              if (pendingOrder.salt) setRevealSalt(pendingOrder.salt);
                            }}
                          >
                            Auto-fill from Pending Order
                          </Button>
                        </div>
                      )}

                      <Input
                        label="Order ID"
                        type="number"
                        placeholder="Enter your order ID (from submit tx)"
                        value={revealOrderId}
                        onChange={(e) => setRevealOrderId(e.target.value)}
                      />
                      <Input
                        label="Amount in USDC (same as committed)"
                        type="text"
                        placeholder="e.g. 10"
                        value={revealAmount}
                        onChange={(e) => setRevealAmount(e.target.value)}
                      />
                      <Input
                        label="Limit Price (same as committed)"
                        type="text"
                        placeholder="e.g. 0.0005"
                        value={revealPrice}
                        onChange={(e) => setRevealPrice(e.target.value)}
                      />
                      <Input
                        label="Salt (from commitment)"
                        type="text"
                        placeholder="Paste your saved salt (0x...)"
                        value={revealSalt}
                        onChange={(e) => setRevealSalt(e.target.value)}
                      />

                      <Button
                        className="w-full"
                        onClick={handleRevealOrder}
                        isLoading={isRevealingOrder || isConfirmingReveal}
                        disabled={!revealOrderId || !revealAmount || !revealPrice || !revealSalt || isRevealingOrder || isConfirmingReveal}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {isRevealingOrder
                          ? 'Confirm in Wallet...'
                          : isConfirmingReveal
                          ? 'Revealing Order...'
                          : 'Reveal Order'
                        }
                      </Button>

                      {revealTxHash && !orderRevealed && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${revealTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-thunder-400 hover:text-thunder-300"
                        >
                          View transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      <p className="text-xs text-dark-500 text-center">
                        Enter the exact same values you used when creating your commitment
                      </p>
                    </>
                  )}
                </div>
              ) : auction?.phase !== AuctionPhase.COLLECTION ? (
                <div className="text-center py-8 text-dark-400">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Auction not in collection phase</p>
                  <p className="text-sm mt-1 mb-4">
                    {auction?.phase === AuctionPhase.SETTLEMENT
                      ? 'Auction is settling - trades executing at clearing price'
                      : 'Start a new auction to begin trading'
                    }
                  </p>
                  {(!auction || auction.phase === AuctionPhase.NOT_STARTED || auction.phase === AuctionPhase.COMPLETED) && (
                    <div className="space-y-2">
                      <Button
                        onClick={handleStartAuction}
                        isLoading={isCreatingAuction || isConfirmingAuction}
                        disabled={isCreatingAuction || isConfirmingAuction || !isConnected}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {isCreatingAuction
                          ? 'Confirm in Wallet...'
                          : isConfirmingAuction
                          ? 'Creating Auction...'
                          : 'Start New Auction'
                        }
                      </Button>
                      {!isConnected && (
                        <p className="text-xs text-dark-500">Connect wallet to create auction</p>
                      )}
                      {auctionTxHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${auctionTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-thunder-400 hover:text-thunder-300"
                        >
                          View transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Order Type Toggle */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-dark-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setOrderType('bid')}
                      className={cn(
                        'py-2.5 rounded-md text-sm font-medium transition-all',
                        orderType === 'bid'
                          ? 'bg-green-500 text-white'
                          : 'text-dark-400 hover:text-dark-200'
                      )}
                    >
                      Buy (Bid)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('ask')}
                      className={cn(
                        'py-2.5 rounded-md text-sm font-medium transition-all',
                        orderType === 'ask'
                          ? 'bg-red-500 text-white'
                          : 'text-dark-400 hover:text-dark-200'
                      )}
                    >
                      Sell (Ask)
                    </button>
                  </div>

                  {/* Token Balance Display */}
                  <div className="p-3 rounded-lg bg-dark-800/50 border border-dark-700 space-y-2">
                    {/* USDC Balance (for selling) */}
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-dark-400 text-sm">USDC Balance:</span>
                        <span className="text-dark-100 font-mono">{parseFloat(usdcFormattedBalance).toFixed(2)} USDC</span>
                      </div>
                      {orderType === 'ask' && parseFloat(usdcFormattedAllowance) > 0 && (
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-dark-500 text-xs">Approved:</span>
                          <span className="text-green-400 text-xs font-mono">
                            {parseFloat(usdcFormattedAllowance) > 1e10 ? 'Unlimited' : `${parseFloat(usdcFormattedAllowance).toFixed(2)} USDC`}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* WETH Balance (for buying) */}
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-dark-400 text-sm">WETH Balance:</span>
                        <span className="text-dark-100 font-mono">{parseFloat(wethFormattedBalance).toFixed(6)} WETH</span>
                      </div>
                      {orderType === 'bid' && parseFloat(wethFormattedAllowance) > 0 && (
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-dark-500 text-xs">Approved:</span>
                          <span className="text-green-400 text-xs font-mono">
                            {parseFloat(wethFormattedAllowance) > 1e10 ? 'Unlimited' : `${parseFloat(wethFormattedAllowance).toFixed(6)} WETH`}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Deposit token indicator */}
                    <div className="text-xs text-dark-500 pt-1 border-t border-dark-700">
                      {orderType === 'bid'
                        ? 'Buy orders require WETH deposit'
                        : 'Sell orders require USDC deposit'
                      }
                    </div>
                  </div>

                  <Input
                    label="Amount (USDC)"
                    type="number"
                    placeholder="0.00"
                    value={privacyAmount}
                    onChange={(e) => setPrivacyAmount(e.target.value)}
                  />

                  <Input
                    label="Limit Price (ETH)"
                    type="number"
                    placeholder="0.00"
                    value={privacyPrice}
                    onChange={(e) => setPrivacyPrice(e.target.value)}
                  />

                  {/* Order Summary */}
                  {privacyAmount && privacyPrice && (
                    <div className="p-3 rounded-lg bg-dark-800 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-dark-400">Total Value</span>
                        <span className="text-dark-200">
                          {(parseFloat(privacyAmount) * parseFloat(privacyPrice)).toFixed(6)} ETH
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400">Protection</span>
                        <span className="text-thunder-400">MEV Protected</span>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleGenerateCommitment}
                    isLoading={isSubmitting}
                    disabled={!privacyAmount || !privacyPrice || isSubmitting}
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    Generate Commitment
                  </Button>

                  {/* Pending Order Display */}
                  {pendingOrder && (
                    <div className="mt-4 p-4 bg-dark-800 rounded-lg border border-thunder-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-thunder-400">
                          {orderSubmitted ? 'Order Submitted!' : 'Commitment Ready'}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => { clearPendingOrder(); resetOrderTx(); }}>
                          Clear
                        </Button>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-dark-400">Type:</span>
                          <span className={pendingOrder.isBid ? 'text-green-400' : 'text-red-400'}>
                            {pendingOrder.isBid ? 'Buy (Bid)' : 'Sell (Ask)'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Amount:</span>
                          <span className="text-dark-100">{formatUsdc(pendingOrder.amount)} USDC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Limit Price:</span>
                          <span className="text-dark-100">{formatEther(pendingOrder.limitPrice)} ETH</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Your Balance:</span>
                          <span className={parseFloat(usdcFormattedBalance) >= parseFloat(formatUsdc(pendingOrder.amount)) ? 'text-green-400' : 'text-red-400'}>
                            {parseFloat(usdcFormattedBalance).toFixed(2)} USDC
                          </span>
                        </div>
                        <div className="pt-2 border-t border-dark-700">
                          <span className="text-dark-400 block mb-1 text-xs">Commitment Hash:</span>
                          <code className="text-xs text-thunder-400 break-all">
                            {pendingOrder.commitment}
                          </code>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/30 rounded p-2 mt-2">
                          <span className="text-green-400 block mb-1 text-xs font-medium">
                            ⚠️ SAVE THIS SALT - You need it for the reveal phase!
                          </span>
                          <code className="text-xs text-green-400 break-all">
                            {pendingOrder.salt}
                          </code>
                        </div>
                      </div>

                      {/* Submit Order Button - Uses ERC20 token deposit as collateral */}
                      {!orderSubmitted ? (
                        <div className="mt-4 space-y-2">
                          {depositInfo && (
                            <>
                              {/* Deposit Info */}
                              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                <p className="text-blue-400 text-sm font-medium">{depositInfo.tokenSymbol} Deposit Required</p>
                                <p className="text-dark-400 text-xs mt-1">
                                  Deposit {depositInfo.formattedDeposit} {depositInfo.tokenSymbol} as collateral.
                                  It will be returned/settled after the auction.
                                </p>
                              </div>

                              {/* Balance Warning */}
                              {depositInfo.hasInsufficientBalance && (
                                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                  <p className="text-yellow-400 text-sm">
                                    Low {depositInfo.tokenSymbol} balance ({pendingOrder.isBid ? wethFormattedBalance : usdcFormattedBalance}).
                                    Need {depositInfo.formattedDeposit} for deposit.
                                  </p>
                                </div>
                              )}

                              {/* Approval Button */}
                              {depositInfo.needsApproval && !depositInfo.hasInsufficientBalance && (
                                <Button
                                  className="w-full"
                                  variant="secondary"
                                  onClick={handleApproveToken}
                                  isLoading={isApproving || isConfirmingApproval}
                                  disabled={isApproving || isConfirmingApproval}
                                >
                                  {isApproving
                                    ? 'Confirm in Wallet...'
                                    : isConfirmingApproval
                                    ? 'Approving...'
                                    : `Approve ${depositInfo.tokenSymbol}`
                                  }
                                </Button>
                              )}

                              {/* Approval Transaction Link */}
                              {approveTxHash && !approvalSuccess && (
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${approveTxHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-1 text-xs text-thunder-400 hover:text-thunder-300"
                                >
                                  View approval transaction <ExternalLink className="w-3 h-3" />
                                </a>
                              )}

                              {/* Submit Order Button */}
                              <Button
                                className="w-full"
                                onClick={handleSubmitOrder}
                                isLoading={isSubmittingOrder || isConfirmingOrder}
                                disabled={
                                  isSubmittingOrder ||
                                  isConfirmingOrder ||
                                  depositInfo.needsApproval
                                }
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                {isSubmittingOrder
                                  ? 'Confirm in Wallet...'
                                  : isConfirmingOrder
                                  ? 'Submitting Order...'
                                  : `Submit Order (Deposit ${depositInfo.formattedDeposit} ${depositInfo.tokenSymbol})`
                                }
                              </Button>
                            </>
                          )}

                          {orderTxHash && !orderSubmitted && (
                            <a
                              href={`https://sepolia.etherscan.io/tx/${orderTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1 text-xs text-thunder-400 hover:text-thunder-300"
                            >
                              View transaction <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          <p className="text-xs text-dark-500 text-center">
                            Need testnet tokens?{' '}
                            <a
                              href="https://faucet.circle.com/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-thunder-400 hover:text-thunder-300"
                            >
                              USDC Faucet
                            </a>
                            {' | '}
                            <a
                              href="https://www.alchemy.com/faucets/ethereum-sepolia"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-thunder-400 hover:text-thunder-300"
                            >
                              ETH Faucet
                            </a>
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-400 text-sm font-medium">Order submitted successfully!</p>
                          <p className="text-dark-400 text-xs mt-1">
                            Wait for the reveal phase, then reveal your order using your saved salt.
                          </p>
                          {orderTxHash && (
                            <a
                              href={`https://sepolia.etherscan.io/tx/${orderTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-thunder-400 hover:text-thunder-300 mt-2"
                            >
                              View transaction <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auction Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Batch Auction</span>
                {auction && (
                  <Badge variant={phaseBadgeVariant[auction.phase]}>
                    {phaseIcons[auction.phase]}
                    <span className="ml-1">{phaseNames[auction.phase]}</span>
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {auction ? `Auction #${auction.id}` : 'No active auction'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auction ? (
                <div className="space-y-4">
                  {/* Phase Timeline */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        auction.phase >= AuctionPhase.COLLECTION ? 'bg-thunder-500/20 text-thunder-400' : 'bg-dark-700 text-dark-500'
                      )}>
                        <EyeOff className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-dark-200">Commit Phase</div>
                        <div className="text-xs text-dark-500">Ends: {formatTimestamp(auction.collectionEndTime)}</div>
                      </div>
                      {auction.phase === AuctionPhase.COLLECTION && (
                        <Badge variant="warning">Active</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        auction.phase >= AuctionPhase.REVEAL ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-700 text-dark-500'
                      )}>
                        <Eye className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-dark-200">Reveal Phase</div>
                        <div className="text-xs text-dark-500">Ends: {formatTimestamp(auction.revealEndTime)}</div>
                      </div>
                      {auction.phase === AuctionPhase.REVEAL && (
                        <Badge variant="info">Active</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        auction.phase >= AuctionPhase.SETTLEMENT ? 'bg-purple-500/20 text-purple-400' : 'bg-dark-700 text-dark-500'
                      )}>
                        <Gavel className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-dark-200">Settlement</div>
                        <div className="text-xs text-dark-500">Ends: {formatTimestamp(auction.settlementEndTime)}</div>
                      </div>
                      {auction.phase === AuctionPhase.SETTLEMENT && (
                        <Badge variant="warning">Active</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        auction.phase === AuctionPhase.COMPLETED ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-500'
                      )}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-dark-200">Complete</div>
                      </div>
                      {auction.phase === AuctionPhase.COMPLETED && (
                        <Badge variant="success">Done</Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="border-t border-dark-800 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-dark-400">Orders</div>
                        <div className="text-lg font-semibold text-dark-100">{auction.orderCount}</div>
                      </div>
                      <div>
                        <div className="text-xs text-dark-400">Status</div>
                        <div className="text-lg font-semibold text-dark-100">
                          {auction.cleared ? 'Cleared' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clearing Results */}
                  {auction.cleared && (
                    <div className="border-t border-dark-800 pt-4">
                      <div className="text-xs text-dark-400 mb-2">Clearing Results</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-dark-400">Clearing Price:</span>
                          <span className="text-thunder-400 font-mono">
                            {formatEther(auction.clearingPrice)} ETH
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-dark-400">Matched Volume:</span>
                          <span className="text-green-400 font-mono">
                            {formatEther(auction.matchedVolume)} ETH
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-dark-400">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No auction data available</p>
                  <p className="text-sm mt-1 mb-4">Start a new auction to begin trading</p>
                  <div className="space-y-2">
                    <Button
                      onClick={handleStartAuction}
                      isLoading={isCreatingAuction || isConfirmingAuction}
                      disabled={isCreatingAuction || isConfirmingAuction || !isConnected}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {isCreatingAuction
                        ? 'Confirm in Wallet...'
                        : isConfirmingAuction
                        ? 'Creating Auction...'
                        : 'Start New Auction'
                      }
                    </Button>
                    {!isConnected && (
                      <p className="text-xs text-dark-500">Connect wallet to create auction</p>
                    )}
                    {auctionTxHash && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${auctionTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 text-xs text-thunder-400 hover:text-thunder-300"
                      >
                        View transaction <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* How It Works (Full Width) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>How Privacy Trading Works</CardTitle>
              <CardDescription>
                MEV-protected batch auctions using commit-reveal pattern
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-thunder-500/20 flex items-center justify-center mx-auto mb-3">
                    <EyeOff className="w-6 h-6 text-thunder-400" />
                  </div>
                  <h3 className="font-medium text-dark-100 mb-1">1. Commit</h3>
                  <p className="text-xs text-dark-400">
                    Submit a hidden commitment. Your price and amount stay private.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="font-medium text-dark-100 mb-1">2. Reveal</h3>
                  <p className="text-xs text-dark-400">
                    Reveal your order using your salt. All orders revealed together.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                    <Gavel className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="font-medium text-dark-100 mb-1">3. Clear</h3>
                  <p className="text-xs text-dark-400">
                    A uniform clearing price is calculated for all matched orders.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="font-medium text-dark-100 mb-1">4. Settle</h3>
                  <p className="text-xs text-dark-400">
                    Matched trades execute via Uniswap v4. Unmatched funds returned.
                  </p>
                </div>
              </div>

              {/* Testnet Resources */}
              <div className="mt-6 pt-6 border-t border-dark-800">
                <p className="text-sm text-dark-400 mb-3">Testnet Resources (Sepolia):</p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://faucet.circle.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-thunder-400 transition-colors"
                  >
                    Get USDC (Circle Faucet) <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://www.alchemy.com/faucets/ethereum-sepolia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-blue-400 transition-colors"
                  >
                    Get Sepolia ETH <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://sepolia.etherscan.io/address/${SEPOLIA_TOKENS.USDC}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-dark-300 transition-colors"
                  >
                    USDC Contract <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={showCreateSession}
        onClose={() => setShowCreateSession(false)}
      />
    </div>
  );
}
