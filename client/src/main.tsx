import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WalletProvider } from '@/components/wallet';
import { YellowProvider } from '@/contexts';
import App from './App';
import './index.css';

// Yellow Network environment - sandbox for testnet, production for mainnet
const yellowEnvironment = (import.meta.env.VITE_YELLOW_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <YellowProvider environment={yellowEnvironment}>
        <App />
      </YellowProvider>
    </WalletProvider>
  </StrictMode>
);
