import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  REDIS_URL: z.string().optional(),

  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),

  YELLOW_NODE_URL: z.string().optional(),
  YELLOW_API_KEY: z.string().optional(),

  CIRCLE_API_KEY: z.string().optional(),
  CIRCLE_ENTITY_SECRET: z.string().optional(),
  CIRCLE_WALLET_SET_ID: z.string().optional(),

  ARC_RPC_URL: z.string().optional().default('https://rpc.testnet.arc.network'),
  OPERATOR_PRIVATE_KEY: z.string().optional(),

  THUNDER_PRIVACY_HOOK_ADDRESS: z.string().optional(),
  THUNDER_BATCH_AUCTION_ADDRESS: z.string().default('0x7020cEACF748d9163c39A097a7BF63ea02F8CE75'),
  SEPOLIA_RPC_URL: z.string().default('https://ethereum-sepolia-rpc.publicnode.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
