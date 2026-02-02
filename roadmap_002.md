# thunderFi — Roadmap to 1st place (Yellow SDK + Uniswap v4 Privacy + Arc/Circle)

## North Star (what judges should feel in 90 seconds)
**Deposit once → act instantly many times (off-chain) → settle once (on-chain)**, with:
- **Yellow SDK/Nitrolite** powering *session-based, gasless, instant* USDC actions.
- **Uniswap v4** providing a *privacy-aware, verifiable* settlement design (with TxIDs + tests).
- **Arc + Circle tools** making USDC movement *chain-abstracted* with Arc as the *liquidity + settlement hub*.

---

## Track strategy (how you actually win all 3)
### 1) Yellow Network Prize (primary win condition)
You win this by showing **depth**:
- **Session**: create session keys, set allowance/spend limit, show session identity on screen.
- **Off-chain actions**: do *many* real user actions (not just one transfer).
- **Settlement**: close/settle session via smart contract calls; show final balances + tx links.
- **UX contrast**: explicitly show why on-chain per-action is impossible (speed + gas).

### 2) Uniswap v4 Privacy DeFi (differentiator + credibility)
You win this by showing **functional, verifiable code** with a privacy posture that is:
- **Responsible**: reduce *unnecessary information exposure*; avoid “full privacy” claims.
- **On-chain verifiable**: deterministic rules + tests; clean threat model explanation.
- **Evidenced**: provide **TxIDs** + scripts + README steps to reproduce.

### 3) Arc bounty (requires completeness + polish)
You win this by satisfying requirements *exactly*:
- **Required tools**: Arc + Circle Gateway + USDC + Circle Wallets (and Bridge Kit only if you target that track).
- **Functional MVP**: working frontend + backend + **architecture diagram**.
- **Product feedback**: clear, actionable feedback about Circle tooling (judges explicitly weigh it).

---

## Product: the MVP that best fits all judging criteria
### The “2–3 minute demo” user flow (must be rock-solid)
1. **Create Yellow session** (show spend cap + session id)
2. **Deposit once** (on-chain tx)
3. **Instant loop** (10–30 actions off-chain, no gas, no confirmation):
   - Place intent trades (or “swap intents”)
   - Modify/cancel intents
   - Micro-fee per action (pay-per-use) + live balance decrement
4. **Checkpoint settle**:
   - Batch net outcome to **Uniswap v4** (one/few txs)
   - Route resulting USDC via **Arc** (liquidity hub) to payouts/treasury
5. **End session**:
   - Close channel → on-chain settlement complete
   - Withdraw or keep for next session

### Scope guardrails (to prevent losing the hackathon)
Ship:
- One core asset flow: **USDC** (plus a single counterpart token if needed)
- One privacy mechanism (do it well)
- 1–2 networks max + Arc as the hub (do not add “every chain”)

Defer:
- Advanced charts, multi-pair orderbooks, liquidation/risk, complex multi-oracle systems

---

## Architecture (what to build)
### Components
- **Frontend (web app)**:
  - Session creation / allowance UI
  - “Instant actions” UI + action counter + receipts panel
  - “Settle now” + “End session” flows with tx links
- **Backend / coordinator**:
  - Yellow session orchestration + off-chain state updates
  - Intent aggregation + batching logic for settlement
  - Deterministic “receipt” generation (hashes, batch id, timestamps)
- **Yellow SDK / Nitrolite**:
  - Channel open (deposit)
  - Off-chain state updates for each action
  - Channel close (final settlement)
- **Uniswap v4 contracts**:
  - Minimal v4 setup (template-based)
  - Privacy mechanism implementation + tests
- **Arc + Circle tools**:
  - Circle Wallets for keys/accounts (make the demo flow explicit)
  - Circle Gateway for chain-abstracted USDC movement
  - Arc as settlement hub (treasury + payout routing + accounting)

### “Judge-proof” observability (non-negotiable)
Add a simple “Receipts” panel showing:
- session id
- number of off-chain actions
- starting + ending balances
- batch id / commitment hash (if used)
- settlement tx links (Yellow close, Uniswap v4, Arc routing)

---

## Uniswap v4 Privacy mechanism (choose ONE; implement cleanly)
### Recommended: Batch intents + commit/reveal receipts (easy to explain, easy to verify)
**Idea**: collect user intents during the Yellow session; at checkpoint:
- commit a batch hash (optional) and then settle a netted set of swaps
- publish a deterministic “batch receipt” in README and/or emitted events

**Privacy benefit (responsible framing)**:
- reduces per-action onchain footprint and timing leakage
- reduces unnecessary exposure of user behavior (fewer distinct txs/events)

**Integrity**:
- explicit invariants + replayable test suite
- clear failure paths (e.g., late reveal window → fallback)

Alternative (only if faster for you): pure commit–reveal for key parameters (amount/limit) with a strict reveal window + explicit revert behavior.

