import { Shield, Lock, Eye, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SettleButton, BatchHistory } from '@/components/settlement';
import { useSessionStore } from '@/stores/sessionStore';
import { useActionsStore } from '@/stores/actionsStore';

export function Settle() {
  const { stats } = useSessionStore();
  const { actions } = useActionsStore();

  const unsettledActions = actions.filter((a) => a.status !== 'settled');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50">Settlement</h1>
        <p className="text-dark-400 text-sm mt-1">
          Batch settle your off-chain actions with privacy
        </p>
      </div>

      {/* Privacy Explainer */}
      <Card variant="glass" className="border-thunder-500/20">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-thunder-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-thunder-500" />
            </div>
            <div>
              <h3 className="font-semibold text-dark-100 mb-2">
                Privacy-Enhanced Settlement
              </h3>
              <p className="text-dark-400 text-sm mb-4">
                Your actions are batched and settled using a commit-reveal pattern.
                This hides individual trade timing and reduces your on-chain footprint.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4 text-green-500" />
                  <span className="text-dark-300">Timing hidden</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Eye className="w-4 h-4 text-green-500" />
                  <span className="text-dark-300">Details hidden until reveal</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-dark-300">Fully verifiable</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Settlement */}
        <div className="lg:col-span-2 space-y-6">
          {/* Settlement Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Settlement Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-dark-800 text-center">
                  <div className="text-2xl font-bold text-dark-100">
                    {unsettledActions.length}
                  </div>
                  <div className="text-xs text-dark-500">Actions to settle</div>
                </div>
                <div className="p-4 rounded-lg bg-dark-800 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    ${stats.gasSaved}
                  </div>
                  <div className="text-xs text-dark-500">Gas saved</div>
                </div>
                <div className="p-4 rounded-lg bg-dark-800 text-center">
                  <div className="text-2xl font-bold text-dark-100">2</div>
                  <div className="text-xs text-dark-500">On-chain txs</div>
                </div>
                <div className="p-4 rounded-lg bg-dark-800 text-center">
                  <div className="text-2xl font-bold text-dark-100">~$3</div>
                  <div className="text-xs text-dark-500">Est. gas cost</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Batch History */}
          <BatchHistory />
        </div>

        {/* Right Column - Settle Button & Info */}
        <div className="space-y-6">
          <SettleButton />

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle>How Settlement Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-thunder-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-thunder-500">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-200">Commit Phase</p>
                    <p className="text-xs text-dark-500">
                      Hash of all intents published on-chain
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-thunder-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-thunder-500">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-200">Privacy Window</p>
                    <p className="text-xs text-dark-500">
                      Short delay hides your timing
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-thunder-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-thunder-500">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-200">Reveal & Execute</p>
                    <p className="text-xs text-dark-500">
                      Batch executed via Uniswap v4 Hook
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
