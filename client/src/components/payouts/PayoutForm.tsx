import { useState } from 'react';
import { Plus, Trash2, Send, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { usePayoutStore } from '@/stores/payoutStore';
import { useSessionStore } from '@/stores/sessionStore';

interface Recipient {
  address: string;
  chain: string;
  amount: string;
}

const chains = [
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'base', name: 'Base' },
  { id: 'optimism', name: 'Optimism' },
  { id: 'polygon', name: 'Polygon' },
];

export function PayoutForm() {
  const [recipients, setRecipients] = useState<Recipient[]>([
    { address: '', chain: 'arbitrum', amount: '' },
  ]);

  const { createPayout, processPayout, isProcessing } = usePayoutStore();
  const { session } = useSessionStore();

  const addRecipient = () => {
    setRecipients([...recipients, { address: '', chain: 'arbitrum', amount: '' }]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    const newRecipients = [...recipients];
    newRecipients[index] = { ...newRecipients[index], [field]: value };
    setRecipients(newRecipients);
  };

  const totalAmount = recipients
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    .toFixed(2);

  const isValid =
    recipients.length > 0 &&
    recipients.every((r) => r.address && r.amount && parseFloat(r.amount) > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const payout = await createPayout(recipients);
    await processPayout(payout.id);

    // Reset form
    setRecipients([{ address: '', chain: 'arbitrum', amount: '' }]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-thunder-500" />
          <CardTitle>Create Payout</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info Banner */}
          <div className="p-3 rounded-lg bg-thunder-500/10 border border-thunder-500/20 text-sm">
            <p className="text-thunder-400">
              Payouts are routed through Arc as a liquidity hub.
              Recipients receive USDC on their chosen chain.
            </p>
          </div>

          {/* Recipients */}
          <div className="space-y-3">
            {recipients.map((recipient, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-dark-800 border border-dark-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-dark-400">
                    Recipient {index + 1}
                  </span>
                  {recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRecipient(index)}
                      className="p-1 text-dark-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <Input
                  placeholder="0x... wallet address"
                  value={recipient.address}
                  onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={recipient.chain}
                    onChange={(e) => updateRecipient(index, 'chain', e.target.value)}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2.5 text-dark-100 focus:outline-none focus:ring-2 focus:ring-thunder-500/50"
                  >
                    {chains.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name}
                      </option>
                    ))}
                  </select>

                  <Input
                    type="number"
                    placeholder="Amount (USDC)"
                    value={recipient.amount}
                    onChange={(e) => updateRecipient(index, 'amount', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add Recipient Button */}
          <Button
            type="button"
            variant="secondary"
            onClick={addRecipient}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Recipient
          </Button>

          {/* Summary */}
          <div className="p-4 rounded-lg bg-dark-900 border border-dark-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Recipients</span>
              <span className="text-dark-200">{recipients.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Total Amount</span>
              <span className="text-dark-200">${totalAmount} USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Routing</span>
              <span className="text-thunder-400">Via Arc Hub</span>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={!isValid || isProcessing || !session}
            isLoading={isProcessing}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Payout
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
