# System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CRYPTO PAYMENT GATEWAY                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                       FRONTEND (Client-Side)                     │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │ Homepage     │  │ Invoice Page │  │ Admin Panel  │          │  │
│  │  │              │  │              │  │              │          │  │
│  │  │ • Features   │  │ • Create     │  │ • Config     │          │  │
│  │  │ • Demo info  │  │ • Monitor    │  │ • View txs   │          │  │
│  │  │ • Navigation │  │ • Polling    │  │ • Statistics │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  │         ↓                  ↓                   ↓                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │              Real-time Polling Service                   │  │  │
│  │  │  • 2-second interval polling                            │  │  │
│  │  │  • Balance monitoring                                   │  │  │
│  │  │  • Confirmation tracking                               │  │  │
│  │  │  • Status updates                                      │  │  │
│  │  └────────────────┬─────────────────────────────────────────┘  │  │
│  │                   │                                             │  │
│  └───────────────────┼─────────────────────────────────────────────┘  │
│                      │                                              │
│  ┌───────────────────┼─────────────────────────────────────────────┐  │
│  │                   ↓                                             │  │
│  │           BACKEND (Server-Side)                               │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │           API Routes (Next.js)                       │  │  │
│  │  ├──────────────────────────────────────────────────────┤  │  │
│  │  │                                                      │  │  │
│  │  │ POST /api/invoices/create                           │  │  │
│  │  │ ├─ Derive wallet from master mnemonic              │  │  │
│  │  │ ├─ Create invoice record in database               │  │  │
│  │  │ └─ Return wallet address to client                 │  │  │
│  │  │                                                      │  │  │
│  │  │ POST /api/invoices/poll                             │  │  │
│  │  │ ├─ Check invoice wallet balance (RPC)              │  │  │
│  │  │ ├─ Update database with balance                    │  │  │
│  │  │ ├─ Trigger sweep if payment received               │  │  │
│  │  │ └─ Return status to client                         │  │  │
│  │  │                                                      │  │  │
│  │  │ GET /api/admin/config                               │  │  │
│  │  │ ├─ Verify admin token                              │  │  │
│  │  │ └─ Return gateway configuration                    │  │  │
│  │  │                                                      │  │  │
│  │  │ POST /api/admin/config                              │  │  │
│  │  │ ├─ Verify admin token                              │  │  │
│  │  │ ├─ Update master wallet address                    │  │  │
│  │  │ └─ Generate/verify gas wallet                      │  │  │
│  │  │                                                      │  │  │
│  │  │ GET /api/admin/transactions                         │  │  │
│  │  │ ├─ Verify admin token                              │  │  │
│  │  │ ├─ Fetch all invoices                              │  │  │
│  │  │ └─ Return with transaction history                 │  │  │
│  │  │                                                      │  │  │
│  │  └──────┬───────────────────────────────────────────────┘  │  │
│  │         │                                                   │  │
│  │         ↓                                                   │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │         Web3 & Database Libraries                    │  │  │
│  │  ├──────────────────────────────────────────────────────┤  │  │
│  │  │                                                      │  │  │
│  │  │ wallet.ts                                           │  │  │
│  │  │ ├─ deriveWalletFromMnemonic()                       │  │  │
│  │  │ ├─ getWalletBalance()                               │  │  │
│  │  │ ├─ getTransactionCount()                            │  │  │
│  │  │ ├─ sendTransaction()                                │  │  │
│  │  │ └─ getTransactionReceipt()                          │  │  │
│  │  │                                                      │  │  │
│  │  │ invoices.ts                                         │  │  │
│  │  │ ├─ createInvoice()                                  │  │  │
│  │  │ ├─ getInvoice()                                     │  │  │
│  │  │ ├─ updateInvoiceStatus()                            │  │  │
│  │  │ └─ checkAndSweepInvoice()                           │  │  │
│  │  │                                                      │  │  │
│  │  │ admin.ts                                            │  │  │
│  │  │ ├─ getAdminConfig()                                 │  │  │
│  │  │ └─ getOrCreateGasWallet()                           │  │  │
│  │  │                                                      │  │  │
│  │  └──────┬───────────────────────────────────────────────┘  │  │
│  │         │                                                   │  │
│  │         ↓                                                   │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │        External Services                             │  │  │
│  │  ├──────────────────────────────────────────────────────┤  │  │
│  │  │                                                      │  │  │
│  │  │ SUPABASE                                            │  │  │
│  │  │ ├─ PostgreSQL Database                              │  │  │
│  │  │ │  ├─ admin_config table                            │  │  │
│  │  │ │  └─ invoices table                                │  │  │
│  │  │ └─ Row-Level Security (RLS)                         │  │  │
│  │  │                                                      │  │  │
│  │  │ OPTIMISM RPC                                        │  │  │
│  │  │ ├─ Balance queries                                  │  │  │
│  │  │ ├─ Transaction broadcasting                         │  │  │
│  │  │ └─ Block confirmation tracking                      │  │  │
│  │  │                                                      │  │  │
│  │  │ ETHERS.JS                                           │  │  │
│  │  │ ├─ Wallet management                                │  │  │
│  │  │ ├─ Contract interactions                            │  │  │
│  │  │ └─ Transaction signing                              │  │  │
│  │  │                                                      │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

