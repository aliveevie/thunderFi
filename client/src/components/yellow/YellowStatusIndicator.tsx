/**
 * Yellow Network Status Indicator
 * Shows connection status and key metrics for Yellow state channels
 */

import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { useYellow } from '@/contexts';

interface YellowStatusIndicatorProps {
  variant?: 'compact' | 'detailed';
  className?: string;
}

export function YellowStatusIndicator({
  variant = 'compact',
  className = '',
}: YellowStatusIndicatorProps) {
  const { connectionState, isConnected, isConnecting, balances } = useYellow();

  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
      case 'authenticating':
        return 'text-thunder-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-dark-500';
    }
  };

  const getStatusIcon = () => {
    if (isConnecting) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    if (connectionState.status === 'error') {
      return <AlertCircle className="w-4 h-4" />;
    }
    if (isConnected) {
      return <Wifi className="w-4 h-4" />;
    }
    return <WifiOff className="w-4 h-4" />;
  };

  const getStatusText = () => {
    switch (connectionState.status) {
      case 'connected':
        return 'Yellow Network';
      case 'connecting':
        return 'Connecting...';
      case 'authenticating':
        return 'Authenticating...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Disconnected';
    }
  };

  // Get USDC balance
  const usdcBalance = balances.find((b) => b.asset.toLowerCase() === 'usdc');

  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700 ${className}`}
      >
        <span className={getStatusColor()}>{getStatusIcon()}</span>
        <span className="text-xs text-dark-300">{getStatusText()}</span>
        {isConnected && usdcBalance && (
          <>
            <span className="text-dark-600">•</span>
            <span className="text-xs text-dark-200 font-medium">
              ${parseFloat(usdcBalance.available).toFixed(2)}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl bg-dark-900 border border-dark-800 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={getStatusColor()}>{getStatusIcon()}</span>
          <span className="text-sm font-medium text-dark-100">
            {getStatusText()}
          </span>
        </div>
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-dark-600'
          }`}
        />
      </div>

      {connectionState.error && (
        <p className="text-xs text-red-400 mb-3">{connectionState.error}</p>
      )}

      {isConnected && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Status</span>
            <span className="text-green-400">Active</span>
          </div>
          {usdcBalance && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Available</span>
                <span className="text-dark-100">
                  ${parseFloat(usdcBalance.available).toFixed(2)} USDC
                </span>
              </div>
              {parseFloat(usdcBalance.locked) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-400">Locked</span>
                  <span className="text-dark-300">
                    ${parseFloat(usdcBalance.locked).toFixed(2)} USDC
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!isConnected && !isConnecting && (
        <p className="text-xs text-dark-500">
          Connect your wallet to enable state channels
        </p>
      )}
    </div>
  );
}
