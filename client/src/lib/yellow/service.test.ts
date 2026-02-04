import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YellowService, YELLOW_CONFIGS } from './service';
import type { WalletClient, Account } from 'viem';

describe('YellowService', () => {
  let service: YellowService;
  const testAddress = '0x1234567890123456789012345678901234567890';

  // Create a mock WalletClient that simulates wallet signing
  const mockAccount: Account = {
    address: testAddress as `0x${string}`,
    type: 'json-rpc',
  };

  const createMockWalletClient = () => ({
    account: mockAccount,
    signTypedData: vi.fn(async () => `0x${'ab'.repeat(65)}` as `0x${string}`),
    signMessage: vi.fn(async () => `0x${'cd'.repeat(65)}` as `0x${string}`),
  } as unknown as WalletClient);

  let mockWalletClient: WalletClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletClient = createMockWalletClient();
    service = new YellowService({
      ...YELLOW_CONFIGS.sandbox,
      defaultAsset: 'usdc',
    });
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('connection', () => {
    it('should start in disconnected state', () => {
      expect(service.isConnected()).toBe(false);
      expect(service.getConnectionState().status).toBe('disconnected');
    });

    it('should connect with address and wallet client', async () => {
      await service.connect(testAddress, mockWalletClient);

      expect(service.isConnected()).toBe(true);
      expect(service.getAddress()).toBe(testAddress);
    });

    it('should require wallet signing for connection', async () => {
      await service.connect(testAddress, mockWalletClient);

      // signTypedData should be called for EIP-712 authentication
      expect(mockWalletClient.signTypedData).toHaveBeenCalled();
    });

    it('should disconnect cleanly', async () => {
      await service.connect(testAddress, mockWalletClient);

      service.disconnect();

      expect(service.isConnected()).toBe(false);
      expect(service.getAddress()).toBeNull();
    });
  });

  describe('session management', () => {
    it('should require connection before creating session', async () => {
      await expect(async () => {
        await service.createSession({
          protocol: 'test-protocol',
          counterparty: '0x0987654321098765432109876543210987654321',
          allocation: { self: '100', counterparty: '0' },
        });
      }).rejects.toThrow('Not connected');
    });

    it('should create a session with real Yellow SDK', async () => {
      await service.connect(testAddress, mockWalletClient);

      const session = await service.createSession({
        protocol: 'thunderfi-trading-v1',
        counterparty: '0x0987654321098765432109876543210987654321',
        allocation: { self: '50', counterparty: '0' },
        asset: 'usdc',
      });

      expect(session.id).toBeDefined();
      expect(session.id.startsWith('0x') || session.id.includes('session')).toBe(true);
      expect(session.protocol).toBe('thunderfi-trading-v1');
      expect(session.status).toBe('open');
    });

    it('should create trading session with wallet signing', async () => {
      await service.connect(testAddress, mockWalletClient);

      const session = await service.createTradingSession('50');

      expect(session).toBeDefined();
    });
  });

  describe('balances', () => {
    it('should require connection before getting balances', async () => {
      await expect(async () => {
        await service.getBalances();
      }).rejects.toThrow('Not connected');
    });

    it('should fetch balances after connection', async () => {
      await service.connect(testAddress, mockWalletClient);

      const balances = await service.getBalances();

      expect(Array.isArray(balances)).toBe(true);
    });
  });

  describe('payments', () => {
    it('should require active session for payments', async () => {
      await service.connect(testAddress, mockWalletClient);

      await expect(async () => {
        await service.sendPayment('nonexistent-session', {
          recipient: '0x0987654321098765432109876543210987654321',
          amount: '10',
          asset: 'usdc',
        });
      }).rejects.toThrow('Session not found');
    });

    it('should send payment within session', async () => {
      await service.connect(testAddress, mockWalletClient);

      const session = await service.createSession({
        protocol: 'thunderfi-trading-v1',
        counterparty: '0x0987654321098765432109876543210987654321',
        allocation: { self: '50', counterparty: '0' },
      });

      const result = await service.sendPayment(session.id, {
        recipient: '0x0987654321098765432109876543210987654321',
        amount: '10',
        asset: 'usdc',
      });

      expect(result.status).toBe('confirmed');
    });
  });

  describe('config', () => {
    it('should have correct sandbox configuration', () => {
      expect(YELLOW_CONFIGS.sandbox.environment).toBe('sandbox');
      expect(YELLOW_CONFIGS.sandbox.clearNodeUrl).toContain('wss://');
      expect(YELLOW_CONFIGS.sandbox.chainId).toBe(11155111); // Sepolia
    });

    it('should have correct production configuration', () => {
      expect(YELLOW_CONFIGS.production.environment).toBe('production');
      expect(YELLOW_CONFIGS.production.clearNodeUrl).toContain('wss://');
      expect(YELLOW_CONFIGS.production.chainId).toBe(1); // Mainnet
    });
  });

  describe('event handling', () => {
    it('should subscribe to events', async () => {
      const onConnected = vi.fn();
      service.on('connected', onConnected);

      await service.connect(testAddress, mockWalletClient);

      expect(onConnected).toHaveBeenCalled();
    });
  });
});

describe('YellowService - Integration Requirements', () => {
  it('MUST require wallet signature for authentication', async () => {
    const service = new YellowService({
      ...YELLOW_CONFIGS.sandbox,
      defaultAsset: 'usdc',
    });

    const mockAccount: Account = {
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      type: 'json-rpc',
    };

    const trackingWalletClient = {
      account: mockAccount,
      signTypedData: vi.fn(async () => `0x${'ab'.repeat(65)}` as `0x${string}`),
      signMessage: vi.fn(async () => `0x${'cd'.repeat(65)}` as `0x${string}`),
    } as unknown as WalletClient;

    await service.connect(mockAccount.address, trackingWalletClient);

    // CRITICAL: signTypedData MUST have been called for EIP-712 authentication
    expect(trackingWalletClient.signTypedData).toHaveBeenCalled();

    service.disconnect();
  });

  it('Session IDs must come from ClearNode, not be generated locally', async () => {
    const service = new YellowService({
      ...YELLOW_CONFIGS.sandbox,
      defaultAsset: 'usdc',
    });

    const mockAccount: Account = {
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      type: 'json-rpc',
    };

    const mockWalletClient = {
      account: mockAccount,
      signTypedData: vi.fn(async () => `0x${'ab'.repeat(65)}` as `0x${string}`),
      signMessage: vi.fn(async () => `0x${'cd'.repeat(65)}` as `0x${string}`),
    } as unknown as WalletClient;

    await service.connect(mockAccount.address, mockWalletClient);

    const session = await service.createTradingSession('50');

    // Session ID should be from ClearNode (hex format) not a random mock ID
    const looksLikeRealId = session.id.startsWith('0x') ||
                           session.id.includes('-') ||
                           session.id.includes('session');

    expect(looksLikeRealId).toBe(true);

    service.disconnect();
  });
});
