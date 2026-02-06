<p align="center">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Solidity-0.8.26-363636?logo=solidity&logoColor=white" alt="Solidity" />
  <img src="https://img.shields.io/badge/Uniswap-v4-FF007A?logo=uniswap&logoColor=white" alt="Uniswap v4" />
</p>

<h1 align="center">thunderFi</h1>

<p align="center">
  <strong>Deposit once. Trade unlimited. Pay out anywhere.</strong>
</p>

<p align="center">
  A gasless, MEV-protected USDC trading layer with cross-chain payouts.
</p>

<p align="center">
  <a href="https://thunderfi.ibxlab.com">Live Demo</a> •
  <a href="https://youtu.be/EsbzduTGiMs">Video Demo</a> •
  <a href="#integrations">Integrations</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## Overview

**thunderFi** combines three technologies to solve DeFi's biggest UX problems:

| Problem | Solution | Technology |
|---------|----------|------------|
| Gas fees on every trade | Off-chain state channels | Yellow Network |
| MEV extraction & frontrunning | Commit-reveal batch auctions | Uniswap v4 Hooks |
| Cross-chain complexity | Chain-abstracted USDC transfers | Circle Arc |

Users deposit once, trade unlimited times without gas, and withdraw to any chain.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              thunderFi                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. CREATE SESSION          2. TRADE              3. PAYOUT            │
│   ┌─────────────────┐       ┌─────────────────┐   ┌─────────────────┐   │
│   │  Deposit USDC   │       │  Standard Mode  │   │  Select Chain   │   │
│   │  (one-time gas) │  ──►  │  (gasless)      │   │  Arbitrum       │   │
│   │                 │       │                 │   │  Base           │   │
│   │  Yellow Network │       │  Privacy Mode   │   │  Optimism       │   │
│   │  State Channel  │       │  (MEV-protected)│   │  Polygon        │   │
│   └─────────────────┘       └─────────────────┘   └─────────────────┘   │
│          │                         │                      │             │
│          ▼                         ▼                      ▼             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     Backend Hub (Node.js)                        │   │
│   │  • Yellow SDK session management                                 │   │
│   │  • Privacy auction coordination                                  │   │
│   │  • Circle Arc wallet management                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│          ┌─────────────────────────┼─────────────────────────┐          │
│          ▼                         ▼                         ▼          │
│   ┌─────────────┐         ┌─────────────────┐       ┌─────────────┐     │
│   │   Yellow    │         │   Uniswap v4    │       │  Circle Arc │     │
│   │  Nitrolite  │         │  Privacy Hook   │       │    CCTP     │     │
│   │  Channels   │         │  Batch Auction  │       │   Bridge    │     │
│   └─────────────┘         └─────────────────┘       └─────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Integrations

### Yellow Network

State channels for gasless off-chain trading sessions.

**Implementation:**
- Nitrolite SDK integration for session creation and management
- Off-chain state updates signed between user and hub
- On-chain settlement only when closing session

