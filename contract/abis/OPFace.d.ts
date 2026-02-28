import { Address, AddressMap } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the mint function call.
 */
export type Mint = CallResult<
    {
        tokenId: bigint;
    },
    OPNetEvent<TransferEvent>[]
>;

/**
 * @description Represents the result of the minterOf function call.
 */
export type MinterOf = CallResult<
    {
        minter: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the mintedAt function call.
 */
export type MintedAt = CallResult<
    {
        blockNumber: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the mintPrice function call.
 */
export type MintPrice = CallResult<
    {
        price: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the treasury function call.
 */
export type Treasury = CallResult<
    {
        treasury: string;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IOPFace
// ------------------------------------------------------------------
export interface IOPFace extends IOP_NETContract {
    mint(tokenURI: string): Promise<Mint>;
    minterOf(tokenId: bigint): Promise<MinterOf>;
    mintedAt(tokenId: bigint): Promise<MintedAt>;
    mintPrice(): Promise<MintPrice>;
    treasury(): Promise<Treasury>;
}
