/**
 * thunderFi API Client
 * HTTP client for communicating with the thunderFi server.
 * Handles JWT auth, payouts, and Circle wallet operations.
 */

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/v1';

let authToken: string | null = null;

const TOKEN_STORAGE_KEY = 'thunderfi-auth-token';

/**
 * Set the JWT auth token (received from session creation).
 * Persists to localStorage so it survives page reloads.
 */
export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Get the current auth token. Restores from localStorage if needed.
 */
export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return authToken;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || `API error: ${response.status}`);
  }

  return data.data as T;
}

// ---- Session API ----

export interface ServerSessionResponse {
  id: string;
  status: string;
  allowance: string;
  spent: string;
  remaining: string;
  actionsCount: number;
  createdAt: string;
  token: string;
}

export async function createServerSession(walletAddress: string, allowance: string): Promise<ServerSessionResponse> {
  const result = await request<ServerSessionResponse>('POST', '/sessions', { walletAddress, allowance });
  // Store JWT for subsequent authenticated requests
  setAuthToken(result.token);
  return result;
}

// ---- Payout API ----

export interface PayoutRecipientInput {
  address: string;
  chain: string;
  amount: string;
}

export interface PayoutRecipientResponse {
  address: string;
  chain: string;
  amount: string;
  status: string;
  txHash: string | null;
}

export interface PayoutResponse {
  id: string;
  sessionId: string;
  recipients: PayoutRecipientResponse[];
  totalAmount: string;
  status: string;
  createdAt: string;
}

export async function createPayout(sessionId: string, recipients: PayoutRecipientInput[]): Promise<PayoutResponse> {
  return request<PayoutResponse>('POST', `/sessions/${sessionId}/payouts`, { recipients });
}

export async function processPayout(payoutId: string): Promise<PayoutResponse> {
  return request<PayoutResponse>('POST', `/payouts/${payoutId}/process`);
}

export async function getPayouts(sessionId: string): Promise<PayoutResponse[]> {
  return request<PayoutResponse[]>('GET', `/sessions/${sessionId}/payouts`);
}

export async function getPayout(payoutId: string): Promise<PayoutResponse> {
  return request<PayoutResponse>('GET', `/payouts/${payoutId}`);
}

// ---- Wallet API ----

export interface CircleWalletInfo {
  id: string;
  address: string;
  blockchain: string;
  state: string;
}

export interface CircleTokenBalance {
  token: {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    blockchain: string;
  };
  amount: string;
}

export interface WalletRecord {
  id: string;
  circleWalletId: string;
  chain: string;
  address: string;
  createdAt: string;
}

export async function createWallets(chains: string[] = ['arbitrum']): Promise<CircleWalletInfo[]> {
  return request<CircleWalletInfo[]>('POST', '/wallets/create', { chains });
}

export async function getWallets(): Promise<WalletRecord[]> {
  return request<WalletRecord[]>('GET', '/wallets');
}

export async function getAllBalances(): Promise<Record<string, CircleTokenBalance[]>> {
  return request<Record<string, CircleTokenBalance[]>>('GET', '/wallets/balance');
}

export async function getChainBalance(chain: string): Promise<CircleTokenBalance[]> {
  return request<CircleTokenBalance[]>('GET', `/wallets/balance/${chain}`);
}

export interface ArcChainInfo {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorer: string;
}

export async function getArcInfo(): Promise<ArcChainInfo> {
  return request<ArcChainInfo>('GET', '/wallets/arc/info');
}

export async function requestFaucet(chain: string): Promise<{ message: string }> {
  return request<{ message: string }>('POST', '/wallets/faucet', { chain });
}
