'use client';

import { useState, useRef, useCallback, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';
import { uploadFileToIPFS, uploadJSONToIPFS, buildMetadata } from '@/lib/ipfs';
import { mintToken, MINT_PRICE_SAT } from '@/lib/contract';
import { getProvider } from '@/lib/wallet';
import type { MintState } from '@/types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

interface Props {
    walletAddress: string | null;
    totalSupply: bigint;
    onMinted?: (tokenId: bigint) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MintForm({ walletAddress, totalSupply, onMinted }: Props) {
    const [file, setFile]          = useState<File | null>(null);
    const [preview, setPreview]    = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [mint, setMint]          = useState<MintState>({ step: 'idle' });
    const fileRef                  = useRef<HTMLInputElement>(null);

    const isSoldOut = totalSupply >= 100n;
    const isBusy    = mint.step !== 'idle' && mint.step !== 'success' && mint.step !== 'error';

    // ── File selection ────────────────────────────────────────────────────────

    const handleFile = useCallback((f: File) => {
        if (!ACCEPTED_TYPES.includes(f.type)) {
            setMint({ step: 'error', error: 'Only PNG, JPG, GIF, or WEBP files are accepted.' });
            return;
        }
        if (f.size > MAX_FILE_SIZE) {
            setMint({ step: 'error', error: 'File must be under 5 MB.' });
            return;
        }
        setFile(f);
        setMint({ step: 'idle' });
        const url = URL.createObjectURL(f);
        setPreview(url);
    }, []);

    const onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
    }, [handleFile]);

    const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
    }, [handleFile]);

    // ── Mint ──────────────────────────────────────────────────────────────────

    const handleMint = useCallback(async () => {
        if (!walletAddress) {
            setMint({ step: 'error', error: 'Please connect your wallet first.' });
            return;
        }
        if (!file) {
            setMint({ step: 'error', error: 'Please select an image first.' });
            return;
        }
        if (isSoldOut) {
            setMint({ step: 'error', error: 'All 100 OP Face NFTs have been minted.' });
            return;
        }

        const provider = getProvider();
        if (!provider) {
            setMint({ step: 'error', error: 'OP_WALLET not found.' });
            return;
        }

        try {
            // Step 1: Upload image to IPFS
            setMint({ step: 'uploading' });
            const imageURI = await uploadFileToIPFS(file);

            // Step 2: Build & upload metadata
            const tentativeTokenId = Number(totalSupply) + 1;
            const metadata = buildMetadata({
                tokenId: tentativeTokenId,
                imageURI,
                minter: walletAddress,
            });
            const metaURI = await uploadJSONToIPFS(metadata);

            // Step 3: Sign PSBT
            setMint({ step: 'signing' });

            const { tokenId, txHash } = await mintToken({
                tokenURI: metaURI,
                senderAddress: walletAddress,
                walletSignFn: async (psbt) => {
                    return provider.signPsbt(psbt, { autoFinalized: true });
                },
                walletBroadcastFn: async (signed) => {
                    setMint({ step: 'broadcasting' });
                    return provider.pushPsbt(signed);
                },
            });

            setMint({ step: 'success', tokenId, txHash });
            onMinted?.(tokenId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setMint({ step: 'error', error: msg });
        }
    }, [walletAddress, file, isSoldOut, totalSupply, onMinted]);

    const reset = useCallback(() => {
        setFile(null);
        setPreview(null);
        setMint({ step: 'idle' });
        if (fileRef.current) fileRef.current.value = '';
    }, []);

    // ── Render: success ───────────────────────────────────────────────────────
    if (mint.step === 'success') {
        return (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-8 text-center space-y-4">
                <div className="text-5xl">🎉</div>
                <h2 className="text-2xl font-bold text-emerald-400">Minted!</h2>
                <p className="text-zinc-400">
                    <span className="text-white font-semibold">OP Face #{mint.tokenId?.toString()}</span> is now on Bitcoin.
                </p>
                {mint.txHash && (
                    <a
                        href={`https://explorer.opnet.org/tx/${mint.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-sm text-orange-400 hover:text-orange-300 underline"
                    >
                        View transaction ↗
                    </a>
                )}
                <div className="flex gap-3 justify-center pt-2">
                    <a
                        href={`/token/${mint.tokenId?.toString()}`}
                        className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-colors"
                    >
                        View Token
                    </a>
                    <button
                        onClick={reset}
                        className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm transition-colors"
                    >
                        Mint Another
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: main form ─────────────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* Drop zone / preview */}
            <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => !preview && fileRef.current?.click()}
                className={[
                    'relative rounded-2xl border-2 border-dashed transition-all overflow-hidden',
                    preview ? 'border-orange-500/50 cursor-default' : 'cursor-pointer',
                    isDragging ? 'border-orange-400 bg-orange-500/10' : 'border-zinc-700 hover:border-zinc-500',
                    !preview ? 'flex items-center justify-center min-h-[220px]' : '',
                ].join(' ')}
            >
                {preview ? (
                    <>
                        <Image
                            src={preview}
                            alt="Preview"
                            width={480}
                            height={480}
                            className="w-full object-contain max-h-[340px] rounded-2xl"
                            unoptimized
                        />
                        {!isBusy && (
                            <button
                                onClick={(e) => { e.stopPropagation(); reset(); }}
                                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-sm transition-colors"
                                title="Remove image"
                            >
                                ✕
                            </button>
                        )}
                    </>
                ) : (
                    <div className="py-10 px-6 text-center space-y-3">
                        <div className="text-4xl opacity-40">🖼️</div>
                        <p className="text-zinc-400 font-medium">Drop your image here</p>
                        <p className="text-zinc-600 text-sm">PNG, JPG, GIF, WEBP — up to 5 MB</p>
                        <span className="inline-block mt-2 px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm border border-zinc-700 hover:border-zinc-500 transition-colors">
                            Browse file
                        </span>
                    </div>
                )}
            </div>
            <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={onInputChange}
                className="hidden"
            />

            {/* Error */}
            {mint.step === 'error' && (
                <div className="rounded-xl bg-red-950/40 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                    {mint.error}
                </div>
            )}

            {/* Status */}
            {isBusy && (
                <div className="rounded-xl bg-zinc-800/60 border border-zinc-700 px-4 py-3 text-sm text-zinc-300 flex items-center gap-3">
                    <Spinner />
                    <span>{STEP_LABELS[mint.step]}</span>
                </div>
            )}

            {/* Mint button */}
            <button
                onClick={handleMint}
                disabled={!walletAddress || !file || isBusy || isSoldOut}
                className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg transition-all shadow-xl shadow-orange-500/20 active:scale-[0.98]"
            >
                {isBusy ? (
                    <span className="flex items-center justify-center gap-2">
                        <Spinner />
                        {STEP_LABELS[mint.step]}
                    </span>
                ) : isSoldOut ? (
                    'Sold Out'
                ) : !walletAddress ? (
                    'Connect Wallet to Mint'
                ) : (
                    'Mint for 0.005 tBTC'
                )}
            </button>

            {/* Price note */}
            {!isSoldOut && (
                <p className="text-center text-xs text-zinc-600">
                    Mint price: <span className="text-zinc-400">0.005 tBTC</span> ({MINT_PRICE_SAT.toLocaleString()} sat) + network fee
                </p>
            )}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
    uploading:    'Uploading image to IPFS…',
    signing:      'Sign in your wallet…',
    broadcasting: 'Broadcasting transaction…',
    confirming:   'Waiting for confirmation…',
};

function Spinner() {
    return (
        <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}
