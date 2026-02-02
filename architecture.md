# thunderFi — Technical Architecture

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER LAYER                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                      Web Application (Vite + React 18)                       │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │  │  Connect &   │  │   Trading    │  │  Settlement  │  │   Payouts    │     │    │
│  │  │   Session    │  │   Console    │  │    Panel     │  │   Manager    │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ REST/WebSocket (port 3001)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  APPLICATION LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         Backend Services (Node.js)                           │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │    │
│  │  │  Session Service │  │  Trading Engine  │  │ Settlement Service│           │    │
│  │  │  (Yellow SDK)    │  │  (Intent Mgmt)   │  │  (Batch Builder)  │           │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘           │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │    │
│  │  │  Payout Service  │  │  Receipt Service │  │   Auth Service   │           │    │
│  │  │  (Arc/Circle)    │  │  (Event Log)     │  │  (Circle Wallets)│           │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘           │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                │                         │                         │
                │                         │                         │
                ▼                         ▼                         ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────────────┐
│    YELLOW NETWORK     │  │     UNISWAP V4        │  │       ARC + CIRCLE            │
│  ┌─────────────────┐  │  │  ┌─────────────────┐  │  │  ┌─────────────────────────┐  │
│  │  Nitrolite Node │  │  │  │  PoolManager    │  │  │  │     Arc Network         │  │
│  │  (State Channel)│  │  │  │  (v4 Core)      │  │  │  │  (Settlement Hub)       │  │
│  └─────────────────┘  │  │  └─────────────────┘  │  │  └─────────────────────────┘  │
│  ┌─────────────────┐  │  │  ┌─────────────────┐  │  │  ┌─────────────────────────┐  │
│  │  Safe Contract  │  │  │  │ ThunderPrivacy  │  │  │  │    Circle Gateway       │  │
│  │  (Fund Custody) │  │  │  │     Hook        │  │  │  │  (Cross-Chain Router)   │  │
│  └─────────────────┘  │  │  └─────────────────┘  │  │  └─────────────────────────┘  │
└───────────────────────┘  └───────────────────────┘  │  ┌─────────────────────────┐  │
                                                      │  │    Circle Wallets       │  │
                                                      │  │  (Auth + Key Mgmt)      │  │
                                                      │  └─────────────────────────┘  │
                                                      └───────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Vite 5, React 18, TypeScript | SPA (fast HMR) |
| Styling | Tailwind CSS, shadcn/ui | UI components |
| State | Zustand, TanStack Query | Client state management |
| Backend | Node.js, Express, TypeScript | API services |
| Database | PostgreSQL, Redis | Persistence & caching |
| Blockchain | ethers.js v6, viem | Chain interactions |
| Smart Contracts | Solidity 0.8.26, Foundry | On-chain logic |

---

## 2. Component Architecture

### 2.1 Frontend Architecture (Vite + React)

```
client/
├── index.html                    # Entry HTML
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS config
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx                 # React entry point
    ├── App.tsx                  # Root component + Router
    ├── vite-env.d.ts
    ├── index.css                # Global styles + Tailwind
    │
    ├── pages/                   # Route pages
    │   ├── Landing.tsx          # Landing page
    │   ├── Dashboard.tsx        # Main dashboard layout
    │   ├── Session.tsx          # Session management
    │   ├── Trade.tsx            # Trading interface
    │   ├── Settle.tsx           # Settlement panel
    │   └── Payouts.tsx          # Payout management
    │
    ├── components/
    │   ├── ui/                  # shadcn/ui components
    │   │   ├── Button.tsx
    │   │   ├── Card.tsx
    │   │   ├── Input.tsx
    │   │   ├── Modal.tsx
    │   │   └── ...
    │   ├── layout/
    │   │   ├── Header.tsx
    │   │   ├── Sidebar.tsx
    │   │   └── Layout.tsx
    │   ├── session/
    │   │   ├── CreateSessionModal.tsx
    │   │   ├── SessionStatus.tsx
    │   │   └── AllowanceDisplay.tsx
    │   ├── trading/
    │   │   ├── OrderForm.tsx
    │   │   ├── OrderBook.tsx
    │   │   ├── ActionCounter.tsx
    │   │   └── GasSavedDisplay.tsx
    │   ├── settlement/
    │   │   ├── SettleButton.tsx
    │   │   ├── BatchPreview.tsx
    │   │   └── TxLinkDisplay.tsx
    │   └── payouts/
    │       ├── PayoutForm.tsx
    │       ├── RecipientList.tsx
    │       └── ChainSelector.tsx
    │
    ├── hooks/
    │   ├── useSession.ts        # Yellow session management
    │   ├── useActions.ts        # Off-chain action handling
    │   ├── useSettlement.ts     # Settlement logic
    │   ├── usePayouts.ts        # Arc/Circle payouts
    │   └── useWebSocket.ts      # WebSocket connection
    │
    ├── services/                # API client layer
    │   ├── api.ts               # Axios/fetch instance
    │   ├── sessionApi.ts        # Session endpoints
    │   ├── actionApi.ts         # Action endpoints
    │   ├── settlementApi.ts     # Settlement endpoints
    │   └── payoutApi.ts         # Payout endpoints
    │
    ├── stores/                  # Zustand stores
    │   ├── sessionStore.ts      # Session state
    │   ├── actionsStore.ts      # Actions & receipts
    │   ├── walletStore.ts       # Wallet connection
    │   └── settingsStore.ts     # User preferences
    │
    ├── lib/
    │   ├── utils.ts             # Utility functions
    │   ├── constants.ts         # App constants
    │   └── contracts/
    │       ├── addresses.ts     # Contract addresses
    │       └── abis/            # Contract ABIs
    │
    └── types/
        └── index.ts             # Shared types
```

### 2.2 Backend Architecture (Node.js + Express)

