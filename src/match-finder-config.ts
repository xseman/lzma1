import type { MatchFinder } from "./encoder.js";
import {
	DICTIONARY_SIZE_THRESHOLD,
	initArray,
} from "./utils.js";

/**
 * Match finder configuration helpers
 * Pure functions extracted from LZMA class for better modularity
 */

/**
 * Compute window reservation size for match finder buffer allocation
 */
export function computeWindowReservSize(
	dictionarySize: number,
	keepBefore: number,
	numFastBytes: number,
	keepAfter: number,
): number {
	return ~~((dictionarySize + keepBefore + numFastBytes + keepAfter) / 2) + 0x100;
}

/**
 * Ensure cyclic buffer is properly sized and allocated
 */
export function ensureCyclicBuffer(matchFinder: MatchFinder, dictionarySize: number): void {
	const cyclicBufferSize = dictionarySize + 1;

	if (matchFinder._cyclicBufferSize !== cyclicBufferSize) {
		const doubledCyclicBufferSize = (matchFinder._cyclicBufferSize = cyclicBufferSize) * 2;
		matchFinder._son = initArray(doubledCyclicBufferSize);
	}
}

interface HashSizeConfig {
	hashMask: number;
	hashSizeSum: number;
}

/**
 * Compute hash size for match finder hash table
 */
export function computeHashSize(dictionarySize: number, hashArrayEnabled: boolean): HashSizeConfig {
	let hs = 0x10000;
	let hashMask = 0;

	if (hashArrayEnabled) {
		hs = dictionarySize - 1;
		hs |= hs >> 1;
		hs |= hs >> 2;
		hs |= hs >> 4;
		hs |= hs >> 0x08;
		hs >>= 1;
		hs |= 0xFFFF;

		if (hs > 0x1000000) {
			hs >>= 1;
		}

		hashMask = hs;
		hs += 1;

		// Add kFixHashSize (assumed to be available on matchFinder)
		// This will be passed in from the calling context
	}

	return { hashMask, hashSizeSum: hs };
}

/**
 * Set cut value for match finder based on fast bytes setting
 */
export function setCutValue(numFastBytes: number): number {
	return 0x10 + (numFastBytes >> 1);
}

/**
 * Set maximum match length for match finder
 */
export function setMatchMaxLen(numFastBytes: number): number {
	return numFastBytes;
}

/**
 * Check if dictionary size is below threshold requiring special handling
 */
export function isDictionarySizeBelowThreshold(dictionarySize: number): boolean {
	return dictionarySize < DICTIONARY_SIZE_THRESHOLD;
}
