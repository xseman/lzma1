/**
 * Compression options and presets, the decompression options, and the
 * options of raw decoding.
 */

import {
	type LzmaHeader,
	UNKNOWN_SIZE,
} from "./header.js";
import type { MatchFinderType } from "./lz-encoder.js";
import { Lzma2Decoder } from "./lzma2-decoder.js";
import { MemoryLimitError } from "./memory-limit.js";

/**
 * LZMA compression level (1-9).
 * Higher values compress better but are slower and use more memory.
 */
export type CompressionMode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface CompressionOptions {
	/**
	 * Preset level 1-9, default 5. Levels 1-3 use the fast encoder with a
	 * hash chain match finder, levels 4-9 the normal encoder with a binary
	 * tree match finder. The other options override values of the preset.
	 */
	level?: CompressionMode;
	/**
	 * Dictionary size in bytes (4 KiB - 768 MiB). How far back matches can
	 * reach. When the input size is known, a smaller dictionary is written
	 * to the header if it's enough to cover the whole input.
	 */
	dictSize?: number;
	/** Literal context bits (0-4, `lc + lp <= 4`), default 3. */
	lc?: number;
	/** Literal position bits (0-4, `lc + lp <= 4`), default 0. */
	lp?: number;
	/** Position bits (0-4), default 2. */
	pb?: number;
	/** Encoder mode: `"fast"` (heuristic) or `"normal"` (optimal parsing). */
	mode?: "fast" | "normal";
	/** Match length (8-273) that is good enough to stop searching. */
	niceLen?: number;
	/** Match finder: `"hc4"` (hash chain, faster) or `"bt4"` (binary tree, better). */
	matchFinder?: MatchFinderType;
	/** Maximum match finder search depth, 0 = automatic. */
	depth?: number;
	/**
	 * Write an end marker after the data, default `true`. The header also
	 * holds the uncompressed size, so the marker is redundant for decoders
	 * that read it: `false` omits it and saves 5-6 bytes, like XZ for Java
	 * and 7-Zip without `-eos`.
	 *
	 * Safe to turn off when the decoder knows the size: this library,
	 * `xz --format=lzma`, 7-Zip, or a format that stores the size elsewhere.
	 * Not safe for decoders of raw LZMA data or streams that don't know the
	 * size (e.g. `xz --format=raw`, Python's `FORMAT_RAW`): without the marker
	 * they report an error or decode past the end. Strict decoders that know
	 * the size may reject a marker, e.g. XZ for Java's raw `LZMAInputStream`
	 * constructor without `enableRelaxedEndCondition()`.
	 *
	 * Requires a known size: `Compress` throws a `RangeError` for `false`.
	 */
	endMarker?: boolean;
}

/** Progress of an async function, passed to `onProgressAsync`. */
export interface ProgressEventArgs {
	/** Fraction of the input processed so far, from 0 at the start to 1 at the end. */
	readonly progress: number;
}

/** Options shared by the async functions. */
export interface AsyncProgressOptions {
	/**
	 * Callback that the async functions await regularly while they work,
	 * default none. It gets called with progress 0 before any work, at
	 * intervals during the work, and with progress 1 at the end.
	 *
	 * The time between calls is unspecified, but the interval will be large
	 * enough to ensure negligible overhead even for a callback that simply
	 * returns. The callback should decide when to update the page and yield,
	 * for example by checking the clock. It can be synchronous if it never
	 * yields. If the callback throws an exception, that cancels the
	 * operation.
	 *
	 * @example
	 * Check for cancellation at every call, but update a progress bar and
	 * yield to the browser at most every 100 ms:
	 *
	 * ```ts
	 * let lastYield = performance.now();
	 *
	 * const compressed = await compressAsync(data, {
	 * 	onProgressAsync: async ({ progress }) => {
	 * 		controller.signal.throwIfAborted();
	 *
	 * 		if (progress < 1 && performance.now() - lastYield < 100) {
	 * 			return;
	 * 		}
	 *
	 * 		progressBar.value = progress;
	 *
	 * 		// setTimeout starts a new task, which lets the browser repaint
	 * 		// and handle input. Awaiting an already-resolved promise would not.
	 * 		await new Promise((resolve) => setTimeout(resolve, 0));
	 * 		lastYield = performance.now();
	 * 	},
	 * });
	 * ```
	 */
	onProgressAsync?: (eventArgs: ProgressEventArgs) => void | Promise<void>;
}

