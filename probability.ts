import { initArray } from "./utils.js";

/**
 * Binary tree interface for probability modeling
 */
export interface BitTree {
	numBitLevels: number;
	models: number[];
}

/**
 * Creates probability price lookup table for range encoding
 * Used to estimate the cost of encoding symbols with given probabilities
 */
export function createProbPrices(): number[] {
	const probPrices = [];
	for (let i = 8; i >= 0; --i) {
		let start = 1 << (9 - i - 1);
		let end = 1 << (9 - i);

		for (let j = start; j < end; ++j) {
			probPrices[j] = (i << 6) + ((end - j) << 6 >>> (9 - i - 1));
		}
	}

	return probPrices;
}

/**
 * Creates fast position lookup table for distance encoding
 * Maps distances to position slot values for efficient encoding
 */
export function createFastPos(): number[] {
	const gFastPos = [0x00, 0x01];
	let c = 2;

	for (let slotFast = 2; slotFast < 22; ++slotFast) {
		let k = 1 << ((slotFast >> 1) - 1);

		for (let j = 0; j < k; ++j, ++c) {
			gFastPos[c] = slotFast;
		}
	}

	return gFastPos;
}

/**
 * Creates a binary tree decoder for probability-based bit decoding
 * Used in LZMA for context-dependent bit sequence decoding
 */
export function createBitTreeDecoder(numBitLevels: number): BitTree {
	return {
		numBitLevels: numBitLevels,
		models: initArray(1 << numBitLevels),
	};
}

/**
 * Creates a binary tree encoder for probability-based bit encoding
 * Used in LZMA for context-dependent bit sequence encoding
 */
export function createBitTreeEncoder(numBitLevels: number): BitTree {
	return {
		numBitLevels: numBitLevels,
		models: initArray(1 << numBitLevels),
	};
}
