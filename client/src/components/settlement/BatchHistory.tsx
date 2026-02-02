import { ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { useSettlementStore } from '@/stores/settlementStore';
import { formatDate, formatAddress } from '@/lib/utils';
import type { BatchStatus } from '@/types';

const statusConfig: Record<BatchStatus, { icon: typeof CheckCircle2; variant: string; label: string }> = {
  building: { icon: Clock, variant: 'warning', label: 'Building' },
  committed: { icon: Clock, variant: 'info', label: 'Committed' },
  revealed: { icon: Clock, variant: 'info', label: 'Revealed' },
  settled: { icon: CheckCircle2, variant: 'success', label: 'Settled' },
  failed: { icon: XCircle, variant: 'danger', label: 'Failed' },
};

export function BatchHistory() {
  const { batches } = useSettlementStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlement History</CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-dark-500 text-sm">No settlements yet</p>
            <p className="text-dark-600 text-xs mt-1">
              Your settlement batches will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => {
              const config = statusConfig[batch.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={batch.id}
                  className="p-4 rounded-lg bg-dark-800 border border-dark-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        className={`w-5 h-5 ${
                          batch.status === 'settled'
                            ? 'text-green-500'
                            : batch.status === 'failed'
                            ? 'text-red-500'
                            : 'text-thunder-500'
                        }`}
                      />
                      <div>
                        <div className="text-sm font-medium text-dark-200">
                          Batch #{batch.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-dark-500">
                          {formatDate(batch.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Badge variant={config.variant as 'success' | 'warning' | 'info' | 'danger'}>
                      {config.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-dark-500 text-xs">Actions</div>
                      <div className="text-dark-200">{batch.actionsCount}</div>
                    </div>
                    <div>
                      <div className="text-dark-500 text-xs">Net Amount</div>
                      <div
                        className={
                          parseFloat(batch.netAmount) >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }
                      >
                        {parseFloat(batch.netAmount) >= 0 ? '+' : ''}
                        ${batch.netAmount}
                      </div>
                    </div>
                    <div>
                      <div className="text-dark-500 text-xs">Gas Cost</div>
                      <div className="text-dark-200">
                        ${batch.gasCost || '--'}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Links */}
                  {(batch.commitTxHash || batch.revealTxHash) && (
                    <div className="mt-3 pt-3 border-t border-dark-700 flex gap-4">
                      {batch.commitTxHash && (
                        <a
                          href={`https://etherscan.io/tx/${batch.commitTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-dark-400 hover:text-thunder-500"
                        >
                          Commit: {formatAddress(batch.commitTxHash)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {batch.revealTxHash && (
                        <a
                          href={`https://etherscan.io/tx/${batch.revealTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-dark-400 hover:text-thunder-500"
                        >
                          Reveal: {formatAddress(batch.revealTxHash)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
