/**
 * The differential corpus: every cell pairs one seeded input with one
 * encoder configuration. `generate.ts` compresses each cell with XZ for
 * Java and commits the result; the identity test compresses the same cell
 * with this library and compares byte for byte, then decodes the committed
 * fixture back to the input.
 *
 * Every cell has two Java fixtures: `<id>.lzma`, written with the
 * known size and no end marker, and `<id>.marker.lzma`, written in XZ for
 * Java's end-marker form, which always declares the size unknown. A
 * streaming cell has only the second kind, compared against the library's
 * chunked `Compress`, which also declares the size unknown.
 *
 * Constraint: the dictionary size each cell ends up with (after
 * `fitDictSize`, which streaming cells skip because the size is unknown)
 * must be a fixed point of `roundDictSize`, because `encodeHeader` rounds
 * the size while XZ for Java's `LZMAOutputStream` writes it raw; on any
 * other size the headers would differ by design. `generate.ts` asserts
 * this for every cell.
 */

import type { InputSpec } from "./inputs.ts";

const KB = 1024;
const MB = 1024 * KB;

/** One encoder configuration, in the library's option names. */
export interface EncoderConfig {
	dictSize: number;
	mode: "normal" | "fast";
	matchFinder: "bt4" | "hc4";
	niceLen: number;
	depth: number;
	lc: number;
	lp: number;
	pb: number;
}

/** Marks a cell compressed through the chunked streaming encoder. */
export interface StreamSpec {
	chunkSize: number;
}

export interface CorpusCell {
	id: string;
	input: InputSpec;
	cfg: EncoderConfig;
	stream?: StreamSpec;
}

/** The two Java fixture forms; see the module comment. */
export type FixtureVariant = "plain" | "marker";

export function fixtureFileName(id: string, variant: FixtureVariant): string {
	return variant === "plain" ? `${id}.lzma` : `${id}.marker.lzma`;
}

/** The fixture variants a cell has: streaming cells only have a marker form. */
export function fixtureVariants(cell: CorpusCell): FixtureVariant[] {
	return cell.stream === undefined ? ["plain", "marker"] : ["marker"];
}

function cfg(dictSize: number, mode: EncoderConfig["mode"], matchFinder: EncoderConfig["matchFinder"], niceLen: number, depth = 0, lc = 3, lp = 0, pb = 2): EncoderConfig {
	return { dictSize, mode, matchFinder, niceLen, depth, lc, lp, pb };
}

/** The base option matrix from the original 35-case comparison. */
const BASE_CONFIGS: [string, EncoderConfig][] = [
	["n-bt4-32", cfg(1 << 20, "normal", "bt4", 32)],
	["n-bt4-64", cfg(1 << 20, "normal", "bt4", 64)],
	["n-bt4-273", cfg(1 << 22, "normal", "bt4", 273)],
	["n-hc4-64", cfg(1 << 20, "normal", "hc4", 64)],
	["f-hc4-128d8", cfg(1 << 20, "fast", "hc4", 128, 8)],
	["f-bt4-273", cfg(1 << 20, "fast", "bt4", 273)],
	["n-bt4-64-lc0lp2pb0", cfg(1 << 20, "normal", "bt4", 64, 0, 0, 2, 0)],
];

const BASE_SIZES = [1, 100, 5000, 70000, 300000];

function baseCells(): CorpusCell[] {
	const cells: CorpusCell[] = [];
	let seed = 1000;
	for (const size of BASE_SIZES) {
		const input: InputSpec = { builder: "mixed", size, seed: seed++ };
		for (const [name, config] of BASE_CONFIGS) {
			cells.push({ id: `base-${size}-${name}`, input, cfg: config });
		}
	}

	return cells;
}

