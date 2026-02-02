import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { useActionsStore } from '@/stores/actionsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { formatAmount, formatTime } from '@/lib/utils';

export function OrderBook() {
  const { orders, cancelOrder } = useActionsStore();
  const { incrementActions, updateSpent } = useSessionStore();

  const handleCancel = async (orderId: string) => {
    await cancelOrder(orderId);
    updateSpent('0.001');
    incrementActions();
  };

  const openOrders = orders.filter((o) => o.status === 'open');

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Open Orders</CardTitle>
        <Badge variant="info">{openOrders.length} open</Badge>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-dark-500 text-sm">No orders yet</p>
            <p className="text-dark-600 text-xs mt-1">
              Place an order to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-800 hover:bg-dark-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        order.side === 'buy' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {order.side === 'buy' ? 'Buy' : 'Sell'} {formatAmount(order.amount)} USDC
                        </span>
                        <Badge
                          variant={
                            order.status === 'open'
                              ? 'success'
                              : order.status === 'cancelled'
                              ? 'danger'
                              : 'default'
                          }
                          size="sm"
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-dark-500">
                        @ {formatAmount(order.price, 6)} ETH · {formatTime(order.createdAt)}
                      </div>
                    </div>
                  </div>

                  {order.status === 'open' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(order.id)}
                      className="text-dark-400 hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
