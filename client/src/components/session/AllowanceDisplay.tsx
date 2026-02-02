import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import { formatUSD } from '@/lib/utils';

export function AllowanceDisplay() {
  const { session } = useSessionStore();

  if (!session) return null;

  const remaining = parseFloat(session.remaining);
  const allowance = parseFloat(session.allowance);
  const percentRemaining = (remaining / allowance) * 100;

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-dark-900 border border-dark-800">
      <div className="flex-1">
        <div className="text-xs text-dark-500 mb-1">Session Allowance</div>
        <div className="flex items-baseline gap-2">
          <motion.span
            key={session.remaining}
            initial={{ scale: 1.1, color: '#fde047' }}
            animate={{ scale: 1, color: '#f1f5f9' }}
            className="text-2xl font-bold"
          >
            {formatUSD(session.remaining)}
          </motion.span>
          <span className="text-dark-500 text-sm">
            / {formatUSD(session.allowance)}
          </span>
        </div>
      </div>

      {/* Mini Progress Ring */}
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="#1e293b"
            strokeWidth="4"
          />
          <motion.circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="#eab308"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={150}
            initial={{ strokeDashoffset: 150 }}
            animate={{ strokeDashoffset: 150 - (percentRemaining / 100) * 150 }}
            transition={{ duration: 0.5 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-dark-300">
            {Math.round(percentRemaining)}%
          </span>
        </div>
      </div>
    </div>
  );
}