```
server/
├── package.json
├── tsconfig.json
├── nodemon.json                 # Dev hot reload
├── prisma/
│   └── schema.prisma            # Database schema
└── src/
    ├── index.ts                 # Entry point (Express + WS)
    ├── app.ts                   # Express app setup
    │
    ├── config/
    │   ├── env.ts               # Environment config
    │   ├── database.ts          # Prisma client
    │   ├── redis.ts             # Redis client
    │   ├── chains.ts            # Chain configurations
    │   └── contracts.ts         # Contract addresses
    │
    ├── routes/
    │   ├── index.ts             # Route aggregator
    │   ├── session.routes.ts    # /api/v1/sessions
    │   ├── action.routes.ts     # /api/v1/sessions/:id/actions
    │   ├── settlement.routes.ts # /api/v1/sessions/:id/settlement
    │   └── payout.routes.ts     # /api/v1/sessions/:id/payouts
    │
    ├── controllers/
    │   ├── SessionController.ts
    │   ├── ActionController.ts
    │   ├── SettlementController.ts
    │   └── PayoutController.ts
    │
    ├── services/
    │   ├── session/
    │   │   ├── SessionService.ts
    │   │   └── SessionRepository.ts
    │   ├── yellow/
    │   │   ├── YellowClient.ts      # Yellow SDK wrapper
    │   │   └── StateManager.ts      # Off-chain state
    │   ├── trading/
    │   │   ├── TradingEngine.ts
    │   │   ├── IntentManager.ts
    │   │   └── OrderMatcher.ts
    │   ├── settlement/
    │   │   ├── SettlementService.ts
    │   │   ├── BatchBuilder.ts
    │   │   └── PrivacyHookClient.ts
    │   ├── circle/
    │   │   ├── WalletService.ts     # Circle Wallets
    │   │   ├── GatewayClient.ts     # Circle Gateway
    │   │   └── ArcSettlement.ts     # Arc hub
    │   └── receipt/
    │       ├── ReceiptService.ts
    │       └── EventLogger.ts
    │
    ├── middleware/
    │   ├── auth.ts              # Circle Wallet auth
    │   ├── cors.ts              # CORS config
    │   ├── rateLimit.ts         # Rate limiting
    │   ├── validate.ts          # Request validation
    │   └── errorHandler.ts      # Error handling
    │
    ├── websocket/
    │   ├── index.ts             # WS server setup
    │   ├── handler.ts           # Connection handler
    │   ├── events.ts            # Event definitions
    │   └── rooms.ts             # Session rooms
    │
    ├── jobs/                    # Background jobs
    │   ├── settlementWorker.ts  # Process settlements
    │   └── payoutWorker.ts      # Process payouts
    │
    ├── utils/
    │   ├── crypto.ts            # Signing utilities
    │   ├── validation.ts        # Zod schemas
    │   └── logger.ts            # Winston logger
    │
    └── types/
        ├── express.d.ts         # Express type extensions
        └── index.ts             # Shared types
```

---

## 3. Data Models

### 3.1 Core Entities

```typescript
// Session Model
interface Session {
  id: string;                    // UUID
  yellowSessionId: string;       // Yellow SDK session ID
  userId: string;                // Circle Wallet user ID
  walletAddress: string;         // User's wallet address

  // Allowance
  initialAllowance: bigint;      // Starting allowance (USDC)
  remainingAllowance: bigint;    // Current remaining

  // State
  status: SessionStatus;         // 'pending' | 'active' | 'settling' | 'closed'
  depositTxHash: string | null;  // Channel open tx
  settlementTxHash: string | null; // Final settlement tx

  // Timestamps
  createdAt: Date;
  activatedAt: Date | null;
  closedAt: Date | null;
}

enum SessionStatus {
  PENDING = 'pending',           // Created, awaiting deposit
  ACTIVE = 'active',             // Deposit confirmed, ready for actions
  SETTLING = 'settling',         // Settlement in progress
  CLOSED = 'closed'              // Fully settled
}

// Action Model (Off-Chain)
interface Action {
  id: string;                    // UUID
  sessionId: string;             // Parent session
  type: ActionType;              // Type of action

  // Action Data
  payload: ActionPayload;        // Type-specific data
  signature: string;             // User signature

  // Costs
  fee: bigint;                   // Micro-fee charged

  // State
  status: ActionStatus;          // 'pending' | 'confirmed' | 'settled'
  receipt: ActionReceipt;        // Confirmation receipt

  // Timestamps
  createdAt: Date;
  confirmedAt: Date | null;
  settledAt: Date | null;
}

enum ActionType {
  PLACE_ORDER = 'place_order',
  CANCEL_ORDER = 'cancel_order',
  MODIFY_ORDER = 'modify_order',
  MICRO_TIP = 'micro_tip'
}

type ActionPayload =
  | PlaceOrderPayload
  | CancelOrderPayload
  | ModifyOrderPayload
  | MicroTipPayload;

interface PlaceOrderPayload {
  pair: string;                  // e.g., "USDC/ETH"
  side: 'buy' | 'sell';
  amount: bigint;
  price: bigint;
  orderType: 'limit' | 'market';
}

interface CancelOrderPayload {
  orderId: string;
}

interface MicroTipPayload {
  recipient: string;             // Address
  amount: bigint;
  message?: string;
}

// Receipt Model
interface ActionReceipt {
  actionId: string;
  sequenceNumber: number;        // Order in session
  previousStateHash: string;     // For verification
  newStateHash: string;
  timestamp: number;
  counterpartySignature: string; // Yellow node signature
}

// Settlement Batch Model
interface SettlementBatch {
  id: string;
  sessionId: string;

  // Actions included
  actionIds: string[];
  actionCount: number;

  // Batch commitment (for privacy)
  batchHash: string;             // Hash of all intents
  salt: string;                  // For reveal

  // On-chain data
  commitTxHash: string | null;   // Commit transaction
  revealTxHash: string | null;   // Reveal + execute tx

  // Settlement outcome
  netAmount: bigint;             // Net USDC change
  gasCost: bigint;               // Actual gas paid

  // Status
  status: BatchStatus;

  // Timestamps
  createdAt: Date;
  committedAt: Date | null;
  revealedAt: Date | null;
}

enum BatchStatus {
  BUILDING = 'building',
  COMMITTED = 'committed',
  REVEALED = 'revealed',
  SETTLED = 'settled',
  FAILED = 'failed'
}

// Payout Model
interface Payout {
  id: string;
  sessionId: string;

  // Recipients
  recipients: PayoutRecipient[];
  totalAmount: bigint;

  // Routing
  sourceChain: string;           // Always 'arc' for hub model

  // Status
  status: PayoutStatus;

  // Circle Gateway data
  gatewayTransferId: string | null;

  // Timestamps
  createdAt: Date;
  completedAt: Date | null;
}

interface PayoutRecipient {
  address: string;
  chain: string;                 // Destination chain
  amount: bigint;
  status: 'pending' | 'sent' | 'confirmed';
  txHash: string | null;
}
```

