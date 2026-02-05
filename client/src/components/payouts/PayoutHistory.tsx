import { ExternalLink, CheckCircle2, Clock, Send, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { usePayoutStore } from '@/stores/payoutStore';
import { formatDate, formatAddress, formatUSD } from '@/lib/utils';
import type { PayoutStatus } from '@/types';

// Chain-specific block explorer URLs (testnet)
const EXPLORER_MAP: Record<string, string> = {
  arc: 'https://testnet.arcscan.app/tx/',
  arbitrum: 'https://sepolia.arbiscan.io/tx/',
  base: 'https://sepolia.basescan.org/tx/',
  optimism: 'https://sepolia-optimism.etherscan.io/tx/',
  polygon: 'https://amoy.polygonscan.com/tx/',
  ethereum: 'https://sepolia.etherscan.io/tx/',
};

const statusConfig: Record<PayoutStatus, { icon: typeof CheckCircle2; variant: string; label: string }> = {
  pending: { icon: Clock, variant: 'warning', label: 'Pending' },
  processing: { icon: Send, variant: 'info', label: 'Processing' },
  completed: { icon: CheckCircle2, variant: 'success', label: 'Completed' },
  failed: { icon: AlertCircle, variant: 'danger', label: 'Failed' },
};

export function PayoutHistory() {
  const { payouts } = usePayoutStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout History</CardTitle>
      </CardHeader>
      <CardContent>
        {payouts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-dark-500 text-sm">No payouts yet</p>
            <p className="text-dark-600 text-xs mt-1">
              Your payout history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payouts.map((payout) => {
              const config = statusConfig[payout.status] || statusConfig.pending;
              const StatusIcon = config.icon;

              return (
                <div
                  key={payout.id}
                  className="p-4 rounded-lg bg-dark-800 border border-dark-700"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        className={`w-5 h-5 ${
                          payout.status === 'completed'
                            ? 'text-green-500'
                            : payout.status === 'failed'
                            ? 'text-red-500'
                            : payout.status === 'processing'
                            ? 'text-blue-500 animate-pulse'
                            : 'text-thunder-500'
                        }`}
                      />
                      <div>
                        <div className="text-sm font-medium text-dark-200">
                          {formatUSD(payout.totalAmount)} to {payout.recipients.length} recipient{payout.recipients.length > 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-dark-500">
                          {formatDate(payout.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Badge variant={config.variant as 'success' | 'warning' | 'info' | 'danger'}>
                      {config.label}
                    </Badge>
                  </div>

                  {/* Recipients */}
                  <div className="space-y-2">
                    {payout.recipients.map((recipient, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded bg-dark-900"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              recipient.status === 'confirmed'
                                ? 'bg-green-500'
                                : recipient.status === 'sent'
                                ? 'bg-blue-500 animate-pulse'
                                : recipient.status === 'failed'
                                ? 'bg-red-500'
                                : 'bg-dark-600'
                            }`}
                          />
                          <span className="text-sm text-dark-300">
                            {formatAddress(recipient.address)}
                          </span>
                          <Badge variant="default" size="sm">
                            {recipient.chain}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-dark-200">
                            ${recipient.amount}
                          </span>
                          {recipient.txHash && (
                            <a
                              href={`${EXPLORER_MAP[recipient.chain] || 'https://sepolia.etherscan.io/tx/'}${recipient.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-dark-500 hover:text-thunder-500"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
