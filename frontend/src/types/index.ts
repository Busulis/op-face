// ─── Wallet types ────────────────────────────────────────────────────────────
// The SDK (`@btc-vision/transaction`) declares window.opnet?: OPWallet and
// window.unisat?: Unisat globally.  We don't re-declare them here.

// ─── NFT types ────────────────────────────────────────────────────────────────

export interface NFTToken {
    tokenId: bigint;
    owner: string;
    minter: string;
    mintedAt: bigint;
    tokenURI: string;
    metadata?: NFTMetadata;
}

export interface NFTMetadata {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
}

// ─── Contract call result ──────────────────────────────────────────────────────

export interface CallResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    txHash?: string;
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

export interface GalleryState {
    tokens: NFTToken[];
    loading: boolean;
    error?: string;
}

// ─── Wallet state ─────────────────────────────────────────────────────────────

export interface WalletState {
    connected: boolean;
    address: string | null;
    balance: bigint;
    loading: boolean;
    error?: string;
}

// ─── Mint state ───────────────────────────────────────────────────────────────

export type MintStep =
    | 'idle'
    | 'uploading'
    | 'signing'
    | 'broadcasting'
    | 'confirming'
    | 'success'
    | 'error';

export interface MintState {
    step: MintStep;
    tokenId?: bigint;
    txHash?: string;
    error?: string;
}
