# thunderFi — Pitch Video Script
**Runtime: ~3 minutes**

---

## PART 1: THE PROBLEM (0:00 - 0:30)

### Scene 1: Problem Statement
*[Dark screen with text overlay]*

"DeFi trading is broken.

Every swap costs gas. Every transaction leaks information to MEV bots. And moving assets between chains? That's a nightmare of bridges, fees, and failed transactions.

Traders lose over $1.4 billion annually to MEV extraction alone. Gas fees eat into profits. And cross-chain liquidity remains fragmented.

What if there was a better way?"

---

## PART 2: THE SOLUTION (0:30 - 1:00)

### Scene 2: Introducing thunderFi
![Landing Page](landing-page.png)

"Introducing thunderFi.

One deposit. Unlimited gasless trades. Built-in MEV protection. Payouts to any chain.

We've unified three breakthrough technologies into one seamless experience:

**Yellow Network** — State channels that let you trade instantly, off-chain, with zero gas fees.

**Uniswap v4 Privacy Hooks** — Commit-reveal batch auctions that eliminate frontrunning and sandwich attacks.

**Circle Arc** — Your liquidity hub for instant cross-chain USDC transfers via CCTP.

Let me show you how it works."

---

## PART 3: LIVE DEMO (1:00 - 2:30)

### Scene 3: Connect Wallet
![Connect Wallet](clickonconectandcreateand-approve.png)

"Getting started takes seconds.

Click 'Get Started' and connect your wallet. We support MetaMask, WalletConnect, Coinbase Wallet, and more.

One click. You're in."

---

### Scene 4: Dashboard — Create Session
![Create Session](click-create-sessiion.png)

"This is your Dashboard. The system status shows three components: Session, Privacy Auction, and Payout.

Right now, no session exists. Click 'Create Session' to initialize your Yellow Network state channel."

---

### Scene 5: Enter Deposit Amount
![Enter Amount](type-amount&clikc-next.png)

"Enter your USDC deposit amount.

This is your trading balance. Once deposited, you can execute unlimited trades against this balance — completely gasless.

No more paying $5, $10, $50 per transaction. One deposit. Unlimited actions."

---

### Scene 6: Request Testnet Tokens
![Request Tokens](click-request-tokens.png)

"Need testnet USDC? One click gets you tokens from the faucet.

On mainnet, your existing USDC works seamlessly."

---

### Scene 7: Approve & Create
![Session Creation](session-creation.png)

"Review your session and confirm.

Your wallet prompts for approval. This is the only on-chain transaction you'll make.

After this — every trade, every order, every action — happens off-chain. Instant. Free."

---

### Scene 8: Session Active
![Session Created](session-created.png)

"Done.

Your state channel is live. Your balance is locked and ready. The Yellow Network connection is established.

That's it. You're ready to trade."

---

### Scene 9: Full Dashboard
![Dashboard](dashboard.png)

"Welcome to your trading command center.

**Session Balance** — Your available funds.
**Total Actions** — Every gasless trade you've made.
**Gas Saved** — Real dollars kept in your pocket.
**Arc Hub Balance** — Your cross-chain liquidity pool.

From here, you can:
- Trade instantly in Standard Mode
- Enable Privacy Mode for MEV-protected batch auctions
- Settle your positions on-chain whenever you're ready
- Payout to Arbitrum, Base, Optimism, Polygon — any CCTP-supported chain

All from one interface. One deposit. One experience."

---

## PART 4: CLOSING (2:30 - 3:00)

### Scene 10: Value Proposition
![Landing Page](landing-page.png)

"thunderFi eliminates the three biggest problems in DeFi:

**Gas fees?** Gone. Trade unlimited times on a single deposit.

**MEV attacks?** Eliminated. Commit-reveal auctions ensure fair execution.

**Chain fragmentation?** Solved. Arc routes your USDC anywhere instantly.

This is the future of decentralized trading.

Deposit once. Trade instantly. Pay out anywhere.

thunderFi."

---

## END CARD

![End Card](landing-page.png)

```
thunderFi
Gasless. Private. Chain-Abstracted.

GitHub: github.com/thunderfi
Live Demo: thunderfi.app
```

---

## TECHNICAL NOTES

**Deployed Contracts (Sepolia):**
- ThunderBatchAuction: `0x48f50f4166a9f10d13d0119590B71a724B5CE8AA`
- ThunderPrivacyHook: `0xBa4149aCEFddE4eDa3752e03D3785336565260C0`
- PrivacyRouter: `0xbcB1178BDc04fa7aBefb1bd43a750c432F8A299B`

**Integrations:**
- Yellow Network SDK — State channel sessions
- Uniswap v4 — Privacy hooks for batch auctions
- Circle Arc — CCTP cross-chain transfers
