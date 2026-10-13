/**
 * Seeded input generator for the differential corpus. Pure integer
 * arithmetic only (`Math.imul`, shifts, remainder), so every platform and
 * engine produces bit-identical inputs and the inputs themselves never
 * need to be committed; `manifest.json` records their hashes.
 */

/** A source of integers in `[0, bound)`. */
export type RandomBelow = (bound: number) => number;

/** 32-bit LCG (glibc constants). */
export function makeRng(seed: number): RandomBelow {
	let state = seed >>> 0;

	return (bound) => {
		state = (Math.imul(state, 1103515245) + 12345) >>> 0;

		// Top 24 bits; `bound` never exceeds 2^22 here, so the bias is small
		// and, more importantly, the result is exact integer arithmetic.
		return (state >>> 8) % bound;
	};
}

/**
 * Mixed input: byte noise, short- and long-distance repeats, and text-like
 * runs, in random segments. The corpus workhorse.
 */
export function mixed(size: number, seed: number): Uint8Array<ArrayBuffer> {
	const randomBelow = makeRng(seed);
	const output = new Uint8Array(size);
	let i = 0;
	while (i < size) {
		const kind = randomBelow(4);
		if (kind === 0 || i < 8) {
			const length = 1 + randomBelow(30);
			for (let j = 0; j < length && i < size; j++) output[i++] = randomBelow(256);
		} else if (kind === 1) {
			const distance = 1 + randomBelow(Math.min(i, 300));
			const length = 2 + randomBelow(200);
			for (let j = 0; j < length && i < size; j++, i++) output[i] = output[i - distance];
		} else if (kind === 2) {
			const distance = 1 + randomBelow(i);
			const length = 2 + randomBelow(40);
			for (let j = 0; j < length && i < size; j++, i++) output[i] = output[i - distance];
		} else {
			const length = 1 + randomBelow(50);
			for (let j = 0; j < length && i < size; j++) output[i++] = 32 + randomBelow(60);
		}
	}

	return output;
}

/**
 * Long same-byte and two-byte runs separated by short noise. Forces chains
 * of maximum-length (273) matches and the length coder's high range.
 */
export function runs(size: number, seed: number): Uint8Array<ArrayBuffer> {
	const randomBelow = makeRng(seed);
	const output = new Uint8Array(size);
	let i = 0;
	while (i < size) {
		const kind = randomBelow(8);
		if (kind === 0) {
			const length = 1 + randomBelow(12);
			for (let j = 0; j < length && i < size; j++) output[i++] = randomBelow(256);
		} else if (kind < 6) {
			const value = randomBelow(256);
			const length = 200 + randomBelow(2000);
			for (let j = 0; j < length && i < size; j++) output[i++] = value;
		} else {
			const first = randomBelow(256);
			const second = randomBelow(256);
			const length = 100 + randomBelow(1000);
			for (let j = 0; j < length && i < size; j++) output[i++] = (j & 1) === 0 ? first : second;
		}
	}

	return output;
}

/**
 * A marker block at the start, incompressible filler, then the block
 * repeated near the end: the only good matches sit at a distance close to
 * `size`, forcing the top distance slots the dictionary allows.
 */
export function longDist(size: number, seed: number): Uint8Array<ArrayBuffer> {
	const randomBelow = makeRng(seed);
	const output = new Uint8Array(size);
	const blockLength = Math.min(4096, size >> 3);

	// A unique random marker block at the start.
	for (let i = 0; i < blockLength; i++) output[i] = randomBelow(256);

	// Filler: a tiled 256-byte random pattern with sparse mutations. It
	// compresses to almost nothing (rep matches at distance 256), so the
	// committed fixture stays small even for multi-megabyte inputs, and
	// it never reproduces the marker block.
	const tile = new Uint8Array(256);
	for (let i = 0; i < 256; i++) tile[i] = randomBelow(256);
	for (let i = blockLength; i < size; i++) {
		output[i] = tile[i & 255];
		if (randomBelow(997) === 0) output[i] = randomBelow(256);
	}

	// Three copies of the marker block in the last quarter, at slightly
	// different distances, so the only matches for them sit at a distance
	// close to `size` and the match finder sees distinct candidates.
	for (let copy = 0; copy < 3; copy++) {
		const at = size - (copy + 1) * (blockLength + 37);
		if (at <= blockLength) break;
		output.copyWithin(at, 0, blockLength);
	}

	return output;
}

/**
 * Matches cycling through four fixed distances, exercising rep0-rep3
 * reordering, short reps, and the rep match price paths.
 */
export function repCycle(size: number, seed: number): Uint8Array<ArrayBuffer> {
	const randomBelow = makeRng(seed);
	const output = new Uint8Array(size);
	const distances = [11, 97, 1021, 8192];
	let i = 0;
	while (i < 32 && i < size) output[i++] = randomBelow(256);
	while (i < size) {
		const kind = randomBelow(10);
		if (kind === 0) {
			output[i++] = randomBelow(256);
		} else {
			const distance = distances[randomBelow(4)];
			const length = kind < 3 ? 1 : 2 + randomBelow(30);
			for (let j = 0; j < length && i < size; j++, i++) output[i] = i - distance >= 0 ? output[i - distance] : randomBelow(256);
		}
	}

	return output;
}

/**
 * Keeps the normal encoder's optimum search open until its 4095-position
 * lookahead cap. A random block `R` is followed by three copies of it with
 * single-byte substitutions at sites spaced 60-99 bytes apart: the first
 * copy takes the even-numbered sites, the second the odd-numbered ones,
 * the third all of them, with the same substituted byte at each site. In
 * the third copy, every match stops at the next substitution, so no match
 * reaches a long `niceLen`, yet from any position a match into the copy
 * that shares the next site's byte reaches past it, so the search never
 * runs out of candidates before the cap. Random bytes pad the tail.
 */
export function optsCap(size: number, seed: number): Uint8Array<ArrayBuffer> {
	const randomBelow = makeRng(seed);
	const segmentLength = Math.floor(size / 4);
	const output = new Uint8Array(size);
	for (let i = 0; i < segmentLength; i++) output[i] = randomBelow(256);

	const sites: number[] = [];
	for (let at = 40 + randomBelow(40); at < segmentLength; at += 60 + randomBelow(40)) sites.push(at);
	const substitutes = sites.map((at) => output[at] ^ (1 + randomBelow(255)));

	for (let copy = 1; copy <= 3; copy++) {
		const copyStart = copy * segmentLength;
		output.copyWithin(copyStart, 0, segmentLength);
		for (let k = 0; k < sites.length; k++) {
			const takesSite = copy === 3 || (copy === 1 && k % 2 === 0) || (copy === 2 && k % 2 === 1);
			if (takesSite) output[copyStart + sites[k]] = substitutes[k];
		}
	}

	for (let i = 4 * segmentLength; i < size; i++) output[i] = randomBelow(256);

	return output;
}

export const BUILDERS = { mixed, runs, longDist, repCycle, optsCap };

export type BuilderName = keyof typeof BUILDERS;

/** The seeded input of one corpus cell. */
export interface InputSpec {
	builder: BuilderName;
	size: number;
	seed: number;
}

/** Builds the input of one corpus cell. */
export function buildInput(spec: InputSpec): Uint8Array<ArrayBuffer> {
	return BUILDERS[spec.builder](spec.size, spec.seed);
}

/** Whether a string names an input builder (for validating parsed JSON). */
export function isBuilderName(name: string): name is BuilderName {
	return Object.hasOwn(BUILDERS, name);
}
