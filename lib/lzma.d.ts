/** xs */
/**
 * NOTE: This is the master file that is used to generate lzma-c.js and lzma-d.js.
 *      Comments are used to determine which parts are to be removed.
 *
 * cs-ce (compression start-end)
 * ds-de (decompression start-end)
 * xs-xe (only in this file start-end)
 * co    (compression only)
 * do    (decompression only)
 */
/** xe */
/** ce */
type Mode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export declare function compress(str: string | Uint8Array, mode?: Mode): Int8Array;
export declare function decompress(bytearray: Uint8Array): Int8Array;
export {};
/** ce */
