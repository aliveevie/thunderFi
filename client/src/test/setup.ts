import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private messageQueue: string[] = [];

  constructor(public url: string) {
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    this.messageQueue.push(data);

    // Parse and respond to messages
    try {
      const parsed = JSON.parse(data);
      const requestId = parsed.req?.[0];
      const method = parsed.req?.[1];

      // Simulate ClearNode responses with correct Nitrolite RPC format
      setTimeout(() => {
        let response: string;

        if (method === 'auth_request') {
          // Auth challenge response with challenge_message in the params
          response = JSON.stringify({
            res: [requestId, 'auth_challenge', { challenge_message: 'test-challenge-message-12345' }, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else if (method === 'auth_verify') {
          // Auth success with JWT token
          response = JSON.stringify({
            res: [requestId, 'auth_verify', {
              address: '0x1234567890123456789012345678901234567890',
              sessionKey: '0x1234567890123456789012345678901234567890',
              success: true,
              jwt: 'test-jwt-token',
            }, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else if (method === 'get_ledger_balances') {
          response = JSON.stringify({
            res: [requestId, 'get_ledger_balances', {
              ledgerBalances: [
                { asset: 'usdc', amount: '100.00' }
              ]
            }, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else if (method === 'create_app_session') {
          response = JSON.stringify({
            res: [requestId, 'create_app_session', {
              appSessionId: '0xabc123def456789012345678901234567890abcd',
              version: 1,
              status: 'open'
            }, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else if (method === 'ping') {
          response = JSON.stringify({
            res: [requestId, 'pong', {}, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else if (method === 'get_config') {
          response = JSON.stringify({
            res: [requestId, 'get_config', {
              broker_address: '0x0000000000000000000000000000000000000001',
              networks: []
            }, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else if (method === 'transfer') {
          response = JSON.stringify({
            res: [requestId, 'transfer', {
              transactions: []
            }, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else if (method === 'message') {
          response = JSON.stringify({
            res: [requestId, 'message', {}, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else if (method === 'close_app_session') {
          response = JSON.stringify({
            res: [requestId, 'close_app_session', {
              appSessionId: '0xabc123def456789012345678901234567890abcd',
              version: 1,
              status: 'closed'
            }, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        } else {
          response = JSON.stringify({
            res: [requestId, 'error', { error: `Unknown method: ${method}` }, Date.now()],
            sig: ['0x1234567890abcdef'],
          });
        }

        if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
          this.onmessage(new MessageEvent('message', { data: response }));
        }
      }, 10);
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }
  }

  getMessageQueue() {
    return [...this.messageQueue];
  }
}

// Make MockWebSocket available globally
(global as any).WebSocket = MockWebSocket;
(global as any).MockWebSocket = MockWebSocket;

// Mock console methods for cleaner test output
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
