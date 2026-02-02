import { Zap, Wallet, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui';
import { useWalletStore } from '@/stores/walletStore';
import { useSessionStore } from '@/stores/sessionStore';
import { formatAddress, formatUSD } from '@/lib/utils';

export function Header() {
  const { address, isConnected, connect, disconnect } = useWalletStore();
  const { session } = useSessionStore();

  return (
    <header className="h-16 border-b border-dark-800 bg-dark-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-thunder-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-dark-900" />
          </div>
          <span className="text-xl font-bold">
            thunder<span className="text-thunder-500">Fi</span>
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Session Balance (if active) */}
          {session && session.status === 'active' && (
            <div className="px-4 py-2 rounded-lg bg-dark-800 border border-dark-700">
              <div className="text-xs text-dark-400">Session Balance</div>
              <div className="text-sm font-semibold text-thunder-400">
                {formatUSD(session.remaining)}
              </div>
            </div>
          )}

          {/* Wallet Connection */}
          {isConnected ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="flex items-center gap-2"
                onClick={disconnect}
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>{formatAddress(address!)}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={connect} className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
