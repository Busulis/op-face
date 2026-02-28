'use client';

import Image from 'next/image';
import Link from 'next/link';
import { resolveIPFSUri } from '@/lib/ipfs';
import type { NFTToken } from '@/types';

interface Props {
    token: NFTToken;
    size?: 'sm' | 'md';
}

export default function TokenCard({ token, size = 'md' }: Props) {
    const imageURL = resolveIPFSUri(token.metadata?.image ?? token.tokenURI);
    const name     = token.metadata?.name ?? `OP Face #${token.tokenId}`;

    return (
        <Link
            href={`/token/${token.tokenId}`}
            className="group block rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-0.5"
        >
            {/* Image */}
            <div className={`relative bg-zinc-950 overflow-hidden ${size === 'sm' ? 'aspect-square' : 'aspect-square'}`}>
                <Image
                    src={imageURL}
                    alt={name}
                    fill
                    sizes={size === 'sm' ? '160px' : '280px'}
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${token.tokenId}/400/400`;
                    }}
                />
                {/* Token ID badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-xs text-orange-400 font-mono font-semibold">
                    #{token.tokenId.toString()}
                </div>
            </div>

            {/* Info */}
            <div className={`p-3 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
                <p className="font-semibold text-white truncate">{name}</p>
                {size === 'md' && (
                    <p className="mt-0.5 text-zinc-500 truncate font-mono text-xs">
                        {truncateAddress(token.owner)}
                    </p>
                )}
            </div>
        </Link>
    );
}

function truncateAddress(addr: string): string {
    if (!addr) return '—';
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}
