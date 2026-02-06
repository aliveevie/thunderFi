import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowUpRight, ArrowDownRight, Activity, Wallet } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { SessionStatus, CreateSessionModal } from '@/components/session';
import { ActionCounter } from '@/components/trading';
import { useSessionStore } from '@/stores/sessionStore';
import { usePayoutStore } from '@/stores/payoutStore';
import { useWalletStore } from '@/stores/walletStore';
import { formatUSD, formatAmount } from '@/lib/utils';
import { getAuthToken } from '@/services/api';

export function Dashboard() {
  const navigate = useNavigate();
  const [showCreateSession, setShowCreateSession] = useState(false);
  const { session, stats } = useSessionStore();
  const { isConnected } = useWalletStore();
  const { walletBalances, wallets, fetchWalletBalances } = usePayoutStore();

  // Fetch balances when session exists and user is authenticated
  const hasAuth = !!getAuthToken();
  useEffect(() => {
    if (session && wallets.length > 0 && hasAuth) {
      fetchWalletBalances();
    }
  }, [session, wallets.length, hasAuth, fetchWalletBalances]);

  const arcBalances = walletBalances['arc'] || [];
  const arcUsdcBalance = arcBalances.find(
    (b) => b.token.symbol === 'USDC' || b.token.symbol === 'USDC.e'
  )?.amount || '0';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-50">Dashboard</h1>
          <p className="text-dark-400 text-sm mt-1">
            Overview of your trading session
          </p>
        </div>
        {isConnected && !session && (
          <Button onClick={() => setShowCreateSession(true)}>
            <Zap className="w-4 h-4 mr-2" />
            Create Session
          </Button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">Session Balance</p>
                <p className="text-2xl font-bold text-dark-50">
                  {session ? formatUSD(session.remaining) : '$0.00'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-thunder-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-thunder-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">Total Actions</p>
                <p className="text-2xl font-bold text-dark-50">
                  {session?.actionsCount || 0}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">Gas Saved</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatUSD(stats.gasSaved)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-thunder-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">Arc Hub Balance</p>
                <p className="text-2xl font-bold text-thunder-400">
                  {session ? `${formatAmount(arcUsdcBalance)} USDC` : '$0.00'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-thunder-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-thunder-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Status */}
        <SessionStatus />

        {/* Action Counter */}
        {session && <ActionCounter />}
      </div>

      {/* Quick Actions */}
      {session && session.status === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                variant="secondary"
                className="h-auto py-4 flex-col"
                onClick={() => (navigate('/trade'))}
              >
                <ArrowUpRight className="w-6 h-6 mb-2 text-green-500" />
                <span>Trade</span>
              </Button>
              <Button
                variant="secondary"
                className="h-auto py-4 flex-col"
                onClick={() => (navigate('/settle'))}
              >
                <Activity className="w-6 h-6 mb-2 text-thunder-500" />
                <span>Settle</span>
              </Button>
              <Button
                variant="secondary"
                className="h-auto py-4 flex-col"
                onClick={() => (navigate('/payouts'))}
              >
                <ArrowDownRight className="w-6 h-6 mb-2 text-blue-500" />
                <span>Payout</span>
              </Button>
              <Button
                variant="secondary"
                className="h-auto py-4 flex-col"
                onClick={() => (navigate('/session'))}
              >
                <Zap className="w-6 h-6 mb-2 text-dark-400" />
                <span>Session</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={showCreateSession}
        onClose={() => setShowCreateSession(false)}
      />
    </div>
  );
}
