import { Blockchain } from '@btc-vision/btc-runtime/runtime';
import { revertOnError } from '@btc-vision/btc-runtime/runtime/abort/abort';
import { OPFace } from './contracts/OPFace';

// DO NOT TOUCH THIS.
Blockchain.contract = () => {
    // ONLY CHANGE THE CONTRACT CLASS NAME.
    return new OPFace();
};

// VERY IMPORTANT — export the WASM entry points from the runtime.
export * from '@btc-vision/btc-runtime/runtime/exports';

// VERY IMPORTANT — wire up the abort handler.
export function abort(message: string, fileName: string, line: u32, column: u32): void {
    revertOnError(message, fileName, line, column);
}
