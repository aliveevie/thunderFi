import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a random hex string
 */
export function generateHex(bytes: number = 32): string {
  return '0x' + crypto.randomBytes(bytes).toString('hex');
}

/**
 * Simulate async operation with delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format bigint to string with decimals
 */
export function formatUnits(value: bigint | string, decimals: number = 6): string {
  const str = value.toString();
  if (decimals === 0) return str;

  const padded = str.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, -decimals) || '0';
  const decPart = padded.slice(-decimals);

  return `${intPart}.${decPart}`;
}

/**
 * Parse string to bigint with decimals
 */
export function parseUnits(value: string, decimals: number = 6): bigint {
  const [intPart, decPart = ''] = value.split('.');
  const paddedDec = decPart.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(intPart + paddedDec);
}

/**
 * Calculate hash of data
 */
export function hashData(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return '0x' + crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
