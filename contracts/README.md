# Thunder Privacy DeFi - Uniswap v4 Privacy Hooks

Privacy-preserving trading infrastructure built on Uniswap v4 hooks. This project implements commit-reveal batch auctions, MEV protection, and fair price discovery for decentralized markets.

## Bounty Submission: Uniswap v4 Privacy DeFi ($5,000)

### Deployed Contracts (Sepolia Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| ThunderBatchAuction | `0x7020cEACF748d9163c39A097a7BF63ea02F8CE75` | [View on Etherscan](https://sepolia.etherscan.io/address/0x7020cEACF748d9163c39A097a7BF63ea02F8CE75) |

### Transaction IDs

- **ThunderBatchAuction Deployment**: [`0xcb0253c189457185a548e2619128a7f6375865e6f3f16e832f9a130cf4bc626b`](https://sepolia.etherscan.io/tx/0xcb0253c189457185a548e2619128a7f6375865e6f3f16e832f9a130cf4bc626b)

## Overview

Thunder Privacy DeFi introduces privacy-enhancing mechanisms for decentralized trading:

### Problem Statement

Current DEX trading suffers from:
- **MEV Extraction**: Front-running, sandwich attacks, and JIT liquidity
- **Information Leakage**: Trade details visible before execution
- **Adverse Selection**: LPs lose to informed traders
- **Unfair Execution**: Speed advantages determine outcomes

### Our Solution

We implement three complementary privacy mechanisms:

## 1. ThunderPrivacyHook (Uniswap v4 Hook)

A commit-reveal pattern hook that batches swaps for privacy:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   COMMIT    │ ──▶ │   REVEAL    │ ──▶ │   SETTLE    │ ──▶ │  COMPLETE   │
│  (60 sec)   │     │  (60 sec)   │     │  (60 sec)   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                    │                   │
     ▼                    ▼                   ▼
  Hash only           Reveal swap         Execute all
  (hidden)            details             atomically
```

**Privacy Features:**
- **Commit-Reveal**: Swap details hidden until reveal phase
- **Batch Aggregation**: Individual trades merged into batch
- **Nullifiers**: Prevent double-spending without linking transactions
- **Minimum Batch Size**: Ensures adequate anonymity set (3+ participants)
- **Stealth Addresses**: Optional recipient privacy
- **Fair Ordering**: Randomized execution order within batches

**MEV Protection:**
- Pre-commit prevents front-running (details unknown)
- Batch execution prevents sandwich attacks (atomic)
- Time-delayed settlement prevents JIT liquidity attacks

### Hook Integration

```solidity
// Hook permissions
beforeInitialize: true   // Store pool key, create first batch
beforeSwap: true         // Validate authorized batch swaps
afterSwap: true          // Record execution, update aggregates
```

## 2. ThunderBatchAuction

Frequent batch auction for fair price discovery:

```
┌───────────────────────────────────────────────────────────────┐
│                    BATCH AUCTION FLOW                         │
├───────────────────────────────────────────────────────────────┤
│  Collection Phase    │  Reveal Phase    │  Settlement Phase   │
│  (orders submitted)  │  (orders shown)  │  (uniform clearing) │
└───────────────────────────────────────────────────────────────┘
```

**Features:**
- **Uniform Clearing Price**: All orders in a batch execute at same price
- **Blind Ordering**: Order details hidden until batch clears
- **Time-Priority Immunity**: No advantage to being first
- **Pro-Rata Fills**: Fair allocation when oversubscribed

## 3. PrivacyRouter

User-friendly interface for privacy swaps:

```solidity
// Simple 4-step flow
1. router.preparePrivateSwap(batchId, tokenIn, tokenOut, amount, maxSlippage)
2. router.commitPrivateSwap()    // During commit phase
3. router.revealPrivateSwap()    // During reveal phase
4. router.executePrivateSwap()   // During settle phase
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PrivacyRouter                                │
│  • Commitment generation    • Token handling                     │
│  • Nullifier management     • Batch coordination                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   ThunderPrivacyHook    │     │   ThunderBatchAuction   │
│   (Uniswap v4 Hook)     │     │   (Standalone Auction)  │
│                         │     │                         │
│   • Commit-reveal       │     │   • Uniform price       │
│   • Batch execution     │     │   • Fair ordering       │
│   • MEV protection      │     │   • Pro-rata fills      │
└─────────────────────────┘     └─────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Uniswap v4 PoolManager                        │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Clone repository
git clone https://github.com/aliveevie/thunderFi
cd thunderFi/contracts

# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test
```

## Testing

```bash
# Run all tests (32 tests)
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test test_FullPrivateSwapFlow

# Gas report
forge test --gas-report
```

### Test Coverage

32 comprehensive tests covering:
- Commit-reveal flow
- Nullifier uniqueness
- Batch phase transitions
- Privacy metrics (anonymity set)
- Emergency controls
- Event emissions
- Edge cases and error conditions

## Deployment

### Prerequisites

Create `.env` file:

```bash
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
POOL_MANAGER=0xE03A1074c86CFeDd5C142C4F04F1a1536e203543
```

### Deploy

```bash
# Source environment
source .env

# Deploy ThunderBatchAuction (simple)
forge script script/DeployThunderHook.s.sol:DeployTestnet \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast

# Deploy full suite with CREATE2 (for hook address validation)
forge script script/DeployThunderHook.s.sol:DeployThunderHook \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast
```

## Security Considerations

### Privacy Guarantees

1. **Minimum Batch Size**: Batches require 3+ participants for privacy
2. **Nullifier Uniqueness**: Each commitment uses a unique nullifier
3. **Commitment Binding**: Cannot change swap after commit
4. **Time-Bounded Phases**: Strict deadlines prevent manipulation

### Limitations

1. **Timing Analysis**: Batch boundaries still visible
2. **Amount Ranges**: Large trades may be identifiable
3. **Participation Tracking**: Addresses participating are public
4. **Network Layer**: IP addresses not protected (use Tor/VPN)

### Emergency Controls

- `emergencyPause()`: Operator can pause all operations
- `transferOperator()`: Transfer admin rights
- `withdrawFees()`: Collect accumulated fees

## Gas Costs

| Operation | Gas Cost |
|-----------|----------|
| commitSwap | ~125,000 |
| revealSwap | ~260,000 |
| settleBatch | ~175,000 |
| Full flow (3 users) | ~670,000 |

## Future Improvements

1. **ZK Proofs**: Replace commit-reveal with zero-knowledge proofs
2. **Threshold Encryption**: Encrypt orders until batch threshold met
3. **MEV Auctions**: Redirect extracted value to LPs/users
4. **Cross-Chain Privacy**: Private bridging between chains
5. **Reputation System**: Track honest/dishonest participants

## License

MIT License

## Links

- **GitHub Repository**: https://github.com/aliveevie/thunderFi
- **Uniswap v4 Docs**: https://docs.uniswap.org/contracts/v4/overview

## Team

Built for HackMoney 2026 - Uniswap v4 Privacy DeFi Bounty
