/**
 * Yellow Network Service
 * High-level API for state channel sessions and off-chain payments
 * Uses real @erc7824/nitrolite SDK
 */

import {
  createGetLedgerBalancesMessage,
  createAppSessionMessage,
  createCloseAppSessionMessage,
  createTransferMessage,
  createGetConfigMessageV2,
  createGetAppSessionsMessageV2,
  createApplicationMessage,
  createCreateChannelMessage,
  createResizeChannelMessage,
  createCloseChannelMessage,
  createGetChannelsMessageV2,
  RPCProtocolVersion,
} from '@erc7824/nitrolite';
import type {
  RPCAppSessionAllocation,
} from '@erc7824/nitrolite';
import type { WalletClient, PublicClient, Chain, Transport, Account, Address, Hex } from 'viem';
import { parseUnits } from 'viem';
import type { ContractAddresses } from '@erc7824/nitrolite';
import { ClearNodeConnection } from './clearnode';
import { DepositService, TOKEN_ADDRESSES, NETWORK_CONTRACTS, type DepositResult } from './deposit';
import type {
  YellowConfig,
  AppSession,
  SessionAllocation,
  PaymentIntent,
  PaymentResult,
  LedgerBalance,
  YellowConnectionState,
  YellowEventMap,
  YellowEventHandler,
} from './types';

export interface CreateSessionParams {
  protocol: string;
  counterparty: string;
  allocation: {
    self: string;
    counterparty: string;
  };
  asset?: string;
}

export interface YellowServiceConfig extends YellowConfig {
  defaultAsset?: string;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  custodyAddress: Address;
  adjudicatorAddress: Address;
}

export interface ClearNodeConfig {
  brokerAddress: Address;
  networks: NetworkConfig[];
}

export interface DepositParams {
  amount: string;
  tokenSymbol?: string;
}

export interface WalletBalances {
  wallet: string;
  custody: string;
  ledger: string;
}

export interface ChannelInfo {
  channelId: Hex;
  status: string;
  token: Address;
  chainId: number;
  amount: string;
}

export class YellowService {
  private connection: ClearNodeConnection;
  private config: YellowServiceConfig;
  private activeSessions = new Map<string, AppSession>();
  private activeChannelId: Hex | null = null;
  private depositService: DepositService | null = null;
  private walletClient: WalletClient | null = null;
  private publicClient: PublicClient | null = null;

  constructor(config: YellowServiceConfig) {
    this.config = {
      defaultAsset: 'usdc',
      ...config,
    };
    this.connection = new ClearNodeConnection(config);

    // Listen for session updates
    this.connection.on('sessionUpdate', (session) => {
      this.activeSessions.set(session.id, session);
    });
  }

  /**
   * Initialize connection with wallet
   * @param address - Wallet address
   * @param walletClient - Viem WalletClient for signing (auth params are synchronized internally)
   * @param publicClient - Optional Viem PublicClient for on-chain reads (required for deposits)
   */
  async connect(address: string, walletClient: WalletClient, publicClient?: PublicClient): Promise<void> {
    this.walletClient = walletClient;
    this.publicClient = publicClient || null;
    await this.connection.connect(address, walletClient);
  }

  /**
   * Set the public client for on-chain operations
   */
  setPublicClient(publicClient: PublicClient): void {
    this.publicClient = publicClient;
  }

  /**
   * Disconnect from Yellow Network
   */
  disconnect(): void {
    this.activeSessions.clear();
    this.connection.disconnect();
  }

  /**
   * Get connection state
   */
  getConnectionState(): YellowConnectionState {
    return this.connection.getState();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection.getState().status === 'connected';
  }

  /**
   * Get connected address
   */
  getAddress(): string | null {
    return this.connection.getAddress();
  }

  /**
   * Subscribe to Yellow events
   */
  on<K extends keyof YellowEventMap>(
    event: K,
    handler: YellowEventHandler<K>
  ): () => void {
    return this.connection.on(event, handler);
  }

