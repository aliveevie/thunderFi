import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClearNodeConnection } from './clearnode';
import type { YellowConfig } from './types';
import type { WalletClient, Account } from 'viem';

describe('ClearNodeConnection', () => {
  let connection: ClearNodeConnection;
  const testConfig: YellowConfig = {
    clearNodeUrl: 'wss://test.clearnode.example.com/ws',
    chainId: 11155111,
    environment: 'sandbox',
  };

  // Create a mock WalletClient that simulates wallet signing
  const mockAccount: Account = {
    address: '0x1234567890123456789012345678901234567890',
    type: 'json-rpc',
  };

  const mockWalletClient = {
    account: mockAccount,
    signTypedData: vi.fn(async () => `0x${'ab'.repeat(65)}` as `0x${string}`),
    signMessage: vi.fn(async () => `0x${'cd'.repeat(65)}` as `0x${string}`),
  } as unknown as WalletClient;

  beforeEach(() => {
    vi.clearAllMocks();
    connection = new ClearNodeConnection(testConfig);
  });

  afterEach(() => {
    connection.disconnect();
  });

  describe('connection lifecycle', () => {
    it('should start in disconnected state', () => {
      expect(connection.getState().status).toBe('disconnected');
    });

    it('should transition to connecting state when connect is called', async () => {
      const promise = connection.connect(mockAccount.address, mockWalletClient);

      // Initial state after calling connect
      expect(connection.getState().status).toBe('connecting');

      await promise;

      // Final state after successful connection
      expect(connection.getState().status).toBe('connected');
    });

    it('should update state on disconnect', async () => {
      await connection.connect(mockAccount.address, mockWalletClient);

      expect(connection.getState().status).toBe('connected');

      connection.disconnect();

      expect(connection.getState().status).toBe('disconnected');
    });
  });

  describe('getSigner', () => {
    it('should return null when not connected', () => {
      expect(connection.getSigner()).toBeNull();
    });

    it('should return the SDK signer after connection', async () => {
      await connection.connect(mockAccount.address, mockWalletClient);

      const signer = connection.getSigner();
      expect(signer).not.toBeNull();
      expect(typeof signer).toBe('function');
    });
  });

  describe('authentication flow', () => {
    it('should complete full auth flow with wallet signing', async () => {
      await connection.connect(mockAccount.address, mockWalletClient);

      // Verify we're connected after auth
      expect(connection.getState().status).toBe('connected');

      // The wallet should have been asked to sign
      expect(mockWalletClient.signTypedData).toHaveBeenCalled();
    });

    it('should store JWT token after successful authentication', async () => {
      await connection.connect(mockAccount.address, mockWalletClient);

      // The state should have a JWT after successful auth
      const state = connection.getState();
      expect(state.jwt).toBeDefined();
      expect(state.jwt).toBe('test-jwt-token');
    });
  });

  describe('event handling', () => {
    it('should emit connected event on successful connection', async () => {
      const onConnected = vi.fn();
      connection.on('connected', onConnected);

      await connection.connect(mockAccount.address, mockWalletClient);

      expect(onConnected).toHaveBeenCalled();
    });

    it('should emit disconnected event on disconnect', async () => {
      const onDisconnected = vi.fn();
      connection.on('disconnected', onDisconnected);

      await connection.connect(mockAccount.address, mockWalletClient);

      connection.disconnect();

      expect(onDisconnected).toHaveBeenCalled();
    });

    it('should allow unsubscribing from events', async () => {
      const onConnected = vi.fn();
      const unsubscribe = connection.on('connected', onConnected);

      unsubscribe();

      await connection.connect(mockAccount.address, mockWalletClient);

      expect(onConnected).not.toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should send messages and receive responses', async () => {
      await connection.connect(mockAccount.address, mockWalletClient);

      // Create a test message
      const requestId = connection.getNextRequestId();
      const testMessage = JSON.stringify({
        req: [requestId, 'ping', {}, Date.now()],
        sig: [],
      });

      const response = await connection.sendMessage(testMessage);
      const parsed = JSON.parse(response);

      expect(parsed.res).toBeDefined();
      expect(parsed.res[1]).toBe('pong');
    });
  });

  describe('address management', () => {
    it('should return null address when not connected', () => {
      expect(connection.getAddress()).toBeNull();
    });

    it('should return the connected address after connection', async () => {
      await connection.connect(mockAccount.address, mockWalletClient);

      expect(connection.getAddress()).toBe(mockAccount.address);
    });

    it('should clear address on disconnect', async () => {
      await connection.connect(mockAccount.address, mockWalletClient);

      connection.disconnect();

      expect(connection.getAddress()).toBeNull();
    });
  });
});

describe('ClearNodeConnection - Real SDK Integration', () => {
  it('WalletClient signTypedData must be called for auth', async () => {
    const config: YellowConfig = {
      clearNodeUrl: 'wss://test.clearnode.example.com/ws',
      chainId: 11155111,
      environment: 'sandbox',
    };

    const mockAccount: Account = {
      address: '0x1234567890123456789012345678901234567890',
      type: 'json-rpc',
    };

    const trackingWalletClient = {
      account: mockAccount,
      signTypedData: vi.fn(async () => `0x${'ab'.repeat(65)}` as `0x${string}`),
      signMessage: vi.fn(async () => `0x${'cd'.repeat(65)}` as `0x${string}`),
    } as unknown as WalletClient;

    const connection = new ClearNodeConnection(config);

    await connection.connect(mockAccount.address, trackingWalletClient);

    // Verify signTypedData was called during authentication
    expect(trackingWalletClient.signTypedData).toHaveBeenCalled();

    connection.disconnect();
  });
});
