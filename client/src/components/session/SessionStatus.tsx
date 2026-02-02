import { Zap, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, Badge } from '@/components/ui';
import { useSessionStore } from '@/stores/sessionStore';
import { formatUSD, formatDate } from '@/lib/utils';
import type { SessionStatus as SessionStatusType } from '@/types';

const statusConfig: Record<SessionStatusType, { icon: typeof Zap; color: string; label: string }> = {
  pending: { icon: Clock, color: 'warning', label: 'Pending Deposit' },
  active: { icon: Zap, color: 'success', label: 'Active' },
  settling: { icon: Clock, color: 'info', label: 'Settling' },
  closed: { icon: CheckCircle2, color: 'default', label: 'Closed' },
};

export function SessionStatus() {
  const { session, stats } = useSessionStore();

  if (!session) {
    return (
      <Card className="border-dashed border-2 border-dark-700">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-dark-500" />
          </div>
          <h3 className="text-lg font-medium text-dark-300">No Active Session</h3>
          <p className="text-sm text-dark-500 mt-1">
            Create a session to start trading instantly
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = statusConfig[session.status];
  const StatusIcon = status.icon;
  const percentUsed = (parseFloat(session.spent) / parseFloat(session.allowance)) * 100;

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              session.status === 'active' ? 'bg-green-500/20' : 'bg-dark-800'
            }`}>
              <StatusIcon className={`w-5 h-5 ${
                session.status === 'active' ? 'text-green-500' : 'text-dark-400'
              }`} />
            </div>
            <div>
              <div className="text-sm text-dark-400">Session Status</div>
              <Badge variant={status.color as 'success' | 'warning' | 'info' | 'default'}>
                {status.label}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-dark-400">Created</div>
            <div className="text-sm text-dark-200">{formatDate(session.createdAt)}</div>
          </div>
        </div>

        {/* Balance Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-dark-400">Remaining Balance</span>
            <span className="text-dark-200">
              {formatUSD(session.remaining)} / {formatUSD(session.allowance)}
            </span>
          </div>
          <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-thunder-500 to-thunder-400 transition-all duration-500"
              style={{ width: `${100 - percentUsed}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-dark-800">
            <div className="text-2xl font-bold text-dark-100">{session.actionsCount}</div>
            <div className="text-xs text-dark-500">Actions</div>
          </div>
          <div className="p-3 rounded-lg bg-dark-800">
            <div className="text-2xl font-bold text-green-400">{formatUSD(stats.gasSaved)}</div>
            <div className="text-xs text-dark-500">Gas Saved</div>
          </div>
          <div className="p-3 rounded-lg bg-dark-800">
            <div className="text-2xl font-bold text-dark-100">{formatUSD(stats.totalFeesPaid)}</div>
            <div className="text-xs text-dark-500">Fees Paid</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