/** Options of `compressAsync`. */
export interface CompressAsyncOptions extends CompressionOptions, AsyncProgressOptions {}

/** Returns `onProgressAsync`, or `undefined` if it isn't set. */
export function resolveOnProgressAsync(options: AsyncProgressOptions = {}): AsyncProgressOptions["onProgressAsync"] {
	const onProgressAsync = options.onProgressAsync;
	if (onProgressAsync !== undefined && typeof onProgressAsync !== "function") {
		// Report the type, not the value: putting a symbol in a template string
		// throws a TypeError.
		throw new RangeError(`Invalid onProgressAsync: ${typeof onProgressAsync} (expected a function)`);
	}

	return onProgressAsync;
}

export interface ResolvedOptions {
	dictSize: number;
	lc: number;
	lp: number;
	pb: number;
	mode: "fast" | "normal";
	niceLen: number;
	matchFinder: MatchFinderType;
	depth: number;
	endMarker: boolean;
}

export const DEFAULT_LEVEL: CompressionMode = 5;

export const DICT_SIZE_MIN = 1 << 12;
export const DICT_SIZE_MAX = 768 << 20;
export const NICE_LEN_MIN = 8;
export const NICE_LEN_MAX = 273;

type Preset = Omit<ResolvedOptions, "lc" | "lp" | "pb" | "endMarker">;

// Levels 1-3 match xz's presets. Levels 4-9 keep the dictionary sizes of
// earlier versions of this library, which bound memory use.
// dprint-ignore
const PRESETS: Record<CompressionMode, Preset> = {
	1: { dictSize: 1 << 20, mode: "fast",   matchFinder: "hc4", niceLen: 128, depth: 8 },
	2: { dictSize: 1 << 21, mode: "fast",   matchFinder: "hc4", niceLen: 273, depth: 24 },
	3: { dictSize: 1 << 22, mode: "fast",   matchFinder: "hc4", niceLen: 273, depth: 48 },
	4: { dictSize: 1 << 20, mode: "normal", matchFinder: "bt4", niceLen: 32,  depth: 0 },
	5: { dictSize: 1 << 21, mode: "normal", matchFinder: "bt4", niceLen: 64,  depth: 0 },
	6: { dictSize: 1 << 22, mode: "normal", matchFinder: "bt4", niceLen: 64,  depth: 0 },
	7: { dictSize: 1 << 23, mode: "normal", matchFinder: "bt4", niceLen: 64,  depth: 0 },
	8: { dictSize: 1 << 24, mode: "normal", matchFinder: "bt4", niceLen: 128, depth: 0 },
	9: { dictSize: 1 << 25, mode: "normal", matchFinder: "bt4", niceLen: 273, depth: 0 },
};

