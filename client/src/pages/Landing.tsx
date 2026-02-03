import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Shield, Gauge, Globe, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { useWallet } from '@/hooks/useWallet';

const features = [
  {
    icon: Gauge,
    title: 'Instant Actions',
    description: 'Execute unlimited off-chain actions with zero gas and zero confirmations.',
  },
  {
    icon: Shield,
    title: 'Privacy Enhanced',
    description: 'Batch settlements hide individual timing and reduce on-chain footprint.',
  },
  {
    icon: Globe,
    title: 'Chain Abstracted',
    description: 'Settle and pay out to any chain through Arc as your liquidity hub.',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { connect, isConnected, isConnecting } = useWallet();

  const handleGetStarted = async () => {
    if (!isConnected) {
      await connect();
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-thunder-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-thunder-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-thunder-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-dark-900" />
            </div>
            <span className="text-xl font-bold">
              thunder<span className="text-thunder-500">Fi</span>
            </span>
          </div>
          <Button onClick={handleGetStarted} isLoading={isConnecting}>
            {isConnected ? 'Launch App' : 'Connect Wallet'}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 px-6">
        <div className="max-w-7xl mx-auto pt-20 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-thunder-500/10 border border-thunder-500/20 text-thunder-400 text-sm mb-8">
              <Zap className="w-4 h-4" />
              Powered by Yellow SDK + Uniswap v4 + Arc
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-dark-50">Deposit Once,</span>
              <br />
              <span className="gradient-text">Trade Instantly</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-dark-400 mb-10 max-w-2xl mx-auto">
              Gasless, privacy-preserving USDC trading. Execute unlimited actions off-chain,
              settle once on-chain, pay out to any chain.
            </p>

            {/* CTA */}
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={handleGetStarted}
                isLoading={isConnecting}
                className="px-8"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="secondary" size="lg">
                View Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
              {[
                { value: '$0', label: 'Gas per action' },
                { value: '50ms', label: 'Action speed' },
                { value: '∞', label: 'Actions per session' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl font-bold text-thunder-400">{stat.value}</div>
                  <div className="text-sm text-dark-500">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="grid md:grid-cols-3 gap-6 mt-24"
          >
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl bg-dark-900/50 border border-dark-800 backdrop-blur-xl hover:border-thunder-500/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-thunder-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-thunder-500" />
                </div>
                <h3 className="text-lg font-semibold text-dark-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-dark-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </motion.div>

          {/* How it Works */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-24 text-center"
          >
            <h2 className="text-2xl font-bold text-dark-100 mb-12">How It Works</h2>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {[
                'Create Session',
                'Deposit Once',
                'Trade Instantly',
                'Settle Privately',
                'Payout Anywhere',
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-800 border border-dark-700">
                    <span className="w-6 h-6 rounded-full bg-thunder-500 text-dark-900 text-sm font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-dark-200 text-sm">{step}</span>
                  </div>
                  {index < 4 && <ChevronRight className="w-5 h-5 text-dark-600" />}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-dark-800 px-6 py-8">
        <div className="max-w-7xl mx-auto text-center text-dark-500 text-sm">
          Built for ETHGlobal Hackathon · Yellow SDK + Uniswap v4 + Arc
        </div>
      </footer>
    </div>
  );
}