  /**
   * Get ledger balances using real SDK
   */
  async getBalances(): Promise<LedgerBalance[]> {
    const address = this.connection.getAddress();
    const signer = this.connection.getSigner();
    if (!address || !signer) throw new Error('Not connected');

    const msg = await createGetLedgerBalancesMessage(
      signer,
      address, // accountId
      this.connection.getNextRequestId(),
      Date.now()
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    console.log('[YellowService] get_ledger_balances raw response:', JSON.stringify(response.res?.[2]));

    // Parse response: { res: [id, method, data, timestamp], sig: [...] }
    if (response.res && Array.isArray(response.res) && response.res[2]) {
      const rawData = response.res[2];

      // Handle both array and object response formats
      // ClearNode may return balances as array directly or as { balances: [...] }
      if (Array.isArray(rawData)) {
        console.log('[YellowService] Ledger balances (array format):', rawData);
        return rawData as LedgerBalance[];
      }

      const data = rawData as Record<string, unknown>;
      const balances = (data.balances || data.ledger_balances || data.result) as LedgerBalance[] | undefined;
      console.log('[YellowService] Ledger balances:', balances);
      return balances || [];
    }
    return [];
  }

  /**
   * Get ClearNode configuration
   */
  async getConfig(): Promise<Record<string, unknown>> {
    const msg = createGetConfigMessageV2(
      this.connection.getNextRequestId(),
      Date.now()
    );
    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && Array.isArray(response.res) && response.res[2]) {
      return response.res[2] as Record<string, unknown>;
    }
    return {};
  }

  /**
   * Get parsed ClearNode configuration with network details
   */
  async getParsedConfig(): Promise<ClearNodeConfig | null> {
    const rawConfig = await this.getConfig();
    if (!rawConfig.broker_address || !rawConfig.networks) {
      return null;
    }

    const networks = (rawConfig.networks as Array<{
      chain_id: number;
      name: string;
      custody_address: string;
      adjudicator_address: string;
    }>).map(n => ({
      chainId: n.chain_id,
      name: n.name,
      custodyAddress: n.custody_address as Address,
      adjudicatorAddress: n.adjudicator_address as Address,
    }));

    return {
      brokerAddress: rawConfig.broker_address as Address,
      networks,
    };
  }

  /**
   * Get the custody contract address for a specific chain
   * Returns null if the chain is not supported
   */
  async getCustodyAddress(chainId: number): Promise<Address | null> {
    const config = await this.getParsedConfig();
    if (!config) return null;

    const network = config.networks.find(n => n.chainId === chainId);
    return network?.custodyAddress || null;
  }

  /**
   * Get supported networks from ClearNode
   */
  async getSupportedNetworks(): Promise<NetworkConfig[]> {
    const config = await this.getParsedConfig();
    return config?.networks || [];
  }

  /**
   * Get the token address for a chain
   * First checks ClearNode's supported assets, then falls back to hardcoded addresses
   */
  getTokenAddress(chainId: number, symbol: string = 'USDC'): Address | null {
    // First try ClearNode's dynamic asset list (most accurate)
    const clearNodeAsset = this.connection.getTokenForChain(chainId);
    if (clearNodeAsset) {
      console.log(`[YellowService] Using ClearNode asset for chain ${chainId}: ${clearNodeAsset.symbol} @ ${clearNodeAsset.token}`);
      return clearNodeAsset.token as Address;
    }

    // Fallback to hardcoded addresses
    const tokens = TOKEN_ADDRESSES[chainId];
    return tokens?.[symbol] || null;
  }

  /**
   * Get the token symbol used by ClearNode for a chain
   */
  getTokenSymbol(chainId: number): string {
    const clearNodeAsset = this.connection.getTokenForChain(chainId);
    return clearNodeAsset?.symbol || 'usdc';
  }

