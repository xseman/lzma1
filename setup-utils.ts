/**
 * Setup and initialization utilities for LZMA operations
 */

import { read } from "./io-utils.js";
import { initLenEncoder } from "./length-encoder-utils.js";
import type {
	BitTree,
	Decoder,
	Encoder,
	LenDecoder,
	LenEncoder,
	LiteralDecoderEncoder2,
	MatchFinder,
} from "./lzma.js";
import {
	createBitTreeDecoder,
	createBitTreeEncoder,
} from "./probability.js";
import {
	initArray,
	InitBitModels,
	LZMA_CONSTANTS,
} from "./utils.js";

/**
 * Base initialization for encoder
 */
export function baseInit(encoder: Encoder): void {
	encoder._state = 0;
	encoder._previousByte = 0;

	for (let i = 0; i < 4; ++i) {
		encoder._repDistances[i] = 0;
	}
}

/**
 * Initialize range decoder
 */
export function initRangeDecoder(decoder: Decoder): void {
	decoder.rangeDecoder.code = 0;
	decoder.rangeDecoder.rrange = -1;

	for (let i = 0; i < 5; ++i) {
		decoder.rangeDecoder.code = decoder.rangeDecoder.code << 0x08
			| read(decoder.rangeDecoder.stream!);
	}
}

/**
 * Initialize range encoder
 */
export function initRangeEncoder(encoder: Encoder): void {
	encoder._rangeEncoder.position = LZMA_CONSTANTS.P0_LONG_LIT;
	encoder._rangeEncoder.low = LZMA_CONSTANTS.P0_LONG_LIT;
	encoder._rangeEncoder.rrange = -1;
	encoder._rangeEncoder.cacheSize = 1;
	encoder._rangeEncoder.cache = 0;
}

/**
 * Initialize encoder models and state
 */
export function initEncoder(encoder: Encoder): void {
	encoder._longestMatchWasFound = 0;
	encoder._optimumEndIndex = 0;
	encoder._optimumCurrentIndex = 0;
	encoder._additionalOffset = 0;
}

/**
 * Initialize encoder optimum array
 */
export function initEncoderOptimum(encoder: Encoder): void {
	for (let i = 0; i < 0x1000; ++i) {
		encoder._optimum[i] = {};
	}

	for (let i = 0; i < 4; ++i) {
		encoder._posSlotEncoder[i] = createBitTreeEncoder(6);
	}
}

/**
 * Create length decoder with proper initialization
 */
export function createLenDecoder(): LenDecoder {
	const decoder = {
		choice: initArray(2),
		lowCoder: [] as BitTree[],
		midCoder: [] as BitTree[],
		highCoder: createBitTreeDecoder(0x08),
		numPosStates: 0x00,
	};

	return decoder;
}

/**
 * Initialize length decoder
 */
export function initLenDecoder(decoder: LenDecoder): void {
	InitBitModels(decoder.choice);

	for (let posState = 0; posState < decoder.numPosStates; ++posState) {
		InitBitModels(decoder.lowCoder[posState].models);
		InitBitModels(decoder.midCoder[posState].models);
	}

	InitBitModels(decoder.highCoder.models);
}

/**
 * Create length decoder array for given number of position states
 */
export function createLenDecoderArray(decoder: LenDecoder, numPosStates: number): void {
	for (; decoder.numPosStates < numPosStates; decoder.numPosStates += 1) {
		decoder.lowCoder[decoder.numPosStates] = createBitTreeDecoder(3);
		decoder.midCoder[decoder.numPosStates] = createBitTreeDecoder(3);
	}
}

/**
 * Initialize length encoder with position states
 */
export function initLenEncoderWithPositionStates(encoder: LenEncoder, numPosStates: number): void {
	initLenEncoder(encoder, numPosStates);
}

/**
 * Create literal decoder encoder
 */
export function createLiteralDecoderEncoder2(): LiteralDecoderEncoder2 {
	const encoder = {
		decoders: initArray(0x300),
	} as LiteralDecoderEncoder2;

	return encoder;
}

/**
 * Set match finder type configuration
 */
export function setMatchFinderType(binTree: MatchFinder, numHashBytes: number): void {
	binTree.HASH_ARRAY = numHashBytes > 2;

	if (binTree.HASH_ARRAY) {
		binTree.kNumHashDirectBytes = 0;
		binTree.kMinMatchCheck = 4;
		binTree.kFixHashSize = 66560;
	} else {
		binTree.kNumHashDirectBytes = 2;
		binTree.kMinMatchCheck = 3;
		binTree.kFixHashSize = 0;
	}
}
