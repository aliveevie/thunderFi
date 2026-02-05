import { useState, useEffect } from 'react';
import { Zap, DollarSign, Info, Wifi, WifiOff, Loader2, CheckCircle, Droplets } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Modal, Button, Input } from '@/components/ui';
import { useSessionStore } from '@/stores/sessionStore';
import { useYellow } from '@/contexts';
import { useYellowSession } from '@/hooks';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const presetAmounts = ['25', '50', '100', '250'];

type Step = 'configure' | 'deposit' | 'creating';

export function CreateSessionModal({ isOpen, onClose }: CreateSessionModalProps) {
  const [allowance, setAllowance] = useState('50');
  const [useYellowNetwork, setUseYellowNetwork] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('configure');
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [faucetSuccess, setFaucetSuccess] = useState(false);

  const { address } = useAccount();

  const { createSession: createDemoSession, isCreating: isDemoCreating } = useSessionStore();
  const { setYellowSession } = useSessionStore();
  const {
    service,
    isConnected: yellowConnected,
    isConnecting: yellowConnecting,
    connect: connectYellow,
    walletBalances,
    refreshWalletBalances,
    ensureCorrectChain,
    requestFaucetTokens,
    isRequestingFaucet,
  } = useYellow();

  // Get the actual token name from ClearNode (e.g., "ytest.usd" on sandbox)
  const tokenSymbol = service?.getTokenSymbol(84532) || 'USDC';
  const tokenDisplay = tokenSymbol.toUpperCase();
  const { createSession: createYellowSession, isCreating: isYellowCreating } = useYellowSession();

  const isCreating = useYellowNetwork ? isYellowCreating : isDemoCreating;

  // Refresh wallet balances when modal opens or Yellow connects
  useEffect(() => {
    if (isOpen && useYellowNetwork && yellowConnected) {
      refreshWalletBalances();
    }
  }, [isOpen, useYellowNetwork, yellowConnected, refreshWalletBalances]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('configure');
      setError(null);
      setIsCheckingBalance(false);
      setFaucetSuccess(false);
    }
  }, [isOpen]);

  const ledgerBalance = parseFloat(walletBalances?.ledger || '0');
  const walletBalance = parseFloat(walletBalances?.wallet || '0');
  const custodyBalance = parseFloat(walletBalances?.custody || '0');
  const requiredAmount = Math.max(0, parseFloat(allowance) || 0);
  const needsDeposit = useYellowNetwork && yellowConnected && requiredAmount > 0 && ledgerBalance < requiredAmount;
  const depositAmount = Math.max(0, requiredAmount - ledgerBalance);

  const handleRequestFaucet = async () => {
    setError(null);
    setFaucetSuccess(false);
    try {
      await requestFaucetTokens();
      setFaucetSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Faucet request failed');
    }
  };

  const handleCreate = async () => {
    setError(null);

    try {
      if (useYellowNetwork) {
        // Go straight to the deposit/faucet step - no signing needed yet
        // Faucet is step 1 per the quickstart guide (before any auth)
        // If already connected, refresh balances for display
        if (yellowConnected) {
          await refreshWalletBalances();
        }
        setStep('deposit');
        return;
      } else {
        // Demo mode
        await createDemoSession(allowance, address);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      setStep('configure');
    }
  };

  const handleCreateSession = async () => {
    setError(null);
    setIsCheckingBalance(true);

    try {
      // Ensure on Base Sepolia
      await ensureCorrectChain();

      // Connect to Yellow if not connected (this triggers EIP-712 signing)
      if (!yellowConnected) {
        await connectYellow();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Refresh to get latest ledger balance
      await refreshWalletBalances();
      await new Promise(resolve => setTimeout(resolve, 500));

      setStep('creating');
      const session = await createYellowSession({ allowance });
      setYellowSession(session.id, allowance, address);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';

      if (message.includes('insufficient funds')) {
        setError('Insufficient ledger balance. Request tokens from the faucet first.');
        setStep('deposit');
      } else {
        setError(message);
        setStep('deposit');
      }
    } finally {
      setIsCheckingBalance(false);
    }
  };

  // Deposit step UI
  if (step === 'deposit') {
    const hasBalanceData = walletBalances !== null;

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Get Test Tokens"
        description="Request free tokens to start trading on the sandbox"
        size="md"
      >
        <div className="space-y-6">
          {/* Step 1: Faucet - always available, no signing needed */}
          <div className="p-4 rounded-lg bg-dark-800 space-y-3">
            <div className="flex items-center gap-3">
              <Droplets className="w-5 h-5 text-blue-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-dark-100">Step 1: Request Tokens</p>
                <p className="text-xs text-dark-400">
                  Tokens go directly to your Yellow ledger (off-chain). No signing required.
                </p>
              </div>
            </div>
            {address && (
              <p className="text-xs text-dark-500 font-mono truncate">
                Wallet: {address}
              </p>
            )}
            <Button
              onClick={handleRequestFaucet}
              isLoading={isRequestingFaucet}
              className="w-full flex items-center justify-center gap-2"
            >
              <Droplets className="w-4 h-4" />
              {isRequestingFaucet ? 'Requesting...' : 'Request Test Tokens'}
            </Button>
            {faucetSuccess && (
              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-xs text-green-400">
                  Tokens requested! They should appear in your ledger shortly. Click "Connect & Create Session" below.
                </p>
              </div>
            )}
          </div>

          {/* Balance Overview - only shown when connected */}
          {hasBalanceData && (
            <div className="p-4 rounded-lg bg-dark-800 space-y-3">
              <p className="text-xs text-dark-400 font-medium">Your Balances</p>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Wallet (on-chain)</span>
                <span className="text-dark-100">{walletBalance.toFixed(2)} {tokenDisplay}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Custody (on-chain)</span>
                <span className="text-dark-100">{custodyBalance.toFixed(2)} {tokenDisplay}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Ledger (available for sessions)</span>
                <span className={`font-medium ${ledgerBalance >= requiredAmount && requiredAmount > 0 ? 'text-green-400' : 'text-thunder-400'}`}>
                  {ledgerBalance.toFixed(2)} {tokenDisplay}
                </span>
              </div>
            </div>
          )}

          {/* Status message */}
          {hasBalanceData && ledgerBalance >= requiredAmount && requiredAmount > 0 ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-green-400 font-medium">Sufficient Balance</p>
                <p className="text-dark-400 mt-1">
                  You have enough {tokenDisplay} to create a session with {requiredAmount} {tokenDisplay} allowance.
                </p>
              </div>
            </div>
          ) : !hasBalanceData ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-400 font-medium">Step 2: Connect & Create Session</p>
                <p className="text-dark-400 mt-1">
                  After requesting tokens, click below to connect to Yellow Network and create your session.
                </p>
              </div>
            </div>
          ) : null}

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {/* Create Session button - handles connection + creation */}
            <Button
              onClick={handleCreateSession}
              isLoading={isCheckingBalance || isCreating || yellowConnecting}
              className="w-full flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {yellowConnecting
                ? 'Connecting...'
                : yellowConnected
                ? `Create Session (${requiredAmount} ${tokenDisplay})`
                : 'Connect & Create Session'}
            </Button>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep('configure')} className="flex-1">
                Back
              </Button>
              {yellowConnected && (
                <Button
                  onClick={refreshWalletBalances}
                  variant="secondary"
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-4 h-4" />
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

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

        {/* Balance Info - Only shown in Yellow Network mode when connected */}
        {useYellowNetwork && yellowConnected && walletBalances && (
          <div className="p-4 rounded-lg bg-dark-800 space-y-2">
            <p className="text-xs text-dark-400 font-medium mb-2">Your Balances (Base Sepolia)</p>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Wallet</span>
              <span className="text-dark-100">{walletBalance.toFixed(2)} {tokenDisplay}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Custody (on-chain)</span>
              <span className="text-dark-100">{custodyBalance.toFixed(2)} {tokenDisplay}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Ledger (available)</span>
              <span className={`font-medium ${ledgerBalance >= requiredAmount ? 'text-green-400' : 'text-yellow-400'}`}>
                {ledgerBalance.toFixed(2)} {tokenDisplay}
              </span>
            </div>
            {needsDeposit && (
              <p className="text-xs text-yellow-400 mt-2">
                You need to deposit {depositAmount.toFixed(2)} {tokenDisplay} to create this session
              </p>
            )}
          </div>
        )}

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

        {/* Testnet Info - Only shown in Yellow Network mode */}
        {useYellowNetwork && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Droplets className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-blue-400 font-medium">Sandbox Testnet</p>
              <p className="text-dark-400 text-xs mt-0.5">
                Free test tokens available via faucet in the next step.
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Amount Input */}
        <div>
          <Input
            label={`Session Allowance (${tokenDisplay})`}
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
            <span className="text-dark-100 font-medium">${allowance} {tokenDisplay}</span>
          </div>
          {useYellowNetwork && needsDeposit && (
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Deposit Required</span>
              <span className="text-yellow-400 font-medium">${depositAmount.toFixed(2)} {tokenDisplay}</span>
            </div>
          )}
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
            isLoading={isCreating}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {useYellowNetwork ? 'Next: Get Tokens' : 'Create Session'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
