import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { useSessionStore } from '@/stores/sessionStore';
import { formatUSD } from '@/lib/utils';

export function ActionCounter() {
  const { session, stats } = useSessionStore();

  if (!session) return null;

  return (
    <Card variant="glass" className="overflow-hidden">
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Actions Count */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-thunder-500" />
              <span className="text-sm text-dark-400">Actions</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={session.actionsCount}
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: -10 }}
                className="text-4xl font-bold text-dark-50"
              >
                {session.actionsCount}
              </motion.div>
            </AnimatePresence>
            <div className="text-xs text-dark-500 mt-1">
              0 gas paid
            </div>
          </div>

          {/* Gas Saved */}
          <div className="text-center border-l border-dark-700 pl-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-sm text-dark-400">Gas Saved</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={stats.gasSaved}
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: -10 }}
                className="text-4xl font-bold text-green-400"
              >
                {formatUSD(stats.gasSaved)}
              </motion.div>
            </AnimatePresence>
            <div className="text-xs text-dark-500 mt-1">
              vs on-chain
            </div>
          </div>
        </div>

        {/* Progress Bar Animation */}
        {session.actionsCount > 0 && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className="mt-4 h-1 bg-gradient-to-r from-thunder-500 via-green-500 to-thunder-500 rounded-full origin-left"
          />
        )}
      </CardContent>
    </Card>
  );
}
