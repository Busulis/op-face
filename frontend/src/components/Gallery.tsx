'use client';

import { useState, useEffect, useCallback } from 'react';
import TokenCard from './TokenCard';
import { fetchGallery } from '@/lib/contract';
import type { NFTToken } from '@/types';

interface Props {
    refreshTrigger?: number; // increment to force refresh
}

export default function Gallery({ refreshTrigger = 0 }: Props) {
    const [tokens,  setTokens]  = useState<NFTToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const t = await fetchGallery(20);
            setTokens(t);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load, refreshTrigger]);

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <section>
                <GalleryHeader />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            </section>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <section>
                <GalleryHeader />
                <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-8 text-center space-y-3">
                    <p className="text-red-400 font-medium">Failed to load gallery</p>
                    <p className="text-zinc-600 text-sm">{error}</p>
                    <button
                        onClick={load}
                        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </section>
        );
    }

    // ── Empty ─────────────────────────────────────────────────────────────────
    if (tokens.length === 0) {
        return (
            <section>
                <GalleryHeader />
                <div className="rounded-2xl border border-zinc-800 p-12 text-center space-y-3">
                    <div className="text-4xl opacity-30">🎭</div>
                    <p className="text-zinc-500 font-medium">No faces yet — be the first to mint!</p>
                </div>
            </section>
        );
    }

    // ── Grid ──────────────────────────────────────────────────────────────────
    return (
        <section>
            <GalleryHeader count={tokens.length} onRefresh={load} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {tokens.map((token) => (
                    <TokenCard key={token.tokenId.toString()} token={token} size="md" />
                ))}
            </div>
        </section>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GalleryHeader({ count, onRefresh }: { count?: number; onRefresh?: () => void }) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-2xl font-bold text-white">Recent Mints</h2>
                {count !== undefined && (
                    <p className="text-zinc-500 text-sm mt-0.5">Showing latest {count} NFTs</p>
                )}
            </div>
            {onRefresh && (
                <button
                    onClick={onRefresh}
                    className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="Refresh gallery"
                >
                    <RefreshIcon />
                </button>
            )}
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 animate-pulse">
            <div className="aspect-square bg-zinc-800" />
            <div className="p-3 space-y-2">
                <div className="h-4 bg-zinc-800 rounded-md w-3/4" />
                <div className="h-3 bg-zinc-800 rounded-md w-1/2" />
            </div>
        </div>
    );
}

function RefreshIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );
}
