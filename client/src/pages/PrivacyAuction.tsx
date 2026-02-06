import { useEffect, useState } from 'react';
import {
  Shield,
  Clock,
  Eye,
  EyeOff,
  Gavel,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  ArrowUpDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { usePrivacyAuctionStore, AuctionPhase } from '@/stores/privacyAuctionStore';
import { useWalletStore } from '@/stores/walletStore';

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

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}

function formatEther(wei: string): string {
  const value = BigInt(wei);
  const ethValue = Number(value) / 1e18;
  return ethValue.toFixed(4);
}

export function PrivacyAuction() {
  const {
    isInitialized,
    chainInfo,
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

  const { address, isConnected } = useWalletStore();

  const [orderType, setOrderType] = useState<'bid' | 'ask'>('bid');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Refresh auction data periodically
  useEffect(() => {
    if (!currentAuctionId || currentAuctionId === 0) return;

    const interval = setInterval(() => {
      fetchAuction(currentAuctionId);
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [currentAuctionId, fetchAuction]);

  const handleGenerateCommitment = async () => {
    if (!address || !amount || !limitPrice) return;

    // Convert to wei (18 decimals)
    const amountWei = (parseFloat(amount) * 1e18).toString();
    const priceWei = (parseFloat(limitPrice) * 1e18).toString();

    await generateCommitment(address, amountWei, priceWei, orderType === 'bid');
  };

  const handleRefresh = () => {
    fetchStatus();
    if (currentAuctionId && currentAuctionId > 0) {
      fetchAuction(currentAuctionId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 flex items-center gap-2">
            <Shield className="w-6 h-6 text-thunder-500" />
            Privacy Auction
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            Commit-reveal batch auction for MEV-protected trading on Uniswap v4
          </p>
        </div>
        <Button variant="secondary" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-400">{error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Banner */}
      {!isInitialized && !isLoading && (
        <Card className="border-thunder-500/30 bg-thunder-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-thunder-500" />
              <div>
                <p className="text-dark-200 font-medium">Service Initializing</p>
                <p className="text-dark-400 text-sm">
                  Connecting to ThunderBatchAuction contract on Sepolia...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chain Info */}
      {chainInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-thunder-500" />
              Contract Information
            </CardTitle>
            <CardDescription>
              ThunderBatchAuction deployed on {chainInfo.chainName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-dark-400 mb-1">Network</div>
                <div className="text-dark-100 font-mono">{chainInfo.chainName}</div>
              </div>
              <div>
                <div className="text-xs text-dark-400 mb-1">Chain ID</div>
                <div className="text-dark-100 font-mono">{chainInfo.chainId}</div>
              </div>
              <div>
                <div className="text-xs text-dark-400 mb-1">Contract</div>
                <a
                  href={`${chainInfo.blockExplorer}/address/${chainInfo.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-thunder-400 hover:text-thunder-300 font-mono flex items-center gap-1"
                >
                  {formatAddress(chainInfo.contractAddress)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <div className="text-xs text-dark-400 mb-1">Current Auction</div>
                <div className="text-dark-100 font-mono">
                  {currentAuctionId !== null ? `#${currentAuctionId}` : 'Loading...'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auction Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Auction Status</span>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-dark-400 mb-1">Token Pair</div>
                    <div className="text-dark-100 font-mono text-sm">
                      {formatAddress(auction.token0)} / {formatAddress(auction.token1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-dark-400 mb-1">Order Count</div>
                    <div className="text-dark-100 font-mono">{auction.orderCount}</div>
                  </div>
                </div>

                <div className="border-t border-dark-800 pt-4">
                  <div className="text-xs text-dark-400 mb-2">Phase Timeline</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Collection ends:</span>
                      <span className="text-dark-200 font-mono">
                        {formatTimestamp(auction.collectionEndTime)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Reveal ends:</span>
                      <span className="text-dark-200 font-mono">
                        {formatTimestamp(auction.revealEndTime)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Settlement ends:</span>
                      <span className="text-dark-200 font-mono">
                        {formatTimestamp(auction.settlementEndTime)}
                      </span>
                    </div>
                  </div>
                </div>

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
                <p className="text-sm mt-1">Create a new auction or wait for one to start</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-thunder-500" />
              Submit Private Order
            </CardTitle>
            <CardDescription>
              Generate a commitment hash for your order (on-chain submission via wallet)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <div className="text-center py-8 text-dark-400">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Connect your wallet to submit orders</p>
              </div>
            ) : auction?.phase !== AuctionPhase.COLLECTION ? (
              <div className="text-center py-8 text-dark-400">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Auction not in collection phase</p>
                <p className="text-sm mt-1">
                  Orders can only be submitted during the collection phase
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Order Type Toggle */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Order Type
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={orderType === 'bid' ? 'primary' : 'secondary'}
                      className="flex-1"
                      onClick={() => setOrderType('bid')}
                    >
                      Buy (Bid)
                    </Button>
                    <Button
                      variant={orderType === 'ask' ? 'primary' : 'secondary'}
                      className="flex-1"
                      onClick={() => setOrderType('ask')}
                    >
                      Sell (Ask)
                    </Button>
                  </div>
                </div>

                <Input
                  label="Amount (ETH)"
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                <Input
                  label="Limit Price (ETH)"
                  type="number"
                  placeholder="0.0"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                />

                <Button
                  className="w-full"
                  onClick={handleGenerateCommitment}
                  isLoading={isSubmitting}
                  disabled={!amount || !limitPrice || isSubmitting}
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  Generate Commitment
                </Button>

                {/* Pending Order Display */}
                {pendingOrder && (
                  <div className="mt-4 p-4 bg-dark-800 rounded-lg border border-thunder-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-thunder-400">
                        Commitment Generated
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearPendingOrder}>
                        Clear
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-dark-400">Type: </span>
                        <span className="text-dark-100">
                          {pendingOrder.isBid ? 'Buy (Bid)' : 'Sell (Ask)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-dark-400">Amount: </span>
                        <span className="text-dark-100">{formatEther(pendingOrder.amount)} ETH</span>
                      </div>
                      <div>
                        <span className="text-dark-400">Limit Price: </span>
                        <span className="text-dark-100">
                          {formatEther(pendingOrder.limitPrice)} ETH
                        </span>
                      </div>
                      <div className="pt-2 border-t border-dark-700">
                        <span className="text-dark-400 block mb-1">Commitment Hash:</span>
                        <code className="text-xs text-thunder-400 break-all">
                          {pendingOrder.commitment}
                        </code>
                      </div>
                      <div>
                        <span className="text-dark-400 block mb-1">Salt (save this!):</span>
                        <code className="text-xs text-green-400 break-all">
                          {pendingOrder.salt}
                        </code>
                      </div>
                    </div>
                    <p className="text-xs text-dark-400 mt-4">
                      Submit this commitment to the contract using your wallet. Save the salt - you
                      will need it during the reveal phase.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Privacy Batch Auctions Work</CardTitle>
          <CardDescription>
            MEV-protected trading using commit-reveal pattern
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-thunder-500/20 flex items-center justify-center mx-auto mb-3">
                <EyeOff className="w-6 h-6 text-thunder-400" />
              </div>
              <h3 className="font-medium text-dark-100 mb-1">1. Commit</h3>
              <p className="text-sm text-dark-400">
                Submit a hidden commitment of your order. No one can see your price or amount.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <Eye className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-medium text-dark-100 mb-1">2. Reveal</h3>
              <p className="text-sm text-dark-400">
                Reveal your order details using your salt. All orders revealed simultaneously.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                <Gavel className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-medium text-dark-100 mb-1">3. Clear</h3>
              <p className="text-sm text-dark-400">
                A uniform clearing price is calculated. All matching orders execute at the same
                price.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-medium text-dark-100 mb-1">4. Settle</h3>
              <p className="text-sm text-dark-400">
                Matched orders are settled. Unmatched deposits are returned to traders.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
