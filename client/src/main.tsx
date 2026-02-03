import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WalletProvider } from '@/components/wallet';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </StrictMode>
);
