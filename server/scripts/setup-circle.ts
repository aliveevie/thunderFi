/**
 * Circle Entity Secret Setup Script
 *
 * Generates an entity secret, registers it with Circle,
 * and saves the recovery file. Run once to bootstrap your .env.
 *
 * Usage: npx tsx scripts/setup-circle.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';

const API_KEY = process.env.CIRCLE_API_KEY;

if (!API_KEY) {
  console.error('❌ CIRCLE_API_KEY not set. Export it first:');
  console.error('   export CIRCLE_API_KEY="TEST_API_KEY:..."');
  process.exit(1);
}

async function main() {
  // 1. Generate a random 32-byte entity secret
  const entitySecret = crypto.randomBytes(32).toString('hex');
  console.log('\n🔑 Generated Entity Secret:');
  console.log(`   ${entitySecret}`);
  console.log('\n   ⚠️  Save this! Circle does NOT store it.\n');

  // 2. Register it with Circle and get the recovery file
  console.log('📡 Registering with Circle...');
  try {
    const response = await registerEntitySecretCiphertext({
      apiKey: API_KEY,
      entitySecret,
    });

    // 3. Save recovery file
    const recoveryPath = path.join(__dirname, '..', 'recovery_file.dat');
    fs.writeFileSync(recoveryPath, response.data?.recoveryFile ?? '');
    console.log(`✅ Recovery file saved to: ${recoveryPath}`);
    console.log('   ⚠️  Keep this safe — needed if you lose your entity secret.\n');

    // 4. Print what to put in .env
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Add this to your server/.env file:\n');
    console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (err: any) {
    console.error('❌ Registration failed:', err.message || err);

    // If it fails because entity secret is already registered,
    // the user needs to use their existing one
    if (err.message?.includes('already')) {
      console.log('\n💡 An entity secret is already registered for this API key.');
      console.log('   Use the entity secret you previously generated.');
    }
    process.exit(1);
  }
}

main();
