## Summary

Integrate Yellow Network's state channel protocol (`@erc7824/nitrolite` SDK) into ThunderFi's client, enabling off-chain trading sessions powered by real ClearNode WebSocket connections. This replaces the previous mock/stub Yellow integration with a fully functional pipeline: wallet authentication, sandbox faucet funding, ledger balance management, and app session lifecycle — all running on Base Sepolia testnet.

### Key changes

- **ClearNode WebSocket connection** — Full auth handshake with EIP-712 typed data signing, session key generation via `privateKeyToAccount`, and ECDSA message signing for all subsequent SDK calls. Includes request/response tracking with timeouts, heartbeat ping/pong, automatic reconnection with exponential backoff, and dynamic asset discovery from ClearNode.
- **Wallet signer adapter** — Bridges wagmi's `WalletClient` to the nitrolite SDK's `MessageSigner` interface, handling both wallet-level EIP-712 signing (for auth) and session-key-level ECDSA signing (for RPC messages).
- **On-chain deposit service** — ERC-20 approval and deposit to Yellow Network's custody contract via `NitroliteClient`, with token balance queries across wallet, custody, and ledger layers.
- **Yellow service API** — High-level service orchestrating sandbox faucet token requests, ledger balance queries, ClearNode config parsing, app session create/close, off-chain transfers, and channel management utilities.
- **React integration** — `YellowContext` provider with deposit flow, faucet integration, automatic Base Sepolia chain switching, and three-layer balance tracking. Session creation modal redesigned with multi-step UX (configure → fund via faucet → create session).
- **SPA navigation fix** — Replaced `window.location.href` with React Router `useNavigate()` across Session and Dashboard pages; added zustand `persist` middleware to prevent session state loss.
- **Testing infrastructure** — Vitest with jsdom, React Testing Library, and unit tests for ClearNode connection and Yellow service layers.

## Architecture

```
Wallet (MetaMask/WalletConnect)
  │
  ├── EIP-712 sign ──→ ClearNode Auth (auth_request → auth_verify)
  │                         │
  │                         ▼
  │                    Session Key (ECDSA)
  │                         │
  ├── Faucet HTTP ───→ Unified Balance (off-chain ledger)
  │                         │
  │                         ▼
  └── App Session ───→ create_app_session ──→ Off-chain Trading
                            │
                            ▼
                       close_app_session ──→ Funds return to ledger
```

## Commits

| Commit | Description |
|--------|-------------|
| `7e03420` | Scaffold Yellow SDK types, hooks, context provider, and session store integration |
| `2d2861a` | Add vitest with jsdom, React Testing Library, and test setup utilities |
| `34c568c` | Implement wallet signer adapter bridging WalletClient to SDK MessageSigner |
| `55b8c75` | Replace mock ClearNode with real SDK auth flow (challenge → sign → verify) |
| `09928c8` | Add DepositService for ERC-20 approval and custody contract deposits |
| `e5310e0` | Build YellowService with faucet, balances, sessions, transfers, and channels |
| `58b1143` | Switch default network to Base Sepolia (84532) for Yellow sandbox |
| `3534f4a` | Enhance YellowContext with deposit orchestration and chain management |
| `7a2d826` | Redesign session creation modal with faucet flow and live balance display |
| `769e5c7` | Fix session state loss by using SPA navigation and zustand persistence |
| `2f5c51a` | Add unit tests for ClearNode connection and Yellow service |

## Test plan

- [ ] Connect wallet via WalletConnect/MetaMask on Base Sepolia
- [ ] Connect to Yellow Network ClearNode (sandbox) — verify auth handshake completes
- [ ] Request faucet tokens — verify `ytest.usd` balance appears in ledger
- [ ] Create trading session with allowance — verify app session ID returned
- [ ] Navigate between Dashboard/Trade/Session pages — verify session persists
- [ ] Close session — verify funds return to Unified Balance
- [ ] Run `pnpm test:run` — verify unit tests pass
- [ ] Run `pnpm build` — verify production build succeeds with no type errors
