'use client';

/**
 * OP Face Contract interaction layer.
 *
 * Uses `opnet` for JSON-RPC + contract proxy, and
 * `@btc-vision/transaction` for ABI type constants.
 * Wallet signs the generated PSBT via OP_WALLET (window.opnet).
 */

import type { NFTToken, NFTMetadata } from '@/types';
import { resolveIPFSUri } from '@/lib/ipfs';

// ─── Config ───────────────────────────────────────────────────────────────────

export const CONTRACT_ADDRESS =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '';

export const OPNET_RPC =
    process.env.NEXT_PUBLIC_OPNET_RPC ?? 'https://regtest.opnet.org';

export const MINT_PRICE_SAT = 500_000n; // 0.005 tBTC
export const MAX_SUPPLY      = 100n;

// ─── SDK lazy-import cache (runs in browser) ─────────────────────────────────

type OPNetSDK = typeof import('opnet');
type BitcoinPkg = typeof import('@btc-vision/bitcoin');

let _sdk: OPNetSDK | null = null;
let _btc: BitcoinPkg | null = null;

async function loadSDK(): Promise<OPNetSDK> {
    if (!_sdk) _sdk = await import('opnet');
    return _sdk;
}

async function loadBitcoin(): Promise<BitcoinPkg> {
    if (!_btc) _btc = await import('@btc-vision/bitcoin');
    return _btc;
}

// ─── Provider (singleton) ────────────────────────────────────────────────────

let _provider: InstanceType<OPNetSDK['JSONRpcProvider']> | null = null;

async function getProvider() {
    if (!_provider) {
        const { JSONRpcProvider } = await loadSDK();
        const { networks }       = await loadBitcoin();
        _provider = new JSONRpcProvider(OPNET_RPC, networks.regtest);
    }
    return _provider;
}

// ─── ABI ─────────────────────────────────────────────────────────────────────

async function buildABI() {
    const { ABIDataTypes, BitcoinAbiTypes } = await loadSDK();
    const { STRING, UINT256, ADDRESS } = ABIDataTypes;
    const FN = BitcoinAbiTypes.Function;

    return [
        {
            name: 'mint',
            type: FN,
            payable: true,
            inputs:  [{ name: 'tokenURI', type: STRING }],
            outputs: [{ name: 'tokenId',  type: UINT256 }],
        },
        {
            name: 'totalSupply',
            type: FN,
            constant: true,
            inputs:  [],
            outputs: [{ name: 'supply', type: UINT256 }],
        },
        {
            name: 'maxSupply',
            type: FN,
            constant: true,
            inputs:  [],
            outputs: [{ name: 'max', type: UINT256 }],
        },
        {
            name: 'mintPrice',
            type: FN,
            constant: true,
            inputs:  [],
            outputs: [{ name: 'price', type: UINT256 }],
        },
        {
            name: 'tokenURI',
            type: FN,
            constant: true,
            inputs:  [{ name: 'tokenId', type: UINT256 }],
            outputs: [{ name: 'uri',     type: STRING  }],
        },
        {
            name: 'ownerOf',
            type: FN,
            constant: true,
            inputs:  [{ name: 'tokenId', type: UINT256 }],
            outputs: [{ name: 'owner',   type: ADDRESS }],
        },
        {
            name: 'minterOf',
            type: FN,
            constant: true,
            inputs:  [{ name: 'tokenId', type: UINT256 }],
            outputs: [{ name: 'minter',  type: ADDRESS }],
        },
        {
            name: 'mintedAt',
            type: FN,
            constant: true,
            inputs:  [{ name: 'tokenId',    type: UINT256 }],
            outputs: [{ name: 'blockNumber', type: UINT256 }],
        },
    ];
}

// Cached contract instance
let _contract: ReturnType<OPNetSDK['getContract']> | null = null;

async function getOPFaceContract() {
    if (!_contract) {
        const { getContract } = await loadSDK();
        const { networks }    = await loadBitcoin();
        const provider = await getProvider();
        const abi      = await buildABI();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _contract = getContract(CONTRACT_ADDRESS, abi as any, provider, networks.regtest);
    }
    return _contract;
}