  /**
   * Get token decimals used by ClearNode for a chain
   */
  getTokenDecimals(chainId: number): number {
    const clearNodeAsset = this.connection.getTokenForChain(chainId);
    return clearNodeAsset?.decimals || 6;
  }

  /**
   * Initialize the deposit service for on-chain operations
   * Must be called before deposit/withdraw operations
   */
  async initializeDepositService(chainId: number): Promise<void> {
    if (!this.walletClient || !this.publicClient) {
      throw new Error('Wallet and public clients required for deposits. Call connect() with publicClient first.');
    }

    // Get contract addresses from ClearNode config
    let contractAddresses: ContractAddresses;
    try {
      const custodyAddress = await this.getCustodyAddress(chainId);
      if (custodyAddress) {
        contractAddresses = {
          custody: custodyAddress,
          adjudicator: '0x0000000000000000000000000000000000000000' as Address, // Not needed for deposits
        };
      } else {
        // Fallback to hardcoded addresses
        contractAddresses = NETWORK_CONTRACTS[chainId];
      }
    } catch {
      // Use hardcoded addresses if ClearNode config unavailable
      contractAddresses = NETWORK_CONTRACTS[chainId];
    }

    if (!contractAddresses || contractAddresses.custody === '0x0000000000000000000000000000000000000000') {
      throw new Error(`No custody contract configured for chain ${chainId}`);
    }

    this.depositService = new DepositService({
      publicClient: this.publicClient,
      walletClient: this.walletClient as WalletClient<Transport, Chain, Account>,
      chainId,
      contractAddresses,
    });

    await this.depositService.initialize();
    console.log('[YellowService] Deposit service initialized for chain', chainId);
  }

  /**
   * Get wallet, custody, and ledger balances for a token
   */
  async getWalletBalances(chainId: number, tokenSymbol: string = 'USDC'): Promise<WalletBalances> {
    const tokenAddress = this.getTokenAddress(chainId, tokenSymbol);
    const actualSymbol = this.getTokenSymbol(chainId);
    const decimals = this.getTokenDecimals(chainId);

    if (!tokenAddress) {
      throw new Error(`No token configured for chain ${chainId}. Make sure you're connected to ClearNode first.`);
    }

    console.log(`[YellowService] Getting balances for ${actualSymbol} (${tokenAddress}) on chain ${chainId}`);

    // Initialize deposit service if needed
    if (!this.depositService) {
      await this.initializeDepositService(chainId);
    }

    // Get on-chain balances
    const onChainBalances = await this.depositService!.getBalances(tokenAddress, decimals);

    // Get ledger balance from ClearNode
    let ledgerBalance = '0';
    try {
      const balances = await this.getBalances();
      console.log('[YellowService] All ledger balances:', JSON.stringify(balances));

      // Match by asset name (usdc) or token address
      const usdcBalance = balances.find(b => {
        const assetLower = (b.asset || '').toLowerCase();
        return assetLower === tokenSymbol.toLowerCase() ||
               assetLower === tokenAddress.toLowerCase() ||
               assetLower.includes('usdc');
      });

      if (usdcBalance) {
        // Try multiple possible field names for the balance value
        ledgerBalance = usdcBalance.available || usdcBalance.total || '0';
        console.log('[YellowService] Found USDC ledger balance:', ledgerBalance, 'from asset:', usdcBalance.asset);
      } else {
        console.log('[YellowService] No USDC balance found. Available assets:', balances.map(b => b.asset));
      }
    } catch (e) {
      console.warn('[YellowService] Failed to get ledger balance:', e);
    }

    return {
      wallet: onChainBalances.wallet,
      custody: onChainBalances.custody,
      ledger: ledgerBalance,
    };
  }

