import type {
	BitTree,
	LenEncoder,
} from "./lzma.js";
import { createBitTreeEncoder } from "./probability.js";
import { lenEncoderGetPrice } from "./range-coder.js";
import {
	initArray,
	InitBitModels,
} from "./utils.js";

/**
 * Create a length encoder
 */
export function createLenEncoder(): LenEncoder {
	const encoder = {} as LenEncoder;

	encoder.choice = initArray(2);
	encoder.lowCoder = [] as BitTree[];
	encoder.midCoder = [] as BitTree[];
	encoder.highCoder = createBitTreeEncoder(0x08);

	for (let posState = 0; posState < 0x10; ++posState) {
		encoder.lowCoder[posState] = createBitTreeEncoder(3);
		encoder.midCoder[posState] = createBitTreeEncoder(3);
	}

	return encoder;
}

/**
 * Create a length price table encoder
 */
export function createLenPriceTableEncoder(): LenEncoder {
	const encoder = createLenEncoder();
	encoder.prices = [];
	encoder.counters = [];

	return encoder;
}

/**
 * Initialize length encoder
 */
export function initLenEncoder(encoder: LenEncoder, numPosStates: number): void {
	InitBitModels(encoder.choice);

	for (let posState = 0; posState < numPosStates; ++posState) {
		InitBitModels(encoder.lowCoder[posState].models);
		InitBitModels(encoder.midCoder[posState].models);
	}

	InitBitModels(encoder.highCoder.models);
}

/**
 * Set prices for length encoder
 */
export function setPrices(
	encoder: LenEncoder,
	posState: number,
	numSymbols: number,
	prices: number[],
	st: number,
	probPrices: number[],
): void {
	let a0 = probPrices[encoder.choice[0] >>> 2];
	let a1 = probPrices[0x800 - encoder.choice[0] >>> 2];
	let b0 = a1 + probPrices[encoder.choice[1] >>> 2];
	let b1 = a1 + probPrices[0x800 - encoder.choice[1] >>> 2];

	let i = 0;
	for (i = 0; i < 8; ++i) {
		if (i >= numSymbols) {
			return;
		}
		prices[st + i] = a0 + getBitTreePrice(encoder.lowCoder[posState], i, probPrices);
	}

	for (; i < 0x10; ++i) {
		if (i >= numSymbols) {
			return;
		}
		prices[st + i] = b0 + getBitTreePrice(encoder.midCoder[posState], i - 0x08, probPrices);
	}

	for (; i < numSymbols; ++i) {
		prices[st + i] = b1 + getBitTreePrice(encoder.highCoder, i - 0x08 - 0x08, probPrices);
	}
}

/**
 * Get bit tree price
 */
function getBitTreePrice(bitTree: BitTree, symbol: number, probPrices: number[]): number {
	let price = 0;
	symbol |= 1 << bitTree.numBitLevels;

	while (symbol != 1) {
		price += probPrices[
			(
				((bitTree.models[symbol >>> 1] - symbol) & 1) << 11
			) | (bitTree.models[symbol >>> 1] >>> 1)
		];
		symbol >>>= 1;
	}

	return price;
}

/**
 * Encode with length encoder
 */
export function encodeLenEncoder(
	encoder: LenEncoder,
	symbol: number,
	posState: number,
	encodeBitCallback: (probs: number[], index: number, symbol: number) => void,
	encodeBitTreeCallback: (bitTree: BitTree, symbol: number) => void,
): void {
	if (symbol < 0x08) {
		encodeBitCallback(encoder.choice, 0, 0);
		encodeBitTreeCallback(encoder.lowCoder[posState], symbol);
	} else {
		symbol -= 0x08;
		encodeBitCallback(encoder.choice, 0, 1);

		if (symbol < 0x08) {
			encodeBitCallback(encoder.choice, 1, 0);
			encodeBitTreeCallback(encoder.midCoder[posState], symbol);
		} else {
			encodeBitCallback(encoder.choice, 1, 1);
			encodeBitTreeCallback(encoder.highCoder, symbol - 0x08);
		}
	}
}

/**
 * Get price for length encoder
 */
export function getLenEncoderPrice(
	encoder: LenEncoder,
	symbol: number,
	posState: number,
): number {
	return lenEncoderGetPrice(encoder, symbol, posState);
}

/**
 * Update tables for length price table encoder
 */
export function updateLenPriceTableEncoderTables(
	encoder: LenEncoder,
	numPosStates: number,
	probPrices: number[],
	setPricesCallback?: (
		encoder: LenEncoder,
		posState: number,
		numSymbols: number,
		prices: number[],
		st: number,
	) => void,
): void {
	for (let posState = 0; posState < numPosStates; ++posState) {
		if (setPricesCallback) {
			setPricesCallback(
				encoder,
				posState,
				encoder.tableSize,
				encoder.prices,
				posState * 0x110,
			);
		} else {
			setPrices(
				encoder,
				posState,
				encoder.tableSize,
				encoder.prices,
				posState * 0x110,
				probPrices,
			);
		}

		encoder.counters[posState] = encoder.tableSize;
	}
}
