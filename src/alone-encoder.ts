/**
 * Encoder for the `.lzma` format: header followed by raw LZMA data and an
 * end marker, which is optional when the header holds the size.
 */

import { BT4 } from "./bt4.js";
import { HC4 } from "./hc4.js";
import {
	encodeHeader,
	UNKNOWN_SIZE,
} from "./header.js";
import type { LzEncoderConfig } from "./lz-encoder.js";
import { MATCH_LEN_MAX } from "./lzma-coder.js";
import {
	FAST_EXTRA_SIZE_AFTER,
	FAST_EXTRA_SIZE_BEFORE,
	LzmaEncoderFast,
} from "./lzma-encoder-fast.js";
import {
	LzmaEncoderNormal,
	NORMAL_EXTRA_SIZE_AFTER,
	NORMAL_EXTRA_SIZE_BEFORE,
	OPTS,
} from "./lzma-encoder-normal.js";
import type { LzmaEncoder } from "./lzma-encoder.js";
import {
	fitDictSize,
	type ResolvedOptions,
} from "./options.js";
import { RangeEncoder } from "./range-encoder.js";

/**
 * Encoders for small inputs are kept for reuse by later calls: allocating
 * and zeroing their tables (about 0.5 MiB of hash tables alone) costs more
 * than compressing a few hundred bytes. Reused encoders produce the same
 * output as new ones.
 */
const POOL_MAX_DICT_SIZE = 1 << 16;
const POOL_MAX_ENTRIES = 3;
const pool = new Map<string, LzmaEncoder>();

export class AloneEncoder {
	private readonly rc: RangeEncoder;
	private readonly lzma: LzmaEncoder;
	private readonly expectedSize: number;
	private readonly poolKey: string | undefined;
	private readonly endMarker: boolean;
	private inputSize = 0;

	/**
	 * @param options Resolved compression options
	 * @param uncompressedSize Total input size, or `UNKNOWN_SIZE` when streaming
	 * @param reuse Take the encoder from, and return it to, the pool of
	 *        small encoders. Only for synchronous one-shot compression.
	 */
	constructor(options: ResolvedOptions, uncompressedSize: number = UNKNOWN_SIZE, reuse = false) {
		const knownSize = uncompressedSize !== UNKNOWN_SIZE;
		if (!knownSize && !options.endMarker) {
			throw new RangeError("Invalid endMarker: false (the end marker is required when the size is unknown, e.g. in a stream)");
		}

		const dictSize = knownSize
			? fitDictSize(options.dictSize, uncompressedSize)
			: options.dictSize;

		this.expectedSize = uncompressedSize;
		this.endMarker = options.endMarker;
		this.rc = new RangeEncoder(knownSize ? Math.min(uncompressedSize >>> 1, 1 << 20) + 64 : 1 << 16);
		this.rc.writeBytes(encodeHeader({
			lc: options.lc,
			lp: options.lp,
			pb: options.pb,
			dictSize,
			uncompressedSize,
		}));

		// Buffers only need to hold the whole input when its size is known.
		// Rounding up to a power of two lets similar inputs share encoders.
		const sizeClass = knownSize ? 2 ** Math.ceil(Math.log2(Math.max(uncompressedSize, 64))) : undefined;

		if (reuse && knownSize && dictSize <= POOL_MAX_DICT_SIZE) {
			this.poolKey = [options.mode, options.matchFinder, options.niceLen, options.depth, options.lc, options.lp, options.pb, dictSize, sizeClass].join();
		}

		const pooled = this.poolKey === undefined ? undefined : pool.get(this.poolKey);
		if (pooled) {
			pool.delete(this.poolKey!);
			pooled.restart(this.rc);
			this.lzma = pooled;
		} else {
			this.lzma = createEncoder(this.rc, options, dictSize, sizeClass);
		}
	}

	/** Compresses `input`. Output is buffered until `take()` or `finish()`. */
	write(input: Uint8Array): void {
		this.inputSize += input.length;

		if (this.expectedSize !== UNKNOWN_SIZE && this.inputSize > this.expectedSize) {
			throw new Error("Input exceeds the declared uncompressed size");
		}

		const lz = this.lzma.lz;
		let off = 0;
		while (off < input.length) {
			off += lz.fillWindow(input, off, input.length - off);
			this.lzma.encode();
		}
	}

	/** Returns the compressed bytes produced so far. */
	take(): Uint8Array {
		return this.rc.take();
	}

	/** Compresses the remaining input, writes the end marker if enabled and returns the rest of the output. */
	finish(): Uint8Array {
		if (this.expectedSize !== UNKNOWN_SIZE && this.inputSize !== this.expectedSize) {
			throw new Error("Input is smaller than the declared uncompressed size");
		}

		this.lzma.lz.setFinishing();
		this.lzma.encode();
		if (this.endMarker) {
			this.lzma.encodeEndMarker();
		}
		const output = this.rc.finish();

		if (this.poolKey !== undefined) {
			if (pool.size >= POOL_MAX_ENTRIES) {
				pool.delete(pool.keys().next().value!);
			}
			pool.set(this.poolKey, this.lzma);
		}

		return output;
	}
}

function createEncoder(rc: RangeEncoder, options: ResolvedOptions, dictSize: number, sizeClass: number | undefined): LzmaEncoder {
	const isFast = options.mode === "fast";
	const lzConfig: LzEncoderConfig = {
		dictSize,
		extraSizeBefore: isFast ? FAST_EXTRA_SIZE_BEFORE : NORMAL_EXTRA_SIZE_BEFORE,
		extraSizeAfter: isFast ? FAST_EXTRA_SIZE_AFTER : NORMAL_EXTRA_SIZE_AFTER,
		niceLen: options.niceLen,
		matchLenMax: MATCH_LEN_MAX,
		depthLimit: options.depth,
		inputSize: sizeClass,
	};

	const lz = options.matchFinder === "hc4" ? new HC4(lzConfig) : new BT4(lzConfig);
	const lzmaConfig = {
		lc: options.lc,
		lp: options.lp,
		pb: options.pb,
		dictSize,
		niceLen: options.niceLen,
		// Positions of the optimum search never exceed the input size.
		optsSize: sizeClass === undefined ? OPTS : sizeClass + 2,
	};

	return isFast
		? new LzmaEncoderFast(rc, lz, lzmaConfig)
		: new LzmaEncoderNormal(rc, lz, lzmaConfig);
}
