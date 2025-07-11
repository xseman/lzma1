import type {
	Encoder,
	MatchFinder,
} from "./lzma.js";
import {
	getMatchesWithEncoder,
	moveMatchFinderBlock,
	readMatchFinderBlock,
} from "./match-finder.js";

/**
 * Get byte at specific index from match finder buffer
 */
export function getIndexByte(
	encoder: Encoder,
	index: number,
): number {
	return encoder._matchFinder!._bufferBase[
		encoder._matchFinder!._bufferOffset
		+ encoder._matchFinder!._pos
		+ index
	];
}

/**
 * Get match length at specific index and distance
 */
export function getMatchLen(
	encoder: Encoder,
	index: number,
	distance: number,
	limit: number,
): number {
	if (encoder._matchFinder!._streamEndWasReached) {
		if (
			encoder._matchFinder!._pos + index + limit
				> encoder._matchFinder!._streamPos
		) {
			limit = encoder._matchFinder!._streamPos
				- (encoder._matchFinder!._pos + index);
		}
	}

	++distance;
	let i,
		pby = encoder._matchFinder!._bufferOffset
			+ encoder._matchFinder!._pos
			+ index;

	for (
		i = 0;
		i < limit
		&& encoder._matchFinder!._bufferBase[pby + i]
			== encoder._matchFinder!._bufferBase[pby + i - distance];
		++i
	);

	return i;
}

/**
 * Get number of available bytes in match finder
 */
export function getNumAvailableBytes(encoder: Encoder): number {
	return encoder._matchFinder!._streamPos - encoder._matchFinder!._pos;
}

/**
 * Get matches from match finder
 */
export function getMatches(encoder: Encoder, movePosCallback: () => void): number {
	const matchFinder = encoder._matchFinder!;
	const distances = encoder._matchDistances;

	return getMatchesWithEncoder(matchFinder, distances, movePosCallback);
}

/**
 * Move position in match finder buffer
 */
export function movePos(
	encoder: Encoder,
	readCallback: (offset: number, length: number) => number,
): void {
	const matchFinder = encoder._matchFinder!;
	let pointerToPostion;

	matchFinder._pos += 1;

	if (matchFinder._pos > matchFinder._posLimit) {
		pointerToPostion = matchFinder._bufferOffset + matchFinder._pos;
		if (pointerToPostion > matchFinder._pointerToLastSafePosition) {
			moveMatchFinderBlock(matchFinder);
		}

		readMatchFinderBlock(matchFinder, readCallback);
	}
}

/**
 * Reduce offsets in match finder
 */
export function reduceOffsets(encoder: Encoder, subValue: number): void {
	encoder._matchFinder!._bufferOffset += subValue;
	encoder._matchFinder!._posLimit -= subValue;
	encoder._matchFinder!._pos -= subValue;
	encoder._matchFinder!._streamPos -= subValue;
}

/**
 * Move position with distance calculation
 */
export function movePosWithDistance(
	encoder: Encoder,
	normalizeLinksCallback: (numItems: number, subValue: number) => void,
	reduceOffsetsCallback: (subValue: number) => void,
): void {
	const matchFinder = encoder._matchFinder!;

	movePos(encoder, (offset: number, length: number) =>
		// This callback needs to be provided by the caller
		0);

	const subValue = matchFinder._pos - matchFinder._cyclicBufferSize;

	if (subValue >= 0) {
		normalizeLinksCallback(matchFinder._cyclicBufferSize * 2, subValue);
		normalizeLinksCallback(matchFinder._hashSizeSum, subValue);

		reduceOffsetsCallback(subValue);
	}
}

/**
 * Normalize links in match finder
 */
export function normalizeLinks(
	matchFinder: MatchFinder,
	numItems: number,
	subValue: number,
): void {
	const items = matchFinder._son;

	for (let i = 0, value; i < numItems; ++i) {
		value = items[i] || 0;
		if (value <= subValue) {
			value = 0;
		} else {
			value -= subValue;
		}
		items[i] = value;
	}
}