// ─── Read: totalSupply ────────────────────────────────────────────────────────

export async function fetchTotalSupply(): Promise<bigint> {
    try {
        const contract = await getOPFaceContract();
        const result   = await (contract as any).totalSupply();

        if (result && 'error' in result) return 0n;
        return BigInt(result?.properties?.supply ?? 0);
    } catch (err) {
        console.error('fetchTotalSupply error:', err);
        return 0n;
    }
}

// ─── Read: single token ───────────────────────────────────────────────────────

export async function fetchToken(tokenId: bigint): Promise<NFTToken | null> {
    try {
        const contract = await getOPFaceContract();

        const [uriRes, ownerRes, minterRes, mintedAtRes] = await Promise.allSettled([
            (contract as any).tokenURI(tokenId),
            (contract as any).ownerOf(tokenId),
            (contract as any).minterOf(tokenId),
            (contract as any).mintedAt(tokenId),
        ]);

        const val = (r: PromiseSettledResult<any>) =>
            r.status === 'fulfilled' ? r.value : null;

        const tokenURI = String(val(uriRes)?.properties?.uri     ?? '');
        const owner    = String(val(ownerRes)?.properties?.owner  ?? '');
        const minter   = String(val(minterRes)?.properties?.minter ?? '');
        const mintedAt = BigInt(val(mintedAtRes)?.properties?.blockNumber ?? 0);

        // Resolve metadata from IPFS
        let metadata: NFTMetadata | undefined;
        try {
            const metaURL = resolveIPFSUri(tokenURI);
            const res     = await fetch(metaURL);
            if (res.ok) metadata = await res.json();
        } catch {
            // metadata optional
        }

        return { tokenId, owner, minter, mintedAt, tokenURI, metadata };
    } catch {
        return null;
    }
}

// ─── Read: gallery (latest N tokens) ─────────────────────────────────────────

export async function fetchGallery(count = 20): Promise<NFTToken[]> {
    const supply = await fetchTotalSupply();
    if (supply === 0n) return [];

    const from = supply > BigInt(count) ? supply - BigInt(count) + 1n : 1n;

    const ids: bigint[] = [];
    for (let id = supply; id >= from; id--) ids.push(id);

    const tokens = await Promise.all(ids.map(fetchToken));
    return tokens.filter((t): t is NFTToken => t !== null);
}

// ─── Write: mint ──────────────────────────────────────────────────────────────

export interface MintParams {
    tokenURI: string;
    senderAddress: string;
    walletSignFn: (psbtHex: string) => Promise<string>;
    walletBroadcastFn: (signedHex: string) => Promise<string>;
}

export async function mintToken(params: MintParams): Promise<{ tokenId: bigint; txHash: string }> {
    const contract = await getOPFaceContract();

    // Call the contract's mint method (simulation / calldata generation)
    const callResult = await (contract as any).mint(params.tokenURI);

    if (!callResult || ('error' in callResult && callResult.error)) {
        throw new Error(callResult?.error ?? 'Contract call failed');
    }

    if (callResult.revert) {
        throw new Error(`Contract reverted: ${callResult.revert}`);
    }

    // The callResult holds the encoded calldata.
    // For OP_WALLET signing we need to build the interaction TX.
    // The SDK's `sendTransaction()` method handles this when given
    // a wallet-compatible signer (one with `multiSignPsbt`).
    //
    // In the current minimal flow we rely on the wallet extension's
    // own signPsbt / pushPsbt methods passed in as callbacks.

    const calldata = callResult.calldata;
    if (!calldata) {
        throw new Error('Contract did not return calldata for signing');
    }

    // Sign via wallet
    const signedPsbt = await params.walletSignFn(calldata.toString('hex'));

    // Broadcast
    const txHash = await params.walletBroadcastFn(signedPsbt);

    // Parse returned tokenId
    const tokenId = BigInt(callResult?.properties?.tokenId ?? 0);

    return { tokenId, txHash };
}
