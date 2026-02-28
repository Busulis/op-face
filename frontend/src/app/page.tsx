'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { fetchTotalSupply, MAX_SUPPLY } from '@/lib/contract';

// Dynamically import client-only components
const WalletConnect = dynamic(() => import('@/components/WalletConnect'), { ssr: false });
const MintForm      = dynamic(() => import('@/components/MintForm'),      { ssr: false });
const Gallery       = dynamic(() => import('@/components/Gallery'),       { ssr: false });

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
    const [walletAddress,   setWalletAddress]   = useState<string | null>(null);
    const [totalSupply,     setTotalSupply]      = useState<bigint>(BigInt(0));
    const [supplyLoading,   setSupplyLoading]    = useState(true);
    const [galleryRefresh,  setGalleryRefresh]   = useState(0);

    // Poll supply every 15 seconds
    useEffect(() => {
        let mounted = true;
        const refresh = async () => {
            try {
                const s = await fetchTotalSupply();
                if (mounted) setTotalSupply(s);
            } catch {
                // ignore
            } finally {
                if (mounted) setSupplyLoading(false);
            }
        };
        refresh();
        const id = setInterval(refresh, 15_000);
        return () => { mounted = false; clearInterval(id); };
    }, []);

    const handleMinted = useCallback((tokenId: bigint) => {
        setTotalSupply(s => s + 1n);
        setGalleryRefresh(n => n + 1);
        console.log('Minted token', tokenId);
    }, []);

    const minted  = Number(totalSupply);
    const pct     = Math.min((minted / Number(MAX_SUPPLY)) * 100, 100);
    const isSoldOut = totalSupply >= MAX_SUPPLY;

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-20">

            {/* ── Hero ───────────────────────────────────────────────────────── */}
            <section className="text-center space-y-6">
                <div className="inline-block text-6xl animate-bounce-slow">🎭</div>
                <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
                    <span className="text-white">OP </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                        Face
                    </span>
                </h1>
                <p className="max-w-xl mx-auto text-zinc-400 text-lg leading-relaxed">
                    100 unique faces minted forever on Bitcoin.
                    <br />
                    Powered by{' '}
                    <a
                        href="https://opnet.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
                    >
                        OP_NET
                    </a>
                    .
                </p>
            </section>

            {/* ── Mint counter ───────────────────────────────────────────────── */}
            <section id="mint" className="max-w-xl mx-auto space-y-8">

                {/* Counter card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm font-medium">Minted</span>
                        {isSoldOut ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-semibold border border-red-500/20">
                                SOLD OUT
                            </span>
                        ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                                LIVE
                            </span>
                        )}
                    </div>

                    <div className="flex items-end gap-3">
                        <span className="text-5xl font-extrabold text-white tabular-nums">
                            {supplyLoading ? '—' : minted}
                        </span>
                        <span className="text-2xl font-bold text-zinc-600 mb-1">/ 100</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-600">
                        <span>{Math.round(pct)}% minted</span>
                        <span>{100 - minted} remaining</span>
                    </div>
                </div>

                {/* Wallet connect */}
                <div className="flex justify-center">
                    <WalletConnect
                        onConnect={setWalletAddress}
                        onDisconnect={() => setWalletAddress(null)}
                    />
                </div>

                {/* Mint form */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                    <h2 className="text-lg font-semibold text-white mb-5">Mint your face</h2>
                    <MintForm
                        walletAddress={walletAddress}
                        totalSupply={totalSupply}
                        onMinted={handleMinted}
                    />
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                        { label: 'Price',       value: '0.005 tBTC' },
                        { label: 'Supply',      value: '100'         },
                        { label: 'Network',     value: 'Testnet'     },
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-4">
                            <p className="text-xl font-bold text-white">{value}</p>
                            <p className="text-xs text-zinc-500 mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Gallery ───────────────────────────────────────────────────── */}
            <section id="gallery">
                <Gallery refreshTrigger={galleryRefresh} />
            </section>

        </div>
    );
}