### 3.2 Database Schema (Prisma)

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String    @id @default(uuid())
  circleUserId  String    @unique
  walletAddress String    @unique

  sessions      Session[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Session {
  id                  String        @id @default(uuid())
  yellowSessionId     String        @unique
  userId              String
  user                User          @relation(fields: [userId], references: [id])

  initialAllowance    Decimal       @db.Decimal(78, 0)
  remainingAllowance  Decimal       @db.Decimal(78, 0)

  status              SessionStatus @default(PENDING)
  depositTxHash       String?
  settlementTxHash    String?

  actions             Action[]
  batches             SettlementBatch[]
  payouts             Payout[]

  createdAt           DateTime      @default(now())
  activatedAt         DateTime?
  closedAt            DateTime?

  @@index([userId])
  @@index([status])
}

enum SessionStatus {
  PENDING
  ACTIVE
  SETTLING
  CLOSED
}

model Action {
  id          String       @id @default(uuid())
  sessionId   String
  session     Session      @relation(fields: [sessionId], references: [id])

  type        ActionType
  payload     Json
  signature   String

  fee         Decimal      @db.Decimal(78, 0)

  status      ActionStatus @default(PENDING)
  receipt     Json?

  batchId     String?
  batch       SettlementBatch? @relation(fields: [batchId], references: [id])

  createdAt   DateTime     @default(now())
  confirmedAt DateTime?
  settledAt   DateTime?

  @@index([sessionId])
  @@index([status])
}

enum ActionType {
  PLACE_ORDER
  CANCEL_ORDER
  MODIFY_ORDER
  MICRO_TIP
}

enum ActionStatus {
  PENDING
  CONFIRMED
  SETTLED
}

model SettlementBatch {
  id            String      @id @default(uuid())
  sessionId     String
  session       Session     @relation(fields: [sessionId], references: [id])

  actions       Action[]
  actionCount   Int

  batchHash     String
  salt          String

  commitTxHash  String?
  revealTxHash  String?

  netAmount     Decimal     @db.Decimal(78, 0)
  gasCost       Decimal?    @db.Decimal(78, 0)

  status        BatchStatus @default(BUILDING)

  createdAt     DateTime    @default(now())
  committedAt   DateTime?
  revealedAt    DateTime?

  @@index([sessionId])
}

enum BatchStatus {
  BUILDING
  COMMITTED
  REVEALED
  SETTLED
  FAILED
}

model Payout {
  id                 String       @id @default(uuid())
  sessionId          String
  session            Session      @relation(fields: [sessionId], references: [id])

  recipients         Json
  totalAmount        Decimal      @db.Decimal(78, 0)

  sourceChain        String       @default("arc")

  status             PayoutStatus @default(PENDING)
  gatewayTransferId  String?

  createdAt          DateTime     @default(now())
  completedAt        DateTime?

  @@index([sessionId])
}

enum PayoutStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

---

## 4. API Specification

### 4.1 REST Endpoints

```yaml
# Session Endpoints
POST   /api/v1/sessions
  # Create new session
  Request:
    allowance: string          # USDC amount (wei)
  Response:
    sessionId: string
    yellowSessionId: string
    depositAddress: string     # Where to send USDC

GET    /api/v1/sessions/:id
  # Get session details
  Response:
    session: Session

POST   /api/v1/sessions/:id/activate
  # Activate after deposit confirmed
  Request:
    depositTxHash: string
  Response:
    session: Session

POST   /api/v1/sessions/:id/close
  # Close session and settle
  Response:
    settlementTxHash: string
    finalBalance: string

# Action Endpoints
POST   /api/v1/sessions/:id/actions
  # Execute off-chain action
  Request:
    type: ActionType
    payload: ActionPayload
    signature: string
  Response:
    action: Action
    receipt: ActionReceipt

GET    /api/v1/sessions/:id/actions
  # List all actions in session
  Query:
    status?: ActionStatus
    limit?: number
    offset?: number
  Response:
    actions: Action[]
    total: number

# Settlement Endpoints
POST   /api/v1/sessions/:id/settlement/preview
  # Preview settlement without executing
  Response:
    actionsToSettle: number
    estimatedGas: string
    netAmount: string
    batchHash: string

POST   /api/v1/sessions/:id/settlement/commit
  # Commit batch hash (Phase 1)
  Response:
    batchId: string
    commitTxHash: string

POST   /api/v1/sessions/:id/settlement/reveal
  # Reveal and execute (Phase 2)
  Request:
    batchId: string
  Response:
    revealTxHash: string
    settledActions: number

# Payout Endpoints
POST   /api/v1/sessions/:id/payouts
  # Create payout request
  Request:
    recipients: PayoutRecipient[]
  Response:
    payoutId: string
    estimatedFees: string

GET    /api/v1/sessions/:id/payouts/:payoutId
  # Get payout status
  Response:
    payout: Payout

# Stats Endpoints
GET    /api/v1/sessions/:id/stats
  # Get session statistics
  Response:
    totalActions: number
    gasSaved: string           # Estimated gas saved
    totalFeesPaid: string
    netPnL: string
```

### 4.2 WebSocket Events

```typescript
// Client → Server
interface WSClientMessages {
  // Subscribe to session updates
  'subscribe:session': { sessionId: string };

  // Submit action
  'action:submit': {
    sessionId: string;
    type: ActionType;
    payload: ActionPayload;
    signature: string;
  };
}

// Server → Client
interface WSServerMessages {
  // Session updates
  'session:updated': { session: Session };
  'session:activated': { session: Session };
  'session:closing': { session: Session };
  'session:closed': { session: Session; finalTx: string };

  // Action updates
  'action:confirmed': { action: Action; receipt: ActionReceipt };
  'action:settled': { action: Action };

  // Balance updates (real-time)
  'balance:updated': {
    sessionId: string;
    remaining: string;
    spent: string;
  };

  // Settlement updates
  'settlement:committed': { batchId: string; txHash: string };
  'settlement:revealed': { batchId: string; txHash: string };
  'settlement:complete': { batchId: string; settledCount: number };

  // Payout updates
  'payout:processing': { payoutId: string };
  'payout:complete': { payoutId: string; txHashes: string[] };

  // Errors
  'error': { code: string; message: string };
}
```

---

## 5. Smart Contract Architecture

### 5.1 Contract Overview

```
contracts/
├── src/
│   ├── core/
│   │   └── ThunderVault.sol         # Fund custody (with Yellow)
│   ├── hooks/
│   │   └── ThunderPrivacyHook.sol   # Uniswap v4 privacy hook
│   ├── settlement/
│   │   └── BatchSettler.sol         # Batch settlement logic
│   └── interfaces/
│       ├── IThunderVault.sol
│       ├── IThunderPrivacyHook.sol
│       └── IBatchSettler.sol
├── test/
│   ├── ThunderPrivacyHook.t.sol
│   ├── BatchSettler.t.sol
│   └── Integration.t.sol
└── script/
    └── Deploy.s.sol
```

### 5.2 ThunderPrivacyHook.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";

/// @title ThunderPrivacyHook
/// @notice Enables batch intent aggregation with commit-reveal for privacy
contract ThunderPrivacyHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error BatchAlreadyExists();
    error BatchNotFound();
    error BatchNotCommitted();
    error RevealWindowNotOpen();
    error RevealWindowExpired();
    error InvalidBatchHash();
    error UnauthorizedOperator();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event BatchCommitted(
        bytes32 indexed batchId,
        bytes32 batchHash,
        uint256 revealDeadline
    );

    event BatchRevealed(
        bytes32 indexed batchId,
        uint256 intentCount,
        int256 netAmount
    );

    event BatchSettled(
        bytes32 indexed batchId,
        bytes32 settlementHash
    );

    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct SwapIntent {
        address user;
        bool zeroForOne;         // Swap direction
        int256 amountSpecified;  // Amount to swap
        uint160 sqrtPriceLimitX96;
    }

    struct Batch {
        bytes32 batchHash;       // Hash of intents
        address operator;        // Who committed
        uint256 commitBlock;     // When committed
        uint256 revealDeadline;  // Must reveal by
        BatchStatus status;
    }

    enum BatchStatus {
        None,
        Committed,
        Revealed,
        Settled
    }

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Minimum blocks between commit and reveal
    uint256 public constant MIN_REVEAL_DELAY = 2;

    /// @notice Maximum blocks to reveal after commit
    uint256 public constant MAX_REVEAL_WINDOW = 50;

    /// @notice Authorized operators (thunderFi backend)
    mapping(address => bool) public operators;

    /// @notice Batch storage
    mapping(bytes32 => Batch) public batches;

    /// @notice Pending batch for each pool
    mapping(PoolId => bytes32) public pendingBatches;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {
        operators[msg.sender] = true;
    }

    /*//////////////////////////////////////////////////////////////
                            HOOK PERMISSIONS
    //////////////////////////////////////////////////////////////*/

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,              // Check batch status
            afterSwap: true,               // Log settlement
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /*//////////////////////////////////////////////////////////////
                           BATCH OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Commit a batch hash (Phase 1)
    /// @param poolKey The pool for this batch
    /// @param batchHash Hash of all intents + salt
    function commitBatch(
        PoolKey calldata poolKey,
        bytes32 batchHash
    ) external onlyOperator returns (bytes32 batchId) {
        PoolId poolId = poolKey.toId();

        // Check no pending batch
        if (pendingBatches[poolId] != bytes32(0)) {
            revert BatchAlreadyExists();
        }

        // Generate batch ID
        batchId = keccak256(abi.encode(
            poolId,
            batchHash,
            block.number,
            msg.sender
        ));

        // Store batch
        batches[batchId] = Batch({
            batchHash: batchHash,
            operator: msg.sender,
            commitBlock: block.number,
            revealDeadline: block.number + MIN_REVEAL_DELAY + MAX_REVEAL_WINDOW,
            status: BatchStatus.Committed
        });

        pendingBatches[poolId] = batchId;

        emit BatchCommitted(batchId, batchHash, batches[batchId].revealDeadline);
    }

    /// @notice Reveal and execute batch (Phase 2)
    /// @param poolKey The pool for this batch
    /// @param batchId The batch to reveal
    /// @param intents The swap intents
    /// @param salt The salt used in hash
    function revealAndExecute(
        PoolKey calldata poolKey,
        bytes32 batchId,
        SwapIntent[] calldata intents,
        bytes32 salt
    ) external onlyOperator returns (BalanceDelta totalDelta) {
        Batch storage batch = batches[batchId];

        // Validate batch state
        if (batch.status != BatchStatus.Committed) {
            revert BatchNotCommitted();
        }

        // Check reveal window
        if (block.number < batch.commitBlock + MIN_REVEAL_DELAY) {
            revert RevealWindowNotOpen();
        }
        if (block.number > batch.revealDeadline) {
            revert RevealWindowExpired();
        }

        // Verify hash
        bytes32 computedHash = keccak256(abi.encode(intents, salt));
        if (computedHash != batch.batchHash) {
            revert InvalidBatchHash();
        }

        // Update status
        batch.status = BatchStatus.Revealed;

        // Execute aggregated swap
        int256 netAmount = _aggregateIntents(intents);

        // Execute single swap with net amount
        if (netAmount != 0) {
            bool zeroForOne = netAmount > 0;

            totalDelta = poolManager.swap(
                poolKey,
                IPoolManager.SwapParams({
                    zeroForOne: zeroForOne,
                    amountSpecified: netAmount,
                    sqrtPriceLimitX96: zeroForOne
                        ? TickMath.MIN_SQRT_PRICE + 1
                        : TickMath.MAX_SQRT_PRICE - 1
                }),
                abi.encode(batchId)
            );
        }

        emit BatchRevealed(batchId, intents.length, netAmount);

        // Clear pending
        PoolId poolId = poolKey.toId();
        delete pendingBatches[poolId];
    }

    /*//////////////////////////////////////////////////////////////
                             HOOK CALLBACKS
    //////////////////////////////////////////////////////////////*/

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Only allow swaps from operators during batch execution
        // or regular swaps when no batch is pending
        PoolId poolId = key.toId();
        bytes32 pendingBatch = pendingBatches[poolId];

        if (pendingBatch != bytes32(0) && !operators[sender]) {
            // Batch is pending, only operator can execute
            revert UnauthorizedOperator();
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        // Log settlement if this is a batch execution
        if (hookData.length > 0) {
            bytes32 batchId = abi.decode(hookData, (bytes32));
            Batch storage batch = batches[batchId];

            if (batch.status == BatchStatus.Revealed) {
                batch.status = BatchStatus.Settled;

                bytes32 settlementHash = keccak256(abi.encode(
                    batchId,
                    delta.amount0(),
                    delta.amount1(),
                    block.number
                ));

                emit BatchSettled(batchId, settlementHash);
            }
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    /*//////////////////////////////////////////////////////////////
                              INTERNAL
    //////////////////////////////////////////////////////////////*/

    function _aggregateIntents(
        SwapIntent[] calldata intents
    ) internal pure returns (int256 netAmount) {
        for (uint256 i = 0; i < intents.length; i++) {
            if (intents[i].zeroForOne) {
                netAmount += intents[i].amountSpecified;
            } else {
                netAmount -= intents[i].amountSpecified;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOperator() {
        if (!operators[msg.sender]) {
            revert UnauthorizedOperator();
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/

    function setOperator(address operator, bool authorized) external {
        // In production, add proper access control
        operators[operator] = authorized;
    }
}
```

### 5.3 Contract Interaction Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SETTLEMENT FLOW                                     │
└──────────────────────────────────────────────────────────────────────────────┘

[Backend]                    [ThunderPrivacyHook]              [Uniswap v4]
    │                               │                              │
    │  1. Collect intents           │                              │
    │  (off-chain during session)   │                              │
    │                               │                              │
    │  2. Hash intents + salt       │                              │
    │     batchHash = keccak256(    │                              │
    │       intents, salt           │                              │
    │     )                         │                              │
    │                               │                              │
    │  3. commitBatch(poolKey,      │                              │
    │     batchHash)                │                              │
    │ ─────────────────────────────>│                              │
    │                               │  Store batch                 │
    │                               │  Emit BatchCommitted         │
    │<───────────────────────────── │                              │
    │  batchId                      │                              │
    │                               │                              │
    │  [Wait MIN_REVEAL_DELAY       │                              │
    │   blocks for privacy]         │                              │
    │                               │                              │
    │  4. revealAndExecute(         │                              │
    │     poolKey, batchId,         │                              │
    │     intents, salt)            │                              │
    │ ─────────────────────────────>│                              │
    │                               │  Verify hash                 │
    │                               │  Aggregate intents           │
    │                               │                              │
    │                               │  5. poolManager.swap(        │
    │                               │     netAmount)               │
    │                               │ ────────────────────────────>│
    │                               │                              │
    │                               │<──────────────────────────── │
    │                               │  BalanceDelta                │
    │                               │                              │
    │                               │  Emit BatchRevealed          │
    │                               │  Emit BatchSettled           │
    │<───────────────────────────── │                              │
    │  totalDelta                   │                              │
```

---

## 6. Integration Details

### 6.1 Yellow SDK Integration

```typescript
// lib/yellow/client.ts

import { YellowSDK, Session, Channel } from '@yellow-network/sdk';

export class YellowClient {
  private sdk: YellowSDK;

  constructor() {
    this.sdk = new YellowSDK({
      network: 'testnet',
      nodeUrl: process.env.YELLOW_NODE_URL,
    });
  }

  /**
   * Create a new session with specified allowance
   */
  async createSession(
    wallet: string,
    allowance: bigint
  ): Promise<Session> {
    // Generate session keys
    const sessionKeys = await this.sdk.generateSessionKeys();

    // Create session with Nitrolite
    const session = await this.sdk.createSession({
      participant: wallet,
      sessionKeys,
      allowance: allowance.toString(),
      asset: 'USDC',
    });

    return session;
  }

  /**
   * Open channel (deposit funds)
   */
  async openChannel(
    sessionId: string,
    depositTx: string
  ): Promise<Channel> {
    const channel = await this.sdk.openChannel({
      sessionId,
      fundingTx: depositTx,
    });

    return channel;
  }

  /**
   * Execute off-chain state update
   */
  async updateState(
    sessionId: string,
    action: Action,
    signature: string
  ): Promise<StateUpdate> {
    const update = await this.sdk.updateState({
      sessionId,
      action: {
        type: action.type,
        data: action.payload,
      },
      signature,
    });

    return update;
  }

  /**
   * Get current session state
   */
  async getState(sessionId: string): Promise<SessionState> {
    return this.sdk.getSessionState(sessionId);
  }

  /**
   * Initiate settlement
   */
  async initiateSettlement(
    sessionId: string
  ): Promise<SettlementRequest> {
    return this.sdk.initiateSettlement({
      sessionId,
      mode: 'cooperative', // Or 'unilateral' for disputes
    });
  }

  /**
   * Complete settlement (close channel)
   */
  async completeSettlement(
    sessionId: string,
    settlementRequest: SettlementRequest
  ): Promise<string> {
    const txHash = await this.sdk.completeSettlement({
      sessionId,
      request: settlementRequest,
    });

    return txHash;
  }
}
```

### 6.2 Circle Integration

```typescript
// lib/circle/wallets.ts

import { CircleWalletsSDK } from '@circle-fin/wallets-sdk';

export class CircleWalletClient {
  private sdk: CircleWalletsSDK;

  constructor() {
    this.sdk = new CircleWalletsSDK({
      apiKey: process.env.CIRCLE_API_KEY,
      environment: 'sandbox', // or 'production'
    });
  }

  /**
   * Create or retrieve user wallet
   */
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    // Check if wallet exists
    const existing = await this.sdk.getWalletsByUserId(userId);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new wallet
    const wallet = await this.sdk.createWallet({
      userId,
      blockchain: 'ARC', // Arc network
    });

    return wallet;
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletId: string): Promise<Balance[]> {
    return this.sdk.getWalletBalance(walletId);
  }

  /**
   * Sign transaction
   */
  async signTransaction(
    walletId: string,
    transaction: Transaction
  ): Promise<SignedTransaction> {
    return this.sdk.signTransaction({
      walletId,
      transaction,
    });
  }
}

// lib/circle/gateway.ts

import { CircleGatewaySDK } from '@circle-fin/gateway-sdk';

export class CircleGatewayClient {
  private sdk: CircleGatewaySDK;

  constructor() {
    this.sdk = new CircleGatewaySDK({
      apiKey: process.env.CIRCLE_API_KEY,
      environment: 'sandbox',
    });
  }

  /**
   * Route USDC across chains
   */
  async routeUSDC(params: {
    fromChain: string;
    toChain: string;
    amount: bigint;
    recipient: string;
  }): Promise<Transfer> {
    // Get route quote
    const quote = await this.sdk.getQuote({
      sourceChain: params.fromChain,
      destinationChain: params.toChain,
      amount: params.amount.toString(),
      asset: 'USDC',
    });

    // Execute transfer
    const transfer = await this.sdk.createTransfer({
      quoteId: quote.id,
      recipient: params.recipient,
    });

    return transfer;
  }

  /**
   * Batch payout to multiple recipients
   */
  async batchPayout(
    recipients: PayoutRecipient[]
  ): Promise<BatchTransfer> {
    const transfers = await Promise.all(
      recipients.map(r => this.routeUSDC({
        fromChain: 'arc',
        toChain: r.chain,
        amount: r.amount,
        recipient: r.address,
      }))
    );

    return {
      transfers,
      totalAmount: recipients.reduce(
        (sum, r) => sum + r.amount,
        0n
      ),
    };
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(
    transferId: string
  ): Promise<TransferStatus> {
    return this.sdk.getTransfer(transferId);
  }
}
```

---

## 7. Sequence Diagrams

### 7.1 Full Session Lifecycle

```
┌──────┐     ┌──────────┐     ┌─────────┐     ┌────────┐     ┌─────┐
│ User │     │ Frontend │     │ Backend │     │ Yellow │     │ Arc │
└──┬───┘     └────┬─────┘     └────┬────┘     └───┬────┘     └──┬──┘
   │              │                │              │             │
   │ 1. Connect   │                │              │             │
   │─────────────>│                │              │             │
   │              │ 2. Auth        │              │             │
   │              │───────────────>│              │             │
   │              │                │ 3. Circle    │             │
   │              │                │    Wallet    │             │
   │              │                │─────────────────────────────>
   │              │<───────────────│              │             │
   │<─────────────│                │              │             │
   │              │                │              │             │
   │ 4. Create    │                │              │             │
   │    Session   │                │              │             │
   │    ($50)     │                │              │             │
   │─────────────>│                │              │             │
   │              │ 5. Create      │              │             │
   │              │───────────────>│              │             │
   │              │                │ 6. Yellow    │             │
   │              │                │    Session   │             │
   │              │                │─────────────>│             │
   │              │                │<─────────────│             │
   │              │<───────────────│              │             │
   │<─────────────│ sessionId      │              │             │
   │              │                │              │             │
   │ 7. Deposit   │                │              │             │
   │    USDC      │                │              │             │
   │═════════════════════════════════════════════>│             │
   │              │                │              │             │
   │              │ 8. Confirm     │              │             │
   │              │───────────────>│              │             │
   │              │                │ 9. Activate  │             │
   │              │                │─────────────>│             │
   │              │<───────────────│              │             │
   │<─────────────│ Session Active │              │             │
   │              │                │              │             │
   │ 10. Place    │                │              │             │
   │     Orders   │                │              │             │
   │     (x20)    │                │              │             │
   │─────────────>│                │              │             │
   │              │ 11. Actions    │              │             │
   │              │     (WS)       │              │             │
   │              │───────────────>│              │             │
   │              │                │ 12. Update   │             │
   │              │                │     State    │             │
   │              │                │─────────────>│             │
   │              │                │<─────────────│             │
   │              │<───────────────│ receipts     │             │
   │<─────────────│ Live updates   │              │             │
   │              │                │              │             │
   │ 13. Settle   │                │              │             │
   │─────────────>│                │              │             │
   │              │ 14. Settle     │              │             │
   │              │───────────────>│              │             │
   │              │                │ 15. Build    │             │
   │              │                │     Batch    │             │
   │              │                │─────────────>│             │
   │              │                │              │             │
   │              │                │ 16. Commit   │             │
   │              │                │══════════════════════════>│
   │              │                │              │      (v4)   │
   │              │                │              │             │
   │              │                │ 17. Reveal   │             │
   │              │                │══════════════════════════>│
   │              │                │<══════════════════════════│
   │              │<───────────────│ txHash       │             │
   │<─────────────│ Settlement     │              │             │
   │              │ Complete       │              │             │
   │              │                │              │             │
   │ 18. Payout   │                │              │             │
   │─────────────>│                │              │             │
   │              │ 19. Payout     │              │             │
   │              │───────────────>│              │             │
   │              │                │ 20. Gateway  │             │
   │              │                │──────────────────────────>│
   │              │                │<─────────────────────────│
   │              │<───────────────│              │             │
   │<─────────────│ Payout Sent    │              │             │
   │              │                │              │             │
```

### 7.2 Privacy Settlement Detail

```
┌─────────┐     ┌──────────────────┐     ┌─────────────┐
│ Backend │     │ ThunderPrivacy   │     │ Uniswap v4  │
│         │     │ Hook             │     │ PoolManager │
└────┬────┘     └────────┬─────────┘     └──────┬──────┘
     │                   │                      │
     │ 1. Collect 20 intents off-chain          │
     │    [user1: buy 100, user2: sell 50, ...] │
     │                   │                      │
     │ 2. Compute netAmount = +30 USDC          │
     │                   │                      │
     │ 3. batchHash = keccak256(intents, salt)  │
     │                   │                      │
     │ commitBatch(      │                      │
     │   poolKey,        │                      │
     │   batchHash       │                      │
     │ )                 │                      │
     │──────────────────>│                      │
     │                   │                      │
     │                   │ Store:               │
     │                   │ - batchHash          │
     │                   │ - commitBlock        │
     │                   │ - revealDeadline     │
     │                   │                      │
     │<──────────────────│                      │
     │ batchId           │                      │
     │                   │                      │
     │ [Wait 2+ blocks   │                      │
     │  Privacy window:  │                      │
     │  - Hides timing   │                      │
     │  - Hides details] │                      │
     │                   │                      │
     │ revealAndExecute( │                      │
     │   poolKey,        │                      │
     │   batchId,        │                      │
     │   intents[],      │                      │
     │   salt            │                      │
     │ )                 │                      │
     │──────────────────>│                      │
     │                   │                      │
     │                   │ Verify:              │
     │                   │ keccak256(intents,   │
     │                   │   salt) == batchHash │
     │                   │                      │
     │                   │ Aggregate:           │
     │                   │ net = sum(intents)   │
     │                   │                      │
     │                   │ swap(netAmount)      │
     │                   │─────────────────────>│
     │                   │                      │
     │                   │<─────────────────────│
     │                   │ BalanceDelta         │
     │                   │                      │
     │                   │ Emit BatchSettled    │
     │<──────────────────│                      │
     │ totalDelta        │                      │
     │                   │                      │
     │ [On-chain shows:  │                      │
     │  - 1 swap tx      │                      │
     │  - Net amount     │                      │
     │  - Batch hash     │                      │
     │                   │                      │
     │  Does NOT show:   │                      │
     │  - 20 individual  │                      │
     │    user trades    │                      │
     │  - Per-user       │                      │
     │    timing]        │                      │
```

---

## 8. Infrastructure

### 8.1 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    CDN (Cloudflare / AWS CloudFront)                 │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │              Vite React SPA (Static Build)                   │    │    │
│  │  │              /index.html + /assets/*.js,css                  │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    │ API calls (port 443 → 3001)            │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Load Balancer (nginx/ALB)                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       Backend Servers (Docker/K8s)                   │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │           Node.js Express Server (x3 replicas)               │   │    │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │    │
│  │  │  │  REST API   │  │  WebSocket  │  │  Background │          │   │    │
│  │  │  │  :3001      │  │  :3001/ws   │  │  Workers    │          │   │    │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                            Data Layer                                │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │  PostgreSQL  │  │    Redis     │  │  S3/GCS      │               │    │
│  │  │  (Primary +  │  │  (Sessions + │  │  (Receipts + │               │    │
│  │  │   Replica)   │  │   Pub/Sub)   │  │   Logs)      │               │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          External Services                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │  Yellow      │  │  Circle      │  │  Chain       │               │    │
│  │  │  Nitrolite   │  │  APIs        │  │  RPCs        │               │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

DEVELOPMENT SETUP:
┌────────────────────┐     ┌────────────────────┐
│  Vite Dev Server   │────▶│  Express Server    │
│  localhost:5173    │     │  localhost:3001    │
│  (HMR enabled)     │     │  (nodemon)         │
└────────────────────┘     └────────────────────┘
```

### 8.2 Environment Configuration

```bash
# server/.env.example

# Server
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/thunderfi

# Redis
REDIS_URL=redis://localhost:6379

# Yellow Network
YELLOW_NODE_URL=https://testnet.yellow.org
YELLOW_API_KEY=

# Circle
CIRCLE_API_KEY=
CIRCLE_WALLET_SET_ID=
CIRCLE_GATEWAY_URL=https://api.circle.com/gateway

# Chains
ARC_RPC_URL=https://rpc.arc.network
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
BASE_RPC_URL=https://mainnet.base.org

# Contracts
THUNDER_PRIVACY_HOOK_ADDRESS=
BATCH_SETTLER_ADDRESS=

# Keys (NEVER commit real keys)
OPERATOR_PRIVATE_KEY=

# JWT (for session tokens)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

```bash
# client/.env.example

# API
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Chain Config
VITE_DEFAULT_CHAIN_ID=421614
VITE_ARC_CHAIN_ID=123456

# Feature Flags
VITE_ENABLE_DEMO_MODE=true
```

---

## 9. Security Considerations

### 9.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Session key compromise | Keys are session-scoped with allowance limits |
| MEV extraction | Commit-reveal hides intent details until execution |
| Replay attacks | Each action has unique sequence number and signature |
| Backend compromise | Final settlement requires on-chain verification |
| Front-running | Batch aggregation reduces individual exposure |
| Denial of service | Rate limiting + allowance caps |

### 9.2 Security Checklist

- [ ] All user inputs validated server-side
- [ ] Session signatures verified on every action
- [ ] Rate limiting on all endpoints
- [ ] Allowance enforced at contract level
- [ ] Commit-reveal timing enforced on-chain
- [ ] No private keys stored in backend (use KMS)
- [ ] All external calls have timeouts
- [ ] Error messages don't leak sensitive info

---

## 10. Testing Strategy

### 10.1 Test Coverage

```
tests/
├── unit/
│   ├── session.test.ts          # Session lifecycle
│   ├── actions.test.ts          # Action processing
│   ├── batch.test.ts            # Batch building
│   └── settlement.test.ts       # Settlement logic
├── integration/
│   ├── yellow.test.ts           # Yellow SDK integration
│   ├── circle.test.ts           # Circle APIs
│   └── uniswap.test.ts          # v4 hook interaction
├── e2e/
│   ├── full-flow.test.ts        # Complete user journey
│   └── settlement.test.ts       # On-chain settlement
└── contracts/
    ├── ThunderPrivacyHook.t.sol # Hook tests
    └── Integration.t.sol        # Cross-contract tests
```

### 10.2 Contract Test Example

```solidity
// test/ThunderPrivacyHook.t.sol

contract ThunderPrivacyHookTest is Test {
    ThunderPrivacyHook hook;
    IPoolManager poolManager;
    PoolKey poolKey;

    function setUp() public {
        // Deploy hook and pool
    }

    function test_commitBatch_storesBatchCorrectly() public {
        bytes32 batchHash = keccak256("test batch");

        bytes32 batchId = hook.commitBatch(poolKey, batchHash);

        (bytes32 storedHash, , , , ) = hook.batches(batchId);
        assertEq(storedHash, batchHash);
    }

    function test_revealAndExecute_verifiesHash() public {
        SwapIntent[] memory intents = new SwapIntent[](2);
        intents[0] = SwapIntent(user1, true, 100e6, 0);
        intents[1] = SwapIntent(user2, false, 50e6, 0);
        bytes32 salt = bytes32("salt");

        bytes32 batchHash = keccak256(abi.encode(intents, salt));
        bytes32 batchId = hook.commitBatch(poolKey, batchHash);

        vm.roll(block.number + 3); // Past reveal delay

        hook.revealAndExecute(poolKey, batchId, intents, salt);

        // Verify batch settled
        (, , , , ThunderPrivacyHook.BatchStatus status) = hook.batches(batchId);
        assertEq(uint(status), uint(ThunderPrivacyHook.BatchStatus.Settled));
    }

    function test_revealAndExecute_revertsOnBadHash() public {
        SwapIntent[] memory intents = new SwapIntent[](1);
        intents[0] = SwapIntent(user1, true, 100e6, 0);
        bytes32 salt = bytes32("salt");

        // Commit with different hash
        bytes32 batchId = hook.commitBatch(poolKey, bytes32("wrong"));

        vm.roll(block.number + 3);

        vm.expectRevert(ThunderPrivacyHook.InvalidBatchHash.selector);
        hook.revealAndExecute(poolKey, batchId, intents, salt);
    }
}
```

---

## 11. Monitoring & Observability

### 11.1 Key Metrics

```typescript
// Metrics to track
const metrics = {
  // Session metrics
  'session.created': Counter,
  'session.activated': Counter,
  'session.closed': Counter,
  'session.duration_seconds': Histogram,

  // Action metrics
  'actions.submitted': Counter,
  'actions.confirmed': Counter,
  'actions.per_session': Histogram,
  'actions.latency_ms': Histogram,

  // Settlement metrics
  'settlement.batches': Counter,
  'settlement.actions_per_batch': Histogram,
  'settlement.gas_used': Histogram,
  'settlement.latency_seconds': Histogram,

  // Payout metrics
  'payouts.created': Counter,
  'payouts.completed': Counter,
  'payouts.amount_usd': Histogram,

  // System metrics
  'yellow.connection_status': Gauge,
  'circle.api_latency_ms': Histogram,
  'rpc.request_count': Counter,
};
```

### 11.2 Alerts

```yaml
# alerts.yaml
alerts:
  - name: high_settlement_latency
    condition: settlement.latency_seconds > 60
    severity: warning

  - name: yellow_connection_lost
    condition: yellow.connection_status == 0
    severity: critical

  - name: high_action_failure_rate
    condition: rate(actions.failed) / rate(actions.submitted) > 0.05
    severity: warning

  - name: batch_settlement_failed
    condition: increase(settlement.failed) > 0
    severity: critical
```

---

## 12. Quick Start Commands

```bash
# Project structure
thunderfi/
├── client/          # Vite + React frontend
├── server/          # Node.js + Express backend
├── contracts/       # Solidity smart contracts
└── package.json     # Root workspace

# Install all dependencies (from root)
pnpm install

# Set up database
cd server && pnpm db:push

# Run development (both frontend + backend)
pnpm dev
# Or run separately:
pnpm dev:client      # Vite on localhost:5173
pnpm dev:server      # Express on localhost:3001

# Run tests
pnpm test            # All tests
pnpm test:client     # Frontend tests
pnpm test:server     # Backend tests
pnpm test:contracts  # Foundry contract tests

# Deploy contracts
cd contracts && forge script script/Deploy.s.sol --broadcast

# Build for production
pnpm build           # Builds both client + server
pnpm build:client    # Vite build → client/dist
pnpm build:server    # TypeScript compile → server/dist

# Start production
pnpm start           # Serves static + API
```

### Root package.json (workspace)

```json
{
  "name": "thunderfi",
  "private": true,
  "workspaces": ["client", "server", "contracts"],
  "scripts": {
    "dev": "concurrently \"pnpm dev:client\" \"pnpm dev:server\"",
    "dev:client": "pnpm --filter client dev",
    "dev:server": "pnpm --filter server dev",
    "build": "pnpm build:client && pnpm build:server",
    "build:client": "pnpm --filter client build",
    "build:server": "pnpm --filter server build",
    "test": "pnpm test:client && pnpm test:server",
    "test:client": "pnpm --filter client test",
    "test:server": "pnpm --filter server test",
    "test:contracts": "cd contracts && forge test"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

---

**This architecture is designed to:**
1. Maximize Yellow SDK integration depth (primary bounty)
2. Implement clean privacy mechanism for Uniswap v4
3. Fully integrate Arc + Circle tools as required
4. Be demoable in 2-3 minutes with clear value proposition