export function resolveOptions(options: CompressionMode | CompressionOptions = {}): ResolvedOptions {
	if (typeof options !== "object") {
		options = { level: options };
	}

	const level = options.level ?? DEFAULT_LEVEL;
	const preset = Object.hasOwn(PRESETS, level) ? PRESETS[level] : undefined;
	if (preset === undefined) {
		throw new RangeError(`Invalid compression level: ${level}`);
	}

	const resolved: ResolvedOptions = {
		...preset,
		lc: options.lc ?? 3,
		lp: options.lp ?? 0,
		pb: options.pb ?? 2,
		dictSize: options.dictSize ?? preset.dictSize,
		mode: options.mode ?? preset.mode,
		niceLen: options.niceLen ?? preset.niceLen,
		matchFinder: options.matchFinder ?? preset.matchFinder,
		depth: options.depth ?? preset.depth,
		endMarker: options.endMarker ?? true,
	};

	checkInteger("lc", resolved.lc, 0, 4);
	checkInteger("lp", resolved.lp, 0, 4);
	if (resolved.lc + resolved.lp > 4) {
		throw new RangeError(`Invalid lc + lp: ${resolved.lc + resolved.lp} (xz accepts at most 4)`);
	}
	checkInteger("pb", resolved.pb, 0, 4);
	checkInteger("dictSize", resolved.dictSize, DICT_SIZE_MIN, DICT_SIZE_MAX);
	checkInteger("niceLen", resolved.niceLen, NICE_LEN_MIN, NICE_LEN_MAX);
	checkInteger("depth", resolved.depth, 0, 0x7FFFFFFF);

	if (resolved.mode !== "fast" && resolved.mode !== "normal") {
		throw new RangeError(`Invalid mode: ${resolved.mode}`);
	}
	if (resolved.matchFinder !== "hc4" && resolved.matchFinder !== "bt4") {
		throw new RangeError(`Invalid matchFinder: ${resolved.matchFinder}`);
	}
	if (typeof resolved.endMarker !== "boolean") {
		throw new RangeError(`Invalid endMarker: ${resolved.endMarker} (expected a boolean)`);
	}

	return resolved;
}

/**
 * Returns the smallest dictionary size that covers `inputSize` bytes, but
 * at most `dictSize`. Sizes are rounded up to `2^n` or `2^n + 2^(n-1)`,
 * which some decoders expect.
 */
export function fitDictSize(dictSize: number, inputSize: number): number {
	if (inputSize >= dictSize) {
		return dictSize;
	}

	for (let n = 12; n < 31; ++n) {
		if (1 << n >= inputSize) return Math.min(1 << n, dictSize);
		if ((1 << n) + (1 << (n - 1)) >= inputSize) return Math.min((1 << n) + (1 << (n - 1)), dictSize);
	}

	return dictSize;
}

/** Options of `decompress`, `decompressString` and `Decompress`. */
export interface DecompressionOptions {
	/**
	 * Reject an end marker before the size the header declares, default
	 * false. By default the data ends at such a marker, because some
	 * producers write a size that is too large. XZ for Java and xz reject
	 * it.
	 */
	strict?: boolean;
}

/** Validates the decompression options. Returns `strict`. */
export function resolveStrict(options: DecompressionOptions = {}): boolean {
	const strict = options.strict ?? false;
	if (typeof strict !== "boolean") {
		throw new RangeError(`Invalid strict: ${strict} (expected a boolean)`);
	}

	return strict;
}

/**
 * Properties of raw LZMA1 data, which has no `.lzma` header. They come from
 * the container, e.g. the coder properties of a 7z entry.
 */
export interface RawLzma1Options {
	/** Literal context bits, 0-8. */
	lc: number;
	/** Literal position bits, 0-4. */
	lp: number;
	/** Position bits, 0-4. */
	pb: number;
	/** Dictionary size in bytes, 0 to 4 GiB - 1. */
	dictSize: number;
	/**
	 * Uncompressed size in bytes, default unknown. When it is known, the
	 * data has to end after that many bytes, with or without an end marker,
	 * and the dictionary is no larger than this size. When it is unknown,
	 * the data has to end with an end marker.
	 */
	uncompressedSize?: number;
	/**
	 * Memory limit in KiB, default none. If decoding would need more, the
	 * call throws a `MemoryLimitError` before it allocates anything. The
	 * estimate counts the dictionary at `dictSize` and the probabilities of
	 * `lc` and `lp`, as XZ for Java does. It doesn't count the output buffer,
	 * which `decompressRawLzma1` sizes from `uncompressedSize`, up to 16 MiB
	 * at first, or at 4 times the input length when the size is unknown.
	 */
	memoryLimitKb?: number;
}

/**
 * Properties of raw LZMA2 data, the format inside `.xz` blocks and 7z
 * LZMA2 entries.
 */
