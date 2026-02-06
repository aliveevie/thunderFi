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

  THUNDER_PRIVACY_HOOK_ADDRESS: z.string().default('0xBa4149aCEFddE4eDa3752e03D3785336565260C0'),
  THUNDER_BATCH_AUCTION_ADDRESS: z.string().default('0x48f50f4166a9f10d13d0119590B71a724B5CE8AA'),
  PRIVACY_ROUTER_ADDRESS: z.string().default('0xbcB1178BDc04fa7aBefb1bd43a750c432F8A299B'),
  SEPOLIA_RPC_URL: z.string().default('https://ethereum-sepolia-rpc.publicnode.com'),
  UNISWAP_V4_POOL_MANAGER: z.string().default('0xE03A1074c86CFeDd5C142C4F04F1a1536e203543'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
