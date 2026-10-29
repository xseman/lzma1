/**
 * @license
 * Copyright Filip Seman
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	type BinaryInput,
	compressData,
	compressDataAsync,
	decompressData,
	decompressDataAsync,
	decompressRawLzma2Data,
	toUint8Array,
} from "./lzma.js";
import {
	type CompressAsyncOptions,
	type CompressionMode,
	type CompressionOptions,
	type DecompressAsyncOptions,
	type DecompressionOptions,
	DEFAULT_LEVEL,
	type RawLzma1AsyncOptions,
	type RawLzma1Options,
	type RawLzma2Options,
	resolveOnProgressAsync,
	resolveRawLzma1Options,
	resolveRawLzma2Options,
	resolveStrict,
} from "./options.js";
import {
	decodeUtf8,
	encodeUtf8,
} from "./utf8.js";

export { CRC32_TABLE } from "./crc32.js";
export { type BinaryInput, LZMA } from "./lzma.js";
export { MemoryLimitError } from "./memory-limit.js";
export type { AsyncProgressOptions, CompressAsyncOptions, CompressionMode, CompressionOptions, DecompressAsyncOptions, DecompressionOptions, ProgressEventArgs, RawLzma1AsyncOptions, RawLzma1Options, RawLzma2Options } from "./options.js";
export { DecompressRawLzma1, DecompressRawLzma2 } from "./raw-web-streams.js";
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
 * Compresses data into the `.lzma` format, pausing regularly to await
 * `onProgressAsync`. The callback can update a progress bar, yield so that
 * a web page stays responsive, or cancel by throwing.
 *
 * The output is the same as `compress(data, mode)`. Without
 * `onProgressAsync`, the whole compression runs before the promise is
 * returned.
 *
 * @param data Data to compress; the caller can read it but must not modify it
 *        until the returned promise has settled
 * @param mode Compression level (1-9, default 5) or options
 * @returns Compressed data
 * @throws {RangeError} If an option is invalid (the promise rejects)
 * @throws Any error that `onProgressAsync` throws
 */
export async function compressAsync(
	data: BinaryInput,
	mode: CompressionMode | CompressAsyncOptions = DEFAULT_LEVEL,
): Promise<Uint8Array> {
	return compressDataAsync(toUint8Array(data), mode);
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
 * @param options `strict` rejects an end marker before the declared size
 * @returns Decompressed data
 * @throws {RangeError} If an option is invalid
 * @throws {Error} If the data is truncated or corrupted
 */
export function decompress(data: BinaryInput, options?: DecompressionOptions): Uint8Array {
	return decompressData(toUint8Array(data), resolveStrict(options));
}

/**
 * Decompresses `.lzma` data, pausing regularly to await `onProgressAsync`.
 * The callback can update a progress bar, yield so that a web page stays
 * responsive, or cancel by throwing.
 *
 * The output is the same as `decompress(data, options)`. Without
 * `onProgressAsync`, the whole decompression runs before the promise is
 * returned.
 *
 * @param data Compressed data; the caller can read it but must not modify it
 *        until the returned promise has settled
 * @param options `strict` rejects an end marker before the declared size
 * @returns Decompressed data
 * @throws {RangeError} If an option is invalid (the promise rejects)
 * @throws {Error} If the data is truncated or corrupted (the promise rejects)
 * @throws Any error that `onProgressAsync` throws
 */
export async function decompressAsync(data: BinaryInput, options?: DecompressAsyncOptions): Promise<Uint8Array> {
	return decompressDataAsync(toUint8Array(data), resolveStrict(options), undefined, resolveOnProgressAsync(options));
}

/**
 * Decompresses `.lzma` data into a string. The data is decoded as UTF-8;
 * data compressed by lzma1 v0.3.0 and older is also supported.
 *
 * @param data Compressed data
 * @param options `strict` rejects an end marker before the declared size
 * @returns Decompressed string
 * @throws {RangeError} If an option is invalid
 * @throws {Error} If the data is truncated or corrupted
 */
export function decompressString(data: BinaryInput, options?: DecompressionOptions): string {
	return decodeUtf8(decompressData(toUint8Array(data), resolveStrict(options)));
}

/**
 * Decompresses raw LZMA1 data, which has no `.lzma` header. Its properties
 * come from the container, e.g. a 7z archive. An end marker before a known
 * size is an error, as with `strict`.
 *
 * @param data Compressed data
 * @param options Properties of the data, its uncompressed size if known,
 *        and a memory limit
 * @returns Decompressed data
 * @throws {RangeError} If an option is invalid
 * @throws {MemoryLimitError} If decoding would need more memory than `memoryLimitKb`
 * @throws {Error} If the data is truncated or corrupted
 */
export function decompressRawLzma1(data: BinaryInput, options: RawLzma1Options): Uint8Array {
	// Strict: raw data has no earlier producers to stay compatible with, and
	// XZ for Java rejects an end marker before the known size.
	return decompressData(toUint8Array(data), true, resolveRawLzma1Options(options));
}

/**
 * Decompresses raw LZMA1 data like `decompressRawLzma1`, pausing regularly
 * to await `onProgressAsync`. The callback can update a progress bar, yield
 * so that a web page stays responsive, or cancel by throwing.
 *
 * The output is the same as `decompressRawLzma1(data, options)`. Without
 * `onProgressAsync`, the whole decompression runs before the promise is
 * returned.
 *
 * @param data Compressed data; the caller can read it but must not modify it
 *        until the returned promise has settled
 * @param options Properties of the data, its uncompressed size if known,
 *        and a memory limit
 * @returns Decompressed data
 * @throws {RangeError} If an option is invalid (the promise rejects)
 * @throws {MemoryLimitError} If decoding would need more memory than `memoryLimitKb` (the promise rejects)
 * @throws {Error} If the data is truncated or corrupted (the promise rejects)
 * @throws Any error that `onProgressAsync` throws
 */
export async function decompressRawLzma1Async(data: BinaryInput, options: RawLzma1AsyncOptions): Promise<Uint8Array> {
	// Strict, like `decompressRawLzma1`.
	return decompressDataAsync(toUint8Array(data), true, resolveRawLzma1Options(options), resolveOnProgressAsync(options));
}

/**
 * Decompresses raw LZMA2 data, the format inside `.xz` blocks and 7z LZMA2
 * entries. Its dictionary size comes from the container.
 *
 * @param data Compressed data
 * @param options Dictionary size and a memory limit
 * @returns Decompressed data
 * @throws {RangeError} If an option is invalid
 * @throws {MemoryLimitError} If decoding would need more memory than `memoryLimitKb`
 * @throws {Error} If the data is truncated or corrupted
 */
export function decompressRawLzma2(data: BinaryInput, options: RawLzma2Options): Uint8Array {
	return decompressRawLzma2Data(toUint8Array(data), resolveRawLzma2Options(options));
}
