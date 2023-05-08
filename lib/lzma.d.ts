/**
 * s - dictionary size
 * f - fb
 * m - matchFinder
 *
 * NOTE: Because some values are always the same, they have been removed.
 * lc is always 3
 * lp is always 0
 * pb is always 2
 */
declare const ModeMap: {
    readonly 1: {
        readonly s: 16;
        readonly f: 64;
        readonly m: 0;
    };
    readonly 2: {
        readonly s: 20;
        readonly f: 64;
        readonly m: 0;
    };
    readonly 3: {
        readonly s: 19;
        readonly f: 64;
        readonly m: 1;
    };
    readonly 4: {
        readonly s: 20;
        readonly f: 64;
        readonly m: 1;
    };
    readonly 5: {
        readonly s: 21;
        readonly f: 128;
        readonly m: 1;
    };
    readonly 6: {
        readonly s: 22;
        readonly f: 128;
        readonly m: 1;
    };
    readonly 7: {
        readonly s: 23;
        readonly f: 128;
        readonly m: 1;
    };
    readonly 8: {
        readonly s: 24;
        readonly f: 255;
        readonly m: 1;
    };
    readonly 9: {
        readonly s: 25;
        readonly f: 255;
        readonly m: 1;
    };
};
type Modes = keyof typeof ModeMap;
export declare function compress(data: string | Uint8Array | ArrayBuffer, mode?: Modes): Int8Array;
export declare function decompress(bytearray: Uint8Array | ArrayBuffer): Int8Array | string;
export {};
