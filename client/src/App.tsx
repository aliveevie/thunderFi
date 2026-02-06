import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Landing, Dashboard, Session, Trade, Settle, Payouts, PrivacyAuction } from '@/pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page (no layout) */}
        <Route path="/" element={<Landing />} />

        {/* App Routes (with layout) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/session" element={<Session />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/settle" element={<Settle />} />
          <Route path="/payouts" element={<Payouts />} />
          <Route path="/privacy" element={<PrivacyAuction />} />

          {/* Redirects */}
          <Route path="/settings" element={<Dashboard />} />
          <Route path="/help" element={<Dashboard />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
