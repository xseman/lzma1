import type { BitTree } from "./lzma.js";

/**
 * Bit-tree operations for LZMA compression and decompression
 * These functions handle binary tree encoding/decoding for probability-based bit sequences
 */

/**
 * Decodes a symbol from a bit-tree using probability models
 * Used in LZMA decompression for context-dependent bit sequence decoding
 */
export function bitTreeDecoder(
	bitTree: BitTree,
	decodeBitFn: (probs: number[], index: number) => 0 | 1,
): number {
	let bitIndex, m = 1;

	for (bitIndex = bitTree.numBitLevels; bitIndex != 0; bitIndex -= 1) {
		m = (m << 1) + decodeBitFn(bitTree.models, m);
	}

	return m - (1 << bitTree.numBitLevels);
}

/**
 * Encodes a symbol using bit-tree encoding with probability models
 * Used in LZMA compression for context-dependent bit sequence encoding
 */
export function bitTreeEncoder(
	bitTree: BitTree,
	symbol: number,
	encodeBitFn: (models: number[], index: number, bit: number) => void,
): void {
	let bit, bitIndex, m = 1;

	for (bitIndex = bitTree.numBitLevels; bitIndex != 0;) {
		bitIndex -= 1;
		bit = symbol >>> bitIndex & 1;
		encodeBitFn(bitTree.models, m, bit);
		m = m << 1 | bit;
	}
}

/**
 * Calculates the encoding cost for a symbol using bit-tree probabilities
 * Used in LZMA compression for optimal match selection
 */
export function bitTreeEncoderGetPrice(
	bitTree: BitTree,
	symbol: number,
	getPriceFn: (prob: number, symbol: number) => number,
): number {
	let bit, bitIndex, m = 1, price = 0;

	for (bitIndex = bitTree.numBitLevels; bitIndex != 0;) {
		bitIndex -= 1;
		bit = symbol >>> bitIndex & 1;
		price += getPriceFn(bitTree.models[m], bit);
		m = (m << 1) + bit;
	}

	return price;
}

/**
 * Reverse decodes a symbol from bit-tree (LSB first)
 * Used in LZMA for position alignment decoding
 */
export function reverseDecode(
	bitTree: BitTree,
	decodeBitFn: (probs: number[], index: number) => 0 | 1,
): number {
	let symbol = 0;
	for (
		let m = 1, bitIndex = 0, bit: number;
		bitIndex < bitTree.numBitLevels;
		++bitIndex
	) {
		bit = decodeBitFn(bitTree.models, m);
		m <<= 1;
		m += bit;
		symbol |= bit << bitIndex;
	}

	return symbol;
}

/**
 * Reverse decodes a symbol from models array with start index
 * Used in LZMA for position encoding with custom model arrays
 */
export function reverseDecodeWithModels(
	models: number[],
	startIndex: number,
	numBitLevels: number,
	decodeBitFn: (probs: number[], index: number) => 0 | 1,
): number {
	let symbol = 0;

	for (
		let bitIndex = 0, m = 1, bit: number;
		bitIndex < numBitLevels;
		++bitIndex
	) {
		bit = decodeBitFn(models, startIndex + m);
		m <<= 1;
		m += bit;
		symbol |= bit << bitIndex;
	}

	return symbol;
}

/**
 * Reverse encodes a symbol using bit-tree (LSB first)
 * Used in LZMA for position alignment encoding
 */
export function reverseEncode(
	bitTree: BitTree,
	symbol: number,
	encodeBitFn: (models: number[], index: number, bit: number) => void,
): void {
	let bit, m = 1;

	for (let i = 0; i < bitTree.numBitLevels; ++i) {
		bit = symbol & 1;
		encodeBitFn(bitTree.models, m, bit);
		m = m << 1 | bit;
		symbol >>= 1;
	}
}

/**
 * Reverse encodes a symbol with custom models array
 * Used in LZMA for position encoding with custom model arrays
 */
export function reverseEncodeWithModels(
	models: number[],
	startIndex: number,
	numBitLevels: number,
	symbol: number,
	encodeBitFn: (models: number[], index: number, bit: number) => void,
): void {
	let bit, m = 1;

	for (let i = 0; i < numBitLevels; ++i) {
		bit = symbol & 1;
		encodeBitFn(models, startIndex + m, bit);
		m = m << 1 | bit;
		symbol >>= 1;
	}
}

/**
 * Calculates reverse encoding cost for a symbol using bit-tree
 * Used in LZMA compression for optimal match selection
 */
export function reverseGetPrice(
	bitTree: BitTree,
	symbol: number,
	getPriceFn: (prob: number, symbol: number) => number,
): number {
	let bit, m = 1, price = 0;

	for (let i = bitTree.numBitLevels; i != 0; i -= 1) {
		bit = symbol & 1;
		symbol >>>= 1;
		price += getPriceFn(bitTree.models[m], bit);
		m = m << 1 | bit;
	}

	return price;
}

/**
 * Calculates reverse encoding cost with custom models array
 * Used in LZMA compression for optimal position encoding cost estimation
 */
export function reverseGetPriceWithModels(
	models: number[],
	startIndex: number,
	numBitLevels: number,
	symbol: number,
	probPrices: number[],
): number {
	let bit, m = 1, price = 0;

	for (let i = numBitLevels; i != 0; i -= 1) {
		bit = symbol & 1;
		symbol >>>= 1;
		price += probPrices[((models[startIndex + m] - bit ^ -bit) & 0x7FF) >>> 2];
		m = m << 1 | bit;
	}

	return price;
}
