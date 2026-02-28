'use client';

/**
 * OP_WALLET / Unisat wallet helpers.
 *
 * The SDK (`@btc-vision/transaction`) already declares on the global Window:
 *   window.opnet?: OPWallet   (extends Unisat)
 *   window.unisat?: Unisat
 * so we do NOT re-declare them here — doing so would conflict.
 */

// ─── Provider access ──────────────────────────────────────────────────────────

export function getProvider() {
    if (typeof window === 'undefined') return null;
    return window.opnet ?? window.unisat ?? null;
}

export function isProviderAvailable(): boolean {
    return getProvider() !== null;
}

// ─── Wallet connection ────────────────────────────────────────────────────────

export async function connectWallet(): Promise<{ address: string }> {
    const provider = getProvider();
    if (!provider) {
        throw new Error(
            'OP_WALLET not detected. Please install the OP_WALLET browser extension from https://opnet.org'
        );
    }

    const accounts = await provider.requestAccounts();
    const address = accounts[0];
    if (!address) throw new Error('No accounts returned by wallet');

    return { address };
}

export async function disconnectWallet(): Promise<void> {
    const provider = getProvider();
    if (provider?.disconnect) {
        provider.disconnect();
    }
}

export async function getWalletAddress(): Promise<string | null> {
    const provider = getProvider();
    if (!provider) return null;
    try {
        const accounts = await provider.getAccounts();
        return accounts[0] ?? null;
    } catch {
        return null;
    }
}

export async function getWalletBalance(): Promise<bigint> {
    const provider = getProvider();
    if (!provider) return 0n;
    try {
        const bal = await provider.getBalance();
        return BigInt(bal.total);
    } catch {
        return 0n;
    }
}

// ─── Satoshi helpers ──────────────────────────────────────────────────────────

/** Convert satoshis (bigint) to BTC display string. */
export function satToBTC(sat: bigint): string {
    if (sat === 0n) return '0.00000000';
    const whole = sat / 100_000_000n;
    const frac  = sat % 100_000_000n;
    return `${whole}.${frac.toString().padStart(8, '0')}`;
}

/** Parse BTC string to satoshis. */
export function btcToSat(btc: string): bigint {
    const [whole = '0', frac = ''] = btc.split('.');
    const fracPadded = frac.padEnd(8, '0').slice(0, 8);
    return BigInt(whole) * 100_000_000n + BigInt(fracPadded);
}

// ─── Event helpers ────────────────────────────────────────────────────────────

export function onAccountsChanged(handler: (address: string) => void): () => void {
    const provider = getProvider();
    if (!provider) return () => {};

    const wrapped = (accounts: string[]) => {
        const addr = accounts[0];
        if (addr) handler(addr);
    };

    provider.on('accountsChanged', wrapped);
    return () => provider.removeListener('accountsChanged', wrapped);
}
