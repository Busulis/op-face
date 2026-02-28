import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchToken } from '@/lib/contract';
import { resolveIPFSUri } from '@/lib/ipfs';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(
    { params }: { params: { id: string } }
): Promise<Metadata> {
    const tokenId = BigInt(params.id || '0');
    const token   = await fetchToken(tokenId);

    if (!token) {
        return { title: 'Token Not Found — OP Face' };
    }

    const name  = token.metadata?.name ?? `OP Face #${token.tokenId}`;
    const image = resolveIPFSUri(token.metadata?.image ?? token.tokenURI);

    return {
        title:       `${name} — OP Face`,
        description: token.metadata?.description ?? 'A unique face minted on Bitcoin via OP_NET.',
        openGraph: {
            title:  name,
            images: [{ url: image }],
            type:   'website',
        },
    };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TokenPage({ params }: { params: { id: string } }) {
    const rawId = params.id;
    const tokenId = BigInt(rawId || '0');

    if (tokenId <= 0n || tokenId > 100n) {
        notFound();
    }

    const token = await fetchToken(tokenId);

    if (!token) {
        notFound();
    }

    const imageURL = resolveIPFSUri(token.metadata?.image ?? token.tokenURI);
    const name     = token.metadata?.name ?? `OP Face #${token.tokenId}`;
    const desc     = token.metadata?.description ?? 'A unique face minted on Bitcoin via OP_NET.';

    const attributes = token.metadata?.attributes ?? [];

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
            {/* Back */}
            <Link
                href="/"
                className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-8 transition-colors"
            >
                <span>←</span> Back to Gallery
            </Link>

            <div className="grid md:grid-cols-2 gap-10">
                {/* ── Image ───────────────────────────────────────────────── */}
                <div className="space-y-4">
                    <div className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
                        <Image
                            src={imageURL}
                            alt={name}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-contain p-2"
                            unoptimized
                            priority
                        />
                    </div>
                </div>

                {/* ── Info ────────────────────────────────────────────────── */}
                <div className="space-y-6">
                    {/* Header */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">
                                OP FACE
                            </span>
                            <span className="text-xs text-zinc-600">Bitcoin · OP_NET Testnet</span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-white">{name}</h1>
                        <p className="mt-2 text-zinc-400 leading-relaxed">{desc}</p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <InfoCard label="Token ID" value={`#${token.tokenId}`} mono />
                        <InfoCard label="Minted at Block" value={token.mintedAt.toString()} mono />
                    </div>

                    {/* Addresses */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 divide-y divide-zinc-800">
                        <AddressRow label="Owner"  value={token.owner}  />
                        <AddressRow label="Minter" value={token.minter} />
                    </div>

                    {/* Token URI */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                        <p className="text-xs text-zinc-500 font-medium mb-1.5">Token URI</p>
                        <a
                            href={resolveIPFSUri(token.tokenURI)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-orange-400 hover:text-orange-300 break-all font-mono underline"
                        >
                            {token.tokenURI}
                        </a>
                    </div>

                    {/* Attributes */}
                    {attributes.length > 0 && (
                        <div>
                            <p className="text-sm font-semibold text-zinc-300 mb-3">Attributes</p>
                            <div className="grid grid-cols-2 gap-2">
                                {attributes.map((attr, i) => (
                                    <div
                                        key={i}
                                        className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                                    >
                                        <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
                                            {attr.trait_type}
                                        </p>
                                        <p className="text-sm text-white font-semibold mt-0.5 truncate">
                                            {String(attr.value)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Explorer link */}
                    <a
                        href={`https://explorer.opnet.org/token/${token.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 w-full justify-center py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-sm font-medium transition-colors"
                    >
                        View on OP_NET Explorer ↗
                    </a>
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs text-zinc-500 font-medium">{label}</p>
            <p className={`text-base text-white font-semibold mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>
                {value}
            </p>
        </div>
    );
}

function AddressRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-500 font-medium shrink-0">{label}</span>
            <span className="text-xs text-zinc-300 font-mono truncate" title={value}>
                {value || '—'}
            </span>
        </div>
    );
}
