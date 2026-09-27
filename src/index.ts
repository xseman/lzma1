/**
 * @license
 * Copyright Filip Seman
 * SPDX-License-Identifier: MIT
 */

import {
	type BinaryInput,
	compressData,
	decompressData,
	toUint8Array,
} from "./lzma.js";
import {
	type CompressionMode,
	type CompressionOptions,
	DEFAULT_LEVEL,
} from "./options.js";
import {
	decodeUtf8,
	encodeUtf8,
} from "./utf8.js";

export { CRC32_TABLE } from "./crc32.js";
export { type BinaryInput, LZMA } from "./lzma.js";
export type { CompressionMode, CompressionOptions } from "./options.js";
export { Compress, Decompress } from "./web-streams.js";

/**
 * Compresses data into the `.lzma` format.
 *
 * @param data Data to compress
 * @param mode Compression level (1-9, default 5) or options
 * @returns Compressed data
 */
export function compress(
	data: BinaryInput,
	mode: CompressionMode | CompressionOptions = DEFAULT_LEVEL,
): Uint8Array {
	return compressData(toUint8Array(data), mode);
}

/**
 * Compresses a string, encoded as UTF-8, into the `.lzma` format.
 *
 * @param data String to compress
 * @param mode Compression level (1-9, default 5) or options
 * @returns Compressed data
 */
export function compressString(
	data: string,
	mode: CompressionMode | CompressionOptions = DEFAULT_LEVEL,
): Uint8Array {
	return compressData(encodeUtf8(data), mode);
}

/**
 * Decompresses `.lzma` data.
 *
 * @param data Compressed data
 * @returns Decompressed data
 * @throws {Error} If the data is truncated or corrupted
 */
export function decompress(data: BinaryInput): Uint8Array {
	return decompressData(toUint8Array(data));
}

/**
 * Decompresses `.lzma` data into a string. The data is decoded as UTF-8;
 * data compressed by lzma1 v0.3.0 and older is also supported.
 *
 * @param data Compressed data
 * @returns Decompressed string
 * @throws {Error} If the data is truncated or corrupted
 */
export function decompressString(data: BinaryInput): string {
	return decodeUtf8(decompressData(toUint8Array(data)));
}