  /**
   * Deposit tokens to the Yellow Network custody contract
   * This is required before creating sessions with funds
   */
  async deposit(params: DepositParams): Promise<DepositResult> {
    const chainId = this.config.chainId;
    const tokenAddress = this.getTokenAddress(chainId);
    const tokenSymbol = this.getTokenSymbol(chainId);
    const decimals = this.getTokenDecimals(chainId);

    if (!tokenAddress) {
      throw new Error(`No token configured for chain ${chainId}. ClearNode may not support this chain.`);
    }

    // Initialize deposit service if needed
    if (!this.depositService) {
      await this.initializeDepositService(chainId);
    }

    console.log(`[YellowService] Depositing ${params.amount} ${tokenSymbol} (${tokenAddress}) to custody contract (decimals: ${decimals})`);

    const result = await this.depositService!.approveAndDeposit({
      tokenAddress,
      amount: params.amount,
      decimals,
    });

    console.log('[YellowService] Deposit complete:', result);
    return result;
  }

  /**
   * Withdraw tokens from the Yellow Network custody contract
   */
  async withdraw(amount: string): Promise<string> {
    const chainId = this.config.chainId;
    const tokenAddress = this.getTokenAddress(chainId);
    const decimals = this.getTokenDecimals(chainId);

    if (!tokenAddress) {
      throw new Error(`No token configured for chain ${chainId}`);
    }

    if (!this.depositService) {
      await this.initializeDepositService(chainId);
    }

    const amountBigInt = parseUnits(amount, decimals);
    const txHash = await this.depositService!.withdraw(tokenAddress, amountBigInt);

    console.log('[YellowService] Withdrawal tx:', txHash);
    return txHash;
  }

