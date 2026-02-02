import { useState } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import { Card, CardContent, Button } from '@/components/ui';
import { CreateSessionModal, AllowanceDisplay } from '@/components/session';
import { OrderForm, ActionCounter, OrderBook, ReceiptsPanel } from '@/components/trading';
import { useSessionStore } from '@/stores/sessionStore';
import { useWalletStore } from '@/stores/walletStore';

export function Trade() {
  const [showCreateSession, setShowCreateSession] = useState(false);
  const { session } = useSessionStore();
  const { isConnected } = useWalletStore();

  const needsSession = isConnected && (!session || session.status !== 'active');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-50">Trade</h1>
          <p className="text-dark-400 text-sm mt-1">
            Execute instant, gasless trades off-chain
          </p>
        </div>
        {session && <AllowanceDisplay />}
      </div>

      {/* Warning Banner */}
      {needsSession && (
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

      {/* Main Trading Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Form */}
        <div className="space-y-6">
          <OrderForm />
        </div>

        {/* Middle Column - Orders & Actions */}
        <div className="space-y-6">
          <ActionCounter />
          <OrderBook />
        </div>

        {/* Right Column - Receipts */}
        <div className="space-y-6">
          <ReceiptsPanel />
        </div>
      </div>

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={showCreateSession}
        onClose={() => setShowCreateSession(false)}
      />
    </div>
  );
}