export interface RawLzma2Options {
	/**
	 * Dictionary size in bytes, 4 KiB to 4 GiB - 1. It comes from the
	 * container's LZMA2 properties byte. The uncompressed size, if known and
	 * at least 4 KiB, works too, since matches can't reach back before the
	 * start of the data. A smaller size lowers the estimate checked against
	 * `memoryLimitKb`.
	 */
	dictSize: number;
	/**
	 * Memory limit in KiB, default none. If decoding would need more, the
	 * call throws a `MemoryLimitError` before it allocates anything. The
	 * estimate counts the dictionary at `dictSize`, as XZ for Java does. It
	 * doesn't count the output buffer, which `decompressRawLzma2` creates with
	 * the first output, at 4 times the input length up to 16 MiB.
	 */
	memoryLimitKb?: number;
}

/** Largest dictionary size a container can declare: 4 GiB - 1. */
const RAW_DICT_SIZE_MAX = 0xFFFFFFFF;

/**
 * Validates the options of raw LZMA1 decoding and checks the memory limit.
 * Returns the properties in the shape of a `.lzma` header.
 */
export function resolveRawLzma1Options(options: RawLzma1Options): LzmaHeader {
	const { lc, lp, pb, dictSize, uncompressedSize, memoryLimitKb } = options;

	checkInteger("lc", lc, 0, 8);
	checkInteger("lp", lp, 0, 4);
	checkInteger("pb", pb, 0, 4);
	checkInteger("dictSize", dictSize, 0, RAW_DICT_SIZE_MAX);

	if (uncompressedSize !== undefined) {
		checkInteger("uncompressedSize", uncompressedSize, 0, Number.MAX_SAFE_INTEGER);
	}

	checkMemoryLimit(getLzma1MemoryUsageKb(dictSize, lc, lp), memoryLimitKb);

	return { lc, lp, pb, dictSize, uncompressedSize: uncompressedSize ?? UNKNOWN_SIZE };
}

/**
 * Validates the options of raw LZMA2 decoding and checks the memory limit.
 * Returns the dictionary size.
 */
export function resolveRawLzma2Options(options: RawLzma2Options): number {
	const { dictSize, memoryLimitKb } = options;

	checkInteger("dictSize", dictSize, DICT_SIZE_MIN, RAW_DICT_SIZE_MAX);
	checkMemoryLimit(Lzma2Decoder.getMemoryUsageKb(dictSize), memoryLimitKb);

	return dictSize;
}

/**
 * Approximate memory needed to decode raw LZMA1 data, in KiB, as XZ for
 * Java's `LZMAInputStream.getMemoryUsage` computes it. It counts the
 * dictionary at the given size, before it is reduced to the uncompressed
 * size.
 */
function getLzma1MemoryUsageKb(dictSize: number, lc: number, lp: number): number {
	// Roughly 10 KiB for the base state, the dictionary buffer, and 0x300
	// two-byte probabilities for each of the 2^(lc + lp) literal coders.
	return 10 + Math.floor(getDictSize(Math.max(dictSize, DICT_SIZE_MIN)) / 1024) + Math.floor(((2 * 0x300) << (lc + lp)) / 1024);
}

/**
 * Dictionary size rounded up to a multiple of 16, as XZ for Java allocates
 * it, so the estimates match its numbers.
 */
function getDictSize(dictSize: number): number {
	// Not `(dictSize + 15) & ~15`, which turns sizes of 2 GiB and up negative.
	return Math.ceil(dictSize / 16) * 16;
}

/** Throws a `MemoryLimitError` if `memoryNeededKb` exceeds `memoryLimitKb`. */
function checkMemoryLimit(memoryNeededKb: number, memoryLimitKb: number | undefined): void {
	if (memoryLimitKb === undefined) {
		return;
	}

	checkInteger("memoryLimitKb", memoryLimitKb, 0, Number.MAX_SAFE_INTEGER);

	if (memoryNeededKb > memoryLimitKb) {
		throw new MemoryLimitError(memoryNeededKb, memoryLimitKb);
	}
}

function checkInteger(name: string, value: number, min: number, max: number): void {
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new RangeError(`Invalid ${name}: ${value} (expected an integer ${min}-${max})`);
	}
}
