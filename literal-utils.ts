import type {
	LiteralCoder,
	LiteralDecoderEncoder2,
} from "./lzma.js";
import {
	initArray,
	InitBitModels,
} from "./utils.js";

/**
 * Convert value to signed 8-bit integer
 */
export function toSigned8bit(value: number): number {
	const buffer = new ArrayBuffer(1);
	const view = new DataView(buffer);
	view.setInt8(0, value);

	return view.getInt8(0);
}

/**
 * Get decoder for literal based on position and previous byte
 */
export function getDecoder(
	literalDecoder: LiteralCoder,
	pos: number,
	prevByte: number,
): LiteralDecoderEncoder2 {
	// Calculate index based on position and previous byte
	const positionMask = pos & literalDecoder.posMask;
	const prevBitsMask = (prevByte & 0xFF) >>> (0x08 - literalDecoder.numPrevBits);
	const index = (positionMask << literalDecoder.numPrevBits) + prevBitsMask;

	// Return decoder at calculated index
	return literalDecoder.coders[index];
}

/**
 * Initialize literal decoder
 */
export function initLiteralDecoder(decoder: LiteralCoder): void {
	let i, numStates;
	numStates = 1 << decoder.numPrevBits + decoder.numPosBits;

	for (i = 0; i < numStates; ++i) {
		InitBitModels(decoder.coders[i].decoders);
	}
}

/**
 * Decode normal literal symbol
 */
export function decodeNormal(
	decoder: LiteralDecoderEncoder2,
	decodeBitCallback: (models: number[], index: number) => number,
): number {
	let symbol = 1;
	do {
		symbol = symbol << 1 | decodeBitCallback(decoder.decoders, symbol);
	} while (symbol < 0x100);

	return toSigned8bit(symbol);
}

/**
 * Decode literal with match byte
 */
export function decodeWithMatchByte(
	encoder: LiteralDecoderEncoder2,
	matchByte: number,
	decodeBitCallback: (models: number[], index: number) => number,
): number {
	let bit, matchBit, symbol = 1;
	do {
		matchBit = matchByte >> 7 & 1;
		matchByte <<= 1;
		bit = decodeBitCallback(
			encoder!.decoders,
			(1 + matchBit << 0x08) + symbol,
		);
		symbol = symbol << 1 | bit;

		if (matchBit != bit) {
			while (symbol < 0x100) {
				symbol = symbol << 1 | decodeBitCallback(encoder!.decoders, symbol);
			}
			break;
		}
	} while (symbol < 0x100);

	return toSigned8bit(symbol);
}

/**
 * Create literal decoder encoder
 */
export function createLiteralDecoderEncoder2(): LiteralDecoderEncoder2 {
	return {
		decoders: initArray(0x300),
	};
}

/**
 * Create literal encoder with specified configuration
 */
export function createLiteralEncoder(
	numPrevBits: number,
	numPosBits: number,
	createSubCoder: () => LiteralDecoderEncoder2,
): LiteralCoder {
	const encoder = {
		numPrevBits,
		numPosBits,
		posMask: (1 << numPosBits) - 1,
		coders: [],
	} as LiteralCoder;

	const numStates = 1 << (numPrevBits + numPosBits);
	encoder.coders = [];

	for (let i = 0; i < numStates; ++i) {
		encoder.coders[i] = createSubCoder();
	}

	return encoder;
}

/**
 * Get sub-coder for literal encoder based on position and previous byte
 */
export function getSubCoder(
	literalEncoder: LiteralCoder,
	pos: number,
	prevByte: number,
): LiteralDecoderEncoder2 {
	// Calculate position mask bits
	const posBits = pos & literalEncoder.posMask;
	const posShifted = posBits << literalEncoder.numPrevBits;

	// Calculate previous byte bits
	const prevByteShift = 0x08 - literalEncoder.numPrevBits;
	const prevByteBits = (prevByte & 0xFF) >>> prevByteShift;

	// Combine position and prevByte bits to get final index
	const coderIndex = posShifted + prevByteBits;

	return literalEncoder.coders[coderIndex];
}

/**
 * Initialize or create literal encoder with specified configuration
 */
export function initOrCreateLiteralEncoder(
	literalEncoder: LiteralCoder,
	numPrevBits: number,
	numPosBits: number,
	createSubCoder: () => LiteralDecoderEncoder2,
): void {
	if (
		literalEncoder.coders != null
		&& literalEncoder.numPrevBits == numPrevBits
		&& literalEncoder.numPosBits == numPosBits
	) {
		return;
	}

	literalEncoder.numPosBits = numPosBits;
	literalEncoder.posMask = (1 << numPosBits) - 1;
	literalEncoder.numPrevBits = numPrevBits;

	const numStates = 1 << (literalEncoder.numPrevBits + literalEncoder.numPosBits);
	literalEncoder.coders = [];

	for (let i = 0; i < numStates; ++i) {
		literalEncoder.coders[i] = createSubCoder();
	}
}
