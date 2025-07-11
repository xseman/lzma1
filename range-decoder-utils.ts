/**
 * Range decoder utilities for LZMA decompression
 */

import { read } from "./io-utils.js";
import { LZMA_CONSTANTS } from "./utils.js";

// Local interface for the range decoder
interface RangeDecoder {
	code: number;
	rrange: number;
	stream: any;
}

// Helper function for signed 16-bit conversion
function toSigned16bit(value: number): number {
	return value > 32767 ? value - 65536 : value;
}

/**
 * Decode bit using range decoder
 */
export function decodeBit(
	rangeDecoder: RangeDecoder,
	probs: number[],
	index: number,
): 0 | 1 {
	let newBound, prob = probs[index];
	newBound = (rangeDecoder.rrange >>> 11) * prob;

	if ((rangeDecoder.code ^ LZMA_CONSTANTS.MIN_INT32) < (newBound ^ LZMA_CONSTANTS.MIN_INT32)) {
		rangeDecoder.rrange = newBound;
		probs[index] = toSigned16bit(prob + (0x800 - prob >>> 5));
		if (!(rangeDecoder.rrange & LZMA_CONSTANTS.bitMaskForRange)) {
			rangeDecoder.code = rangeDecoder.code << 0x08 | read(rangeDecoder.stream!);
			rangeDecoder.rrange <<= 0x08;
		}

		return 0;
	} else {
		rangeDecoder.rrange -= newBound;
		rangeDecoder.code -= newBound;
		probs[index] = toSigned16bit(prob - (prob >>> 5));
		if (!(rangeDecoder.rrange & LZMA_CONSTANTS.bitMaskForRange)) {
			rangeDecoder.code = rangeDecoder.code << 0x08 | read(rangeDecoder.stream!);
			rangeDecoder.rrange <<= 0x08;
		}

		return 1;
	}
}

/**
 * Decode direct bits using range decoder
 */
export function decodeDirectBits(rangeDecoder: RangeDecoder, numTotalBits: number): number {
	let result = 0;

	for (let i = numTotalBits; i != 0; i -= 1) {
		rangeDecoder.rrange >>>= 1;
		let t = rangeDecoder.code - rangeDecoder.rrange >>> 0x1F;
		rangeDecoder.code -= rangeDecoder.rrange & t - 1;
		result = result << 1 | 1 - t;

		if (!(rangeDecoder.rrange & LZMA_CONSTANTS.bitMaskForRange)) {
			rangeDecoder.code = rangeDecoder.code << 0x08 | read(rangeDecoder.stream!);
			rangeDecoder.rrange <<= 0x08;
		}
	}

	return result;
}

/**
 * Initialize range decoder
 */
export function initRangeDecoder(rangeDecoder: RangeDecoder): void {
	rangeDecoder.code = 0;
	rangeDecoder.rrange = -1;

	for (let i = 0; i < 5; ++i) {
		rangeDecoder.code = rangeDecoder.code << 0x08
			| read(rangeDecoder.stream!);
	}
}