│
├─ OPTIMISM BLOCKCHAIN
│  ├─ Master Wallet (m/44'/60'/0'/0/0 - not derived as invoice)
│  ├─ Gas Wallet (m/44'/60'/0'/0/0 - derived from mnemonic)
│  ├─ Invoice Wallet 1 (m/44'/60'/0'/0/1)
│  ├─ Invoice Wallet 2 (m/44'/60'/0'/0/2)
│  └─ Invoice Wallet N (m/44'/60'/0'/0/n)
│     ├─ User sends ETH or USDT
│     ├─ Gateway monitors balance
│     ├─ Gateway triggers sweep
│     └─ Funds transferred to master wallet
```

## Data Flow Diagrams

### Invoice Creation Flow

```
CLIENT                          SERVER                          DATABASE
  │                               │                                  │
  │ POST /api/invoices/create     │                                  │
  ├──────────────────────────────→│                                  │
  │                               │ 1. Get invoice count             │
  │                               ├─────────────────────────────────→│
  │                               │←─────────────────────────────────┤
  │                               │                                  │
  │                               │ 2. Derive wallet at index N      │
  │                               │    (from MASTER_MNEMONIC)        │
  │                               │                                  │
  │                               │ 3. Create invoice record         │
  │                               ├─────────────────────────────────→│
  │                               │←─────────────────────────────────┤
  │ Response with wallet          │                                  │
  │←──────────────────────────────┤                                  │
  │ {                             │                                  │
  │   walletAddress: "0x...",     │                                  │
  │   amount: 0.01,               │                                  │
  │   currency: "ETH",            │                                  │
  │   status: "pending"           │                                  │
  │ }                             │                                  │
```

### Payment Polling Flow

```
CLIENT (Polling every 2 sec)    SERVER                    BLOCKCHAIN
  │                               │                              │
  │ POST /api/invoices/poll       │                              │
  ├──────────────────────────────→│                              │
  │                               │ 1. Query balance             │
  │                               ├─────────────────────────────→│
  │                               │←─────────────────────────────┤
  │                               │ (balance: 0.01 ETH)          │
  │                               │                              │
  │                               │ 2. Check confirmations       │
  │                               ├─────────────────────────────→│
  │                               │←─────────────────────────────┤
  │                               │ (confirmations: 3)           │
  │                               │                              │
  │                               │ 3. Payment received?         │
  │                               │    YES → Trigger sweep       │
  │                               │                              │
  │                               │ 4. Derive invoice wallet     │
  │                               │    from MASTER_MNEMONIC      │
  │                               │                              │
  │                               │ 5. Send sweep transaction    │
  │                               ├─────────────────────────────→│
  │                               │←─────────────────────────────┤
  │                               │ (txHash: 0x...)              │
  │                               │                              │
  │ Response                      │                              │
  │←──────────────────────────────┤                              │
  │ {                             │                              │
  │   status: "sweeping",         │                              │
  │   balance: 0.01,              │                              │
  │   confirmations: 3            │                              │
  │ }                             │                              │
```

### USDT Payment with Gas Prefunding

```
                    ETH/USDT
CLIENT  →  INVOICE WALLET  →  GATEWAY  →  MASTER WALLET
                                │              ↑
                                │              │
                          (detect USDT         (send USDT)
                           received)
                                │
                          ┌─────v──────┐
                          │ CHECK BALANCE
                          │ Is >= amount?
                          └─────┬──────┘
                                │ YES
                          ┌─────v──────────────┐
                          │ PREFUND GAS        │
                          │ From Gas Wallet    │
                          │ Send ETH to invoice│
                          └─────┬──────────────┘
                                │ wait for confirmation
                          ┌─────v──────────────┐
                          │ SWEEP USDT         │
                          │ From invoice wallet│
                          │ To master wallet   │
                          └─────┬──────────────┘
                                │
                          Status: completed
```

## Wallet Derivation Hierarchy

```
┌─────────────────────────────────────────────────────┐
│        MASTER MNEMONIC (BIP-39)                    │
│   "word1 word2 word3 ... word12/24"                │
│     (Only stored in MASTER_MNEMONIC env var)       │
└─────────────────┬───────────────────────────────────┘
                  │
          ┌───────┴────────┐
          │                │
    ┌─────v──────┐   ┌────v────────┐
    │ HD Node    │   │ BIP-44 Path  │
    │ Derivation │   │ m/44'/60'/   │
    │            │   │ 0'/0/n       │
    └─────┬──────┘   └─────────────┘
          │
    ┌─────┴──────────────────────────┐
    │   Master Wallet               │
    │   (m/44'/60'/0'/0)             │
    │   ↓                            │
    │   Address: 0x...               │
    │   Private Key: 0x...           │
    └─────┬──────────────────────────┘
          │
    ┌─────┴──────────────────────────────────────┐
    │                                            │
┌───v─────────────┐ ┌──────────────────────────┐ │
│ Gas Wallet      │ │ Invoice Wallets          │ │
│ Index: 0        │ │                          │ │
│ Address: 0x...  │ │ Index 1: 0x...           │ │
│                 │ │ Index 2: 0x...           │ │
│ (Prefund ETH)   │ │ ...                      │ │
│                 │ │ Index N: 0x...           │ │
└─────────────────┘ │ (User payment destination)
                    └──────────────────────────┘
```

## Database Schema

```
ADMIN_CONFIG
├─ id (TEXT, PRIMARY KEY)
├─ created_at (TIMESTAMP)
├─ updated_at (TIMESTAMP)
├─ master_wallet_address (TEXT)
└─ gas_wallet_address (TEXT)

INVOICES
├─ id (UUID, PRIMARY KEY)
├─ created_at (TIMESTAMP)
├─ currency (TEXT: ETH|USDT)
├─ amount_expected (NUMERIC)
├─ wallet_address (TEXT, UNIQUE)
├─ derivation_index (INTEGER, UNIQUE)
├─ status (TEXT: pending|received|prefunding|sweeping|completed)
├─ current_balance (NUMERIC)
├─ confirmation_count (INTEGER)
├─ last_checked_at (TIMESTAMP)
└─ sweep_tx_hash (TEXT)

INDEXES
├─ invoices.status
├─ invoices.wallet_address
└─ invoices.created_at DESC
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│              SECURITY LAYERS                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Layer 1: SECRET MANAGEMENT                             │
│ ├─ MASTER_MNEMONIC: Environment variable (server-only) │
│ ├─ ADMIN_TOKEN: Environment variable                   │
│ └─ Private Keys: Derived on-the-fly, never stored      │
│                                                         │
│ Layer 2: API AUTHENTICATION                            │
│ ├─ Admin endpoints: Bearer token auth                  │
│ ├─ Invoice endpoints: Public (anyone can create)       │
│ └─ Polling: Invoice ID required                        │
│                                                         │
│ Layer 3: DATA PROTECTION                               │
│ ├─ Supabase RLS: Row-level security policies           │
│ ├─ Input validation: All user inputs validated         │
│ └─ HTTPS: All data encrypted in transit                │
│                                                         │
│ Layer 4: BLOCKCHAIN SECURITY                           │
│ ├─ Non-custodial: Gateway never controls funds         │
│ ├─ Deterministic wallets: Same index = same wallet     │
│ └─ Transaction verification: Check receipt on-chain    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  VERCEL (Edge Network)                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Next.js Application                        │ │
│  ├────────────────────────────────────────────────────┤ │
│  │                                                    │ │
│  │  Frontend (Static/SSR)                            │ │
│  │  ├─ Pages                                         │ │
│  │  ├─ Components                                    │ │
│  │  └─ Styles                                        │ │
│  │                                                    │ │
│  │  API Routes (Serverless Functions)                │ │
│  │  ├─ /api/invoices/*                               │ │
│  │  └─ /api/admin/*                                  │ │
│  │                                                    │ │
│  │  Environment Variables                            │ │
│  │  ├─ NEXT_PUBLIC_* (client-side)                   │ │
│  │  └─ MASTER_MNEMONIC (server-side only)            │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│          ↓ Uses                    ↓ Uses               │
│  ┌──────────────┐         ┌──────────────────┐         │
│  │  Supabase    │         │  Optimism RPC    │         │
│  │  PostgreSQL  │         │  Endpoints       │         │
│  │  Database    │         │  (via ethers.js) │         │
│  └──────────────┘         └──────────────────┘         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
CLIENT-SIDE
├─ Next.js Image Optimization
├─ Code Splitting
├─ CSS-in-JS (Tailwind)
└─ Service Worker (optional)

SERVER-SIDE
├─ Serverless Functions (auto-scaling)
├─ Database Connection Pooling
├─ API Response Caching
└─ Optimistic Updates

BLOCKCHAIN
├─ RPC Request Batching
├─ Confirmation Polling (not listening)
├─ Gas Estimation Caching
└─ Block Confirmation Tracking
```

## Scalability Considerations

```
HORIZONTAL SCALING
├─ Stateless API (Vercel handles)
├─ Database: Supabase with auto-scaling
├─ Multiple RPC endpoints (fallback)
└─ CDN: Vercel's global edge network

VERTICAL SCALING
├─ Database indexes for quick queries
├─ Polling instead of listeners
├─ Batch operations where possible
└─ Efficient data structures
```

This architecture supports the demo's requirements for:
- Non-custodial fund handling
- Serverless deployment
- Real-time polling-based updates
- Secure key management
- Production-grade security
