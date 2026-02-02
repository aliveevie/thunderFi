import { useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useActionsStore } from '@/stores/actionsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { cn } from '@/lib/utils';

export function OrderForm() {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');

  const { placeOrder, isExecuting } = useActionsStore();
  const { session, updateSpent, incrementActions } = useSessionStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !price || !session) return;

    await placeOrder({
      pair: 'USDC/ETH',
      side,
      amount,
      price,
    });

    // Update session state
    updateSpent('0.001'); // Small fee
    incrementActions();

    // Reset form
    setAmount('');
    setPrice('');
  };

  const isDisabled = !session || session.status !== 'active' || !amount || !price;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Place Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Buy/Sell Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-dark-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={cn(
                'py-2.5 rounded-md text-sm font-medium transition-all',
                side === 'buy'
                  ? 'bg-green-500 text-white'
                  : 'text-dark-400 hover:text-dark-200'
              )}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={cn(
                'py-2.5 rounded-md text-sm font-medium transition-all',
                side === 'sell'
                  ? 'bg-red-500 text-white'
                  : 'text-dark-400 hover:text-dark-200'
              )}
            >
              Sell
            </button>
          </div>

          {/* Trading Pair */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-dark-800">
            <span className="text-sm text-dark-400">Pair</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">USDC/ETH</span>
              <ArrowDownUp className="w-4 h-4 text-dark-500" />
            </div>
          </div>

          {/* Amount Input */}
          <Input
            label="Amount (USDC)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />

          {/* Price Input */}
          <Input
            label="Price (ETH)"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />

          {/* Order Summary */}
          {amount && price && (
            <div className="p-3 rounded-lg bg-dark-800 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">Total</span>
                <span className="text-dark-200">
                  {(parseFloat(amount) * parseFloat(price)).toFixed(6)} ETH
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Fee</span>
                <span className="text-green-400">$0.001 (off-chain)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Gas</span>
                <span className="text-green-400">$0.00</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isDisabled}
            isLoading={isExecuting}
            variant={side === 'buy' ? 'primary' : 'danger'}
          >
            {side === 'buy' ? 'Buy' : 'Sell'} USDC
          </Button>

          {!session && (
            <p className="text-center text-sm text-dark-500">
              Create a session to start trading
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
