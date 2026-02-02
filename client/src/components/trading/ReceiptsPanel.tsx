import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { useActionsStore } from '@/stores/actionsStore';
import { formatTime } from '@/lib/utils';
import type { ActionType } from '@/types';

const actionLabels: Record<ActionType, string> = {
  place_order: 'Order Placed',
  cancel_order: 'Order Cancelled',
  modify_order: 'Order Modified',
  micro_tip: 'Tip Sent',
};

export function ReceiptsPanel() {
  const { actions } = useActionsStore();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-dark-400" />
          <CardTitle>Action Receipts</CardTitle>
        </div>
        <Badge variant="default">{actions.length} total</Badge>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-dark-500 text-sm">No actions yet</p>
            <p className="text-dark-600 text-xs mt-1">
              Your off-chain action receipts will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            <AnimatePresence>
              {actions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center">
                      {action.status === 'confirmed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-dark-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-dark-200">
                        {actionLabels[action.type]}
                      </div>
                      <div className="text-xs text-dark-500">
                        {formatTime(action.timestamp)} · Fee: ${action.fee}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={action.status === 'confirmed' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {action.status}
                  </Badge>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
