import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  ArrowLeftRight,
  CheckCircle2,
  Send,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/session', icon: Zap, label: 'Session' },
  { to: '/trade', icon: ArrowLeftRight, label: 'Trade' },
  { to: '/settle', icon: CheckCircle2, label: 'Settle' },
  { to: '/payouts', icon: Send, label: 'Payouts' },
];

const bottomItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/help', icon: HelpCircle, label: 'Help' },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-dark-800 bg-dark-950 flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-thunder-500/10 text-thunder-500 border border-thunder-500/20'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Stats Card */}
      <div className="p-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-thunder-500/20 to-thunder-600/10 border border-thunder-500/20">
          <div className="text-xs text-thunder-400 font-medium mb-1">Gas Saved</div>
          <div className="text-2xl font-bold text-thunder-400">$47.82</div>
          <div className="text-xs text-dark-400 mt-1">From 32 actions</div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-dark-800 space-y-1">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-dark-800 text-dark-100'
                  : 'text-dark-500 hover:text-dark-300 hover:bg-dark-800/50'
              )
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
