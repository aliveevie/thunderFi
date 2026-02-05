import { useEffect } from 'react';
import { RefreshCw, ArrowRight, ExternalLink, Wallet } from 'lucide-react';
import { Card, CardContent, Button } from '@/components/ui';
import { usePayoutStore } from '@/stores/payoutStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getAuthToken } from '@/services/api';
import { formatAmount } from '@/lib/utils';

const CHAIN_LABELS: Record<string, string> = {
  arc: 'Arc (Hub)',
  arbitrum: 'Arbitrum',
  base: 'Base',
  optimism: 'Optimism',
  polygon: 'Polygon',
  ethereum: 'Ethereum',
};

const CHAIN_COLORS: Record<string, string> = {
  arc: 'bg-thunder-500',
  arbitrum: 'bg-blue-500',
  base: 'bg-blue-600',
  optimism: 'bg-red-500',
  polygon: 'bg-purple-500',
  ethereum: 'bg-gray-500',
};

function getUsdcAmount(balances: { token: { symbol: string }; amount: string }[]): string {
  const usdc = balances.find(
    (b) => b.token.symbol === 'USDC' || b.token.symbol === 'USDC.e'
  );
  return usdc?.amount || '0';
}

export function ArcHubBalance() {
  const { walletBalances, isLoadingBalances, fetchWalletBalances, wallets } = usePayoutStore();
  const { session } = useSessionStore();
  const hasAuth = !!getAuthToken();

  useEffect(() => {
    // Only fetch if user has an active session and auth token
    if (wallets.length > 0 && session && hasAuth) {
      fetchWalletBalances();
    }
  }, [wallets.length, session, hasAuth, fetchWalletBalances]);

  const arcBalances = walletBalances['arc'] || [];
  const arcUsdcAmount = getUsdcAmount(arcBalances);
  const hasArcWallet = wallets.some((w) => w.chain === 'arc');

  // Compute total across all chains
  const spokeChains = Object.entries(walletBalances).filter(([chain]) => chain !== 'arc');
  const totalSpokeUsdc = spokeChains.reduce(
    (sum, [, balances]) => sum + parseFloat(getUsdcAmount(balances) || '0'),
    0
  );
  const totalUsdc = parseFloat(arcUsdcAmount) + totalSpokeUsdc;

  return (
    <Card variant="glass" className="border-thunder-500/30 bg-gradient-to-br from-dark-800 via-dark-800 to-thunder-500/5">
      <CardContent className="py-6">
        {/* Hub Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-thunder-500/20 flex items-center justify-center ring-2 ring-thunder-500/30">
              <Wallet className="w-5 h-5 text-thunder-500" />
            </div>
            <div>
              <h3 className="font-semibold text-dark-100 text-sm">Arc Liquidity Hub</h3>
              <p className="text-dark-500 text-xs">All payouts route from here</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchWalletBalances}
            disabled={isLoadingBalances}
            className="text-dark-400 hover:text-dark-200"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingBalances ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {!hasArcWallet ? (
          <div className="text-center py-4">
            <p className="text-dark-500 text-sm">
              Arc wallet will be created when you start a session
            </p>
          </div>
        ) : (
          <>
            {/* Arc Hub Balance — Big Number */}
            <div className="text-center mb-5 py-3">
              <p className="text-dark-500 text-xs uppercase tracking-wider mb-1">Hub Balance</p>
              <p className="text-3xl font-bold text-dark-50">
                {isLoadingBalances ? (
                  <span className="animate-pulse text-dark-500">...</span>
                ) : (
                  <>
                    {formatAmount(arcUsdcAmount)}
                    <span className="text-lg text-dark-400 ml-2">USDC</span>
                  </>
                )}
              </p>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-dark-500 hover:text-thunder-400 mt-1 transition-colors"
              >
                View on ArcScan <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Hub → Spoke Visual */}
            <div className="border-t border-dark-700 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-thunder-500" />
                <span className="text-xs text-dark-500 uppercase tracking-wider">
                  Liquidity Distribution
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* Arc Hub Row */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-thunder-500/10 border border-thunder-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-thunder-500" />
                    <span className="text-sm font-medium text-thunder-400">Arc (Hub)</span>
                  </div>
                  <span className="text-sm font-mono text-dark-200">
                    {formatAmount(arcUsdcAmount)} USDC
                  </span>
                </div>

                {/* Arrow */}
                {spokeChains.length > 0 && (
                  <div className="flex justify-center py-0.5">
                    <div className="flex items-center gap-1 text-dark-600">
                      <div className="w-px h-3 bg-dark-600" />
                      <ArrowRight className="w-3 h-3 rotate-90" />
                      <span className="text-[10px] uppercase tracking-wider">CCTP</span>
                      <ArrowRight className="w-3 h-3 rotate-90" />
                      <div className="w-px h-3 bg-dark-600" />
                    </div>
                  </div>
                )}

                {/* Spoke Chains */}
                {spokeChains.map(([chain, balances]) => (
                  <div
                    key={chain}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-dark-800/80"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${CHAIN_COLORS[chain] || 'bg-dark-500'}`} />
                      <span className="text-sm text-dark-300">{CHAIN_LABELS[chain] || chain}</span>
                    </div>
                    <span className="text-sm font-mono text-dark-400">
                      {formatAmount(getUsdcAmount(balances))} USDC
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-700">
                <span className="text-xs text-dark-500">Total across all chains</span>
                <span className="text-sm font-mono font-medium text-dark-200">
                  {formatAmount(totalUsdc.toString())} USDC
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
