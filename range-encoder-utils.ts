/**
 * Range encoder utilities for LZMA compression
 */

import { write } from "./io-utils.js";
import {
	add,
	and,
	fromInt,
	lowBits_0,
	LZMA_CONSTANTS,
	shl,
	shru,
} from "./utils.js";

// Local interface for the range encoder
interface RangeEncoder {
	rrange: number;
	low: [number, number];
	position: [number, number];
	cacheSize: number;
	cache: number;
	stream: any;
}

// Helper function for signed 16-bit conversion
function toSigned16bit(value: number): number {
	return value > 32767 ? value - 65536 : value;
}

/**
 * Shift low bytes in range encoder
 */
export function shiftLow(rangeEncoder: RangeEncoder): void {
	const LowHi = lowBits_0(shru(rangeEncoder.low, 0x20));
	if (LowHi !== 0 || rangeEncoder.low[0] < 0xFF000000) {
		rangeEncoder.position = add(
			rangeEncoder.position,
			fromInt(rangeEncoder.cacheSize),
		);

		let temp = rangeEncoder.cache;
		do {
			write(rangeEncoder.stream, temp + LowHi);
			temp = 0xFF;
		} while ((rangeEncoder.cacheSize -= 1) != 0);

		rangeEncoder.cache = lowBits_0(rangeEncoder.low) >>> 0x18;
	}

	rangeEncoder.cacheSize += 1;
	rangeEncoder.low = shl(and(rangeEncoder.low, [0xFFFFFF, 0]), 0x08);
}

/**
 * Encode bit using range encoder
 */
export function encodeBit(
	rangeEncoder: RangeEncoder,
	probs: number[],
	index: number,
	symbol: number,
	shiftLowFn: () => void,
): void {
	let newBound, prob = probs[index];
	newBound = (rangeEncoder.rrange >>> 11) * prob;

	if (!symbol) {
		rangeEncoder.rrange = newBound;
		probs[index] = toSigned16bit(prob + (0x800 - prob >>> 5));
	} else {
		rangeEncoder.low = add(
			rangeEncoder.low,
			and(fromInt(newBound), [LZMA_CONSTANTS._MAX_UINT32, 0]),
		);
		rangeEncoder.rrange -= newBound;
		probs[index] = toSigned16bit(prob - (prob >>> 5));
	}

	if (!(rangeEncoder.rrange & LZMA_CONSTANTS.bitMaskForRange)) {
		rangeEncoder.rrange <<= 0x08;
		shiftLowFn();
	}
}

/**
 * Encode direct bits using range encoder
 */
export function encodeDirectBits(
	rangeEncoder: RangeEncoder,
	valueToEncode: number,
	numTotalBits: number,
	shiftLowFn: () => void,
): void {
	for (let i = numTotalBits - 1; i >= 0; i -= 1) {
		rangeEncoder.rrange >>>= 1;
		if ((valueToEncode >>> i & 1) == 1) {
			rangeEncoder.low = add(rangeEncoder.low, fromInt(rangeEncoder.rrange));
		}
		if (!(rangeEncoder.rrange & LZMA_CONSTANTS.bitMaskForRange)) {
			rangeEncoder.rrange <<= 0x08;
			shiftLowFn();
		}
	}
}

/**
 * Get processed size from range encoder
 */
export function getProcessedSizeAdd(rangeEncoder: RangeEncoder): [number, number] {
	const processedCacheSize = add(
		fromInt(rangeEncoder.cacheSize),
		rangeEncoder.position,
	);

	return add(
		processedCacheSize,
		[4, 0],
	);
}
