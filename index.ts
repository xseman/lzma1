/**
 * @license
 * Copyright Filip Seman
 * SPDX-License-Identifier: MIT
 */

import { LZMA } from "./lzma.js";
export { LZMA } from "./lzma.js";

/**
 * Compresses data using LZMA algorithm
 *
 * @param data Data to compress - can be Uint8Array or ArrayBuffer
 * @param mode Compression mode (1-9), defaults to 5
 * @returns Compressed data as a byte array
 */
export function compress(
	data: Uint8Array | ArrayBuffer,
	mode: keyof LZMA["CompressionModes"] = 5,
): Uint8Array {
	const lzma = new LZMA();
	return new Uint8Array(lzma.compress(data, mode));
}

/**
 * Compresses data using LZMA algorithm
 *
 * @param data String to compress
 * @param mode Compression mode (1-9), defaults to 5
 * @returns Compressed data as byte array
 */
export function compressString(
	data: string,
	mode: keyof LZMA["CompressionModes"] = 5,
): Uint8Array {
	const lzma = new LZMA();
	return new Uint8Array(lzma.compressString(data, mode));
}

/**
 * Decompresses LZMA compressed data
 *
 * @param data Compressed data as Uint8Array or ArrayBuffer
 * @returns Decompressed data
 */
export function decompress(data: Uint8Array | ArrayBuffer): Uint8Array {
	const lzma = new LZMA();
	return new Uint8Array(lzma.decompress(data));
}

/**
 * Decompresses LZMA compressed data
 *
 * @param data Compressed data as Uint8Array or ArrayBuffer
 * @returns Decompressed data as string
 */
export function decompressString(data: Uint8Array | ArrayBuffer): string {
	const lzma = new LZMA();
	return lzma.decompressString(data);
}