**PR:** [#2 — Yellow SDK Integration](https://github.com/aliveevie/thunderFi/pull/2)

---

### Uniswap v4 Privacy Hooks

Custom hook implementing commit-reveal batch auctions for MEV protection.

**Contracts Deployed (Sepolia):**
| Contract | Address |
|----------|---------|
| ThunderBatchAuction | [`0x3F2C0a59A4721f949EB689D0b32A42f0B0f35794`](https://sepolia.etherscan.io/address/0x3F2C0a59A4721f949EB689D0b32A42f0B0f35794) |
| ThunderPrivacyHook | [`0x0f9E2883cd11D10DE50d48c4E77379ae9b4e7D88`](https://sepolia.etherscan.io/address/0x0f9E2883cd11D10DE50d48c4E77379ae9b4e7D88) |
| PrivacyRouter | [`0xEC4ea50D14d470dCc6D64F9d99f9C0C06DeFf82F`](https://sepolia.etherscan.io/address/0xEC4ea50D14d470dCc6D64F9d99f9C0C06DeFf82F) |

**How it works:**
1. Orders submitted as cryptographic commitments (hidden price/amount)
2. Commit period ends, reveal period begins
3. All orders revealed simultaneously
4. Uniform clearing price calculated, orders settled in batch

**PR:** [#1 — Uniswap v4 Integration](https://github.com/aliveevie/thunderFi/pull/1)

---

### Circle Arc

Chain-abstracted USDC payouts via CCTP (Cross-Chain Transfer Protocol).

**Implementation:**
- Developer-controlled wallets for hub management
- CCTP integration for cross-chain transfers
- Supported destinations: Arbitrum, Base, Optimism, Polygon

**PR:** [#3 — Circle Arc Integration](https://github.com/aliveevie/thunderFi/pull/3)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, Framer Motion |
| State | Zustand |
| Wallet | wagmi, viem, RainbowKit |
| Backend | Node.js, Express, Socket.IO |
| Off-chain | Yellow SDK / Nitrolite |
| Smart Contracts | Solidity 0.8.26, Foundry |
| Settlement | Uniswap v4 Hooks |
| Cross-chain | Circle Arc, CCTP |

---

## Project Structure

```
thunderFi/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages (Landing, Dashboard, Trade, Payout)
│   │   ├── stores/         # Zustand state management
│   │   ├── hooks/          # Custom hooks (usePrivacyAuction, useWallet)
│   │   └── services/       # API and contract services
│   └── ...
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── services/       # Yellow, Circle, Privacy services
│   │   ├── routes/         # API endpoints
│   │   └── index.ts        # Express server
│   └── ...
├── contracts/              # Solidity smart contracts
│   ├── src/
│   │   ├── ThunderBatchAuction.sol
│   │   ├── ThunderPrivacyHook.sol
│   │   └── PrivacyRouter.sol
│   └── ...
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask or compatible wallet

### Installation

```bash
# Clone repository
git clone https://github.com/aliveevie/thunderFi.git
cd thunderFi

# Install client dependencies
cd client
pnpm install
pnpm dev

# Install server dependencies (separate terminal)
cd ../server
pnpm install
pnpm dev
```

### Environment Variables

**Client** (`client/.env`):
```
VITE_API_URL=http://localhost:3001
VITE_ALCHEMY_API_KEY=your_key
```

**Server** (`server/.env`):
```
CIRCLE_API_KEY=your_key
CIRCLE_ENTITY_SECRET=your_secret
YELLOW_HUB_PRIVATE_KEY=your_key
```

---

## Demo

<table>
  <tr>
    <td align="center"><strong>Live Application</strong></td>
    <td align="center"><strong>Video Walkthrough</strong></td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://thunderfi.ibxlab.com">
        <img src="https://img.shields.io/badge/thunderfi.ibxlab.com-Visit-blue?style=for-the-badge" alt="Live Demo" />
      </a>
    </td>
    <td align="center">
      <a href="https://youtu.be/EsbzduTGiMs">
        <img src="https://img.shields.io/badge/YouTube-Watch-red?style=for-the-badge&logo=youtube" alt="Video Demo" />
      </a>
    </td>
  </tr>
</table>

### Demo Flow

1. **Connect Wallet** — MetaMask on Sepolia testnet
2. **Create Session** — Initialize Yellow state channel with USDC allowance
3. **Request Tokens** — Use testnet faucet for WETH/USDC
4. **Trade (Standard)** — Execute gasless swaps via state channel
5. **Trade (Privacy)** — Submit commit-reveal orders for MEV protection
6. **Payout** — Send USDC to any supported chain via Circle Arc

---

## Architecture

For detailed technical documentation, see [architecture.md](./architecture.md).

---

## Integration Feedback

Developer experience notes for each integration:

- [Yellow Network Feedback](./yellow-feedback.md)
- [Circle Arc Feedback](./circle-feedback.md)
- [Uniswap v4 Feedback](./uniswap-feedback.md)

---

## License

MIT
