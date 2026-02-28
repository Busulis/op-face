import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP721,
    OP721InitParameters,
    Revert,
    SafeMath,
    StoredMapU256,
    StoredU256,
    EMPTY_POINTER,
    Address,
    U256_BYTE_LENGTH,
} from '@btc-vision/btc-runtime/runtime';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mint price: 0.005 tBTC = 500,000 satoshis */
const MINT_PRICE: u64 = 500_000;

/** Treasury address (bech32m string embedded in each transaction output) */
const TREASURY: string = 'bcrt1pzcu0e6e04uc5l43fvrr2czh2fxh5my8c08ggnywghw3hchznqdcsr9x2s9';

// ─── Extra storage pointers (appended after OP721's own pointers) ─────────────

const minterOfPointer: u16 = Blockchain.nextPointer;  // tokenId -> minter address (as u256)
const mintedAtPointer: u16 = Blockchain.nextPointer;  // tokenId -> block number (as u256)

// ─── Contract ─────────────────────────────────────────────────────────────────

@final
export class OPFace extends OP721 {
    // Per-token: who originally minted (stored as u256 from address bytes)
    private readonly _minterOf: StoredMapU256 = new StoredMapU256(minterOfPointer);
    // Per-token: Bitcoin block number at mint time (stored as u256)
    private readonly _mintedAt: StoredMapU256 = new StoredMapU256(mintedAtPointer);

    public constructor() {
        super();
    }

    // ── Deployment ────────────────────────────────────────────────────────────

    public override onDeployment(_calldata: Calldata): void {
        // Initialize OP721 collection (name, symbol, baseURI, maxSupply=100)
        this.instantiate(
            new OP721InitParameters(
                'OP Face',
                'OPFACE',
                'ipfs://',            // baseURI prefix; full URI per token
                u256.fromU32(100),   // max supply
                '',                  // collectionBanner
                '',                  // collectionIcon
                'https://opface.btc', // collectionWebsite
                'Limited to 100 unique faces minted on Bitcoin via OP_NET.',
            ),
        );
        // Ensure nextTokenId starts at 1
        this._nextTokenId.value = u256.One;
    }

    // ── Mint ─────────────────────────────────────────────────────────────────

    @method({ name: 'tokenURI', type: ABIDataTypes.STRING })
    @returns({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @emit('Transfer')
    public mint(calldata: Calldata): BytesWriter {
        const uri: string = calldata.readStringWithLength();
        const sender: Address = Blockchain.tx.sender;

        // 1. Check supply cap (OP721 base checks this too, but be explicit)
        if (this._totalSupply.value >= u256.fromU32(100)) {
            throw new Revert('OPFace: max supply of 100 reached');
        }

        // 2. Validate BTC payment: must find an output sending >= 500,000 sat to TREASURY
        this._requireTreasuryPayment();

        // 3. Assign token ID from counter
        const tokenId: u256 = this._nextTokenId.value;

        // 4. Mint via OP721 base (sets owner, increments supply, emits Transfer event)
        this._mint(sender, tokenId);

        // 5. Set per-token metadata URI
        this._setTokenURI(tokenId, uri);

        // 6. Store minter and timestamp
        this._minterOf.set(tokenId, this._u256FromAddress(sender));
        this._mintedAt.set(tokenId, u256.fromU64(Blockchain.block.number));

        // 7. Advance the token ID counter
        this._nextTokenId.value = SafeMath.add(tokenId, u256.One);

        // 8. Return the newly minted token ID
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(tokenId);
        return w;
    }

    // ── Read: minterOf ────────────────────────────────────────────────────────

    @method({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'minter', type: ABIDataTypes.ADDRESS })
    public minterOf(calldata: Calldata): BytesWriter {
        const tokenId: u256 = calldata.readU256();
        this._requireExists(tokenId);

        const minterU256 = this._minterOf.get(tokenId);
        const w = new BytesWriter(32);
        w.writeU256(minterU256);
        return w;
    }

    // ── Read: mintedAt ────────────────────────────────────────────────────────

    @method({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'blockNumber', type: ABIDataTypes.UINT256 })
    public mintedAt(calldata: Calldata): BytesWriter {
        const tokenId: u256 = calldata.readU256();
        this._requireExists(tokenId);

        const blockNum = this._mintedAt.get(tokenId);
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(blockNum);
        return w;
    }

    // ── Read: mintPrice ───────────────────────────────────────────────────────

    @method()
    @returns({ name: 'price', type: ABIDataTypes.UINT256 })
    public mintPrice(_: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(u256.fromU64(MINT_PRICE));
        return w;
    }

    // ── Read: treasury ────────────────────────────────────────────────────────

    @method()
    @returns({ name: 'treasury', type: ABIDataTypes.STRING })
    public treasury(_: Calldata): BytesWriter {
        const encoded = String.UTF8.encode(TREASURY);
        const w = new BytesWriter(4 + encoded.byteLength);
        w.writeU32(encoded.byteLength as u32);
        w.writeBytes(Uint8Array.wrap(encoded));
        return w;
    }

    // ── Internal: payment guard ────────────────────────────────────────────────

    private _requireTreasuryPayment(): void {
        const outputs = Blockchain.tx.outputs;
        for (let i = 0; i < outputs.length; i++) {
            const out = outputs[i];
            // `out.to` is a nullable string (the decoded bech32 address of the output)
            if (out.to !== null && out.to === TREASURY && out.value >= MINT_PRICE) {
                return; // payment confirmed
            }
        }
        throw new Revert(
            `OPFace: no output found sending ${MINT_PRICE} sat to treasury. ` +
            `Include an output to ${TREASURY} with at least 0.005 tBTC.`,
        );
    }

    // ── Internal: existence guard ──────────────────────────────────────────────

    private _requireExists(tokenId: u256): void {
        if (!this._exists(tokenId)) {
            throw new Revert(`OPFace: token ${tokenId} does not exist`);
        }
    }
}
