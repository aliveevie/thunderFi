import { Globe, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { ArcHubBalance, PayoutForm, PayoutHistory } from '@/components/payouts';

export function Payouts() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50">Payouts</h1>
        <p className="text-dark-400 text-sm mt-1">
          Send USDC to any chain through Arc
        </p>
      </div>

      {/* Arc Hub Balance + Flow Explainer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Arc Hub Balance — Prominent Left Column */}
        <ArcHubBalance />

        {/* Chain Abstraction Explainer */}
        <Card variant="glass" className="border-thunder-500/20 lg:col-span-2">
          <CardContent className="py-6 h-full flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-thunder-500/20 flex items-center justify-center flex-shrink-0">
                <Globe className="w-6 h-6 text-thunder-500" />
              </div>
              <div>
                <h3 className="font-semibold text-dark-100 mb-1">
                  Chain-Abstracted Payouts
                </h3>
                <p className="text-dark-400 text-sm">
                  Arc is your central liquidity hub. All USDC is held on Arc and routed
                  to any destination chain via Circle CCTP — no manual bridging required.
                </p>
              </div>
            </div>

            {/* Visual Flow */}
            <div className="flex items-center justify-center gap-2 mt-6 px-4">
              <div className="px-3 py-1.5 rounded bg-dark-800 text-sm text-dark-300">
                Fund Arc
              </div>
              <ArrowRight className="w-4 h-4 text-dark-600" />
              <div className="px-3 py-1.5 rounded bg-thunder-500/20 text-sm text-thunder-400 border border-thunder-500/30 font-medium">
                Arc Hub
              </div>
              <ArrowRight className="w-4 h-4 text-dark-600" />
              <div className="px-3 py-1.5 rounded bg-dark-800 text-sm text-dark-300">
                CCTP Burn
              </div>
              <ArrowRight className="w-4 h-4 text-dark-600" />
              <div className="px-3 py-1.5 rounded bg-dark-800 text-sm text-dark-300">
                Mint on Dest
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payout Form */}
        <PayoutForm />

        {/* Payout History */}
        <PayoutHistory />
      </div>

      {/* Supported Chains */}
      <Card>
        <CardContent className="py-6">
          <h3 className="font-medium text-dark-200 mb-4">Supported Chains</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'Arc (Hub)', color: 'bg-thunder-500' },
              { name: 'Arbitrum', color: 'bg-blue-500' },
              { name: 'Base', color: 'bg-blue-600' },
              { name: 'Optimism', color: 'bg-red-500' },
              { name: 'Polygon', color: 'bg-purple-500' },
            ].map((chain) => (
              <div
                key={chain.name}
                className="flex items-center gap-3 p-3 rounded-lg bg-dark-800"
              >
                <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                <span className="text-sm text-dark-200">{chain.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