---

## Arc track selection (pick one and optimize everything for it)
### Recommended track: Best Chain Abstracted USDC Apps Using Arc as a Liquidity Hub
Deliverables that match the prompt:
- Arc shown as the **hub** where USDC is sourced/settled before routing elsewhere
- UX is chain-abstracted (“Send payout”, not “Bridge to chain X”)
- 2-recipient payout demo (multi-recipient looks strong and is easy to judge)

Required tools checklist (must be visible in README + code):
- Arc
- Circle Gateway
- USDC
- Circle Wallets

Also required:
- Working frontend + backend
- Architecture diagram
- “Product feedback” section (specific + actionable)

---

## Time-boxed build plan (optimize for “working demo early”)
### Milestone 0 (1–2 hours): Repo + demo skeleton
- Create repo layout + env templates
- Add a “Demo Path” script/checklist (the exact clicks you will record)
- Add a “Receipts” UI panel placeholder (even before plumbing)

### Milestone 1 (Day 0–1): Yellow session + deposit (proof-of-life)
- Connect to Nitrolite test env
- Create wallet session; display session id + allowance UI
- Implement deposit once (channel open) end-to-end
- Show balances (even if raw)

Definition of done:
- You can record: “connect → create session → deposit → balance visible”.

### Milestone 2 (Day 1–2): Instant off-chain actions (the “wow”)
Implement 2–3 actions that update off-chain state:
- Action A: place intent
- Action B: cancel/modify intent
- Action C: micro-fee / pay-per-action (deduct USDC per click)

Add:
- action counter (10–30 actions quickly)
- receipts log (per action + running balance)

Definition of done:
- 10 actions in <15 seconds, visibly instant, no on-chain tx spam.

### Milestone 3 (Day 2–3): Settlement + end session (make it real)
- Add “Settle now” (checkpoint) and “End session” flows
- Close/settle via smart contract calls
- Display tx links + final balances

Definition of done:
- 1–2 txs transform “many off-chain actions” into on-chain finality.

### Milestone 4 (Day 3–4): Uniswap v4 Privacy DeFi implementation
- Fork/use v4 template; deploy contracts
- Implement chosen privacy mechanism (batch intent receipt)
- Add tests + a script that outputs TxIDs
- Add README threat model (“what is private / what isn’t”)

Definition of done:
- Anyone can run tests; you have TxIDs to paste into submission.

### Milestone 5 (Day 4–5): Arc + Circle Gateway + Wallets integration
- Integrate Circle Wallets (make the custody/key story explicit)
- Use Circle Gateway to route USDC into Arc as hub
- Implement payouts (2 recipients) from Arc routing outcome
- Add architecture diagram + product feedback section

Definition of done:
- Demo shows chain abstraction + Arc hub narrative + required tools.

### Final 12–24 hours: polish for judges, not new features
- Add error states + retries + “demo mode” defaults
- Reduce demo friction (pre-filled addresses, faucet guidance)
- Re-record the demo video cleanly (2–3 min)
- Freeze changes early; only fix reliability issues

---

## Demo video script (2–3 minutes, no dead time)
1. “Why” (10s): on-chain per-action is unusable; state channels fix it.
2. Create session + set allowance (20s)
3. Deposit once (show tx link) (20s)
4. Rapid-fire 10–30 instant actions + receipts updating (40s)
5. Settle now → Uniswap v4 checkpoint + explain privacy mechanism in one sentence (30s)
6. Arc hub routing → 2 payouts sent with chain-abstracted UX (30s)
7. End session + final balances (20s)

---

## Submission package checklist (copy/paste into README)
### Yellow Network
- [ ] Yellow SDK/Nitrolite session created in app
- [ ] Off-chain logic: multiple actions update balances instantly
- [ ] On-chain settlement: close/settle produces final balances
- [ ] Demo video (2–3 min) shows the above clearly

### Uniswap v4 Privacy DeFi
- [ ] Functional code + tests
- [ ] TxIDs included (testnet and/or mainnet)
- [ ] README explains mechanism + threat model + invariants

### Arc / Circle tools
- [ ] Uses Arc + Circle Gateway + USDC + Circle Wallets
- [ ] Working frontend + backend
- [ ] Architecture diagram included
- [ ] Product feedback section included (specific + actionable)

---

## Risk controls (how to avoid “almost works”)
- **Integration flakiness**: implement a deterministic “Demo Mode” path and verbose receipts logs.
- **Privacy over-claims**: phrase as “reduces onchain footprint/timing leakage” and document limitations.
- **Scope creep**: after Milestone 4, freeze features; only reliability + docs + demo.

---

## Definition of Done (top-spot bar)
- Yellow: session + many off-chain actions + on-chain settlement is undeniable on video.
- Uniswap v4: privacy mechanism is implemented, tested, and proven with TxIDs.
- Arc: required Circle tools are used, with a working MVP + diagram + product feedback.
