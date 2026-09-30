/**
 * Compression options and presets.
 */

import type { MatchFinderType } from "./lz-encoder.js";

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
}

export const DEFAULT_LEVEL: CompressionMode = 5;

export const DICT_SIZE_MIN = 1 << 12;
export const DICT_SIZE_MAX = 768 << 20;
export const NICE_LEN_MIN = 8;
export const NICE_LEN_MAX = 273;

type Preset = Omit<ResolvedOptions, "lc" | "lp" | "pb">;

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

function checkInteger(name: string, value: number, min: number, max: number): void {
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new RangeError(`Invalid ${name}: ${value} (expected an integer ${min}-${max})`);
	}
}
