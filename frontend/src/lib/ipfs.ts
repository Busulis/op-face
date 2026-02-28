'use client';

const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';
const PINATA_API     = 'https://api.pinata.cloud';

// ─── Pinata upload ────────────────────────────────────────────────────────────

export interface PinataConfig {
    apiKey: string;
    apiSecret: string;
}

function getPinataConfig(): PinataConfig {
    const apiKey    = process.env.NEXT_PUBLIC_PINATA_API_KEY ?? '';
    const apiSecret = process.env.NEXT_PUBLIC_PINATA_API_SECRET ?? '';
    return { apiKey, apiSecret };
}

/** Upload a File to IPFS via Pinata. Returns ipfs:// URI. */
export async function uploadFileToIPFS(file: File): Promise<string> {
    const { apiKey, apiSecret } = getPinataConfig();

    // Fallback: use NFT.Storage public endpoint if no Pinata key
    if (!apiKey || !apiSecret) {
        return uploadFileToNFTStorage(file);
    }

    const formData = new FormData();
    formData.append('file', file);

    const metadata = JSON.stringify({ name: `opface-${Date.now()}-${file.name}` });
    formData.append('pinataMetadata', metadata);

    const options = JSON.stringify({ cidVersion: 1 });
    formData.append('pinataOptions', options);

    const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
            pinata_api_key: apiKey,
            pinata_secret_api_key: apiSecret,
        },
        body: formData,
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`IPFS upload failed: ${msg}`);
    }

    const { IpfsHash } = await res.json();
    return `ipfs://${IpfsHash}`;
}

/** Upload a JSON object to IPFS via Pinata. Returns ipfs:// URI. */
export async function uploadJSONToIPFS(data: object): Promise<string> {
    const { apiKey, apiSecret } = getPinataConfig();

    if (!apiKey || !apiSecret) {
        return uploadJSONToNFTStorage(data);
    }

    const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            pinata_api_key: apiKey,
            pinata_secret_api_key: apiSecret,
        },
        body: JSON.stringify({
            pinataContent: data,
            pinataMetadata: { name: `opface-meta-${Date.now()}` },
        }),
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`IPFS metadata upload failed: ${msg}`);
    }

    const { IpfsHash } = await res.json();
    return `ipfs://${IpfsHash}`;
}

// ─── NFT.Storage fallback (public, no key needed) ────────────────────────────

async function uploadFileToNFTStorage(file: File): Promise<string> {
    const res = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_NFTSTORAGE_KEY ?? 'public'}`,
            'Content-Type': file.type,
        },
        body: file,
    });

    if (!res.ok) throw new Error('NFT.Storage upload failed');
    const { value } = await res.json();
    return `ipfs://${value.cid}`;
}

async function uploadJSONToNFTStorage(data: object): Promise<string> {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    return uploadFileToNFTStorage(blob as unknown as File);
}

// ─── Metadata builder ─────────────────────────────────────────────────────────

export interface BuildMetadataOptions {
    tokenId: number;
    imageURI: string;
    minter: string;
}

export function buildMetadata(opts: BuildMetadataOptions): object {
    return {
        name: `OP Face #${opts.tokenId}`,
        description:
            'A unique face minted on Bitcoin via OP_NET. Limited to 100 NFTs forever.',
        image: opts.imageURI,
        external_url: 'https://opface.btc',
        attributes: [
            { trait_type: 'Collection', value: 'OP Face' },
            { trait_type: 'Token ID',   value: opts.tokenId },
            { trait_type: 'Minter',     value: opts.minter },
            { trait_type: 'Chain',      value: 'Bitcoin (OP_NET)' },
        ],
    };
}

// ─── Gateway resolver ─────────────────────────────────────────────────────────

/** Convert ipfs:// URI to a public HTTPS gateway URL. */
export function resolveIPFSUri(uri: string): string {
    if (!uri) return '/placeholder.png';
    if (uri.startsWith('ipfs://')) {
        const cid = uri.slice(7);
        return `${PINATA_GATEWAY}/${cid}`;
    }
    if (uri.startsWith('http')) return uri;
    return `/placeholder.png`;
}
