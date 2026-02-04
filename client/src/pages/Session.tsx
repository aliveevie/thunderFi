import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, XCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { SessionStatus, CreateSessionModal, AllowanceDisplay } from '@/components/session';
import { useSessionStore } from '@/stores/sessionStore';
import { useWallet } from '@/hooks/useWallet';
import { formatAddress, formatDate } from '@/lib/utils';

export function Session() {
  const navigate = useNavigate();
  const [showCreateSession, setShowCreateSession] = useState(false);
  const { session, closeSession, isClosing } = useSessionStore();
  const { isConnected, address } = useWallet();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-50">Session Management</h1>
          <p className="text-dark-400 text-sm mt-1">
            Manage your trading session and allowance
          </p>
        </div>
        {isConnected && !session && (
          <Button onClick={() => setShowCreateSession(true)}>
            <Zap className="w-4 h-4 mr-2" />
            Create Session
          </Button>
        )}
      </div>

      {/* Not Connected State */}
      {!isConnected && (
        <Card className="border-dashed border-2 border-dark-700">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-dark-500" />
            </div>
            <h3 className="text-lg font-medium text-dark-300">Wallet Not Connected</h3>
            <p className="text-sm text-dark-500 mt-1">
              Connect your wallet to manage sessions
            </p>
          </CardContent>
        </Card>
      )}

      {/* Session Content */}
      {isConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Session Status */}
          <div className="lg:col-span-2 space-y-6">
            <SessionStatus />

            {/* Session Details */}
            {session && (
              <Card>
                <CardHeader>
                  <CardTitle>Session Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-dark-800">
                      <span className="text-dark-400">Session ID</span>
                      <span className="text-dark-200 font-mono text-sm">
                        {session.id}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-dark-800">
                      <span className="text-dark-400">Wallet</span>
                      <span className="text-dark-200 font-mono text-sm">
                        {formatAddress(address!)}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-dark-800">
                      <span className="text-dark-400">Created</span>
                      <span className="text-dark-200">
                        {formatDate(session.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-dark-800">
                      <span className="text-dark-400">Deposit Transaction</span>
                      {session.depositTxHash ? (
                        <a
                          href={`https://sepolia.basescan.org/tx/${session.depositTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-thunder-500 hover:underline font-mono text-sm"
                        >
                          {formatAddress(session.depositTxHash)}
                        </a>
                      ) : (
                        <span className="text-dark-500">-</span>
                      )}
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-dark-400">Status</span>
                      <Badge
                        variant={
                          session.status === 'active'
                            ? 'success'
                            : session.status === 'settling'
                            ? 'info'
                            : 'default'
                        }
                      >
                        {session.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Allowance Display */}
            {session && <AllowanceDisplay />}

            {/* Session Actions */}
            {session && session.status === 'active' && (
              <Card>
                <CardHeader>
                  <CardTitle>Session Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => navigate('/trade')}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Trade
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => navigate('/settle')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Settle Actions
                  </Button>
                  <Button
                    variant="danger"
                    className="w-full justify-start"
                    onClick={closeSession}
                    isLoading={isClosing}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Close Session
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Session Info */}
            <Card variant="glass">
              <CardContent className="pt-6">
                <h4 className="font-medium text-dark-200 mb-3">Session Lifecycle</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-thunder-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-thunder-500">1</span>
                    </div>
                    <p className="text-dark-400">
                      Create session and deposit USDC
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-thunder-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-thunder-500">2</span>
                    </div>
                    <p className="text-dark-400">
                      Trade instantly with zero gas
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-thunder-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-thunder-500">3</span>
                    </div>
                    <p className="text-dark-400">
                      Settle actions on-chain when ready
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-thunder-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-thunder-500">4</span>
                    </div>
                    <p className="text-dark-400">
                      Close session to withdraw funds
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
