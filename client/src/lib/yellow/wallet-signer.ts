/**
 * Wallet Signer for Yellow Network
 * Creates EIP-712 compatible signers for browser wallets
 */

import { type Hex, type WalletClient, type Address } from 'viem';
import { EIP712AuthTypes, RPCMethod, type MessageSigner, type RPCData } from '@erc7824/nitrolite';

// EIP-712 Domain type for Yellow Network authentication
// Note: Only 'name' is required per the SDK's EIP712AuthDomain type
// CRITICAL: The domain name MUST match the 'application' parameter in auth_request
// ClearNode verifies signatures using: Domain{ Name: application }
export interface EIP712Domain {
  name: string;
}

// Re-export SDK types for convenience
export type { MessageSigner, RPCData };

/**
 * @deprecated Use MessageSigner from @erc7824/nitrolite directly
 */
export type NitroliteMessageSigner = MessageSigner;

/**
 * Create a message signer that uses EIP-712 for auth_verify
 * and keccak256 hash signing for other methods (compatible with ClearNode)
 *
 * CRITICAL: The 'application' param becomes the EIP-712 domain name.
 * ClearNode verifies: Domain{ Name: application }
 */
export function createWalletMessageSigner(
  walletClient: WalletClient,
  authParams: {
    scope: string;
    sessionKey: Address;
    expiresAt: bigint;
    allowances: Array<{ asset: string; amount: string }>;
    application: string; // CRITICAL: This becomes the EIP-712 domain name
  }
): MessageSigner {
  // Create the EIP-712 domain using the application name
  // This MUST match the 'application' field in auth_request
  const domain: EIP712Domain = { name: authParams.application };

  return async (payload: RPCData): Promise<Hex> => {
    const account = walletClient.account;
    if (!account) {
      throw new Error('Wallet not connected');
    }

    const method = payload[1] as string;
    const params = payload[2] as Record<string, unknown>;

    console.log('[WalletSigner] Signing method:', method, 'params:', params);

    // For auth_verify, use EIP-712 typed data signing
    if (method === RPCMethod.AuthVerify && 'challenge' in params) {
      const challengeMessage = params.challenge as string;
      console.log('[WalletSigner] auth_verify challenge:', challengeMessage);
      console.log('[WalletSigner] Using domain:', domain);

      const message = {
        challenge: challengeMessage,
        scope: authParams.scope,
        wallet: account.address,
        session_key: authParams.sessionKey,
        expires_at: authParams.expiresAt,
        allowances: authParams.allowances,
      };

      console.log('[WalletSigner] EIP-712 message:', JSON.stringify(message, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      ));

      try {
        const signature = await walletClient.signTypedData({
          account,
          domain,
          types: EIP712AuthTypes,
          primaryType: 'Policy',
          message: message as Record<string, unknown>,
        });

        console.log('[WalletSigner] EIP-712 signature obtained');
        return signature;
      } catch (error) {
        console.error('[WalletSigner] EIP-712 signing failed:', error);
        throw new Error(`EIP-712 signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // For other methods (create_app_session, etc.), use personal_sign on the JSON payload directly
    // This matches the quick start example which signs the message string directly
    // DO NOT pre-hash - let personal_sign handle the hashing internally
    const jsonPayload = JSON.stringify(payload, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );

    console.log('[WalletSigner] Signing payload with personal_sign (no pre-hash)');

    try {
      // Sign the JSON payload directly - personal_sign will handle prefixing and hashing
      const signature = await walletClient.signMessage({
        account,
        message: jsonPayload,
      });

      return signature;
    } catch (error) {
      console.error('[WalletSigner] Message signing failed:', error);
      throw new Error(`Message signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
}

/**
 * Create a simple message signer from wagmi's signMessage
 * This is for simpler signing scenarios
 */
export function createSimpleMessageSigner(
  signMessage: (message: string) => Promise<string>
): MessageSigner {
  return async (payload: RPCData): Promise<Hex> => {
    const jsonPayload = JSON.stringify(payload, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );

    const signature = await signMessage(jsonPayload);
    return signature as Hex;
  };
}
