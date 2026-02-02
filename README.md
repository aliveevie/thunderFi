# thunderFi

> Deposit once, trade instantly off-chain with privacy, settle once on-chain across any chain.

## Overview

**thunderFi** is a gasless, privacy-preserving USDC trading and payout platform built for ETHGlobal Hackathon. It combines three powerful technologies:

- **Yellow SDK/Nitrolite** — Instant off-chain sessions with state channels
- **Uniswap v4 Hooks** — Privacy-enhanced batch settlement
- **Arc + Circle** — Chain-abstracted USDC liquidity hub

## Problem

Trading on-chain is expensive and slow:
- Every action requires a transaction
- 30 trades = 30 transactions = $50+ in gas fees
- User experience is terrible

## Solution

thunderFi solves this with a "deposit once, trade many, settle once" model:

1. **Create Session** — Deposit USDC once, get instant trading capability
2. **Trade Instantly** — Execute unlimited actions off-chain (0 gas, 50ms latency)
3. **Settle Privately** — Batch settle via Uniswap v4 with commit-reveal privacy
4. **Payout Anywhere** — Send USDC to any chain through Arc hub

## Features

- **Zero Gas Per Action** — All trades happen off-chain via Yellow state channels
- **Privacy-Enhanced Settlement** — Commit-reveal pattern hides individual timing
- **Chain Abstraction** — Arc routes USDC payouts to any supported chain
- **Real-time UI** — Live action counter, gas saved display, receipt logging

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite, React 18, TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Off-chain | Yellow SDK / Nitrolite |
| Settlement | Uniswap v4 Hooks |
| Cross-chain | Arc, Circle Gateway, Circle Wallets |

## Project Structure

```
thunderfi/
├── client/               # Vite + React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Route pages
│   │   ├── stores/       # Zustand state
│   │   └── types/        # TypeScript types
│   └── ...
├── server/               # Node.js backend (coming soon)
├── contracts/            # Solidity contracts (coming soon)
├── architecture.md       # Technical architecture
└── roadmap-001.md        # Development roadmap
```

## Quick Start

```bash
# Install dependencies
cd client
pnpm install

# Run development server
pnpm dev

# Open http://localhost:5173
```

## Demo Flow

1. **Connect Wallet** — Click "Connect Wallet" on landing page
2. **Create Session** — Set allowance (e.g., $50 USDC)
3. **Deposit** — One-time on-chain deposit
4. **Trade** — Place 20+ orders instantly (watch the counter!)
5. **Settle** — Click "Settle Now" to batch settle
6. **Payout** — Send USDC to recipients on any chain

## Bounties

### Yellow Network ($15,000)
- Deep Yellow SDK integration
- Session-based off-chain transactions
- On-chain settlement demonstration

### Uniswap v4 Privacy DeFi ($5,000)
- ThunderPrivacyHook with commit-reveal
- Batch intent aggregation
- MEV-resistant execution

### Arc/Circle ($10,000)
- Chain-abstracted USDC routing
- Circle Wallets integration
- Multi-recipient payouts via Arc hub

## Architecture

See [architecture.md](./architecture.md) for detailed technical documentation.

## Roadmap

See [roadmap-001.md](./roadmap-001.md) for development milestones.

## Team

Built with ❤️ for ETHGlobal Hackathon

## License

MIT
