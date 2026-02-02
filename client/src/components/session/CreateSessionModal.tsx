import { useState } from 'react';
import { Zap, DollarSign, Info } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import { useSessionStore } from '@/stores/sessionStore';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const presetAmounts = ['25', '50', '100', '250'];

export function CreateSessionModal({ isOpen, onClose }: CreateSessionModalProps) {
  const [allowance, setAllowance] = useState('50');
  const { createSession, isCreating } = useSessionStore();

  const handleCreate = async () => {
    await createSession(allowance);
    onClose();
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
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-thunder-500/10 border border-thunder-500/20">
          <Info className="w-5 h-5 text-thunder-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-thunder-400 font-medium">How it works</p>
            <p className="text-dark-400 mt-1">
              Your allowance is the maximum you can spend in this session.
              Actions are instant and gasless. Settle anytime to finalize on-chain.
            </p>
          </div>
        </div>

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
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            isLoading={isCreating}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Create Session
          </Button>
        </div>
      </div>
    </Modal>
  );
}
