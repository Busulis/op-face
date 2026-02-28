# OP Face — Bitcoin NFT on OP_NET

A limited-edition NFT minting dApp running entirely on Bitcoin via **OP_NET**. Only 100 faces will ever exist.

---

## Overview

| Property       | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| **Name**       | OP Face                                                               |
| **Symbol**     | OPFACE                                                                |
| **Max Supply** | 100                                                                   |
| **Mint Price** | 0.005 tBTC (500,000 sat)                                              |
| **Treasury**   | `bcrt1pzcu0e6e04uc5l43fvrr2czh2fxh5my8c08ggnywghw3hchznqdcsr9x2s9` |
| **Network**    | OP_NET Testnet (regtest / signet)                                     |
| **Contract**   | AssemblyScript → WASM, deployed on OP_NET                            |

---

## Project Structure

```
op-face/
├── contract/                  # AssemblyScript smart contract
│   ├── src/
│   │   ├── contracts/
│   │   │   └── OPFace.ts      # Main NFT contract
│   │   └── index.ts           # WASM entry point
│   ├── abis/
│   │   └── OPFace.json        # ABI definition
│   ├── scripts/
│   │   └── deploy.ts          # Deployment script
│   ├── build/                 # Compiled WASM output (generated)
│   ├── asconfig.json          # AssemblyScript config
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                  # Next.js 14 dApp
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx       # Mint page (home)
│   │   │   └── token/[id]/
│   │   │       └── page.tsx   # Token detail page
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── MintForm.tsx
│   │   │   ├── Gallery.tsx
│   │   │   └── TokenCard.tsx
│   │   ├── lib/
│   │   │   ├── contract.ts    # OP_NET contract calls
│   │   │   ├── wallet.ts      # Wallet utilities
│   │   │   └── ipfs.ts        # IPFS upload helpers
│   │   └── types/
│   │       └── index.ts
│   ├── .env.example
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
```

---

## Prerequisites

- **Node.js** ≥ 18
- **OP_WALLET** browser extension — [https://opnet.org](https://opnet.org)
- **@opnet/cli** — `npm i -g @opnet/cli`
- **AssemblyScript** — `npm i -g assemblyscript`
- Testnet tBTC from the OP_NET faucet

---

## 1 — Build the Contract

```bash
cd contract
npm install
npm run build
# → build/OPFace.wasm
```

For an optimised (smaller) binary:
```bash
npm run build:optimized
```

---

## 2 — Deploy to Testnet

```bash
cd contract

# Set your deployer private key (WIF format)
export DEPLOYER_WIF="cYourPrivateKeyHere..."

# Deploy to regtest
npx ts-node scripts/deploy.ts --network regtest

# Deploy to signet/testnet
npx ts-node scripts/deploy.ts --network testnet
```

The script prints the contract address on success. Copy it for the next step.

Alternatively, use the CLI directly:
```bash
opnet-deploy \
  --network regtest \
  --rpc https://regtest.opnet.org \
  --contract build/OPFace.wasm \
  --wif $DEPLOYER_WIF
```

---

## 3 — Configure the Frontend

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=<your-contract-address-from-step-2>
NEXT_PUBLIC_OPNET_RPC=https://regtest.opnet.org

# Optional: Pinata IPFS (recommended for production)
NEXT_PUBLIC_PINATA_API_KEY=
NEXT_PUBLIC_PINATA_API_SECRET=
```

---

## 4 — Run the Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Contract API

### Write Methods

| Method             | Parameters    | Description                              |
|--------------------|---------------|------------------------------------------|
| `mint(tokenURI)`   | `string`      | Mint NFT. Requires 0.005 tBTC payment.  |

### Read Methods

| Method              | Returns    | Description                          |
|---------------------|------------|--------------------------------------|
| `totalSupply()`     | `uint256`  | Current number of minted tokens      |
| `maxSupply()`       | `uint256`  | Always 100                           |
| `mintPrice()`       | `uint256`  | Satoshi price (500,000)              |
| `name()`            | `string`   | "OP Face"                            |
| `symbol()`          | `string`   | "OPFACE"                             |
| `tokenURI(id)`      | `string`   | IPFS metadata URI                    |
| `ownerOf(id)`       | `string`   | Current owner address                |
| `minterOf(id)`      | `string`   | Original minter address              |
| `mintedAt(id)`      | `uint256`  | Bitcoin block number of mint         |
| `tokenInfo(id)`     | multi      | owner, minter, block, URI in one call|

### Events

| Event       | Fields                                |
|-------------|---------------------------------------|
| `Transfer`  | `from (string)`, `to (string)`, `tokenId (uint256)` |

---

## Mint Flow

```
User selects image (PNG/JPG/GIF/WEBP ≤ 5MB)
        │
        ▼
Image uploaded to IPFS  →  ipfs://Qm{imageCID}
        │
        ▼
Metadata JSON built & uploaded to IPFS  →  ipfs://Qm{metaCID}
        │
        ▼
OP_NET SDK builds PSBT:
  • Input:  user UTXO (covers 500,000 sat + fee)
  • Output: calldata → mint(metaURI)
  • Value:  500,000 sat sent to contract
        │
        ▼
OP_WALLET signs PSBT
        │
        ▼
Transaction broadcast to Bitcoin
        │
        ▼
OP_NET executes contract:
  1. Validates supply < 100
  2. Validates value ≥ 500,000 sat
  3. Transfers 500,000 sat to treasury
  4. Stores token: owner, minter, timestamp, URI
  5. Emits Transfer event
  6. Returns tokenId
        │
        ▼
Frontend shows success + token detail page
```

---

## Treasury

All mint proceeds (0.005 tBTC per mint, up to 0.5 tBTC total) are sent automatically to:

```
bcrt1pzcu0e6e04uc5l43fvrr2czh2fxh5my8c08ggnywghw3hchznqdcsr9x2s9
```

---

## Tech Stack

| Layer     | Technology                                  |
|-----------|---------------------------------------------|
| Contract  | AssemblyScript → WASM, OP_NET runtime       |
| Chain     | Bitcoin (via OP_NET smart contract layer)   |
| Storage   | IPFS (Pinata / NFT.Storage)                 |
| Frontend  | Next.js 14, TypeScript, Tailwind CSS        |
| SDK       | @btc-vision/sdk, @btc-vision/btc-runtime    |
| Wallet    | OP_WALLET browser extension                 |

---

## Development

```bash
# Lint
cd frontend && npm run lint

# Type check
cd frontend && npm run type-check

# Build for production
cd frontend && npm run build
```

---

## Testnet Resources

- **OP_NET Testnet:** https://regtest.opnet.org
- **Explorer:** https://explorer.opnet.org
- **Faucet:** https://faucet.opnet.org
- **Wallet:** https://opnet.org
- **Docs:** https://docs.opnet.org

---

## License

MIT