  /**
   * Request test tokens from the sandbox faucet
   * Tokens are deposited directly into the off-chain Unified Balance (ledger)
   */
  async requestFaucetTokens(userAddress: string): Promise<{ success: boolean; message: string }> {
    const faucetUrl = 'https://clearnet-sandbox.yellow.com/faucet/requestTokens';

    const response = await fetch(faucetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Faucet request failed: ${text}`);
    }

    const data = await response.json();
    return { success: true, message: data.message || 'Tokens requested successfully' };
  }

  /**
   * Check if user has sufficient ledger balance for a session
   */
  async hasLedgerBalance(amount: string, tokenSymbol: string = 'USDC'): Promise<boolean> {
    try {
      const balances = await this.getBalances();
      const balance = balances.find(b =>
        b.asset.toLowerCase() === tokenSymbol.toLowerCase()
      );

      if (!balance) return false;

      const available = parseFloat(balance.available || '0');
      const required = parseFloat(amount);

      return available >= required;
    } catch {
      return false;
    }
  }

  // ========================================================================
  // Channel Lifecycle Methods (per Yellow Network quickstart)
  // Flow: create_channel → resize (allocate_amount) → use → close_channel
  // ========================================================================

  /**
   * Create a state channel on the ClearNode
   * Per quickstart: create_channel { chain_id, token }
   */
  async createChannel(chainId?: number, tokenAddress?: Address): Promise<Hex> {
    const signer = this.connection.getSigner();
    if (!signer) throw new Error('Not connected');

    const cId = chainId || this.config.chainId;
    const token = tokenAddress || this.getTokenAddress(cId);
    if (!token) throw new Error(`No token configured for chain ${cId}`);

    console.log(`[YellowService] Creating channel on chain ${cId} with token ${token}`);

    const msg = await createCreateChannelMessage(
      signer,
      { chain_id: cId, token },
      this.connection.getNextRequestId(),
      Date.now()
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    console.log('[YellowService] create_channel full response:', JSON.stringify(response.res?.[2]));

    if (response.res && response.res[1] === 'error') {
      throw new Error(`Channel creation failed: ${JSON.stringify(response.res[2])}`);
    }

    // Response params: RPCChannelOperation & { channel: RPCChannel }
    // Fields: channelId, state, serverSignature, channel
    const data = response.res?.[2] as Record<string, unknown> | undefined;

    // Try multiple possible field names (camelCase and snake_case)
    const channelId = (data?.channelId || data?.channel_id) as Hex | undefined;
    if (!channelId) {
      throw new Error(`No channel ID in response. Keys: ${data ? Object.keys(data).join(', ') : 'none'}`);
    }

    this.activeChannelId = channelId;
    console.log('[YellowService] Channel created:', channelId);
    return channelId;
  }

  /**
   * Find an existing open channel for the given chain, or return null
   */
  async findOpenChannel(chainId?: number): Promise<Hex | null> {
    try {
      const channels = await this.getChannels();
      const cId = chainId || this.config.chainId;
      const open = channels.find(
        ch => ch.chainId === cId && (ch.status === 'open' || ch.status === 'Open')
      );
      if (open) {
        console.log('[YellowService] Found existing open channel:', open.channelId);
        return open.channelId;
      }
    } catch (err) {
      console.warn('[YellowService] Failed to fetch channels:', err);
    }
    return null;
  }

  /**
   * Resize a channel - move funds between Unified Balance (ledger) and channel
   * allocate_amount: moves from Unified Balance → Channel (off-chain, no gas)
   * resize_amount: moves from L1 custody → Channel (on-chain, requires gas)
   * Per quickstart: resize_channel { channel_id, allocate_amount, funds_destination }
   */
  async resizeChannel(
    channelId: Hex,
    options: {
      allocateAmount?: bigint;
      resizeAmount?: bigint;
      fundsDestination?: Address;
    }
  ): Promise<void> {
    const signer = this.connection.getSigner();
    const address = this.connection.getAddress();
    if (!signer || !address) throw new Error('Not connected');

    const fundsDestination = options.fundsDestination || (address as Address);

    console.log(`[YellowService] Resizing channel ${channelId}`, {
      allocateAmount: options.allocateAmount?.toString(),
      resizeAmount: options.resizeAmount?.toString(),
      fundsDestination,
    });

    const msg = await createResizeChannelMessage(
      signer,
      {
        channel_id: channelId,
        allocate_amount: options.allocateAmount,
        resize_amount: options.resizeAmount,
        funds_destination: fundsDestination,
      },
      this.connection.getNextRequestId(),
      Date.now()
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && response.res[1] === 'error') {
      throw new Error(`Channel resize failed: ${JSON.stringify(response.res[2])}`);
    }

    console.log('[YellowService] Channel resized successfully');
  }

  /**
   * Close a state channel, moving funds back to Unified Balance
   * Per quickstart: close_channel { channel_id, funds_destination }
   */
  async closeChannel(channelId: Hex, fundsDestination?: Address): Promise<void> {
    const signer = this.connection.getSigner();
    const address = this.connection.getAddress();
    if (!signer || !address) throw new Error('Not connected');

    const destination = fundsDestination || (address as Address);

    console.log(`[YellowService] Closing channel ${channelId}, funds → ${destination}`);

    const msg = await createCloseChannelMessage(
      signer,
      channelId,
      destination,
      this.connection.getNextRequestId(),
      Date.now()
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && response.res[1] === 'error') {
      throw new Error(`Channel close failed: ${JSON.stringify(response.res[2])}`);
    }

    if (this.activeChannelId === channelId) {
      this.activeChannelId = null;
    }

    console.log('[YellowService] Channel closed:', channelId);
  }

  /**
   * Get all channels for the connected user
   */
  async getChannels(): Promise<ChannelInfo[]> {
    const address = this.connection.getAddress();
    if (!address) throw new Error('Not connected');

    const msg = createGetChannelsMessageV2(
      address as Address,
      undefined,
      this.connection.getNextRequestId(),
      Date.now()
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && response.res[1] === 'error') {
      throw new Error(`Get channels failed: ${JSON.stringify(response.res[2])}`);
    }

    const data = response.res?.[2] as {
      channels?: Array<{
        channelId: Hex;
        channel_id?: Hex;
        status: string;
        token: Address;
        chainId?: number;
        chain_id?: number;
        amount?: string;
      }>;
    } | undefined;

    return (data?.channels || []).map(ch => ({
      channelId: ch.channelId || ch.channel_id || ('0x' as Hex),
      status: ch.status,
      token: ch.token,
      chainId: ch.chainId || ch.chain_id || this.config.chainId,
      amount: ch.amount || '0',
    }));
  }

  /**
   * Get the active channel ID
   */
  getActiveChannelId(): Hex | null {
    return this.activeChannelId;
  }

  /**
   * Create a new app session for off-chain interactions
   * NOTE: This method REQUIRES wallet signing for the session message
   */
  async createSession(params: CreateSessionParams): Promise<AppSession> {
    const address = this.connection.getAddress();
    const signer = this.connection.getSigner();
    if (!address || !signer) throw new Error('Not connected to Yellow Network');

    console.log('[YellowService] Creating session with wallet signing required...');

    const asset = params.asset || this.config.defaultAsset!;
    const nonce = Date.now();

    // Create session definition matching Nitrolite SDK format
    const appDefinition = {
      application: params.protocol,
      protocol: RPCProtocolVersion.NitroRPC_0_4,
      participants: [address as `0x${string}`, params.counterparty as `0x${string}`],
      weights: [50, 50],
      quorum: 100,
      challenge: 0,
      nonce,
    };

    // Allocations in SDK format
    const allocations: RPCAppSessionAllocation[] = [
      {
        participant: address as `0x${string}`,
        asset,
        amount: params.allocation.self,
      },
      {
        participant: params.counterparty as `0x${string}`,
        asset,
        amount: params.allocation.counterparty,
      },
    ];

    // Create signed session message using correct SDK signature
    // This REQUIRES wallet approval for signing
    console.log('[YellowService] Requesting wallet signature for session creation...');
    const msg = await createAppSessionMessage(
      signer,
      { definition: appDefinition, allocations },
      this.connection.getNextRequestId(),
      Date.now()
    );

    console.log('[YellowService] Sending session creation to ClearNode...');
    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);
    console.log('[YellowService] Received response:', response.res?.[1]);

    // Check for error
    if (response.res && response.res[1] === 'error') {
      throw new Error(`Session creation failed: ${JSON.stringify(response.res[2])}`);
    }

    // Parse session from response (handle both camelCase and snake_case from SDK)
    const sessionData = response.res && response.res[2]
      ? response.res[2] as { appSessionId?: string; app_session_id?: string; sid?: string }
      : null;

    // Get session ID from response, prioritizing SDK format (appSessionId)
    const sessionId = sessionData?.appSessionId || sessionData?.app_session_id || sessionData?.sid;
    if (!sessionId) {
      throw new Error('No session ID returned from ClearNode');
    }

    const session: AppSession = {
      id: sessionId,
      channelId: '',
      protocol: params.protocol,
      participants: [address, params.counterparty],
      allocations: allocations.map(a => ({
        participant: a.participant,
        asset: a.asset,
        amount: a.amount,
      })) as SessionAllocation[],
      status: 'open',
      nonce,
      createdAt: new Date(),
    };

    this.activeSessions.set(session.id, session);
    return session;
  }

  /**
   * Create a trading session using app sessions directly from Unified Balance.
   *
   * NOTE: Channel lifecycle (create_channel → resize → close) requires on-chain
   * NitroliteClient transactions in addition to WebSocket messages. For now, we
   * skip channels and create app sessions directly, which allocate from Unified
   * Balance without needing on-chain operations. Channel methods are kept as
   * utilities for future server-side API integration.
   */
  async createTradingSession(allowanceAmount: string): Promise<AppSession> {
    const address = this.connection.getAddress();
    if (!address) throw new Error('Not connected');

    const asset = this.getTokenSymbol(this.config.chainId);

    // Get clearnode broker address as counterparty
    const config = await this.getConfig();
    const clearnodeAddress = (config.broker_address as string) ||
                             '0x0000000000000000000000000000000000000001';

    console.log('[YellowService] Creating app session directly from Unified Balance...');
    console.log(`[YellowService] Allowance: ${allowanceAmount} ${asset}, Counterparty: ${clearnodeAddress}`);

    const session = await this.createSession({
      protocol: 'thunderfi-trading-v1',
      counterparty: clearnodeAddress,
      allocation: {
        self: allowanceAmount,
        counterparty: '0',
      },
      asset,
    });

    console.log('[YellowService] Trading session created:', {
      sessionId: session.id,
      allowance: allowanceAmount,
      asset,
    });

    return session;
  }

  /**
   * Send off-chain transfer within a session
   */
  async sendPayment(
    sessionId: string,
    payment: PaymentIntent
  ): Promise<PaymentResult> {
    const signer = this.connection.getSigner();
    if (!signer) throw new Error('Not connected');

    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Create transfer message using correct SDK signature
    const msg = await createTransferMessage(
      signer,
      {
        destination: payment.recipient as `0x${string}`,
        allocations: [{
          asset: payment.asset || this.config.defaultAsset!,
          amount: payment.amount,
        }],
      },
      this.connection.getNextRequestId(),
      Date.now()
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && response.res[1] === 'error') {
      throw new Error(`Transfer failed: ${JSON.stringify(response.res[2])}`);
    }

    const result: PaymentResult = {
      id: `payment-${Date.now()}`,
      sessionId,
      sender: this.connection.getAddress()!,
      recipient: payment.recipient,
      amount: payment.amount,
      asset: payment.asset || this.config.defaultAsset!,
      timestamp: new Date(),
      status: 'confirmed',
    };

    return result;
  }

  /**
   * Execute a trade action within a session (application message)
   */
  async executeTradeAction(
    sessionId: string,
    action: {
      type: 'buy' | 'sell';
      pair: string;
      amount: string;
      price?: string;
    }
  ): Promise<{
    actionId: string;
    status: 'confirmed';
    timestamp: Date;
  }> {
    const signer = this.connection.getSigner();
    if (!signer) throw new Error('Not connected');

    const timestamp = Date.now();

    // Create application message using SDK
    const msg = await createApplicationMessage(
      signer,
      sessionId as `0x${string}`,
      {
        action_type: action.type,
        pair: action.pair,
        amount: action.amount,
        price: action.price,
      },
      this.connection.getNextRequestId(),
      timestamp
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && response.res[1] === 'error') {
      throw new Error(`Trade action failed: ${JSON.stringify(response.res[2])}`);
    }

    return {
      actionId: `action-${timestamp}`,
      status: 'confirmed',
      timestamp: new Date(timestamp),
    };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AppSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AppSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (s) => s.status === 'active' || s.status === 'open'
    );
  }

  /**
   * Fetch sessions from ClearNode
   */
  async fetchSessions(): Promise<AppSession[]> {
    const address = this.connection.getAddress();
    if (!address) throw new Error('Not connected');

    const msg = createGetAppSessionsMessageV2(
      address as `0x${string}`,
      undefined, // status filter
      this.connection.getNextRequestId(),
      Date.now()
    );
    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && Array.isArray(response.res) && response.res[2]) {
      const data = response.res[2] as { sessions?: AppSession[] };
      const sessions = data.sessions || [];

      // Update local cache
      sessions.forEach((s) => this.activeSessions.set(s.id, s));
      return sessions;
    }
    return [];
  }

  /**
   * Close an app session, returning funds to Unified Balance.
   * Channel close is skipped since we create app sessions directly without channels.
   */
  async closeSession(sessionId: string): Promise<{
    finalAllocations: SessionAllocation[];
    settlementTx?: string;
  }> {
    const signer = this.connection.getSigner();
    if (!signer) throw new Error('Not connected');

    const session = this.activeSessions.get(sessionId);

    const allocations: RPCAppSessionAllocation[] = session?.allocations?.map(a => ({
      participant: a.participant as `0x${string}`,
      asset: a.asset,
      amount: a.amount,
    })) || [];

    console.log('[YellowService] Closing app session:', sessionId);
    const msg = await createCloseAppSessionMessage(
      signer,
      {
        app_session_id: sessionId as `0x${string}`,
        allocations,
      },
      this.connection.getNextRequestId(),
      Date.now()
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && response.res[1] === 'error') {
      throw new Error(`Close session failed: ${JSON.stringify(response.res[2])}`);
    }

    this.activeSessions.delete(sessionId);

    return {
      finalAllocations: session?.allocations || [],
      settlementTx: undefined,
    };
  }

  /**
   * Request settlement of pending actions
   */
  async requestSettlement(sessionId: string): Promise<{
    batchId: string;
    actionsCount: number;
    status: 'committed' | 'pending';
    commitTx?: string;
  }> {
    const signer = this.connection.getSigner();
    if (!signer) throw new Error('Not connected');

    const timestamp = Date.now();

    // Use createApplicationMessage for custom app-level messages
    const msg = await createApplicationMessage(
      signer,
      sessionId as `0x${string}`,
      { action: 'request_settlement' },
      this.connection.getNextRequestId(),
      timestamp
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && response.res[1] === 'error') {
      throw new Error(`Settlement request failed: ${JSON.stringify(response.res[2])}`);
    }

    const data = response.res && response.res[2]
      ? response.res[2] as Record<string, unknown>
      : {};

    return {
      batchId: (data.batch_id as string) || `batch-${timestamp}`,
      actionsCount: (data.actions_count as number) || 0,
      status: 'pending',
      commitTx: data.commit_tx as string | undefined,
    };
  }

  /**
   * Get pending actions for a session
   */
  async getPendingActions(sessionId: string): Promise<
    Array<{
      id: string;
      type: string;
      amount: string;
      timestamp: Date;
      status: 'pending' | 'committed' | 'settled';
    }>
  > {
    const signer = this.connection.getSigner();
    if (!signer) throw new Error('Not connected');

    // Use createApplicationMessage for custom app-level queries
    const msg = await createApplicationMessage(
      signer,
      sessionId as `0x${string}`,
      { action: 'get_pending_actions' },
      this.connection.getNextRequestId(),
      Date.now()
    );

    const responseStr = await this.connection.sendMessage(msg);
    const response = JSON.parse(responseStr);

    if (response.res && Array.isArray(response.res) && response.res[2]) {
      const data = response.res[2] as { actions?: Array<{
        id: string;
        type: string;
        amount: string;
        timestamp: string;
        status: 'pending' | 'committed' | 'settled';
      }> };

      return (data.actions || []).map((a) => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
    }
    return [];
  }
}

// Default configuration for different environments
// From: https://docs.yellow.org/docs/build/quick-start
// NOTE: Sandbox supports Polygon Amoy (80002) and Base Sepolia (84532), NOT Ethereum Sepolia
export const YELLOW_CONFIGS: Record<'sandbox' | 'production', YellowConfig> = {
  sandbox: {
    clearNodeUrl: 'wss://clearnet-sandbox.yellow.com/ws', // Sandbox ClearNode (recommended for testing)
    chainId: 84532, // Base Sepolia - supported by sandbox ClearNode
    environment: 'sandbox',
  },
  production: {
    clearNodeUrl: 'wss://clearnet.yellow.com/ws', // Production ClearNode
    chainId: 1, // Mainnet
    environment: 'production',
  },
};

// Singleton instance factory
let serviceInstance: YellowService | null = null;

export function getYellowService(
  environment: 'sandbox' | 'production' = 'sandbox'
): YellowService {
  if (!serviceInstance) {
    serviceInstance = new YellowService({
      ...YELLOW_CONFIGS[environment],
      defaultAsset: 'usdc',
    });
  }
  return serviceInstance;
}

export function resetYellowService(): void {
  if (serviceInstance) {
    serviceInstance.disconnect();
    serviceInstance = null;
  }
}
