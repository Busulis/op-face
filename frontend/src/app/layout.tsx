import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'OP Face — Bitcoin NFT on OP_NET',
    description: 'Mint one of 100 unique face NFTs on Bitcoin. Powered by OP_NET.',
    keywords: ['OP_NET', 'Bitcoin NFT', 'BTC NFT', 'OP Face', 'Bitcoin smart contract'],
    openGraph: {
        title: 'OP Face — Bitcoin NFT on OP_NET',
        description: 'Mint one of 100 unique face NFTs on Bitcoin. Powered by OP_NET.',
        type: 'website',
    },
    icons: {
        icon: '/favicon.ico',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
                {/* Global nav */}
                <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                        <a href="/" className="flex items-center gap-2.5 font-bold text-lg">
                            <span className="text-2xl">🎭</span>
                            <span className="text-white">OP Face</span>
                            <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-normal">
                                Testnet
                            </span>
                        </a>

                        {/* Nav links */}
                        <nav className="hidden sm:flex items-center gap-6 text-sm text-zinc-400">
                            <a href="/" className="hover:text-white transition-colors">Mint</a>
                            <a href="/#gallery" className="hover:text-white transition-colors">Gallery</a>
                            <a
                                href="https://explorer.opnet.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-white transition-colors"
                            >
                                Explorer ↗
                            </a>
                        </nav>
                    </div>
                </header>

                <main>{children}</main>

                <footer className="mt-24 border-t border-zinc-800/60 py-8">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
                        <p>© 2024 OP Face · Built on Bitcoin via OP_NET</p>
                        <div className="flex items-center gap-4">
                            <a
                                href="https://opnet.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-zinc-400 transition-colors"
                            >
                                OP_NET
                            </a>
                            <a
                                href="https://github.com/btc-vision"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-zinc-400 transition-colors"
                            >
                                GitHub
                            </a>
                        </div>
                    </div>
                </footer>
            </body>
        </html>
    );
}
