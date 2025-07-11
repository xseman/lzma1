/**
 * Header and property utilities for LZMA compression/decompression
 */

import { write_0 } from "./io-utils.js";
import type { Encoder } from "./lzma.js";

/**
 * Write LZMA header properties to encoder and optionally to output stream
 */
export function writeHeaderProperties(encoder: Encoder, output?: { buf: any; count: number; }): void {
	const HEADER_SIZE = 0x5; // Total header size in bytes

	// First byte combines posStateBits, literalPosStateBits and literalContextBits
	// Format: (posStateBits * 5 + literalPosStateBits) * 9 + literalContextBits
	encoder.properties[0] = (
		(encoder._posStateBits * 5 + encoder._numLiteralPosStateBits) * 9 + encoder._numLiteralContextBits
	) & 0xFF; // Ensure byte-sized value

	// Next 4 bytes store dictionary size in little-endian format
	for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
		// Shift dictionary size right by appropriate number of bits and mask to byte
		encoder.properties[1 + byteIndex] = (
			encoder._dictionarySize >> (0x08 * byteIndex)
		) & 0xFF;
	}

	// Write the 5-byte header to output if provided
	if (output) {
		write_0(
			output,
			encoder.properties,
			0, // Starting from index 0
			HEADER_SIZE,
		);
	}
}

/**
 * Set decoder properties from header bytes
 */
export function setDecoderProperties(properties: number[], decoder: any): 0 | 1 {
	let val, dictionarySize = 0;

	if (properties.length < 5) {
		return 0;
	}

	val = properties[0] & 0xFF;
	if (val >= 9 * 5 * 5) {
		return 0;
	}

	for (let i = 0; i < 4; ++i) {
		dictionarySize += (properties[1 + i] & 0xFF) << i * 0x08;
	}

	if (!setLcLpPb(val % 9, Math.floor(val / 9) % 5, Math.floor(val / 45), decoder)) {
		return 0;
	}

	return setDictionarySize(dictionarySize, decoder);
}

/**
 * Set LC, LP, PB values for decoder
 */
export function setLcLpPb(lc: number, lp: number, pb: number, decoder: any): 0 | 1 {
	if (lc > 8 || lp > 4 || pb > 4) {
		return 0;
	}

	decoder._numLiteralPosStateBits = lp;
	decoder._numLiteralContextBits = lc;
	decoder._posStateMask = (1 << pb) - 1;

	return 1;
}

/**
 * Set LC and PB values for decoder
 */
export function setLcPb(lc: number, pb: number, decoder: any): 0 | 1 {
	if (lc > 8 || pb > 4) {
		return 0;
	}

	decoder._numLiteralContextBits = lc;
	decoder._posStateMask = (1 << pb) - 1;

	return 1;
}

/**
 * Set dictionary size for decoder
 */
export function setDictionarySize(dictionarySize: number, decoder: any): 0 | 1 {
	if (dictionarySize < 0) {
		return 0;
	}

	if (decoder._dictionarySize != dictionarySize) {
		decoder._dictionarySize = dictionarySize;
		decoder._dictionarySizeCheck = Math.max(decoder._dictionarySize, 1);
	}

	return 1;
}
