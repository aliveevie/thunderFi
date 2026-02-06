/**
 * Database stub — Prisma/PostgreSQL replaced with in-memory store.
 * This file kept for compatibility; all data now lives in store.ts.
 */

export async function connectDatabase(): Promise<void> {
  console.log('Using in-memory store (no database)');
}

export async function disconnectDatabase(): Promise<void> {
  // no-op
}