function boundaryCells(): CorpusCell[] {
	const normal64 = cfg(1 << 20, "normal", "bt4", 64);
	const cells: CorpusCell[] = [];

	// Empty input, both encoder modes.
	cells.push({ id: "empty-normal", input: { builder: "mixed", size: 0, seed: 1 }, cfg: normal64 });
	cells.push({ id: "empty-fast", input: { builder: "mixed", size: 0, seed: 1 }, cfg: cfg(1 << 20, "fast", "hc4", 128, 8) });

	// niceLen at and next to its bounds (8..273).
	for (const nice of [8, 9, 272, 273]) {
		cells.push({
			id: `nice-${nice}`,
			input: { builder: "mixed", size: 70000, seed: 2000 },
			cfg: cfg(1 << 20, "normal", "bt4", nice),
		});
	}

	// The optimum-search window boundary: OPTS is 4096, and a known input
	// size caps the allocated window at sizeClass + 2. Inputs adjacent to
	// 4096 (and to the previous size class step at 2048) cross it.
	for (const size of [2047, 2048, 2049, 4095, 4096, 4097]) {
		cells.push({ id: `opts-${size}`, input: { builder: "mixed", size, seed: 3000 + size }, cfg: normal64 });
	}

	// The optimum search reaching its OPTS - 1 lookahead cap, which the
	// window-size cells above never do. Default depth with the longest
	// niceLen; and a depth-1 search, which misses long matches at the
	// distance of rep0, so the search continues past a match + literal +
	// rep0 candidate whose rep0 length is capped at niceLen.
	cells.push({ id: "optscap-n-bt4-273", input: { builder: "optsCap", size: 24000, seed: 8001 }, cfg: cfg(1 << 20, "normal", "bt4", 273) });
	cells.push({ id: "optscap-n-bt4-128d1", input: { builder: "optsCap", size: 24000, seed: 8001 }, cfg: cfg(1 << 20, "normal", "bt4", 128, 1) });

	// Dictionary/input-size boundaries: input below, at, and above the
	// dictionary size, at the minimum (4096) and a 2^n + 2^(n-1) size.
	for (const size of [4095, 4096, 4097, 12000]) {
		cells.push({ id: `dict4k-${size}`, input: { builder: "mixed", size, seed: 4000 + size }, cfg: cfg(4096, "normal", "bt4", 64) });
	}
	cells.push({ id: "dict6k-8192", input: { builder: "mixed", size: 8192, seed: 4200 }, cfg: cfg(6144, "normal", "bt4", 64) });

	// Power-of-two-adjacent input lengths (buffer and size-class edges).
	for (const size of [65535, 65536, 65537]) {
		cells.push({ id: `pow2-${size}`, input: { builder: "mixed", size, seed: 5000 + size }, cfg: normal64 });
	}

	// Extreme lc/lp/pb corners (lc + lp <= 4, pb <= 4).
	const propsCorners = [[4, 0, 2], [0, 4, 2], [0, 0, 0], [3, 0, 4], [2, 2, 1]];
	for (const [lc, lp, pb] of propsCorners) {
		for (const size of [5000, 70000]) {
			cells.push({
				id: `props-lc${lc}lp${lp}pb${pb}-${size}`,
				input: { builder: "mixed", size, seed: 6000 + size },
				cfg: cfg(1 << 20, "normal", "bt4", 64, 0, lc, lp, pb),
			});
		}
	}

	return cells;
}

/** Inputs crafted to hit decoder corners. */
function decoderCornerCells(): CorpusCell[] {
	const cells: CorpusCell[] = [];

	// Runs forcing chains of maximum-length (273) matches.
	cells.push({ id: "runs-n-273", input: { builder: "runs", size: 70000, seed: 7001 }, cfg: cfg(1 << 20, "normal", "bt4", 273) });
	cells.push({ id: "runs-f-273", input: { builder: "runs", size: 70000, seed: 7001 }, cfg: cfg(1 << 20, "fast", "bt4", 273) });

	// Long distances: matches close to the dictionary size.
	cells.push({ id: "longdist-2m-fast", input: { builder: "longDist", size: 2 * MB + 4097, seed: 7101 }, cfg: cfg(1 << 22, "fast", "bt4", 273) });
	cells.push({ id: "longdist-800k-normal", input: { builder: "longDist", size: 800 * KB, seed: 7102 }, cfg: cfg(1 << 20, "normal", "bt4", 64) });

	// Patterns cycling matches through rep0-rep3.
	cells.push({ id: "repcycle-n", input: { builder: "repCycle", size: 70000, seed: 7201 }, cfg: cfg(1 << 20, "normal", "bt4", 64) });
	cells.push({ id: "repcycle-f", input: { builder: "repCycle", size: 70000, seed: 7201 }, cfg: cfg(1 << 20, "fast", "hc4", 128, 8) });

	return cells;
}

/**
 * Unknown-size streaming through the chunked encoder, with the input
 * larger than the dictionary so the encoder's window has to move. The
 * chunk size is prime, so chunk boundaries drift across every buffer
 * boundary.
 */
function streamingCells(): CorpusCell[] {
	return [{
		id: "stream-n-bt4-64-dict64k",
		input: { builder: "mixed", size: 300000, seed: 8101 },
		cfg: cfg(64 * KB, "normal", "bt4", 64),
		stream: { chunkSize: 7919 },
	}];
}

export const CORPUS: CorpusCell[] = [...baseCells(), ...boundaryCells(), ...decoderCornerCells(), ...streamingCells()];

/**
 * The malformed-stream set is derived from these fixtures (the marker
 * variant is named by its file stem):
 * - every truncation point of the smallest fixtures, strided truncation
 *   points of the larger ones;
 * - single-bit flips at strided offsets;
 * - synthetic bad header fields on one carrier fixture;
 * - declared-size patches on one marker-form fixture.
 * The exact derivation lives in `malformed.ts`; the expected outcome of
 * every case, recorded from XZ for Java's decoder at generation time, is
 * committed in `malformed.json`.
 */
export const MALFORMED_SOURCES = [
	"base-100-n-bt4-64",
	"base-5000-n-bt4-64",
	"base-5000-f-hc4-128d8",
	"repcycle-n",
	"empty-normal",
	"base-100-n-bt4-64.marker",
];

/** The fixture whose header fields are corrupted synthetically. */
export const BAD_HEADER_CARRIER = "base-100-n-bt4-64";

/** The marker-form fixture whose declared size is patched. */
export const DECLARED_SIZE_CARRIER = { source: "base-100-n-bt4-64.marker", cellId: "base-100-n-bt4-64" };
