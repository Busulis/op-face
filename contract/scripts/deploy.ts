/**
 * OP Face — Testnet Deployment Script
 *
 * Usage:
 *   DEPLOYER_WIF=cXxx... npx ts-node scripts/deploy.ts --network regtest
 *   DEPLOYER_WIF=cXxx... npx ts-node scripts/deploy.ts --network testnet
 *
 * The script:
 *   1. Loads the compiled WASM from build/OPFace.wasm
 *   2. Creates a wallet from the WIF private key
 *   3. Fetches UTXOs and a proof-of-work challenge from the OP_NET node
 *   4. Signs a two-transaction deployment (funding + reveal)
 *   5. Broadcasts both transactions
 *   6. Prints the contract address
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// OP_NET SDK
import { JSONRpcProvider }                                        from 'opnet';
import { EcKeyPair, TransactionFactory, Mnemonic, MLDSASecurityLevel } from '@btc-vision/transaction';
import type { IDeploymentParameters }                             from '@btc-vision/transaction';
import { networks }                                               from '@btc-vision/bitcoin';

// ─── Config ───────────────────────────────────────────────────────────────────

const NETWORKS = {
    regtest: {
        btcNetwork: networks.regtest,
        rpc:        'https://regtest.opnet.org',
        explorer:   'https://explorer.opnet.org',
    },
    testnet: {
        btcNetwork: networks.testnet,
        rpc:        'https://testnet.opnet.org',
        explorer:   'https://testnet-explorer.opnet.org',
    },
} as const;

type Network = keyof typeof NETWORKS;

// ─── Parse args ───────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const netIdx     = args.indexOf('--network');
const network    = (netIdx !== -1 ? args[netIdx + 1] : 'regtest') as Network;

if (!NETWORKS[network]) {
    console.error(`Unknown network: "${network}". Use 'regtest' or 'testnet'.`);
    process.exit(1);
}

const { btcNetwork, rpc, explorer } = NETWORKS[network];

// ─── Env ──────────────────────────────────────────────────────────────────────

const wif = process.env.DEPLOYER_WIF;
if (!wif) {
    console.error('Error: DEPLOYER_WIF environment variable is not set.');
    console.error('Example:');
    console.error('  DEPLOYER_WIF=cYourWIF... npx ts-node scripts/deploy.ts --network regtest');
    process.exit(1);
}

// ─── WASM ─────────────────────────────────────────────────────────────────────

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const wasmPath   = path.resolve(__dirname, '../build/OPFace.wasm');

if (!fs.existsSync(wasmPath)) {
    console.error(`WASM not found: ${wasmPath}`);
    console.error('Run `npm run build` first.');
    process.exit(1);
}

const bytecode = fs.readFileSync(wasmPath);
console.log(`\n🎭  OP Face — Deploying to ${network.toUpperCase()}`);
console.log(`    WASM : ${wasmPath} (${(bytecode.length / 1024).toFixed(1)} KB)`);
console.log(`    RPC  : ${rpc}\n`);

// ─── Wallet ───────────────────────────────────────────────────────────────────

const keypair    = EcKeyPair.fromWIF(wif, btcNetwork);
const p2trAddr   = EcKeyPair.getTaprootAddress(keypair, btcNetwork);

console.log(`    Wallet (P2TR): ${p2trAddr}`);

// ─── MLDSA (quantum-resistant signer) ────────────────────────────────────────
// The OP_NET SDK requires an mldsaSigner for deployment.  We generate an
// ephemeral ML-DSA44 keypair from a random mnemonic so the deployment
// transaction satisfies the hashedPublicKey requirement.

console.log('\n    Generating ephemeral ML-DSA keypair …');
const mnemonic       = Mnemonic.generate(undefined, '', btcNetwork, MLDSASecurityLevel.LEVEL2);
const mldsaWallet    = mnemonic.derive(0);
const mldsaSigner    = mldsaWallet.mldsaKeypair;
console.log(`    ML-DSA44 pubkey: ${Buffer.from(mldsaSigner.publicKey).toString('hex').substring(0, 40)}…`);

// ─── Provider ─────────────────────────────────────────────────────────────────

const provider = new JSONRpcProvider(rpc, btcNetwork);
const factory  = new TransactionFactory();

// ─── Fetch UTXOs ─────────────────────────────────────────────────────────────

console.log('\n[1/5] Fetching UTXOs…');
const utxos = await provider.utxoManager.getUTXOs({ address: p2trAddr });

if (utxos.length === 0) {
    console.error(`\n❌  No UTXOs found for ${p2trAddr}`);
    console.error(`    Fund this address with testnet tBTC from the faucet:`);
    console.error(`    https://faucet.opnet.org  or  https://testnet.manu.backend.taiwan.gov.tw/bitcoin`);
    process.exit(1);
}

const totalSat = utxos.reduce((s, u) => s + u.value, 0n);
console.log(`    Found ${utxos.length} UTXO(s) — total ${Number(totalSat / 1000n) / 100} tBTC`);

// ─── Challenge (proof-of-work) ────────────────────────────────────────────────

console.log('\n[2/5] Getting challenge…');
const challenge = await provider.getChallenge();
console.log(`    Challenge epoch: ${challenge.epoch ?? '(no epoch)'}`);

// ─── Build deployment parameters ─────────────────────────────────────────────

console.log('\n[3/5] Building deployment transaction…');

const deployParams: IDeploymentParameters = {
    // Deployer address
    from:             p2trAddr,

    // Classical signer (from WIF)
    signer:           keypair,

    // Quantum signer (ephemeral ML-DSA44 keypair)
    mldsaSigner:      mldsaSigner,

    // UTXOs to fund the deployment
    utxos:            utxos,

    // Network
    network:          btcNetwork,

    // Fees (sat/vByte)
    feeRate:          5,

    // Protocol fee
    priorityFee:      0n,

    // Gas limit in satoshis
    gasSatFee:        10_000n,

    // The compiled contract WASM
    bytecode:         bytecode,

    // Constructor calldata — OPFace.onDeployment() reads nothing from calldata,
    // it calls instantiate() with hardcoded values.
    // calldata: undefined,

    // Challenge proof-of-work
    challenge:        challenge,

    // Link the ephemeral MLDSA pubkey to the deployer address
    revealMLDSAPublicKey:        true,
    linkMLDSAPublicKeyToAddress: true,
};

// ─── Sign ─────────────────────────────────────────────────────────────────────

const deployment = await factory.signDeployment(deployParams);

console.log(`\n    Contract address : ${deployment.contractAddress}`);
console.log(`    Funding TX (hex) : ${deployment.transaction[0].substring(0, 40)}…`);
console.log(`    Reveal  TX (hex) : ${deployment.transaction[1].substring(0, 40)}…`);

// ─── Broadcast ────────────────────────────────────────────────────────────────

console.log('\n[4/5] Broadcasting funding transaction…');
const fundingResult = await provider.sendRawTransaction(deployment.transaction[0]);
if (!fundingResult || fundingResult.error) {
    console.error('❌  Funding TX failed:', fundingResult?.error ?? 'unknown error');
    process.exit(1);
}
console.log(`    Funding TX ID: ${fundingResult.result ?? fundingResult.txid}`);

console.log('\n[5/5] Broadcasting reveal transaction…');
const revealResult = await provider.sendRawTransaction(deployment.transaction[1]);
if (!revealResult || revealResult.error) {
    console.error('❌  Reveal TX failed:', revealResult?.error ?? 'unknown error');
    console.error('    Save the funding TX ID above and retry reveal later.');
    process.exit(1);
}
console.log(`    Reveal  TX ID: ${revealResult.result ?? revealResult.txid}`);

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log('\n✅  Deployment complete!');
console.log(`    Contract : ${deployment.contractAddress}`);
console.log(`    Explorer : ${explorer}/contract/${deployment.contractAddress}`);
console.log('\nNext steps:');
console.log(`  1. Set in frontend/.env.local:`);
console.log(`       NEXT_PUBLIC_CONTRACT_ADDRESS=${deployment.contractAddress}`);
console.log(`  2. cd ../frontend && npm install && npm run dev`);
