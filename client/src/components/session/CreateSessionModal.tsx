import { useState } from 'react';
import { Zap, DollarSign, Info, Wifi, WifiOff } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import { useSessionStore } from '@/stores/sessionStore';
import { useYellow } from '@/contexts';
import { useYellowSession } from '@/hooks';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const presetAmounts = ['25', '50', '100', '250'];

export function CreateSessionModal({ isOpen, onClose }: CreateSessionModalProps) {
  const [allowance, setAllowance] = useState('50');
  const [useYellowNetwork, setUseYellowNetwork] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { createSession: createDemoSession, isCreating: isDemoCreating } = useSessionStore();
  const { setYellowSession } = useSessionStore();
  const { isConnected: yellowConnected, isConnecting: yellowConnecting, connect: connectYellow } = useYellow();
  const { createSession: createYellowSession, isCreating: isYellowCreating } = useYellowSession();

  const isCreating = useYellowNetwork ? isYellowCreating : isDemoCreating;

  const handleCreate = async () => {
    setError(null);

    try {
      if (useYellowNetwork) {
        // Connect to Yellow if not connected
        if (!yellowConnected) {
          await connectYellow();
        }

        // Create Yellow session
        const session = await createYellowSession({ allowance });

        // Sync to session store
        setYellowSession(session.id, allowance);
      } else {
        // Demo mode
        await createDemoSession(allowance);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Trading Session"
      description="Set your session allowance to start trading instantly"
      size="md"
    >
      <div className="space-y-6">
        {/* Yellow Network Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-dark-800 border border-dark-700">
          <div className="flex items-center gap-3">
            {yellowConnected ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-dark-500" />
            )}
            <div>
              <p className="text-sm font-medium text-dark-100">Yellow Network</p>
              <p className="text-xs text-dark-400">
                {yellowConnected ? 'Connected - State channels active' : 'Off-chain state channels'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setUseYellowNetwork(!useYellowNetwork)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              useYellowNetwork ? 'bg-thunder-500' : 'bg-dark-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                useYellowNetwork ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-thunder-500/10 border border-thunder-500/20">
          <Info className="w-5 h-5 text-thunder-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-thunder-400 font-medium">
              {useYellowNetwork ? 'Powered by Yellow SDK' : 'Demo Mode'}
            </p>
            <p className="text-dark-400 mt-1">
              {useYellowNetwork
                ? 'Your funds are secured in a state channel. Trade instantly off-chain with cryptographic guarantees. Settle anytime to finalize on-chain.'
                : 'Simulated trading session for testing. No real transactions.'}
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Amount Input */}
        <div>
          <Input
            label="Session Allowance (USDC)"
            type="number"
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            leftIcon={<DollarSign className="w-4 h-4" />}
            placeholder="Enter amount"
          />

          {/* Preset Amounts */}
          <div className="flex gap-2 mt-3">
            {presetAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setAllowance(amount)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  allowance === amount
                    ? 'bg-thunder-500 text-dark-900'
                    : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Session Details */}
        <div className="p-4 rounded-lg bg-dark-800 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Session Allowance</span>
            <span className="text-dark-100 font-medium">${allowance} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Deposit Required</span>
            <span className="text-dark-100 font-medium">${allowance} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Estimated Gas (one-time)</span>
            <span className="text-dark-100 font-medium">~$2.50</span>
          </div>
          <div className="border-t border-dark-700 pt-3 flex justify-between text-sm">
            <span className="text-dark-400">Actions after deposit</span>
            <span className="text-green-400 font-medium">Unlimited & Free</span>
          </div>
          {useYellowNetwork && (
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Settlement</span>
              <span className="text-thunder-400 font-medium">Batch via Uniswap v4</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            isLoading={isCreating || yellowConnecting}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {yellowConnecting ? 'Connecting...' : 'Create Session'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
