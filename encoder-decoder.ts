import type {
	Decoder,
	Encoder,
	LenEncoder,
} from "./lzma.js";
import {
	createBitTreeDecoder,
	createBitTreeEncoder,
} from "./probability.js";
import {
	initArray,
	LZMA_CONSTANTS,
} from "./utils.js";

/**
 * Creates a new LZMA encoder with default initialization
 */
export function createEncoder(
	createLenPriceTableEncoder: () => LenEncoder,
): Encoder {
	return {
		_state: 0,
		_previousByte: 0,
		_distTableSize: 0,
		_longestMatchWasFound: 0,
		_optimumEndIndex: 0,
		_optimumCurrentIndex: 0,
		_additionalOffset: 0,
		_dictionarySize: 0,
		_matchFinder: null,
		_dictionarySizePrev: 0,
		_numFastBytes: 0,
		_numLiteralContextBits: 0,
		_numLiteralPosStateBits: 0,
		_posStateBits: 0,
		_posStateMask: 0,
		_needReleaseMFStream: 0,
		_inStream: { buf: [], pos: 0, count: 0 },
		_finished: 0,
		nowPos64: [0, 0],
		_repDistances: initArray(4),
		_optimum: [],
		_rangeEncoder: {
			stream: {
				buf: [],
				count: 0,
			},
			rrange: 0,
			cache: 0,
			low: [0, 0],
			cacheSize: 0,
			position: [0, 0],
		},
		_isMatch: initArray(0xC0),
		_isRep: initArray(0x0C),
		_isRepG0: initArray(0x0C),
		_isRepG1: initArray(0x0C),
		_isRepG2: initArray(0x0C),
		_isRep0Long: initArray(0xC0),
		_posSlotEncoder: [],
		_posEncoders: initArray(0x72),
		_posAlignEncoder: createBitTreeEncoder(0x04),
		_lenEncoder: createLenPriceTableEncoder(),
		_repMatchLenEncoder: createLenPriceTableEncoder(),
		_literalEncoder: {} as any,
		_matchDistances: [],
		_posSlotPrices: [],
		_distancesPrices: [],
		_alignPrices: initArray(0x10),
		_matchPriceCount: 0,
		_alignPriceCount: 0,
		reps: initArray(0x04),
		repLens: initArray(0x04),
		processedInSize: [LZMA_CONSTANTS.P0_LONG_LIT],
		processedOutSize: [LZMA_CONSTANTS.P0_LONG_LIT],
		finished: [0x00],
		properties: initArray(0x05),
		tempPrices: initArray(0x80),
		_longestMatchLength: 0x00,
		_matchFinderType: 0x01,
		_numDistancePairs: 0x00,
		_numFastBytesPrev: -0x01,
		backRes: 0x00,
	};
}

/**
 * Creates a new LZMA decoder with default initialization
 */
export function createDecoder(
	createLenDecoder: () => any,
): Decoder {
	const decoder = {
		posStateMask: 0,
		dictSize: 0,
		dictSizeCheck: 0,
		state: 0,
		rep0: 0,
		rep1: 0,
		rep2: 0,
		rep3: 0,
		outSize: [0, 0],
		nowPos64: [0, 0],
		prevByte: 0,
		alive: 0,
		encoder: null,
		decoder: {} as Decoder,
		inBytesProcessed: [0, 0],
		outWin: {} as any,
		rangeDecoder: {} as any,
		matchDecoders: initArray(0xC0),
		repDecoders: initArray(0x0C),
		repG0Decoders: initArray(0x0C),
		repG1Decoders: initArray(0x0C),
		repG2Decoders: initArray(0x0C),
		rep0LongDecoders: initArray(0xC0),
		posSlotDecoders: initArray(4),
		posDecoders: initArray(0x72),
		posAlignDecoder: createBitTreeDecoder(0x04),
		lenDecoder: createLenDecoder(),
		repLenDecoder: createLenDecoder(),
		literalDecoder: {} as any,
	} as unknown as Decoder;

	for (let i = 0; i < 4; ++i) {
		decoder.posSlotDecoders[i] = createBitTreeDecoder(0x06);
	}

	return decoder;
}
