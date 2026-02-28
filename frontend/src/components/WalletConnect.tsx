'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    connectWallet,
    disconnectWallet,
    getWalletAddress,
    getWalletBalance,
    isProviderAvailable,
    satToBTC,
    onAccountsChanged,
} from '@/lib/wallet';
import type { WalletState } from '@/types';

// ─── Truncate address ─────────────────────────────────────────────────────────
function truncate(addr: string, n = 8): string {
    if (!addr) return '';
    if (addr.length <= n * 2) return addr;
    return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    onConnect?: (address: string) => void;
    onDisconnect?: () => void;
}

export default function WalletConnect({ onConnect, onDisconnect }: Props) {
    const [state, setState] = useState<WalletState>({
        connected: false,
        address: null,
        balance: 0n,
        loading: false,
    });
    const [copied, setCopied] = useState(false);

    // Try to restore session on mount
    useEffect(() => {
        (async () => {
            if (!isProviderAvailable()) return;
            const addr = await getWalletAddress();
            if (addr) {
                const bal = await getWalletBalance();
                setState({ connected: true, address: addr, balance: bal, loading: false });
                onConnect?.(addr);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for account changes
    useEffect(() => {
        const off = onAccountsChanged(async (addr) => {
            const bal = await getWalletBalance();
            setState(s => ({ ...s, address: addr, balance: bal, connected: true }));
            onConnect?.(addr);
        });
        return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleConnect = useCallback(async () => {
        setState(s => ({ ...s, loading: true, error: undefined }));
        try {
            const { address } = await connectWallet();
            const balance      = await getWalletBalance();
            setState({ connected: true, address, balance, loading: false });
            onConnect?.(address);
        } catch (err) {
            setState(s => ({ ...s, loading: false, error: (err as Error).message }));
        }
    }, [onConnect]);

    const handleDisconnect = useCallback(async () => {
        await disconnectWallet();
        setState({ connected: false, address: null, balance: 0n, loading: false });
        onDisconnect?.();
    }, [onDisconnect]);

    const handleCopy = useCallback(() => {
        if (!state.address) return;
        navigator.clipboard.writeText(state.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [state.address]);

    // ── Render: not installed ──────────────────────────────────────────────────
    if (!isProviderAvailable() && typeof window !== 'undefined') {
        return (
            <a
                href="https://opnet.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-colors"
            >
                Install OP_WALLET
                <span className="text-xs opacity-75">↗</span>
            </a>
        );
    }

    // ── Render: disconnected ───────────────────────────────────────────────────
    if (!state.connected) {
        return (
            <button
                onClick={handleConnect}
                disabled={state.loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-500/25"
            >
                {state.loading ? (
                    <>
                        <Spinner />
                        Connecting…
                    </>
                ) : (
                    <>
                        <WalletIcon />
                        Connect OP_WALLET
                    </>
                )}
            </button>
        );
    }

    // ── Render: connected ──────────────────────────────────────────────────────
    return (
        <div className="flex items-center gap-3">
            {/* Balance chip */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
                <span className="text-orange-400">₿</span>
                <span>{satToBTC(state.balance)}</span>
                <span className="text-zinc-500">tBTC</span>
            </div>

            {/* Address + copy */}
            <button
                onClick={handleCopy}
                title={state.address ?? ''}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
            >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{truncate(state.address ?? '')}</span>
                <span className="text-xs text-zinc-500">{copied ? '✓' : '⎘'}</span>
            </button>

            {/* Disconnect */}
            <button
                onClick={handleDisconnect}
                title="Disconnect"
                className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            >
                <DisconnectIcon />
            </button>
        </div>
    );
}

// ─── Mini icons ───────────────────────────────────────────────────────────────

function WalletIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 10h18M7 15h.01M11 15h.01M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
        </svg>
    );
}

function DisconnectIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    );
}

function Spinner() {
    return (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}
