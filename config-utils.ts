import type { Encoder } from "./lzma.js";

/**
 * Mode configuration for LZMA compression
 */
export interface Mode {
	searchDepth: number;
	filterStrength: number;
	modeIndex: number;
}

/**
 * Configure encoder with compression mode
 */
export function configureEncoder(encoder: Encoder, mode: Mode): void {
	setDictionarySize(encoder, 0x1 << mode.searchDepth);
	encoder._numFastBytes = mode.filterStrength;
	setMatchFinder(encoder, mode.modeIndex);

	// lc is always 3
	// lp is always 0
	// pb is always 2
	encoder._numLiteralContextBits = 0x3;
	encoder._numLiteralPosStateBits = 0x0;
	encoder._posStateBits = 0x2;
	encoder._posStateMask = 0x3;
}

/**
 * Set dictionary size for encoder
 */
export function setDictionarySize(encoder: Encoder, dictionarySize: number): void {
	encoder._dictionarySize = dictionarySize;

	let dicLogSize = 0;
	for (; dictionarySize > (1 << dicLogSize); ++dicLogSize);

	encoder._distTableSize = dicLogSize * 2;
}

/**
 * Set match finder type for encoder
 */
export function setMatchFinder(encoder: Encoder, matchFinderIndex: number): void {
	const matchFinderIndexPrev = encoder._matchFinderType;
	encoder._matchFinderType = matchFinderIndex;

	if (encoder._matchFinder && matchFinderIndexPrev != encoder._matchFinderType) {
		encoder._dictionarySizePrev = -1;
		encoder._matchFinder = null;
	}
}

/**
 * Base encoder initialization
 */
export function baseInitEncoder(encoder: Encoder): void {
	encoder._state = 0;
	encoder._previousByte = 0;

	for (let i = 0; i < 4; ++i) {
		encoder._repDistances[i] = 0;
	}
}

/**
 * Get position slot for distance using fast position lookup
 */
export function getPosSlot(pos: number, gFastPos: number[]): number {
	if (pos < 0x800) {
		return gFastPos[pos];
	}

	if (pos < 0x200000) {
		return gFastPos[pos >> 10] + 0x14;
	}

	return gFastPos[pos >> 0x14] + 0x28;
}

/**
 * Get position slot for larger distance using fast position lookup
 */
export function getPosSlot2(pos: number, gFastPos: number[]): number {
	if (pos < 0x20000) {
		return gFastPos[pos >> 6] + 0x0C;
	}

	if (pos < 0x8000000) {
		return gFastPos[pos >> 0x10] + 0x20;
	}

	return gFastPos[pos >> 0x1A] + 0x34;
}

/**
 * Get length to position state mapping
 */
export function getLenToPosState(len: number): number {
	len -= 2;
	if (len < 4) {
		return len;
	}
	return 3;
}

/**
 * Get processed size for encoder
 */
export function getProcessedSizeAdd(encoder: Encoder): [number, number] {
	return [
		encoder._additionalOffset,
		encoder._additionalOffset >> 31,
	];
}
