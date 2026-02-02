import { useState } from 'react';
import { CheckCircle2, Lock, ExternalLink } from 'lucide-react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { useSessionStore } from '@/stores/sessionStore';
import { useActionsStore } from '@/stores/actionsStore';
import { useSettlementStore } from '@/stores/settlementStore';

export function SettleButton() {
  const { session } = useSessionStore();
  const { actions } = useActionsStore();
  const { createBatch, commitBatch, revealBatch, currentBatch, isSettling } = useSettlementStore();
  const [step, setStep] = useState<'idle' | 'commit' | 'reveal' | 'done'>('idle');

  const unsettledActions = actions.filter((a) => a.status !== 'settled');
  const canSettle = session?.status === 'active' && unsettledActions.length > 0;

  const handleSettle = async () => {
    if (!canSettle) return;

    // Step 1: Create batch
    setStep('commit');
    const batch = await createBatch(unsettledActions.length);

    // Step 2: Commit
    await commitBatch(batch.id);

    // Step 3: Reveal
    setStep('reveal');
    await revealBatch(batch.id);

    setStep('done');
    setTimeout(() => setStep('idle'), 3000);
  };

  return (
    <Card className={step !== 'idle' ? 'border-thunder-500/50' : ''}>
      <CardContent>
        <div className="text-center">
          {/* Icon */}
          <div
            className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center transition-all ${
              step === 'done'
                ? 'bg-green-500/20'
                : canSettle
                ? 'bg-thunder-500/20'
                : 'bg-dark-800'
            }`}
          >
            {step === 'done' ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : step !== 'idle' ? (
              <Lock className="w-8 h-8 text-thunder-500 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-dark-500" />
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-dark-100 mb-2">
            {step === 'commit'
              ? 'Committing Batch...'
              : step === 'reveal'
              ? 'Revealing & Settling...'
              : step === 'done'
              ? 'Settlement Complete!'
              : 'Settle Actions'}
          </h3>

          {/* Description */}
          <p className="text-sm text-dark-400 mb-4">
            {step === 'commit'
              ? 'Publishing batch hash to blockchain'
              : step === 'reveal'
              ? 'Executing batched swaps with privacy'
              : step === 'done'
              ? `${currentBatch?.actionsCount || 0} actions settled in 2 transactions`
              : `${unsettledActions.length} actions ready to settle`}
          </p>

          {/* Progress Steps */}
          {step !== 'idle' && step !== 'done' && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge variant={step === 'commit' ? 'warning' : 'success'}>
                1. Commit
              </Badge>
              <div className="w-8 h-px bg-dark-700" />
              <Badge variant={step === 'reveal' ? 'warning' : 'default'}>
                2. Reveal
              </Badge>
            </div>
          )}

          {/* Settlement Summary */}
          {step === 'done' && currentBatch && (
            <div className="p-3 rounded-lg bg-dark-800 mb-4 text-left">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-dark-400">Actions Settled</span>
                <span className="text-dark-200">{currentBatch.actionsCount}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-dark-400">Gas Cost</span>
                <span className="text-dark-200">${currentBatch.gasCost}</span>
              </div>
              {currentBatch.revealTxHash && (
                <a
                  href={`https://etherscan.io/tx/${currentBatch.revealTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-thunder-500 hover:underline"
                >
                  View Transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Button */}
          {step === 'idle' && (
            <Button
              onClick={handleSettle}
              disabled={!canSettle || isSettling}
              isLoading={isSettling}
              className="w-full"
            >
              {canSettle ? 'Settle Now' : 'No Actions to Settle'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
