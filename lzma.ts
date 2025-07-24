interface Mode {
	searchDepth: number;
	filterStrength: number;
	modeIndex: number;
}

/**
 * RelativeIndexable is a generic interface for array-like structures
 * that can be indexed with a number
 */
type RelativeIndexable<T> = {
	[key: number]: T;
	length: number;
};

/**
 * Base stream interface for input/output operations
 */
interface BaseStream {
	buf: RelativeIndexable<number> | Uint8Array | ArrayBuffer | number[];
	pos: number;
	count: number;
}

/**
 * Unified stream interface for all buffer operations
 */
interface Stream {
	buf: RelativeIndexable<number> | Uint8Array | ArrayBuffer | number[];
	pos: number;
	count: number;
}

/**
 * Represents a buffer with a count of used elements
 */
interface BufferWithCount {
	buf: number[];
	count: number;
}

/**
 * Window interface for stream and positioning information
 */
interface Window {
	streamPos?: number;
	pos: number;
	buf?: number[];
	winSize?: number;
	_stream?: BufferWithCount | null;
	_pos: number;
	_streamPos: number;
	_windowSize: number;
	_buffer?: number[];
}

/**
 * Range coder interface with stream
 */
interface RangeCoder {
	stream: Stream | BufferWithCount | null;
}

/**
 * Range decoder with code value
 */
interface RangeDecoder extends RangeCoder {
	code: number;
	rrange: number;
	stream: Stream | null;
}

/**
 * Range encoder with encoding state
 */
interface RangeEncoder extends RangeCoder {
	low: [number, number];
	rrange: number;
	cacheSize: number;
	cache: number;
	position: [number, number];
	stream: BufferWithCount | null;
}

/**
 * Binary tree for probability modeling
 */
interface BitTree {
	numBitLevels: number;
	models: number[];
}

/**
 * Literal coder with decoders array
 */
interface LiteralCoder {
	coders: LiteralDecoderEncoder2[];
	numPrevBits: number;
	numPosBits: number;
	posMask: number;
}

/**
 * Literal encoder interface
 */
interface LiteralEncoder {
	coders: LiteralDecoderEncoder2[];
	numPrevBits: number;
	numPosBits: number;
	posMask: number;
}

/**
 * Literal decoder/encoder for optimization
 */
interface LiteralDecoderEncoder2 {
	decoders: number[];
}

/**
 * Length coder with probability models
 */
interface LenCoder {
	choice: number[];
	lowCoder: BitTree[];
	midCoder: BitTree[];
	highCoder: BitTree;
}

/**
 * Length encoder with required properties
 */
type LenEncoder = LenCoder & {
	tableSize: number;
	prices: number[];
	counters: number[];
	choice: number[];
	lowCoder: BitTree[];
	midCoder: BitTree[];
	highCoder: BitTree;
};

/**
 * Length decoder with required properties
 */
type LenDecoder = LenCoder & {
	choice: number[];
	lowCoder: BitTree[];
	midCoder: BitTree[];
	highCoder: BitTree;
	numPosStates: number;
};

/**
 * Optimization data structure
 */
interface Optimum {
	state?: number;
	prev1IsChar?: number;
	prev2?: number;
	posPrev2?: number;
	backPrev2?: number;
	price?: number;
	posPrev?: number;
	backPrev?: number;
	backs0?: number;
	backs1?: number;
	backs2?: number;
	backs3?: number;
}

/**
 * Match finder implementation
 */
interface MatchFinder {
	_posLimit: number;
	_bufferBase: number[];
	_pos: number;
	_streamPos: number;
	_streamEndWasReached: number;
	_bufferOffset: number;
	_blockSize: number;
	_keepSizeBefore: number;
	_keepSizeAfter: number;
	_pointerToLastSafePosition: number;
	_stream: BaseStream | null;
	HASH_ARRAY: boolean;
	kNumHashDirectBytes: number;
	kMinMatchCheck: number;
	kFixHashSize: number;
	_hashMask: number;
	_hashSizeSum: number;
	_hash: number[];
	_cyclicBufferSize: number;
	_cyclicBufferPos: number;
	_son: number[];
	_matchMaxLen: number;
	_cutValue: number;
}

/**
 * LZMA encoder implementation
 */
interface Encoder {
	_state: number;
	_previousByte: number;
	_distTableSize: number;
	_longestMatchWasFound: number;
	_optimumEndIndex: number;
	_optimumCurrentIndex: number;
	_additionalOffset: number;
	_dictionarySize: number;
	_matchFinder: MatchFinder | null;
	_dictionarySizePrev: number;
	_numFastBytes: number;
	_numLiteralContextBits: number;
	_numLiteralPosStateBits: number;
	_posStateBits: number;
	_posStateMask: number;
	_needReleaseMFStream: number;
	_inStream: BaseStream | null;
	_finished: number;
	nowPos64: [number, number];
	_repDistances: number[];
	_optimum: Optimum[];
	_rangeEncoder: RangeEncoder;
	_isMatch: number[];
	_isRep: number[];
	_isRepG0: number[];
	_isRepG1: number[];
	_isRepG2: number[];
	_isRep0Long: number[];
	_posSlotEncoder: BitTree[];
	_posEncoders: number[];
	_posAlignEncoder: BitTree;
	_lenEncoder: LenEncoder;
	_repMatchLenEncoder: LenEncoder;
	_literalEncoder: LiteralEncoder;
	_matchDistances: number[];
	_posSlotPrices: number[];
	_distancesPrices: number[];
	_alignPrices: number[];
	_matchPriceCount: number;
	_alignPriceCount: number;
	reps: number[];
	repLens: number[];
	processedInSize: [number, number][];
	processedOutSize: [number, number][];
	finished: number[];
	properties: number[];
	tempPrices: number[];
	_longestMatchLength: number;
	_matchFinderType: number;
	_numDistancePairs: number;
	_numFastBytesPrev: number;
	backRes: number;
}

/**
 * LZMA decoder implementation
 */
interface Decoder extends Chunker {
	posStateMask: number;
	dictSize: number;
	dictSizeCheck: number;
	state: number;
	rep0: number;
	rep1: number;
	rep2: number;
	rep3: number;
	outSize: [number, number];
	nowPos64: [number, number];
	prevByte: number;
	alive: number;
	encoder: null;
	decoder: Decoder;
	outWin: Window;
	rangeDecoder: RangeDecoder;
	matchDecoders: number[];
	repDecoders: number[];
	repG0Decoders: number[];
	repG1Decoders: number[];
	repG2Decoders: number[];
	rep0LongDecoders: number[];
	posSlotDecoders: BitTree[];
	posDecoders: number[];
	posAlignDecoder: BitTree;
	lenDecoder: LenDecoder;
	repLenDecoder: LenDecoder;
	literalDecoder: LiteralCoder;
}

/**
 * Unified chunker interface for both encoding and decoding
 */
interface Chunker {
	alive: number;
	inBytesProcessed: [number, number];
}

/**
 * Encoder chunker implementation
 */
interface EncoderChunker extends Chunker {
	encoder: Encoder | null;
	decoder: null;
}

/**
 * Decoder chunker implementation
 */
interface DecoderChunker extends Chunker {
	encoder: null;
	decoder: Decoder;
}

/**
 * Base context interface for compression operations
 */
interface Context {
	chunker: EncoderChunker | DecoderChunker;
}

/**
 * Compression context with optional length information
 */
interface CompressionContext extends Context {
	chunker: EncoderChunker;
	output: BufferWithCount;
	length_0?: [number, number];
}

/**
 * Decompression context
 */
interface DecompressionContext {
	chunker: DecoderChunker;
	output: BufferWithCount;
}

// const CRC32_TABLE = (() => {
// 	const crcTable = [];
// 	for (let i = 0, r; i < 256; ++i, r = i) {
// 		r = i;
// 		for (let j = 0; j < 8; ++j) {
// 			if ((r & 1) != 0) {
// 				r >>>= 1;
// 				r ^= -306674912;
// 			} else {
// 				r >>>= 1;
// 			}
// 		}
// 		crcTable[i] = r;
// 	}

// 	return crcTable;
// })();

// dprint-ignore
const CRC32_TABLE = [
	0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA, 0x076DC419, 0x706AF48F,
	0xE963A535, 0x9E6495A3,	0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
	0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91, 0x1DB71064, 0x6AB020F2,
	0xF3B97148, 0x84BE41DE,	0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
	0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,	0x14015C4F, 0x63066CD9,
	0xFA0F3D63, 0x8D080DF5,	0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
	0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,	0x35B5A8FA, 0x42B2986C,
	0xDBBBC9D6, 0xACBCF940,	0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
	0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423,
	0xCFBA9599, 0xB8BDA50F, 0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
	0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,	0x76DC4190, 0x01DB7106,
	0x98D220BC, 0xEFD5102A, 0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
	0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818, 0x7F6A0DBB, 0x086D3D2D,
	0x91646C97, 0xE6635C01, 0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
	0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457, 0x65B0D9C6, 0x12B7E950,
	0x8BBEB8EA, 0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
	0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2, 0x4ADFA541, 0x3DD895D7,
	0xA4D1C46D, 0xD3D6F4FB, 0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
	0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9, 0x5005713C, 0x270241AA,
	0xBE0B1010, 0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
	0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17, 0x2EB40D81,
	0xB7BD5C3B, 0xC0BA6CAD, 0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
	0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683, 0xE3630B12, 0x94643B84,
	0x0D6D6A3E, 0x7A6A5AA8, 0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
	0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE, 0xF762575D, 0x806567CB,
	0x196C3671, 0x6E6B06E7, 0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
	0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5, 0xD6D6A3E8, 0xA1D1937E,
	0x38D8C2C4, 0x4FDFF252, 0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
	0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55,
	0x316E8EEF, 0x4669BE79, 0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
	0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F, 0xC5BA3BBE, 0xB2BD0B28,
	0x2BB45A92, 0x5CB36A04, 0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
	0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A, 0x9C0906A9, 0xEB0E363F,
	0x72076785, 0x05005713, 0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
	0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21, 0x86D3D2D4, 0xF1D4E242,
	0x68DDB3F8, 0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
	0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C, 0x8F659EFF, 0xF862AE69,
	0x616BFFD3, 0x166CCF45, 0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
	0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB, 0xAED16A4A, 0xD9D65ADC,
	0x40DF0B66, 0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
	0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605, 0xCDD70693,
	0x54DE5729, 0x23D967BF, 0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
	0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
];

export class LZMA {
	readonly #MAX_UINT32 = 4294967296;
	readonly #_MAX_UINT32 = 0xFFFFFFFF;
	readonly #MAX_INT32 = 2147483647;
	readonly #MIN_INT32 = -2147483648;
	readonly #MAX_COMPRESSION_SIZE = 9223372036854775807;
	readonly #kIfinityPrice = 268435455;
	readonly #dictionarySizeThreshold = 0x3FFFFFFF;

	readonly #N1_LONG_LIT: [number, number];
	readonly #MIN_VALUE: [number, number];
	readonly #P0_LONG_LIT: [number, number] = [0, 0];
	readonly #P1_LONG_LIT: [number, number] = [1, 0];

	readonly CompressionModes = {
		1: { searchDepth: 0x10, filterStrength: 0x40, modeIndex: 0x00 },
		2: { searchDepth: 0x14, filterStrength: 0x40, modeIndex: 0x00 },
		3: { searchDepth: 0x13, filterStrength: 0x40, modeIndex: 0x01 },
		4: { searchDepth: 0x14, filterStrength: 0x40, modeIndex: 0x01 },
		5: { searchDepth: 0x15, filterStrength: 0x80, modeIndex: 0x01 },
		6: { searchDepth: 0x16, filterStrength: 0x80, modeIndex: 0x01 },
		7: { searchDepth: 0x17, filterStrength: 0x80, modeIndex: 0x01 },
		8: { searchDepth: 0x18, filterStrength: 0xFF, modeIndex: 0x01 },
		9: { searchDepth: 0x19, filterStrength: 0xFF, modeIndex: 0x01 },
	} as const;

	#encoder: Encoder;
	#decoder: Decoder;
	#probPrices: number[];
	#gFastPos: number[];
	#compressor: CompressionContext;
	#decompressor: DecompressionContext;

	constructor() {
		this.#N1_LONG_LIT = [4294967295, -this.#MAX_UINT32]; // N1_longLit from old.ts
		this.#MIN_VALUE = [0, -9223372036854775808]; // MIN_VALUE from old.ts

		this.#encoder = this.#initEncoder();
		this.#decoder = this.#initDecoder();
		this.#probPrices = this.#createProbPrices();
		this.#gFastPos = this.#createFastPos();
		this.#compressor = this.#initCompressor();
		this.#decompressor = this.#initDecompressor();
	}

	#initEncoder(): Encoder {
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
			_repDistances: this.#initArray(4),
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
			_isMatch: this.#initArray(0xC0),
			_isRep: this.#initArray(0x0C),
			_isRepG0: this.#initArray(0x0C),
			_isRepG1: this.#initArray(0x0C),
			_isRepG2: this.#initArray(0x0C),
			_isRep0Long: this.#initArray(0xC0),
			_posSlotEncoder: [],
			_posEncoders: this.#initArray(0x72),
			_posAlignEncoder: this.#createBitTreeEncoder(0x04),
			_lenEncoder: this.#createLenPriceTableEncoder(),
			_repMatchLenEncoder: this.#createLenPriceTableEncoder(),
			_literalEncoder: {} as LiteralEncoder,
			_matchDistances: [],
			_posSlotPrices: [],
			_distancesPrices: [],
			_alignPrices: this.#initArray(0x10),
			_matchPriceCount: 0,
			_alignPriceCount: 0,
			reps: this.#initArray(0x04),
			repLens: this.#initArray(0x04),
			processedInSize: [this.#P0_LONG_LIT],
			processedOutSize: [this.#P0_LONG_LIT],
			finished: [0x00],
			properties: this.#initArray(0x05),
			tempPrices: this.#initArray(0x80),
			_longestMatchLength: 0x00,
			_matchFinderType: 0x01,
			_numDistancePairs: 0x00,
			_numFastBytesPrev: -0x01,
			backRes: 0x00,
		};
	}

	#initDecoder(): Decoder {
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
			outWin: {} as Window,
			rangeDecoder: {} as RangeDecoder,
			matchDecoders: this.#initArray(0xC0),
			repDecoders: this.#initArray(0x0C),
			repG0Decoders: this.#initArray(0x0C),
			repG1Decoders: this.#initArray(0x0C),
			repG2Decoders: this.#initArray(0x0C),
			rep0LongDecoders: this.#initArray(0xC0),
			posSlotDecoders: this.#initArray(4),
			posDecoders: this.#initArray(0x72),
			posAlignDecoder: this.#createBitTreeDecoder(0x04),
			lenDecoder: this.#createLenDecoder(),
			repLenDecoder: this.#createLenDecoder(),
			literalDecoder: {} as LiteralCoder,
		} as unknown as Decoder;

		for (let i = 0; i < 4; ++i) {
			decoder.posSlotDecoders[i] = this.#createBitTreeDecoder(0x06);
		}

		return decoder;
	}

	#initCompressor(): CompressionContext {
		return {
			chunker: {
				alive: 0x00,
				encoder: null,
				decoder: null,
				inBytesProcessed: [0x00, 0x00],
			},
			output: {
				buf: this.#initArray(0x20),
				count: 0x00,
			},
		};
	}

	#initDecompressor(): DecompressionContext {
		return {
			chunker: {
				alive: 0x00,
				encoder: null,
				decoder: this.#decoder,
				inBytesProcessed: [0x00, 0x00],
			},
			output: {
				buf: this.#initArray(0x20),
				count: 0x00,
			},
		};
	}

	#createProbPrices(): number[] {
		const probPrices = [];
		for (let i = 8; i >= 0; --i) {
			let start = 1 << (9 - i - 1);
			let end = 1 << (9 - i);

			for (let j = start; j < end; ++j) {
				probPrices[j] = (i << 6) + ((end - j) << 6 >>> (9 - i - 1));
			}
		}

		return probPrices;
	}

	#createFastPos(): number[] {
		const gFastPos = [0x00, 0x01];
		let c = 2;

		for (let slotFast = 2; slotFast < 22; ++slotFast) {
			let k = 1 << ((slotFast >> 1) - 1);

			for (let j = 0; j < k; ++j, ++c) {
				gFastPos[c] = slotFast;
			}
		}

		return gFastPos;
	}

	#initArray(len: number): number[] {
		const array = [];

		// This is MUCH faster than "new Array(len)" in newer versions of v8
		// (starting with Node.js 0.11.15, which uses v8 3.28.73).
		array[len - 1] = undefined;

		return array as unknown as number[];
	}

	#add(a: [number, number], b: [number, number]): [number, number] {
		return this.#create(a[0] + b[0], a[1] + b[1]);
	}

	#and(a: [number, number], b: [number, number]): [number, number] {
		const highBits = ~~Math.max(
			Math.min(a[1] / this.#MAX_UINT32, this.#MAX_INT32),
			this.#MIN_INT32,
		) & ~~Math.max(
			Math.min(b[1] / this.#MAX_UINT32, this.#MAX_INT32),
			this.#MIN_INT32,
		);

		const lowBits = this.#lowBits_0(a) & this.#lowBits_0(b);

		let high = highBits * this.#MAX_UINT32;
		let low = lowBits;
		if (lowBits < 0) {
			low += this.#MAX_UINT32;
		}

		return [low, high];
	}

	#compare(a: [number, number], b: [number, number]): 0 | 1 | -1 {
		if (a[0] == b[0] && a[1] == b[1]) {
			return 0;
		}
		const nega = a[1] < 0;
		const negb = b[1] < 0;

		if (nega && !negb) {
			return -1;
		}

		if (!nega && negb) {
			return 1;
		}

		if (this.#sub(a, b)[1] < 0) {
			return -1;
		}

		return 1;
	}

	#create(valueLow: number, valueHigh: number): [number, number] {
		let diffHigh, diffLow;

		valueHigh %= 1.8446744073709552E19;
		valueLow %= 1.8446744073709552E19;
		diffHigh = valueHigh % this.#MAX_UINT32;
		diffLow = Math.floor(valueLow / this.#MAX_UINT32) * this.#MAX_UINT32;
		valueHigh = valueHigh - diffHigh + diffLow;
		valueLow = valueLow - diffLow + diffHigh;

		while (valueLow < 0) {
			valueLow += this.#MAX_UINT32;
			valueHigh -= this.#MAX_UINT32;
		}

		while (valueLow > 4294967295) {
			valueLow -= this.#MAX_UINT32;
			valueHigh += this.#MAX_UINT32;
		}
		valueHigh = valueHigh % 1.8446744073709552E19;

		while (valueHigh > 9223372032559808512) {
			valueHigh -= 1.8446744073709552E19;
		}

		while (valueHigh < -9223372036854775808) {
			valueHigh += 1.8446744073709552E19;
		}

		return [valueLow, valueHigh];
	}

	#eq(a: [number, number], b: [number, number]): boolean {
		return a[0] == b[0] && a[1] == b[1];
	}

	#fromInt(value: number): [number, number] {
		if (value >= 0) {
			return [value, 0];
		} else {
			return [value + this.#MAX_UINT32, -this.#MAX_UINT32];
		}
	}

	#lowBits_0(a: [number, number]): number {
		if (a[0] >= 0x80000000) {
			return ~~Math.max(
				Math.min(a[0] - this.#MAX_UINT32, this.#MAX_INT32),
				this.#MIN_INT32,
			);
		}

		return ~~Math.max(
			Math.min(a[0], this.#MAX_INT32),
			this.#MIN_INT32,
		);
	}

	#pwrAsDouble(n: number): number {
		if (n <= 0x1E) {
			return 1 << n;
		}

		return this.#pwrAsDouble(0x1E) * this.#pwrAsDouble(n - 0x1E);
	}

	#shl(a: [number, number], n: number): [number, number] {
		let diff, newHigh, newLow, twoToN;
		n &= 0x3F;

		if (this.#eq(a, this.#MIN_VALUE)) {
			if (!n) {
				return a;
			}
			return this.#P0_LONG_LIT;
		}

		if (a[1] < 0) {
			throw new Error("Neg");
		}
		twoToN = this.#pwrAsDouble(n);
		newHigh = a[1] * twoToN % 1.8446744073709552E19;
		newLow = a[0] * twoToN;
		diff = newLow - newLow % this.#MAX_UINT32;
		newHigh += diff;
		newLow -= diff;

		if (newHigh >= this.#MAX_COMPRESSION_SIZE) {
			newHigh -= 1.8446744073709552E19;
		}

		return [newLow, newHigh];
	}

	#shr(a: [number, number], n: number): [number, number] {
		n &= 0x3F;
		let shiftFact = this.#pwrAsDouble(n);
		return this.#create(
			Math.floor(a[0] / shiftFact),
			a[1] / shiftFact,
		);
	}

	#shru(a: [number, number], n: number): [number, number] {
		let sr = this.#shr(a, n);
		n &= 0x3F;
		if (a[1] < 0) {
			sr = this.#add(sr, this.#shl([2, 0], 0x3F - n));
		}
		return sr;
	}

	#sub(a: [number, number], b: [number, number]): [number, number] {
		return this.#create(a[0] - b[0], a[1] - b[1]);
	}

	#read(inputStream: BaseStream): number {
		if (inputStream.pos >= inputStream.count) {
			return -1;
		}

		let value: number;
		if (inputStream.buf instanceof ArrayBuffer) {
			value = new Uint8Array(inputStream.buf)[inputStream.pos++];
		} else if (inputStream.buf instanceof Uint8Array) {
			value = inputStream.buf[inputStream.pos++];
		} else {
			value = inputStream.buf[inputStream.pos++];
		}

		return value & 0xFF;
	}

	#read_0(off: number, len: number): number {
		const encoder = this.#compressor.chunker.encoder!;
		const stream = encoder!._matchFinder!._stream!;
		const buffer = encoder!._matchFinder!._bufferBase;

		if (stream.pos >= stream.count) {
			return -1;
		}

		let srcBuf: number[];
		if (stream.buf instanceof Uint8Array) {
			srcBuf = Array.from(stream.buf as Uint8Array);
		} else if (stream.buf instanceof ArrayBuffer) {
			srcBuf = Array.from(new Uint8Array(stream.buf as ArrayBuffer));
		} else {
			srcBuf = stream.buf as number[];
		}

		len = Math.min(len, stream.count - stream.pos);
		this.#arraycopy(srcBuf, stream.pos, buffer, off, len);
		stream.pos += len;

		return len;
	}

	#toByteArray(output: CompressionContext["output"] | DecompressionContext["output"]): number[] {
		const data = output.buf.slice(0, output.count);
		return data;
	}

	#write(buffer: BufferWithCount | null, b: number): void {
		if (!buffer) return;

		// Ensure buffer has enough capacity
		if (buffer.count >= buffer.buf.length) {
			const newSize = Math.max(buffer.buf.length * 2, buffer.count + 1);
			const newBuf = new Array(newSize);
			for (let i = 0; i < buffer.count; i++) {
				newBuf[i] = buffer.buf[i];
			}
			buffer.buf = newBuf;
		}

		buffer.buf[buffer.count++] = b << 24 >> 24;
	}

	#write_0(
		buffer: BufferWithCount,
		buf: number[],
		off: number,
		len: number,
	): void {
		// Ensure buffer has enough capacity
		const requiredSize = buffer.count + len;

		if (requiredSize > buffer.buf.length) {
			const newSize = Math.max(buffer.buf.length * 2, requiredSize);
			const newBuf = new Array(newSize);
			for (let i = 0; i < buffer.count; i++) {
				newBuf[i] = buffer.buf[i];
			}
			buffer.buf = newBuf;
		}

		this.#arraycopy(buf, off, buffer.buf, buffer.count, len);
		buffer.count += len;
	}

	#getChars(
		inputString: string,
		srcBegin: number,
		srcEnd: number,
		dst: number[],
		dstBegin: number,
	): void {
		for (let srcIdx = srcBegin; srcIdx < srcEnd; ++srcIdx) {
			dst[dstBegin++] = inputString.charCodeAt(srcIdx);
		}
	}

	#arraycopy(
		src: number[],
		srcOfs: number,
		dest: number[],
		destOfs: number,
		len: number,
	): void {
		// Bounds checking
		if (
			srcOfs < 0
			|| destOfs < 0
			|| len < 0
			|| srcOfs + len > src.length
			|| destOfs + len > dest.length
		) {
			return;
		}

		if (
			src === dest
			&& srcOfs < destOfs
			&& destOfs < srcOfs + len
		) {
			// Overlapping regions - copy backwards
			for (let i = len - 1; i >= 0; i--) {
				dest[destOfs + i] = src[srcOfs + i];
			}
		} else {
			// Non-overlapping or forward copy
			for (let i = 0; i < len; i++) {
				dest[destOfs + i] = src[srcOfs + i];
			}
		}
	}

	#configure(mode: Mode): void {
		this.#SetDictionarySize_0(0x1 << mode.searchDepth);
		this.#encoder!._numFastBytes = mode.filterStrength;
		this.#SetMatchFinder(mode.modeIndex);

		// lc is always 3
		// lp is always 0
		// pb is always 2
		this.#encoder!._numLiteralContextBits = 0x3;
		this.#encoder!._numLiteralPosStateBits = 0x0;
		this.#encoder!._posStateBits = 0x2;
		this.#encoder!._posStateMask = 0x3;
	}

	#initCompression(
		input: BaseStream,
		len: [number, number],
		mode: Mode,
	): void {
		if (this.#compare(len, this.#N1_LONG_LIT) < 0) {
			throw new Error("invalid length " + len);
		}

		this.#compressor.length_0 = len;
		this.#Encoder();

		this.#configure(mode);
		this.writeHeaderProperties();

		for (let i = 0; i < 64; i += 8) {
			this.#write(
				this.#compressor.output,
				this.#lowBits_0(this.#shr(len, i)) & 0xFF,
			);
		}

		// Initialize encoder stream and properties
		this.#encoder!._needReleaseMFStream = 0x00;
		this.#encoder!._inStream = input;
		this.#encoder!._finished = 0x00;

		// Create and configure encoder
		this.#Create_2();
		this.#encoder!._rangeEncoder.stream = this.#compressor.output;
		this.#Init_4();

		// Initialize pricing tables
		this.#FillDistancesPrices(this.#encoder);
		this.#FillAlignPrices(this.#encoder);

		// Configure length encoders
		this.#encoder!._lenEncoder.tableSize = this.#encoder!._numFastBytes + 1 - 2;
		this.#LZMA_LenPriceTableEncoder_UpdateTablesUpdateTables(
			this.#encoder!._lenEncoder,
			1 << this.#encoder!._posStateBits,
		);

		this.#encoder!._repMatchLenEncoder.tableSize = this.#encoder!._numFastBytes + 1 - 2;
		this.#LZMA_LenPriceTableEncoder_UpdateTablesUpdateTables(
			this.#encoder!._repMatchLenEncoder,
			1 << this.#encoder!._posStateBits,
		);

		// Reset position counter
		this.#encoder!.nowPos64 = this.#P0_LONG_LIT;

		// Create new chunker with configured encoder
		this.#compressor.chunker = {
			encoder: this.#encoder,
			decoder: null,
			alive: 1,
		} as CompressionContext["chunker"];
	}

	#byteArrayCompressor(data: number[] | Uint8Array | ArrayBuffer, mode: Mode): void {
		// Initialize output buffer with estimated size for compression
		const inputSize = data instanceof ArrayBuffer ? data.byteLength : data.length;
		const estimatedOutputSize = Math.max(32, Math.ceil(inputSize * 1.2));

		this.#compressor.output = {
			buf: this.#initArray(estimatedOutputSize),
			count: 0,
		};

		const inputBuffer: BaseStream = {
			pos: 0x00,
			buf: data instanceof ArrayBuffer
				? new Uint8Array(data)
				: data,
			count: data instanceof ArrayBuffer
				? new Uint8Array(data).length
				: data.length,
		};

		this.#initCompression(
			inputBuffer,
			this.#fromInt(data instanceof ArrayBuffer ? data.byteLength : data.length),
			mode,
		);
	}

	#initDecompression(input: BaseStream): void {
		let hex_length = "",
			properties = [],
			r: number | string,
			tmp_length: number;

		for (let i = 0; i < 5; ++i) {
			r = this.#read(input);
			if (r == -1) {
				throw new Error("truncated input");
			}
			properties[i] = r << 24 >> 24;
		}

		if (!this.#SetDecoderProperties(properties)) {
			throw new Error("corrupted input");
		}

		for (let i = 0; i < 64; i += 8) {
			r = this.#read(input);
			if (r == -1) {
				throw new Error("truncated input");
			}
			r = r.toString(0x10);
			if (r.length == 1) r = "0" + r;
			hex_length = r + "" + hex_length;
		}

		/**
		 * Was the length set in the header (if it was compressed from a stream, the
		 * length is all f"s).
		 */
		if (/^0+$|^f+$/i.test(hex_length)) {
			// The length is unknown, so set to -1.
			this.#compressor.length_0 = this.#N1_LONG_LIT;
		} else {
			/**
			 * NOTE: If there is a problem with the decoder because of the length,
			 * you can always set the length to -1 (N1_longLit) which means unknown.
			 */
			tmp_length = parseInt(hex_length, 0x10);
			// If the length is too long to handle, just set it to unknown.
			if (tmp_length > this.#_MAX_UINT32) {
				this.#compressor.length_0 = this.#N1_LONG_LIT;
			} else {
				this.#compressor.length_0 = this.#fromInt(tmp_length);
			}
		}

		this.#decompressor.chunker = this.#CodeInChunks(
			input,
			this.#compressor.length_0,
		);
	}

	#byteArrayDecompressor(data: Uint8Array | ArrayBuffer): void {
		// Calculate initial buffer size for decompression
		const inputDataSize = data instanceof ArrayBuffer ? data.byteLength : data.length;
		const minBufferSize = 0x20; // 32 bytes minimum
		const estimatedOutputSize = inputDataSize * 2; // Estimate 2x expansion for decompression
		const initialBufferSize = Math.max(minBufferSize, estimatedOutputSize);

		this.#decompressor.output = {
			buf: this.#initArray(initialBufferSize),
			count: 0,
		};

		const inputBuffer = {
			buf: data,
			pos: 0,
			count: data instanceof ArrayBuffer ? data.byteLength : data.length,
		};

		this.#initDecompression(inputBuffer);
	}

	#Create_4(
		keepSizeBefore: number,
		keepSizeAfter: number,
		keepSizeReserv: number,
	): void {
		let blockSize;
		this.#encoder!._matchFinder!._keepSizeBefore = keepSizeBefore;
		this.#encoder!._matchFinder!._keepSizeAfter = keepSizeAfter;
		blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserv;

		if (
			this.#encoder!._matchFinder!._bufferBase == null || this.#encoder!._matchFinder!._blockSize != blockSize
		) {
			this.#encoder!._matchFinder!._bufferBase = this.#initArray(blockSize);
			this.#encoder!._matchFinder!._blockSize = blockSize;
		}

		this.#encoder!._matchFinder!._pointerToLastSafePosition = this.#encoder!._matchFinder!._blockSize - keepSizeAfter;
	}

	#GetIndexByte(index: number): number {
		const byte = this.#compressor.chunker.encoder!._matchFinder!._bufferBase[
			this.#compressor.chunker.encoder!._matchFinder!._bufferOffset
			+ this.#compressor.chunker.encoder!._matchFinder!._pos
			+ index
		];

		return byte;
	}

	#GetMatchLen(
		index: number,
		distance: number,
		limit: number,
	): number {
		const encoder = this.#compressor.chunker.encoder!;

		if (encoder!._matchFinder!._streamEndWasReached) {
			if (
				encoder!._matchFinder!._pos + index + limit
					> encoder!._matchFinder!._streamPos
			) {
				limit = encoder!._matchFinder!._streamPos
					- (encoder!._matchFinder!._pos + index);
			}
		}

		++distance;
		let i,
			pby = encoder!._matchFinder!._bufferOffset
				+ encoder!._matchFinder!._pos
				+ index;

		for (
			i = 0;
			i < limit
			&& encoder!._matchFinder!._bufferBase[pby + i]
				== encoder!._matchFinder!._bufferBase[pby + i - distance];
			++i
		);

		return i;
	}

	#GetNumAvailableBytes(): number {
		const encoder = this.#compressor.chunker.encoder!;

		return encoder!._matchFinder!._streamPos - encoder!._matchFinder!._pos;
	}

	#MoveBlock(): void {
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder!;

		let offset = matchFinder._bufferOffset + matchFinder._pos - matchFinder._keepSizeBefore;

		if (offset > 0) {
			--offset;
		}
		let numBytes = matchFinder._bufferOffset + matchFinder._streamPos - offset;

		for (let i = 0; i < numBytes; ++i) {
			matchFinder._bufferBase[i] = matchFinder._bufferBase[offset + i];
		}
		matchFinder._bufferOffset -= offset;
	}

	#MovePos_1(): void {
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder!;
		let pointerToPostion;

		matchFinder._pos += 1;

		if (matchFinder._pos > matchFinder._posLimit) {
			pointerToPostion = matchFinder._bufferOffset + matchFinder._pos;

			if (pointerToPostion > matchFinder._pointerToLastSafePosition) {
				this.#MoveBlock();
			}

			this.#ReadBlock();
		}
	}

	#ReadBlock(): void {
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder!;

		let bytesRead, pointerToPostion, size;
		if (matchFinder._streamEndWasReached) {
			return;
		}

		while (1) {
			size = -matchFinder._bufferOffset + matchFinder._blockSize - matchFinder._streamPos;
			if (!size) {
				return;
			}

			bytesRead = this.#read_0(
				matchFinder._bufferOffset + matchFinder._streamPos,
				size,
			);

			if (bytesRead == -1) {
				matchFinder._posLimit = matchFinder._streamPos;
				pointerToPostion = matchFinder._bufferOffset + matchFinder._posLimit;

				if (pointerToPostion > matchFinder._pointerToLastSafePosition) {
					matchFinder._posLimit = matchFinder._pointerToLastSafePosition - matchFinder._bufferOffset;
				}

				matchFinder._streamEndWasReached = 1;

				return;
			}

			matchFinder._streamPos += bytesRead;
			if (matchFinder._streamPos >= matchFinder._pos + matchFinder._keepSizeAfter) {
				matchFinder._posLimit = matchFinder._streamPos - matchFinder._keepSizeAfter;
			}
		}
	}

	#ReduceOffsets(subValue: number): void {
		this.#compressor.chunker.encoder!._matchFinder!._bufferOffset += subValue;
		this.#compressor.chunker.encoder!._matchFinder!._posLimit -= subValue;
		this.#compressor.chunker.encoder!._matchFinder!._pos -= subValue;
		this.#compressor.chunker.encoder!._matchFinder!._streamPos -= subValue;
	}

	#Create_3(
		keepAddBufferBefore: number,
		keepAddBufferAfter: number,
	): void {
		const dictionarySize = this.#encoder!._dictionarySize;
		const numFastBytes = this.#encoder!._numFastBytes;

		if (dictionarySize < this.#dictionarySizeThreshold) {
			this.#encoder!._matchFinder!._cutValue = 0x10 + (numFastBytes >> 1);
			const windowReservSize = ~~((dictionarySize
				+ keepAddBufferBefore
				+ numFastBytes
				+ keepAddBufferAfter) / 2) + 0x100;

			this.#Create_4(
				dictionarySize + keepAddBufferBefore,
				numFastBytes + keepAddBufferAfter,
				windowReservSize,
			);

			this.#encoder!._matchFinder!._matchMaxLen = numFastBytes;
			let cyclicBufferSize = dictionarySize + 1;

			if (this.#encoder!._matchFinder!._cyclicBufferSize != cyclicBufferSize) {
				this.#encoder!._matchFinder!._son = this.#initArray(
					(this.#encoder!._matchFinder!._cyclicBufferSize = cyclicBufferSize) * 2,
				);
			}

			let hs = 0x10000;
			if (this.#encoder!._matchFinder!.HASH_ARRAY) {
				hs = dictionarySize - 1;
				hs |= hs >> 1;
				hs |= hs >> 2;
				hs |= hs >> 4;
				hs |= hs >> 0x08;
				hs >>= 1;
				hs |= 0xFFFF;

				if (hs > 0x1000000) {
					hs >>= 1;
				}

				this.#encoder!._matchFinder!._hashMask = hs;
				hs += 1;
				hs += this.#encoder!._matchFinder!.kFixHashSize;
			}

			if (hs != this.#encoder!._matchFinder!._hashSizeSum) {
				this.#encoder!._matchFinder!._hash = this.#initArray(this.#encoder!._matchFinder!._hashSizeSum = hs);
			}
		}
	}

	#GetMatches(): number {
		let count,
			cur,
			curMatch,
			curMatch2,
			curMatch3,
			cyclicPos,
			delta,
			hash2Value,
			hash3Value,
			hashValue,
			len,
			len0,
			len1,
			lenLimit,
			matchMinPos,
			maxLen,
			offset,
			pby1,
			ptr0,
			ptr1,
			temp;

		const matchFinder = this.#compressor.chunker.encoder!._matchFinder!;
		const distances = this.#compressor.chunker.encoder!._matchDistances;

		if (matchFinder._pos + matchFinder._matchMaxLen <= matchFinder._streamPos) {
			lenLimit = matchFinder._matchMaxLen;
		} else {
			lenLimit = matchFinder._streamPos - matchFinder._pos;
			if (lenLimit < matchFinder.kMinMatchCheck) {
				this.#MovePos_0();
				return 0;
			}
		}

		offset = 0;
		matchMinPos = matchFinder._pos > matchFinder._cyclicBufferSize
			? matchFinder._pos - matchFinder._cyclicBufferSize
			: 0;

		cur = matchFinder._bufferOffset + matchFinder._pos;
		maxLen = 1;
		hash2Value = 0;
		hash3Value = 0;

		if (matchFinder.HASH_ARRAY) {
			temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 0xFF] ^ (matchFinder._bufferBase[cur + 1] & 0xFF);
			hash2Value = temp & 0x3FF;
			temp ^= (matchFinder._bufferBase[cur + 2] & 0xFF) << 0x08;
			hash3Value = temp & 0xFFFF;
			hashValue = (temp ^ (CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 0xFF] << 5)) & matchFinder._hashMask;
		} else {
			hashValue = (matchFinder._bufferBase[cur] & 0xFF) ^ ((matchFinder._bufferBase[cur + 1] & 0xFF) << 0x08);
		}

		curMatch = matchFinder._hash[matchFinder.kFixHashSize + hashValue] || 0;
		if (matchFinder.HASH_ARRAY) {
			curMatch2 = matchFinder._hash[hash2Value] || 0;
			curMatch3 = matchFinder._hash[0x400 + hash3Value] || 0;
			matchFinder._hash[hash2Value] = matchFinder._pos;
			matchFinder._hash[0x400 + hash3Value] = matchFinder._pos;

			if (curMatch2 > matchMinPos) {
				if (matchFinder._bufferBase[matchFinder._bufferOffset + curMatch2] == matchFinder._bufferBase[cur]) {
					distances[offset++] = maxLen = 2;
					distances[offset++] = matchFinder._pos - curMatch2 - 1;
				}
			}

			if (curMatch3 > matchMinPos) {
				if (matchFinder._bufferBase[matchFinder._bufferOffset + curMatch3] == matchFinder._bufferBase[cur]) {
					if (curMatch3 == curMatch2) {
						offset -= 2;
					}
					distances[offset++] = maxLen = 3;
					distances[offset++] = matchFinder._pos - curMatch3 - 1;
					curMatch2 = curMatch3;
				}
			}

			if (offset != 0 && curMatch2 == curMatch) {
				offset -= 2;
				maxLen = 1;
			}
		}

		matchFinder._hash[matchFinder.kFixHashSize + hashValue] = matchFinder._pos;
		ptr0 = (matchFinder._cyclicBufferPos << 1) + 1;
		ptr1 = matchFinder._cyclicBufferPos << 1;
		len0 = len1 = matchFinder.kNumHashDirectBytes;

		if (matchFinder.kNumHashDirectBytes != 0) {
			if (curMatch > matchMinPos) {
				if (
					matchFinder._bufferBase[
						matchFinder._bufferOffset + curMatch + matchFinder.kNumHashDirectBytes
					] != matchFinder._bufferBase[cur + matchFinder.kNumHashDirectBytes]
				) {
					distances[offset++] = maxLen = matchFinder.kNumHashDirectBytes;
					distances[offset++] = matchFinder._pos - curMatch - 1;
				}
			}
		}
		count = matchFinder._cutValue;

		while (1) {
			if (curMatch <= matchMinPos || count == 0) {
				count -= 1;
				matchFinder._son[ptr0] = matchFinder._son[ptr1] = 0;
				break;
			}
			delta = matchFinder._pos - curMatch;

			cyclicPos = (delta <= matchFinder._cyclicBufferPos
				? matchFinder._cyclicBufferPos - delta
				: matchFinder._cyclicBufferPos - delta + matchFinder._cyclicBufferSize) << 1;

			pby1 = matchFinder._bufferOffset + curMatch;
			len = len0 < len1 ? len0 : len1;

			if (
				matchFinder._bufferBase[pby1 + len] == matchFinder._bufferBase[cur + len]
			) {
				while ((len += 1) != lenLimit) {
					if (
						matchFinder._bufferBase[pby1 + len] != matchFinder._bufferBase[cur + len]
					) {
						break;
					}
				}

				if (maxLen < len) {
					distances[offset++] = maxLen = len;
					distances[offset++] = delta - 1;
					if (len == lenLimit) {
						matchFinder._son[ptr1] = matchFinder._son[cyclicPos];
						matchFinder._son[ptr0] = matchFinder._son[cyclicPos + 1];
						break;
					}
				}
			}

			if (
				(matchFinder._bufferBase[pby1 + len] & 0xFF) < (matchFinder._bufferBase[cur + len] & 0xFF)
			) {
				matchFinder._son[ptr1] = curMatch;
				ptr1 = cyclicPos + 1;
				curMatch = matchFinder._son[ptr1];
				len1 = len;
			} else {
				matchFinder._son[ptr0] = curMatch;
				ptr0 = cyclicPos;
				curMatch = matchFinder._son[ptr0];
				len0 = len;
			}
		}

		this.#MovePos_0();
		return offset;
	}

	#Init_5(): void {
		this.#compressor.chunker.encoder!._matchFinder!._bufferOffset = 0;
		this.#compressor.chunker.encoder!._matchFinder!._pos = 0;
		this.#compressor.chunker.encoder!._matchFinder!._streamPos = 0;
		this.#compressor.chunker.encoder!._matchFinder!._streamEndWasReached = 0;
		this.#ReadBlock();

		this.#compressor.chunker.encoder!._matchFinder!._cyclicBufferPos = 0;
		this.#ReduceOffsets(-1);
	}

	#MovePos_0(): void {
		let subValue;
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder!;

		if ((matchFinder._cyclicBufferPos += 1) >= matchFinder._cyclicBufferSize) {
			matchFinder._cyclicBufferPos = 0;
		}

		this.#MovePos_1();

		if (matchFinder._pos == this.#dictionarySizeThreshold) {
			subValue = matchFinder._pos - matchFinder._cyclicBufferSize;

			this.#NormalizeLinks(matchFinder._cyclicBufferSize * 2, subValue);
			this.#NormalizeLinks(matchFinder._hashSizeSum, subValue);

			this.#ReduceOffsets(subValue);
		}
	}

	/**
	 * This is only called after reading one whole gigabyte.
	 */
	#NormalizeLinks(numItems: number, subValue: number): void {
		const items = this.#compressor.chunker.encoder!._matchFinder!._son;

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

	#SetType(binTree: MatchFinder, numHashBytes: number): void {
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

	#Skip(num: number): void {
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder!;

		let count,
			cur,
			curMatch,
			cyclicPos,
			delta,
			hash2Value,
			hash3Value,
			hashValue,
			len,
			len0,
			len1,
			lenLimit,
			matchMinPos,
			pby1,
			ptr0,
			ptr1,
			temp;

		do {
			if (matchFinder._pos + matchFinder._matchMaxLen <= matchFinder._streamPos) {
				lenLimit = matchFinder._matchMaxLen;
			} else {
				lenLimit = matchFinder._streamPos - matchFinder._pos;
				if (lenLimit < matchFinder.kMinMatchCheck) {
					this.#MovePos_0();
					continue;
				}
			}

			matchMinPos = matchFinder._pos > matchFinder._cyclicBufferSize
				? matchFinder._pos - matchFinder._cyclicBufferSize
				: 0;

			cur = matchFinder._bufferOffset + matchFinder._pos;

			if (matchFinder.HASH_ARRAY) {
				temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 0xFF] ^ (matchFinder._bufferBase[cur + 1] & 0xFF);
				hash2Value = temp & 0x3FF;
				matchFinder._hash[hash2Value] = matchFinder._pos;
				temp ^= (matchFinder._bufferBase[cur + 2] & 0xFF) << 0x08;
				hash3Value = temp & 0xFFFF;
				matchFinder._hash[0x400 + hash3Value] = matchFinder._pos;
				hashValue = (temp ^ (CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 0xFF] << 5)) & matchFinder._hashMask;
			} else {
				hashValue = (matchFinder._bufferBase[cur] & 0xFF) ^ ((matchFinder._bufferBase[cur + 1] & 0xFF) << 0x08);
			}

			curMatch = matchFinder._hash[matchFinder.kFixHashSize + hashValue];
			matchFinder._hash[matchFinder.kFixHashSize + hashValue] = matchFinder._pos;
			ptr0 = (matchFinder._cyclicBufferPos << 1) + 1;
			ptr1 = matchFinder._cyclicBufferPos << 1;
			len0 = len1 = matchFinder.kNumHashDirectBytes;
			count = matchFinder._cutValue;

			while (1) {
				if (curMatch <= matchMinPos || count == 0) {
					count -= 1;
					matchFinder._son[ptr0] = matchFinder._son[ptr1] = 0;
					break;
				}
				delta = matchFinder._pos - curMatch;

				cyclicPos = (delta <= matchFinder._cyclicBufferPos
					? matchFinder._cyclicBufferPos - delta
					: matchFinder._cyclicBufferPos - delta + matchFinder._cyclicBufferSize) << 1;

				pby1 = matchFinder._bufferOffset + curMatch;

				len = len0 < len1 ? len0 : len1;

				if (matchFinder._bufferBase[pby1 + len] == matchFinder._bufferBase[cur + len]) {
					while ((len += 1) != lenLimit) {
						if (
							matchFinder._bufferBase[pby1 + len] != matchFinder._bufferBase[cur + len]
						) {
							break;
						}
					}

					if (len == lenLimit) {
						matchFinder._son[ptr1] = matchFinder._son[cyclicPos];
						matchFinder._son[ptr0] = matchFinder._son[cyclicPos + 1];
						break;
					}
				}

				if ((matchFinder._bufferBase[pby1 + len] & 0xFF) < (matchFinder._bufferBase[cur + len] & 0xFF)) {
					matchFinder._son[ptr1] = curMatch;
					ptr1 = cyclicPos + 1;
					curMatch = matchFinder._son[ptr1];
					len1 = len;
				} else {
					matchFinder._son[ptr0] = curMatch;
					ptr0 = cyclicPos;
					curMatch = matchFinder._son[ptr0];
					len0 = len;
				}
			}
			this.#MovePos_0();
		} while ((num -= 1) != 0);
	}

	#CopyBlock(len: number): void {
		const outputWindow = this.#decompressor.chunker.decoder.outWin;
		const distance = this.#decompressor.chunker.decoder.rep0;

		let pos = outputWindow._pos - distance - 1;

		if (pos < 0) {
			pos += outputWindow._windowSize;
		}

		for (; len != 0; len -= 1) {
			if (pos >= outputWindow._windowSize) {
				pos = 0;
			}
			outputWindow._buffer![outputWindow._pos] = outputWindow._buffer![pos];
			outputWindow._pos += 1;
			pos += 1;

			if (outputWindow._pos >= outputWindow._windowSize) {
				this.#Flush_0();
			}
		}
	}

	#OutWindow_Create(windowSize: number): void {
		const outWin = this.#decoder.outWin;

		if (outWin._buffer == null || outWin._windowSize != windowSize) {
			outWin._buffer = this.#initArray(windowSize);
		}

		outWin._windowSize = windowSize;
		outWin._pos = 0;
		outWin._streamPos = 0;
	}

	#Flush_0(): void {
		let size = this.#decoder.outWin._pos - this.#decoder.outWin._streamPos;

		if (!size) {
			return;
		}

		this.#write_0(
			this.#decoder.outWin._stream!,
			this.#decoder.outWin._buffer!,
			this.#decoder.outWin._streamPos,
			size,
		);

		if (this.#decoder.outWin._pos >= this.#decoder.outWin._windowSize) {
			this.#decoder.outWin._pos = 0;
		}

		this.#decoder.outWin._streamPos = this.#decoder.outWin._pos;
	}

	#GetByte(distance: number): number {
		const outputWindow = this.#decompressor.chunker.decoder.outWin;

		let pos = outputWindow._pos - distance - 1;
		if (pos < 0) {
			pos += outputWindow._windowSize;
		}

		return outputWindow._buffer![pos];
	}

	#PutByte(b: number): void {
		this.#decoder.outWin._buffer![this.#decoder.outWin._pos] = b;
		this.#decoder.outWin._pos += 1;

		if (this.#decoder.outWin._pos >= this.#decoder.outWin._windowSize) {
			this.#Flush_0();
		}
	}

	#OutWindow_ReleaseStream(): void {
		this.#Flush_0();
		this.#decoder.outWin._stream = null;
	}

	GetLenToPosState(len: number): number {
		len -= 2;
		if (len < 4) {
			return len;
		}

		return 3;
	}

	StateUpdateChar(index: number): number {
		if (index < 4) {
			return 0;
		}
		if (index < 10) {
			return index - 3;
		}

		return index - 6;
	}

	#processChunkDecode(): number {
		if (!this.#decompressor.chunker.alive) {
			throw new Error("Bad state");
		}

		if (this.#decompressor.chunker.encoder) {
			throw new Error("No encoding");
		}

		const result = this.#CodeOneChunk();
		if (result === -1) {
			throw new Error("Corrupted input");
		}

		const decoder = this.#decompressor.chunker.decoder;
		this.#decompressor.chunker.inBytesProcessed = decoder.nowPos64;

		const isOutputComplete = (this.#compare(decoder.outSize, this.#P0_LONG_LIT) >= 0)
			&& (this.#compare(decoder.nowPos64, decoder.outSize) >= 0);

		if (result || isOutputComplete) {
			this.#Flush_0();
			this.#OutWindow_ReleaseStream();
			decoder.rangeDecoder.stream = null;
			this.#decompressor.chunker.alive = 0;
		}

		return this.#decompressor.chunker.alive;
	}

	#processChunkEncode(): number {
		if (!this.#compressor.chunker.alive) {
			throw new Error("bad state");
		}

		if (!this.#compressor.chunker.encoder) {
			throw new Error("No decoding");
		}

		this.#CodeOneBlock();
		this.#compressor.chunker.inBytesProcessed = this.#compressor.chunker.encoder!.processedInSize[0];

		if (this.#compressor.chunker.encoder!.finished[0]) {
			this.#ReleaseStreams();
			this.#compressor.chunker.alive = 0;
		}

		return this.#compressor.chunker.alive;
	}

	#CodeInChunks(inStream: BaseStream, outSize: [number, number]): Decoder {
		this.#decoder.rangeDecoder.stream = inStream;
		this.#OutWindow_ReleaseStream();
		this.#decoder.outWin._stream = this.#decompressor.output;

		this.#Init_1();
		this.#decoder.state = 0;
		this.#decoder.rep0 = 0;
		this.#decoder.rep1 = 0;
		this.#decoder.rep2 = 0;
		this.#decoder.rep3 = 0;
		this.#decoder.outSize = outSize;
		this.#decoder.nowPos64 = this.#P0_LONG_LIT;
		this.#decoder.prevByte = 0;

		this.#decoder.decoder = this.#decoder;
		this.#decoder.encoder = null;
		this.#decoder.alive = 1;

		return this.#decoder;
	}

	#CodeOneChunk(): 0 | 1 | -1 {
		const decoder = this.#decompressor.chunker.decoder;
		let decoder2: LiteralDecoderEncoder2, distance, len, numDirectBits, positionSlot;

		let posState = this.#lowBits_0(decoder.nowPos64)
			& decoder.posStateMask;

		if (!this.#decodeBit(decoder.matchDecoders, (decoder.state << 4) + posState)) {
			decoder2 = this.#GetDecoder(
				this.#lowBits_0(decoder.nowPos64),
				decoder.prevByte,
			);

			if (decoder.state < 7) {
				decoder.prevByte = this.#DecodeNormal(decoder2);
			} else {
				decoder.prevByte = this.#DecodeWithMatchByte(
					decoder2,
					this.#GetByte(decoder.rep0),
				);
			}

			this.#PutByte(decoder.prevByte);
			decoder.state = this.StateUpdateChar(decoder.state);
			decoder.nowPos64 = this.#add(
				decoder.nowPos64,
				this.#P1_LONG_LIT,
			);
		} else {
			if (this.#decodeBit(decoder.repDecoders, decoder.state)) {
				len = 0;
				if (!this.#decodeBit(decoder.repG0Decoders, decoder.state)) {
					if (!this.#decodeBit(decoder.rep0LongDecoders, (decoder.state << 4) + posState)) {
						decoder.state = decoder.state < 7
							? 9
							: 11;

						len = 1;
					}
				} else {
					if (
						!this.#decodeBit(
							decoder.repG1Decoders,
							decoder.state,
						)
					) {
						distance = decoder.rep1;
					} else {
						if (!this.#decodeBit(decoder.repG2Decoders, decoder.state)) {
							distance = decoder.rep2;
						} else {
							distance = decoder.rep3;
							decoder.rep3 = decoder.rep2;
						}
						decoder.rep2 = decoder.rep1;
					}

					decoder.rep1 = decoder.rep0;
					decoder.rep0 = distance;
				}

				if (!len) {
					len = this.#Decode(decoder.repLenDecoder, posState) + 2;
					decoder.state = decoder.state < 7 ? 0x08 : 11;
				}
			} else {
				decoder.rep3 = decoder.rep2;
				decoder.rep2 = decoder.rep1;
				decoder.rep1 = decoder.rep0;

				len = 2 + this.#Decode(decoder.lenDecoder, posState);

				decoder.state = decoder.state < 7 ? 7 : 10;

				positionSlot = this.#RangeCoder_BitTreeDecoder_Decoder(
					decoder.posSlotDecoders[this.GetLenToPosState(len)],
				);

				if (positionSlot >= 4) {
					numDirectBits = (positionSlot >> 1) - 1;
					decoder.rep0 = (2 | (positionSlot & 1)) << numDirectBits;

					if (positionSlot < 14) {
						decoder.rep0 += this.reverseDecode(
							decoder.posDecoders,
							decoder.rep0 - positionSlot - 1,
							numDirectBits,
						);
					} else {
						decoder.rep0 += this.#DecodeDirectBits(numDirectBits - 4) << 4;
						decoder.rep0 += this.#ReverseDecode();

						if (decoder.rep0 < 0) {
							if (decoder.rep0 == -1) {
								return 1;
							}

							return -1;
						}
					}
				} else {
					decoder.rep0 = positionSlot;
				}
			}

			if (
				this.#compare(this.#fromInt(decoder.rep0), decoder.nowPos64) >= 0
				|| decoder.rep0 >= decoder.dictSizeCheck
			) {
				return -1;
			}

			this.#CopyBlock(len);

			decoder.nowPos64 = this.#add(decoder.nowPos64, this.#fromInt(len));
			decoder.prevByte = this.#GetByte(0);
		}

		return 0;
	}

	#Init_1(): void {
		this.#decoder.outWin._streamPos = 0;
		this.#decoder.outWin._pos = 0;

		this.InitBitModels(this.#decoder.matchDecoders);
		this.InitBitModels(this.#decoder.rep0LongDecoders);
		this.InitBitModels(this.#decoder.repDecoders);
		this.InitBitModels(this.#decoder.repG0Decoders);
		this.InitBitModels(this.#decoder.repG1Decoders);
		this.InitBitModels(this.#decoder.repG2Decoders);
		this.InitBitModels(this.#decoder.posDecoders);

		this.#Init_0(this.#decoder.literalDecoder);

		for (let i = 0; i < 4; ++i) {
			this.InitBitModels(this.#decoder.posSlotDecoders[i].models);
		}

		this.#Init(this.#decoder.lenDecoder);
		this.#Init(this.#decoder.repLenDecoder);
		this.InitBitModels(this.#decoder.posAlignDecoder.models);
		this.#Init_8();
	}

	#SetDecoderProperties(properties: number[]): 0 | 1 {
		let dictionarySize, i, lc, lp, pb, remainder, val;
		if (properties.length < 5) {
			return 0;
		}

		val = properties[0] & 0xFF;
		lc = val % 9;
		remainder = ~~(val / 9);
		lp = remainder % 5;
		pb = ~~(remainder / 5);

		dictionarySize = 0;
		for (i = 0; i < 4; ++i) {
			dictionarySize += (properties[1 + i] & 0xFF) << (i * 0x08);
		}

		// NOTE: If the input is bad, it might call for an insanely large dictionary size, which would crash the script.
		if (dictionarySize > 0x5F5E0FF || !this.#SetLcLpPb(lc, lp, pb)) {
			return 0;
		}

		return this.#SetDictionarySize(dictionarySize);
	}

	#SetDictionarySize(dictionarySize: number): 0 | 1 {
		if (dictionarySize < 0) {
			return 0;
		}

		if (this.#decoder.dictSize != dictionarySize) {
			this.#decoder.dictSize = dictionarySize;

			this.#decoder.dictSizeCheck = Math.max(
				this.#decoder.dictSize,
				1,
			);

			this.#OutWindow_Create(Math.max(this.#decoder.dictSizeCheck, 0x1000));
		}

		return 1;
	}

	#SetLcLpPb(lc: number, lp: number, pb: number): 0 | 1 {
		if (lc > 0x08 || lp > 4 || pb > 4) {
			return 0;
		}

		this.#Create_0(lp, lc);
		let numPosStates = 0x01 << pb;

		this.#Create(this.#decoder.lenDecoder, numPosStates);
		this.#Create(this.#decoder.repLenDecoder, numPosStates);

		this.#decoder.posStateMask = numPosStates - 1;

		return 1;
	}

	#Create(decoder: LenDecoder, numPosStates: number): void {
		for (; decoder.numPosStates < numPosStates; decoder.numPosStates += 1) {
			decoder.lowCoder[decoder.numPosStates] = this.#createBitTreeDecoder(3);
			decoder.midCoder[decoder.numPosStates] = this.#createBitTreeDecoder(3);
		}
	}

	#Decode(
		decoder: LenDecoder,
		posState: number,
	): number {
		if (!this.#decodeBit(decoder.choice, 0)) {
			return this.#RangeCoder_BitTreeDecoder_Decoder(decoder.lowCoder[posState]);
		}

		let symbol = 0x08;

		if (!this.#decodeBit(decoder.choice, 1)) {
			symbol += this.#RangeCoder_BitTreeDecoder_Decoder(decoder.midCoder[posState]);
		} else {
			symbol += 0x08 + this.#RangeCoder_BitTreeDecoder_Decoder(decoder.highCoder);
		}

		return symbol;
	}

	#createLenDecoder(): LenDecoder {
		const decoder = {
			choice: this.#initArray(2),
			lowCoder: [] as BitTree[],
			midCoder: [] as BitTree[],
			highCoder: this.#createBitTreeDecoder(0x08),
			numPosStates: 0x00,
		};

		return decoder;
	}

	#Init(decoder: LenDecoder): void {
		this.InitBitModels(decoder.choice);

		for (let posState = 0; posState < decoder.numPosStates; ++posState) {
			this.InitBitModels(decoder.lowCoder[posState].models);
			this.InitBitModels(decoder.midCoder[posState].models);
		}

		this.InitBitModels(decoder.highCoder.models);
	}

	#Create_0(
		numPosBits: number,
		numPrevBits: number,
	): void {
		let i, numStates;

		if (
			this.#decoder.literalDecoder.coders !== null
			&& this.#decoder.literalDecoder.numPrevBits == numPrevBits
			&& this.#decoder.literalDecoder.numPosBits == numPosBits
		) {
			return;
		}

		this.#decoder.literalDecoder.numPosBits = numPosBits;
		this.#decoder.literalDecoder.posMask = (1 << numPosBits) - 1;
		this.#decoder.literalDecoder.numPrevBits = numPrevBits;

		numStates = 1 << (this.#decoder.literalDecoder.numPrevBits + this.#decoder.literalDecoder.numPosBits);

		this.#decoder.literalDecoder.coders = [];

		for (i = 0; i < numStates; ++i) {
			this.#decoder.literalDecoder.coders[i] = this.#createLiteralDecoderEncoder2();
		}
	}

	#GetDecoder(
		pos: number,
		prevByte: number,
	): LiteralDecoderEncoder2 {
		const literalDecoder = this.#decompressor.chunker.decoder.literalDecoder;

		// Calculate index based on position and previous byte
		const positionMask = pos & literalDecoder.posMask;
		const prevBitsMask = (prevByte & 0xFF) >>> (8 - literalDecoder.numPrevBits);
		const index = (positionMask << literalDecoder.numPrevBits) + prevBitsMask;

		// Return decoder at calculated index
		return literalDecoder.coders[index];
	}

	#Init_0(decoder: LiteralCoder): void {
		let i, numStates;
		numStates = 1 << (decoder.numPrevBits + decoder.numPosBits);

		for (i = 0; i < numStates; ++i) {
			this.InitBitModels(decoder.coders[i].decoders);
		}
	}

	#DecodeNormal(decoder: LiteralDecoderEncoder2): number {
		let symbol = 1;
		do {
			symbol = symbol << 1 | this.#decodeBit(decoder.decoders, symbol);
		} while (symbol < 0x100);

		return symbol << 24 >> 24;
	}

	#DecodeWithMatchByte(
		encoder: LiteralDecoderEncoder2,
		matchByte: number,
	): number {
		let bit, matchBit, symbol = 1;
		do {
			matchBit = (matchByte >> 7) & 1;
			matchByte <<= 1;
			bit = this.#decodeBit(
				encoder!.decoders,
				((1 + matchBit) << 8) + symbol,
			);
			symbol = symbol << 1 | bit;

			if (matchBit != bit) {
				while (symbol < 0x100) {
					symbol = symbol << 1 | this.#decodeBit(encoder!.decoders, symbol);
				}
				break;
			}
		} while (symbol < 0x100);

		return symbol << 24 >> 24;
	}

	#createLiteralDecoderEncoder2(): LiteralDecoderEncoder2 {
		const literalDecoder = {
			decoders: this.#initArray(0x300),
		};

		return literalDecoder;
	}

	#Backward(cur: number): number {
		const encoder = this.#compressor.chunker.encoder;
		let backCur, backMem, posMem, posPrev;

		encoder!._optimumEndIndex = cur;
		posMem = encoder!._optimum[cur].posPrev;
		backMem = encoder!._optimum[cur].backPrev;

		do {
			if (encoder!._optimum[cur].prev1IsChar) {
				this.#MakeAsChar(encoder!._optimum[posMem!]);
				encoder!._optimum[posMem!].posPrev = posMem! - 1;

				if (encoder!._optimum[cur].prev2) {
					encoder!._optimum[posMem! - 1].prev1IsChar = 0;
					encoder!._optimum[posMem! - 1].posPrev = encoder!._optimum[cur].posPrev2;
					encoder!._optimum[posMem! - 1].backPrev = encoder!._optimum[cur].backPrev2;
				}
			}

			posPrev = posMem;
			backCur = backMem;
			backMem = encoder!._optimum[posPrev!].backPrev;
			posMem = encoder!._optimum[posPrev!].posPrev;
			encoder!._optimum[posPrev!].backPrev = backCur;
			encoder!._optimum[posPrev!].posPrev = cur;
			cur = posPrev!;
		} while (cur > 0);

		encoder!.backRes = encoder!._optimum[0].backPrev!;
		encoder!._optimumCurrentIndex = encoder!._optimum[0].posPrev!;

		return encoder!._optimumCurrentIndex;
	}

	#BaseInit(): void {
		this.#encoder!._state = 0;
		this.#encoder!._previousByte = 0;

		for (let i = 0; i < 4; ++i) {
			this.#encoder!._repDistances[i] = 0;
		}
	}

	#CodeOneBlock(): void {
		let baseVal,
			complexState,
			curByte,
			distance,
			footerBits,
			len,
			lenToPosState,
			matchByte,
			pos,
			posReduced,
			posSlot,
			posState,
			progressPosValuePrev,
			subCoder;

		this.#compressor.chunker.encoder!.processedInSize[0] = this.#P0_LONG_LIT;
		this.#compressor.chunker.encoder!.processedOutSize[0] = this.#P0_LONG_LIT;
		this.#compressor.chunker.encoder!.finished[0] = 1;
		progressPosValuePrev = this.#compressor.chunker.encoder!.nowPos64;

		if (this.#compressor.chunker.encoder!._inStream) {
			this.#compressor.chunker.encoder!._matchFinder!._stream = this.#compressor.chunker.encoder!._inStream;
			this.#Init_5();
			this.#compressor.chunker.encoder!._needReleaseMFStream = 1;
			this.#compressor.chunker.encoder!._inStream = null;
		}

		if (this.#compressor.chunker.encoder!._finished) {
			return;
		}

		this.#compressor.chunker.encoder!._finished = 1;

		if (this.#eq(this.#compressor.chunker.encoder!.nowPos64, this.#P0_LONG_LIT)) {
			if (!this.#GetNumAvailableBytes()) {
				this.#Flush(this.#lowBits_0(this.#compressor.chunker.encoder!.nowPos64));
				return;
			}

			this.#ReadMatchDistances();
			posState = this.#lowBits_0(this.#compressor.chunker.encoder!.nowPos64) & this.#compressor.chunker.encoder!._posStateMask;

			this.#Encode_3(
				this.#compressor.chunker.encoder!._isMatch,
				(this.#compressor.chunker.encoder!._state << 4) + posState,
				0,
			);

			this.#compressor.chunker.encoder!._state = this.StateUpdateChar(this.#compressor.chunker.encoder!._state);
			curByte = this.#GetIndexByte(
				-this.#compressor.chunker.encoder!._additionalOffset,
			);

			this.#Encode_1(
				this.#LZMA_Encoder_GetSubCoder(
					this.#lowBits_0(this.#compressor.chunker.encoder!.nowPos64),
					this.#compressor.chunker.encoder!._previousByte,
				),
				curByte,
			);

			this.#compressor.chunker.encoder!._previousByte = curByte;
			this.#compressor.chunker.encoder!._additionalOffset -= 1;
			this.#compressor.chunker.encoder!.nowPos64 = this.#add(
				this.#compressor.chunker.encoder!.nowPos64,
				this.#P1_LONG_LIT,
			);
		}

		if (!this.#GetNumAvailableBytes()) {
			this.#Flush(this.#lowBits_0(this.#compressor.chunker.encoder!.nowPos64));
			return;
		}

		while (1) {
			len = this.#GetOptimum(this.#lowBits_0(this.#compressor.chunker.encoder!.nowPos64));
			pos = this.#compressor.chunker.encoder!.backRes;
			posState = this.#lowBits_0(this.#compressor.chunker.encoder!.nowPos64) & this.#compressor.chunker.encoder!._posStateMask;
			complexState = (this.#compressor.chunker.encoder!._state << 4) + posState;

			if (len == 1 && pos == -1) {
				this.#Encode_3(
					this.#compressor.chunker.encoder!._isMatch,
					complexState,
					0,
				);

				curByte = this.#GetIndexByte(
					-this.#compressor.chunker.encoder!._additionalOffset,
				);

				subCoder = this.#LZMA_Encoder_GetSubCoder(
					this.#lowBits_0(this.#compressor.chunker.encoder!.nowPos64),
					this.#compressor.chunker.encoder!._previousByte,
				);

				if (this.#compressor.chunker.encoder!._state < 7) {
					this.#Encode_1(subCoder, curByte);
				} else {
					matchByte = this.#GetIndexByte(
						-this.#compressor.chunker.encoder!._repDistances[0]
							- 1
							- this.#compressor.chunker.encoder!._additionalOffset,
					);

					this.#EncodeMatched(
						subCoder,
						matchByte,
						curByte,
					);
				}
				this.#compressor.chunker.encoder!._previousByte = curByte;
				this.#compressor.chunker.encoder!._state = this.StateUpdateChar(this.#compressor.chunker.encoder!._state);
			} else {
				this.#Encode_3(
					this.#compressor.chunker.encoder!._isMatch,
					complexState,
					1,
				);
				if (pos < 4) {
					this.#Encode_3(
						this.#compressor.chunker.encoder!._isRep,
						this.#compressor.chunker.encoder!._state,
						1,
					);

					if (!pos) {
						this.#Encode_3(
							this.#compressor.chunker.encoder!._isRepG0,
							this.#compressor.chunker.encoder!._state,
							0,
						);

						if (len == 1) {
							this.#Encode_3(
								this.#compressor.chunker.encoder!._isRep0Long,
								complexState,
								0,
							);
						} else {
							this.#Encode_3(
								this.#compressor.chunker.encoder!._isRep0Long,
								complexState,
								1,
							);
						}
					} else {
						this.#Encode_3(
							this.#compressor.chunker.encoder!._isRepG0,
							this.#compressor.chunker.encoder!._state,
							1,
						);

						if (pos == 1) {
							this.#Encode_3(
								this.#compressor.chunker.encoder!._isRepG1,
								this.#compressor.chunker.encoder!._state,
								0,
							);
						} else {
							this.#Encode_3(
								this.#compressor.chunker.encoder!._isRepG1,
								this.#compressor.chunker.encoder!._state,
								1,
							);
							this.#Encode_3(
								this.#compressor.chunker.encoder!._isRepG2,
								this.#compressor.chunker.encoder!._state,
								pos - 2,
							);
						}
					}

					if (len == 1) {
						this.#compressor.chunker.encoder!._state = this.#compressor.chunker.encoder!._state < 7 ? 9 : 11;
					} else {
						this.#Encode_0(
							this.#compressor.chunker.encoder!._repMatchLenEncoder,
							len - 2,
							posState,
						);
						this.#compressor.chunker.encoder!._state = this.#compressor.chunker.encoder!._state < 7
							? 0x08
							: 11;
					}
					distance = this.#compressor.chunker.encoder!._repDistances[pos];
					if (pos != 0) {
						const encoder = this.#compressor.chunker.encoder!;
						for (let i = pos; i >= 1; --i) {
							encoder._repDistances[i] = encoder._repDistances[i - 1];
						}
						encoder._repDistances[0] = distance;
					}
				} else {
					this.#Encode_3(
						this.#compressor.chunker.encoder!._isRep,
						this.#compressor.chunker.encoder!._state,
						0x00,
					);

					this.#compressor.chunker.encoder!._state = this.#compressor.chunker.encoder!._state < 7 ? 7 : 10;
					this.#Encode_0(
						this.#compressor.chunker.encoder!._lenEncoder,
						len - 0x02,
						posState,
					);

					pos -= 0x04;
					posSlot = this.GetPosSlot(pos);
					lenToPosState = this.GetLenToPosState(len);

					this.#Encode_2(
						this.#compressor.chunker.encoder!._posSlotEncoder[lenToPosState],
						posSlot,
					);

					if (posSlot >= 0x04) {
						footerBits = (posSlot >> 0x01) - 0x01;
						baseVal = (0x02 | (posSlot & 0x01)) << footerBits;
						posReduced = pos - baseVal;

						if (posSlot < 0x0E) {
							this.ReverseEncode(
								baseVal - posSlot - 0x01,
								footerBits,
								posReduced,
							);
						} else {
							this.#EncodeDirectBits(posReduced >> 0x04, footerBits - 4);
							this.#ReverseEncode(posReduced & 0x0F);
							this.#compressor.chunker.encoder!._alignPriceCount += 1;
						}
					}
					distance = pos;
					const encoder2 = this.#compressor.chunker.encoder!;
					for (let i = 3; i >= 1; --i) {
						encoder2._repDistances[i] = encoder2._repDistances[i - 1];
					}

					encoder2._repDistances[0] = distance;
					encoder2._matchPriceCount += 0x01;
				}

				this.#compressor.chunker.encoder!._previousByte = this.#GetIndexByte(
					len - 1 - this.#compressor.chunker.encoder!._additionalOffset,
				);
			}

			this.#compressor.chunker.encoder!._additionalOffset -= len;
			this.#compressor.chunker.encoder!.nowPos64 = this.#add(
				this.#compressor.chunker.encoder!.nowPos64,
				this.#fromInt(len),
			);

			if (!this.#compressor.chunker.encoder!._additionalOffset) {
				if (this.#compressor.chunker.encoder!._matchPriceCount >= 128) {
					this.#FillDistancesPrices(this.#compressor.chunker.encoder!);
				}

				if (this.#compressor.chunker.encoder!._alignPriceCount >= 16) {
					this.#FillAlignPrices(this.#compressor.chunker.encoder!);
				}

				this.#compressor.chunker.encoder!.processedInSize[0] = this.#compressor.chunker.encoder!.nowPos64;
				this.#compressor.chunker.encoder!.processedOutSize[0] = this.#GetProcessedSizeAdd();

				if (!this.#GetNumAvailableBytes()) {
					this.#Flush(this.#lowBits_0(this.#compressor.chunker.encoder!.nowPos64));

					return;
				}

				if (
					this.#compare(
						this.#sub(this.#compressor.chunker.encoder!.nowPos64, progressPosValuePrev),
						[0x1000, 0],
					) >= 0
				) {
					this.#compressor.chunker.encoder!._finished = 0;
					this.#compressor.chunker.encoder!.finished[0] = 0;

					return;
				}
			}
		}
	}

	#Create_2(): void {
		let binTree, numHashBytes;

		if (!this.#encoder!._matchFinder) {
			binTree = {} as MatchFinder;
			numHashBytes = 4;

			if (!this.#encoder!._matchFinderType) {
				numHashBytes = 2;
			}

			this.#SetType(binTree, numHashBytes);
			this.#encoder!._matchFinder = binTree;
		}

		this.#LZMA_Encoder_LiteralEncoder_Create();

		if (
			this.#encoder!._dictionarySize == this.#encoder!._dictionarySizePrev
			&& this.#encoder!._numFastBytesPrev == this.#encoder!._numFastBytes
		) {
			return;
		}

		this.#Create_3(0x1000, 0x0112);

		this.#encoder!._dictionarySizePrev = this.#encoder!._dictionarySize;
		this.#encoder!._numFastBytesPrev = this.#encoder!._numFastBytes;
	}

	#Encoder(): void {
		for (let i = 0; i < 0x1000; ++i) {
			this.#encoder!._optimum[i] = {};
		}

		for (let i = 0; i < 4; ++i) {
			this.#encoder!._posSlotEncoder[i] = this.#createBitTreeEncoder(6);
		}
	}

	#FillAlignPrices(encoder: Encoder): void {
		for (let i = 0; i < 16; ++i) {
			encoder!._alignPrices[i] = this.#ReverseGetPrice(encoder!._posAlignEncoder, i);
		}

		encoder!._alignPriceCount = 0;
	}

	#FillDistancesPrices(encoder: Encoder): void {
		let baseVal, bitTreeEncoder: BitTree, footerBits, posSlot, st, st2;

		for (let i = 4; i < 128; ++i) {
			posSlot = this.GetPosSlot(i);
			footerBits = (posSlot >> 1) - 1;
			baseVal = (2 | (posSlot & 1)) << footerBits;

			encoder!.tempPrices[i] = this.ReverseGetPrice(
				encoder!._posEncoders,
				baseVal - posSlot - 1,
				footerBits,
				i - baseVal,
			);
		}

		for (let lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
			bitTreeEncoder = encoder!._posSlotEncoder[lenToPosState];
			st = lenToPosState << 6;

			for (posSlot = 0; posSlot < encoder!._distTableSize; posSlot += 1) {
				encoder!._posSlotPrices[st + posSlot] = this.#RangeCoder_Encoder_GetPrice_1(bitTreeEncoder, posSlot);
			}

			for (posSlot = 14; posSlot < encoder!._distTableSize; posSlot += 1) {
				encoder!._posSlotPrices[st + posSlot] += (posSlot >> 1) - 1 - 4 << 6;
			}

			st2 = lenToPosState * 128;
			for (let i = 0; i < 4; ++i) {
				encoder!._distancesPrices[st2 + i] = encoder!._posSlotPrices[st + i];
			}

			for (let i = 4; i < 128; ++i) {
				encoder!._distancesPrices[st2 + i] = encoder!._posSlotPrices[st + this.GetPosSlot(i)] + encoder!.tempPrices[i];
			}
		}

		encoder!._matchPriceCount = 0;
	}

	#Flush(nowPos: number): void {
		this.#ReleaseMFStream();
		this.#WriteEndMarker(nowPos & this.#compressor.chunker.encoder!._posStateMask);

		for (let i = 0; i < 5; ++i) {
			this.#ShiftLow();
		}
	}

	#GetOptimum(position: number) {
		let cur,
			curAnd1Price,
			curAndLenCharPrice,
			curAndLenPrice,
			curBack,
			curPrice,
			currentByte,
			distance,
			len,
			lenEnd,
			lenMain,
			lenTest,
			lenTest2,
			lenTestTemp,
			matchByte,
			matchPrice,
			newLen,
			nextIsChar,
			nextMatchPrice,
			nextOptimum,
			nextRepMatchPrice,
			normalMatchPrice,
			numAvailableBytes,
			numAvailableBytesFull,
			numDistancePairs,
			offs,
			offset,
			opt,
			optimum,
			pos,
			posPrev,
			posState,
			posStateNext,
			price_4,
			repIndex,
			repLen,
			repMatchPrice,
			repMaxIndex,
			shortRepPrice,
			startLen,
			state,
			state2,
			t,
			price,
			price_0,
			price_1,
			price_2,
			price_3,
			lenRes;

		const encoder = this.#compressor.chunker.encoder!;

		if (encoder!._optimumEndIndex != encoder!._optimumCurrentIndex) {
			lenRes = encoder!._optimum[encoder!._optimumCurrentIndex].posPrev! - encoder!._optimumCurrentIndex;
			encoder!.backRes = encoder!._optimum[encoder!._optimumCurrentIndex].backPrev!;
			encoder!._optimumCurrentIndex = encoder!._optimum[encoder!._optimumCurrentIndex].posPrev!;

			return lenRes;
		}

		encoder!._optimumCurrentIndex = encoder!._optimumEndIndex = 0;
		if (encoder!._longestMatchWasFound) {
			lenMain = encoder!._longestMatchLength;
			encoder!._longestMatchWasFound = 0;
		} else {
			lenMain = this.#ReadMatchDistances();
		}

		numDistancePairs = encoder!._numDistancePairs;
		numAvailableBytes = this.#GetNumAvailableBytes() + 1;

		if (numAvailableBytes < 2) {
			encoder!.backRes = -1;
			return 1;
		}

		if (numAvailableBytes > 0x0111) {
			numAvailableBytes = 0x0111;
		}

		repMaxIndex = 0;
		for (let i = 0; i < 4; ++i) {
			encoder!.reps[i] = encoder!._repDistances[i];
			encoder!.repLens[i] = this.#GetMatchLen(-1, encoder!.reps[i], 0x0111);

			if (encoder!.repLens[i] > encoder!.repLens[repMaxIndex]) {
				repMaxIndex = i;
			}
		}

		if (encoder!.repLens[repMaxIndex] >= encoder!._numFastBytes) {
			encoder!.backRes = repMaxIndex;
			lenRes = encoder!.repLens[repMaxIndex];
			this.#MovePos(lenRes - 1);

			return lenRes;
		}

		if (lenMain >= encoder!._numFastBytes) {
			encoder!.backRes = this.#compressor.chunker.encoder!._matchDistances[numDistancePairs - 1] + 4;

			this.#MovePos(lenMain - 1);
			return lenMain;
		}

		currentByte = this.#GetIndexByte(-1);
		matchByte = this.#GetIndexByte(-encoder!._repDistances[0] - 1 - 1);

		if (lenMain < 2 && currentByte != matchByte && encoder!.repLens[repMaxIndex] < 2) {
			encoder!.backRes = -1;
			return 1;
		}

		encoder!._optimum[0].state = encoder!._state;
		posState = position & encoder!._posStateMask;
		encoder!._optimum[1].price = this.#probPrices[
			(encoder!._isMatch[(encoder!._state << 4) + posState]) >>> 2
		] + this.#RangeCoder_Encoder_GetPrice_0(
			this.#LZMA_Encoder_GetSubCoder(
				position,
				encoder!._previousByte,
			),
			encoder!._state >= 7,
			matchByte,
			currentByte,
		);

		this.#MakeAsChar(encoder!._optimum[1]);
		matchPrice = this.#probPrices[
			(2048 - encoder!._isMatch[(encoder!._state << 4) + posState])
			>>> 2
		];

		repMatchPrice = matchPrice + this.#probPrices[
			(2048 - encoder!._isRep[encoder!._state]) >>> 2
		];

		if (matchByte == currentByte) {
			shortRepPrice = repMatchPrice + this.#GetRepLen1Price(posState);
			if (shortRepPrice < encoder!._optimum[1].price) {
				encoder!._optimum[1].price = shortRepPrice;
				this.#MakeAsShortRep(encoder!._optimum[1]);
			}
		}

		lenEnd = lenMain >= encoder!.repLens[repMaxIndex]
			? lenMain
			: encoder!.repLens[repMaxIndex];

		if (lenEnd < 2) {
			encoder!.backRes = encoder!._optimum[1].backPrev!;
			return 1;
		}

		encoder!._optimum[1].posPrev = 0;
		encoder!._optimum[0].backs0 = encoder!.reps[0];
		encoder!._optimum[0].backs1 = encoder!.reps[1];
		encoder!._optimum[0].backs2 = encoder!.reps[2];
		encoder!._optimum[0].backs3 = encoder!.reps[3];
		len = lenEnd;

		do {
			encoder!._optimum[len].price = this.#kIfinityPrice;
			len -= 1;
		} while (len >= 2);

		for (let i = 0; i < 4; ++i) {
			repLen = encoder!.repLens[i];
			if (repLen < 2) {
				continue;
			}
			price_4 = repMatchPrice + this.#GetPureRepPrice(
				i,
				encoder!._state,
				posState,
			);

			do {
				curAndLenPrice = price_4 + this.#RangeCoder_Encoder_GetPrice(
					encoder!._repMatchLenEncoder,
					repLen - 2,
					posState,
				);
				optimum = encoder!._optimum[repLen];
				if (curAndLenPrice < optimum.price!) {
					optimum.price = curAndLenPrice;
					optimum.posPrev = 0;
					optimum.backPrev = i;
					optimum.prev1IsChar = 0;
				}
			} while ((repLen -= 1) >= 2);
		}

		normalMatchPrice = matchPrice
			+ this.#probPrices[(encoder!._isRep[encoder!._state]) >>> 2];

		len = encoder!.repLens[0] >= 2 ? encoder!.repLens[0] + 1 : 2;

		if (len <= lenMain) {
			offs = 0;
			while (len > encoder!._matchDistances[offs]) {
				offs += 2;
			}

			for (;; len += 1) {
				distance = encoder!._matchDistances[offs + 1];
				curAndLenPrice = normalMatchPrice + this.#LZMA_Encoder_GetPosLenPrice(distance, len, posState);
				optimum = encoder!._optimum[len];

				if (curAndLenPrice < optimum.price!) {
					optimum.price = curAndLenPrice;
					optimum.posPrev = 0;
					optimum.backPrev = distance + 4;
					optimum.prev1IsChar = 0;
				}

				if (len == encoder!._matchDistances[offs]) {
					offs += 2;
					if (offs == numDistancePairs) {
						break;
					}
				}
			}
		}
		cur = 0;

		while (1) {
			++cur;
			if (cur == lenEnd) {
				return this.#Backward(cur);
			}
			newLen = this.#ReadMatchDistances();
			numDistancePairs = encoder!._numDistancePairs;

			if (newLen >= encoder!._numFastBytes) {
				encoder!._longestMatchLength = newLen;
				encoder!._longestMatchWasFound = 0x01;

				return this.#Backward(cur);
			}
			position += 0x01;
			posPrev = encoder!._optimum[cur].posPrev;

			if (encoder!._optimum[cur].prev1IsChar) {
				posPrev! -= 0x01;
				if (encoder!._optimum[cur].prev2) {
					state = encoder!._optimum[encoder!._optimum[cur].posPrev2!].state;
					if (encoder!._optimum[cur].backPrev2! < 0x04) {
						state = (state! < 0x07) ? 0x08 : 0x0B;
					} else {
						state = (state! < 0x07) ? 0x07 : 0x0A;
					}
				} else {
					state = encoder!._optimum[posPrev!].state;
				}
				state = this.StateUpdateChar(state!);
			} else {
				state = encoder!._optimum[posPrev!].state;
			}

			if (posPrev! == cur - 1) {
				if (!encoder!._optimum[cur].backPrev) {
					state = state! < 7 ? 9 : 11;
				} else {
					state = this.StateUpdateChar(state!);
				}
			} else {
				if (
					encoder!._optimum[cur].prev1IsChar
					&& encoder!._optimum[cur].prev2
				) {
					posPrev = encoder!._optimum[cur].posPrev2;
					pos = encoder!._optimum[cur].backPrev2;
					state = state! < 0x07 ? 0x08 : 0x0B;
				} else {
					pos = encoder!._optimum[cur].backPrev;
					if (pos! < 4) {
						state = state! < 0x07 ? 0x08 : 0x0B;
					} else {
						state = state! < 0x07 ? 0x07 : 0x0A;
					}
				}
				opt = encoder!._optimum[posPrev!];

				if (pos! < 4) {
					if (!pos) {
						encoder!.reps[0] = opt.backs0!;
						encoder!.reps[1] = opt.backs1!;
						encoder!.reps[2] = opt.backs2!;
						encoder!.reps[3] = opt.backs3!;
					} else if (pos == 1) {
						encoder!.reps[0] = opt.backs1!;
						encoder!.reps[1] = opt.backs0!;
						encoder!.reps[2] = opt.backs2!;
						encoder!.reps[3] = opt.backs3!;
					} else if (pos == 2) {
						encoder!.reps[0] = opt.backs2!;
						encoder!.reps[1] = opt.backs0!;
						encoder!.reps[2] = opt.backs1!;
						encoder!.reps[3] = opt.backs3!;
					} else {
						encoder!.reps[0] = opt.backs3!;
						encoder!.reps[1] = opt.backs0!;
						encoder!.reps[2] = opt.backs1!;
						encoder!.reps[3] = opt.backs2!;
					}
				} else {
					encoder!.reps[0] = pos! - 4;
					encoder!.reps[1] = opt.backs0!;
					encoder!.reps[2] = opt.backs1!;
					encoder!.reps[3] = opt.backs2!;
				}
			}

			encoder!._optimum[cur].state = state;
			encoder!._optimum[cur].backs0 = encoder!.reps[0];
			encoder!._optimum[cur].backs1 = encoder!.reps[1];
			encoder!._optimum[cur].backs2 = encoder!.reps[2];
			encoder!._optimum[cur].backs3 = encoder!.reps[3];
			curPrice = encoder!._optimum[cur].price;

			currentByte = this.#GetIndexByte(-0x01);
			matchByte = this.#GetIndexByte(-encoder!.reps[0] - 1 - 1);

			posState = position & encoder!._posStateMask;
			curAnd1Price = curPrice!
				+ this.#probPrices[(encoder!._isMatch[(state! << 0x04) + posState]) >>> 2]
				+ this.#RangeCoder_Encoder_GetPrice_0(
					this.#LZMA_Encoder_GetSubCoder(position, this.#GetIndexByte(-2)),
					state! >= 7,
					matchByte,
					currentByte,
				);

			nextOptimum = encoder!._optimum[cur + 1];
			nextIsChar = 0;

			if (curAnd1Price < nextOptimum.price!) {
				nextOptimum.price = curAnd1Price;
				nextOptimum.posPrev = cur;
				nextOptimum.backPrev = -0x01;
				nextOptimum.prev1IsChar = 0x00;
				nextIsChar = 1;
			}

			matchPrice = curPrice! + this.#probPrices[
				(2048 - encoder!._isMatch[(state! << 4) + posState]) >>> 2
			];

			repMatchPrice = matchPrice + this.#probPrices[(2048 - encoder!._isRep[state!]) >>> 2];

			if (matchByte == currentByte && !(nextOptimum.posPrev! < cur && !nextOptimum.backPrev)) {
				shortRepPrice = repMatchPrice
					+ (this.#probPrices[(encoder!._isRepG0[state!]) >>> 0x02] + this.#probPrices[(encoder!._isRep0Long[(state! << 0x04) + posState]) >>> 0x02]);

				if (shortRepPrice <= nextOptimum.price!) {
					nextOptimum.price = shortRepPrice;
					nextOptimum.posPrev = cur;
					nextOptimum.backPrev = 0;
					nextOptimum.prev1IsChar = 0;
					nextIsChar = 1;
				}
			}

			numAvailableBytesFull = this.#GetNumAvailableBytes() + 1;
			numAvailableBytesFull = 0xFFF - cur < numAvailableBytesFull
				? 0xFFF - cur
				: numAvailableBytesFull;

			numAvailableBytes = numAvailableBytesFull;

			if (numAvailableBytes < 0x02) {
				continue;
			}

			if (numAvailableBytes > encoder!._numFastBytes) {
				numAvailableBytes = encoder!._numFastBytes;
			}

			if (!nextIsChar && matchByte != currentByte) {
				t = Math.min(numAvailableBytesFull - 1, encoder!._numFastBytes);
				lenTest2 = this.#GetMatchLen(0x00, encoder!.reps[0], t);

				if (lenTest2 >= 0x02) {
					state2 = this.StateUpdateChar(state);
					posStateNext = position + 1 & encoder!._posStateMask;
					nextRepMatchPrice = curAnd1Price
						+ this.#probPrices[(0x800 - encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2]
						+ this.#probPrices[(0x800 - encoder!._isRep[state2]) >>> 2];

					offset = cur + 1 + lenTest2;

					while (lenEnd < offset) {
						encoder!._optimum[lenEnd += 1].price = this.#kIfinityPrice;
					}

					curAndLenPrice = nextRepMatchPrice + (price = this.#RangeCoder_Encoder_GetPrice(
						encoder!._repMatchLenEncoder,
						lenTest2 - 0x02,
						posStateNext,
					),
						price + this.#GetPureRepPrice(
							0x00,
							state2,
							posStateNext,
						));
					optimum = encoder!._optimum[offset];

					if (curAndLenPrice < optimum.price!) {
						optimum.price = curAndLenPrice;
						optimum.posPrev = cur + 1;
						optimum.backPrev = 0;
						optimum.prev1IsChar = 1;
						optimum.prev2 = 0;
					}
				}
			}
			startLen = 0x02;

			for (repIndex = 0; repIndex < 4; ++repIndex) {
				lenTest = this.#GetMatchLen(
					-0x01,
					encoder!.reps[repIndex],
					numAvailableBytes,
				);

				if (lenTest < 2) {
					continue;
				}
				lenTestTemp = lenTest;

				do {
					while (lenEnd < cur + lenTest) {
						encoder!._optimum[lenEnd += 1].price = this.#kIfinityPrice;
					}

					curAndLenPrice = repMatchPrice + (price_0 = this.#RangeCoder_Encoder_GetPrice(
						encoder!._repMatchLenEncoder,
						lenTest - 2,
						posState,
					),
						price_0 + this.#GetPureRepPrice(
							repIndex,
							state,
							posState,
						));

					optimum = encoder!._optimum[cur + lenTest];

					if (curAndLenPrice < optimum.price!) {
						optimum.price = curAndLenPrice;
						optimum.posPrev = cur;
						optimum.backPrev = repIndex;
						optimum.prev1IsChar = 0;
					}
				} while ((lenTest -= 1) >= 2);

				lenTest = lenTestTemp;

				if (!repIndex) {
					startLen = lenTest + 1;
				}

				if (lenTest < numAvailableBytesFull) {
					t = Math.min(
						numAvailableBytesFull - 1 - lenTest,
						encoder!._numFastBytes,
					);
					lenTest2 = this.#GetMatchLen(
						lenTest,
						encoder!.reps[repIndex],
						t,
					);

					if (lenTest2 >= 2) {
						state2 = state < 7 ? 0x08 : 11;
						posStateNext = position + lenTest & encoder!._posStateMask;
						curAndLenCharPrice = repMatchPrice
							+ (price_1 = this.#RangeCoder_Encoder_GetPrice(encoder!._repMatchLenEncoder, lenTest - 2, posState), price_1 + this.#GetPureRepPrice(repIndex, state, posState))
							+ this.#probPrices[(encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2]
							+ this.#RangeCoder_Encoder_GetPrice_0(
								this.#LZMA_Encoder_GetSubCoder(position + lenTest, this.#GetIndexByte(lenTest - 1 - 1)),
								true,
								this.#GetIndexByte(lenTest - 1 - (encoder!.reps[repIndex] + 1)),
								this.#GetIndexByte(lenTest - 1),
							);

						state2 = this.StateUpdateChar(state2);
						posStateNext = position + lenTest + 1 & encoder!._posStateMask;

						nextMatchPrice = curAndLenCharPrice + this.#probPrices[
							(0x800 - encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2
						];

						nextRepMatchPrice = nextMatchPrice + this.#probPrices[
							(0x800 - encoder!._isRep[state2]) >>> 2
						];

						offset = lenTest + 1 + lenTest2;

						while (lenEnd < cur + offset) {
							encoder!._optimum[lenEnd += 1].price = this.#kIfinityPrice;
						}

						curAndLenPrice = nextRepMatchPrice + (price_2 = this.#RangeCoder_Encoder_GetPrice(encoder!._repMatchLenEncoder, lenTest2 - 2, posStateNext), price_2 + this.#GetPureRepPrice(0, state2, posStateNext));
						optimum = encoder!._optimum[cur + offset];

						if (curAndLenPrice < optimum.price!) {
							optimum.price = curAndLenPrice;
							optimum.posPrev = cur + lenTest + 1;
							optimum.backPrev = 0;
							optimum.prev1IsChar = 1;
							optimum.prev2 = 1;
							optimum.posPrev2 = cur;
							optimum.backPrev2 = repIndex;
						}
					}
				}
			}

			if (newLen > numAvailableBytes) {
				newLen = numAvailableBytes;
				for (
					numDistancePairs = 0;
					newLen > encoder!._matchDistances[numDistancePairs];
					numDistancePairs += 2
				) {}
				encoder!._matchDistances[numDistancePairs] = newLen;
				numDistancePairs += 2;
			}

			if (newLen >= startLen) {
				normalMatchPrice = matchPrice + this.#probPrices[(encoder!._isRep[state]) >>> 2];

				while (lenEnd < cur + newLen) {
					encoder!._optimum[lenEnd += 1].price = this.#kIfinityPrice;
				}
				offs = 0;

				while (startLen > encoder!._matchDistances[offs]) {
					offs += 2;
				}
				for (lenTest = startLen;; lenTest += 1) {
					curBack = encoder!._matchDistances[offs + 1];
					curAndLenPrice = normalMatchPrice + this.#LZMA_Encoder_GetPosLenPrice(curBack, lenTest, posState);
					optimum = encoder!._optimum[cur + lenTest];

					if (curAndLenPrice < optimum.price!) {
						optimum.price = curAndLenPrice;
						optimum.posPrev = cur;
						optimum.backPrev = curBack + 4;
						optimum.prev1IsChar = 0;
					}

					if (lenTest == encoder!._matchDistances[offs]) {
						if (lenTest < numAvailableBytesFull) {
							t = Math.min(
								numAvailableBytesFull - 1 - lenTest,
								encoder!._numFastBytes,
							);
							lenTest2 = this.#GetMatchLen(
								lenTest,
								curBack,
								t,
							);

							if (lenTest2 >= 2) {
								state2 = state < 7 ? 7 : 10;
								posStateNext = position + lenTest & encoder!._posStateMask;

								curAndLenCharPrice = curAndLenPrice
									+ this.#probPrices[(encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2]
									+ this.#RangeCoder_Encoder_GetPrice_0(
										this.#LZMA_Encoder_GetSubCoder(
											position + lenTest,
											this.#GetIndexByte(lenTest - 1 - 1),
										),
										true,
										this.#GetIndexByte(lenTest - (curBack + 1) - 1),
										this.#GetIndexByte(lenTest - 1),
									);

								state2 = this.StateUpdateChar(state2);
								posStateNext = position + lenTest + 1 & encoder!._posStateMask;

								nextMatchPrice = curAndLenCharPrice + this.#probPrices[
									(2048 - encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2
								];

								nextRepMatchPrice = nextMatchPrice + this.#probPrices[
									(2048 - encoder!._isRep[state2]) >>> 2
								];
								offset = lenTest + 1 + lenTest2;

								while (lenEnd < cur + offset) {
									encoder!._optimum[lenEnd += 1].price = this.#kIfinityPrice;
								}

								curAndLenPrice = nextRepMatchPrice + (price_3 = this.#RangeCoder_Encoder_GetPrice(encoder!._repMatchLenEncoder, lenTest2 - 2, posStateNext), price_3 + this.#GetPureRepPrice(0, state2, posStateNext));
								optimum = encoder!._optimum[cur + offset];

								if (curAndLenPrice < optimum.price!) {
									optimum.price = curAndLenPrice;
									optimum.posPrev = cur + lenTest + 1;
									optimum.backPrev = 0;
									optimum.prev1IsChar = 1;
									optimum.prev2 = 1;
									optimum.posPrev2 = cur;
									optimum.backPrev2 = curBack + 4;
								}
							}
						}
						offs += 2;

						if (offs == numDistancePairs) {
							break;
						}
					}
				}
			}
		}

		// Fallback return - should not be reached in normal execution
		return 1;
	}

	#LZMA_Encoder_GetPosLenPrice(
		pos: number,
		len: number,
		posState: number,
	): number {
		const encoder = this.#compressor.chunker.encoder;
		let price: number, lenToPosState = this.GetLenToPosState(len);

		if (pos < 128) {
			price = encoder!._distancesPrices[lenToPosState * 128 + pos];
		} else {
			const position = (lenToPosState << 6) + this.GetPosSlot2(pos);
			price = encoder!._posSlotPrices[position] + encoder!._alignPrices[pos & 15];
		}

		return price + this.#RangeCoder_Encoder_GetPrice(
			encoder!._lenEncoder,
			len - 2,
			posState,
		);
	}

	#GetPureRepPrice(
		repIndex: number,
		state: number,
		posState: number,
	): number {
		const encoder = this.#compressor.chunker.encoder;
		let price;

		if (!repIndex) {
			price = this.#probPrices[(encoder!._isRepG0[state]) >>> 2];
			price += this.#probPrices[
				0x800 - this.#compressor.chunker.encoder!._isRep0Long[(state << 4) + posState] >>> 2
			];
		} else {
			price = this.#probPrices[(0x800 - this.#compressor.chunker.encoder!._isRepG0[state]) >>> 2];
			if (repIndex == 1) {
				price += this.#probPrices[(this.#compressor.chunker.encoder!._isRepG1[state]) >>> 2];
			} else {
				price += this.#probPrices[(0x800 - this.#compressor.chunker.encoder!._isRepG1[state]) >>> 2];
				price += this.GetPrice(this.#compressor.chunker.encoder!._isRepG2[state], repIndex - 2);
			}
		}

		return price;
	}

	#GetRepLen1Price(posState: number): number {
		const encoder = this.#compressor.chunker.encoder;

		const repG0Price = this.#probPrices[(encoder!._isRepG0[encoder!._state]) >>> 2];
		const rep0LongPrice = this.#probPrices[encoder!._isRep0Long[(encoder!._state << 4) + posState] >>> 2];

		return repG0Price + rep0LongPrice;
	}

	#Init_4(): void {
		this.#BaseInit();
		this.#Init_9();
		this.InitBitModels(this.#encoder!._isMatch);
		this.InitBitModels(this.#encoder!._isRep0Long);
		this.InitBitModels(this.#encoder!._isRep);
		this.InitBitModels(this.#encoder!._isRepG0);
		this.InitBitModels(this.#encoder!._isRepG1);
		this.InitBitModels(this.#encoder!._isRepG2);
		this.InitBitModels(this.#encoder!._posEncoders);

		this.#Init_3();
		for (let i = 0; i < 4; ++i) {
			this.InitBitModels(this.#encoder!._posSlotEncoder[i].models);
		}

		this.#Init_2(this.#encoder!._lenEncoder, 1 << this.#encoder!._posStateBits);
		this.#Init_2(this.#encoder!._repMatchLenEncoder, 1 << this.#encoder!._posStateBits);
		this.InitBitModels(this.#encoder!._posAlignEncoder.models);

		this.#encoder!._longestMatchWasFound = 0;
		this.#encoder!._optimumEndIndex = 0;
		this.#encoder!._optimumCurrentIndex = 0;
		this.#encoder!._additionalOffset = 0;
	}

	#MovePos(num: number): void {
		if (num > 0) {
			this.#Skip(num);
			this.#compressor.chunker.encoder!._additionalOffset += num;
		}
	}

	#ReadMatchDistances(): number {
		let lenRes = 0;
		const encoder = this.#compressor.chunker.encoder!;
		encoder!._numDistancePairs = this.#GetMatches();

		if (encoder!._numDistancePairs > 0) {
			lenRes = encoder!._matchDistances[encoder!._numDistancePairs - 2];

			if (lenRes == encoder!._numFastBytes) {
				lenRes += this.#GetMatchLen(lenRes - 1, encoder!._matchDistances[encoder!._numDistancePairs - 1], 0x0111 - lenRes);
			}
		}

		encoder!._additionalOffset += 1;

		return lenRes;
	}

	#ReleaseMFStream(): void {
		const encoder = this.#compressor.chunker.encoder;

		if (encoder!._matchFinder && encoder!._needReleaseMFStream) {
			encoder!._matchFinder._stream = null;
			encoder!._needReleaseMFStream = 0;
		}
	}

	#ReleaseStreams(): void {
		this.#ReleaseMFStream();
		this.#compressor.chunker.encoder!._rangeEncoder.stream = null;
	}

	#SetDictionarySize_0(dictionarySize: number): void {
		this.#encoder!._dictionarySize = dictionarySize;

		let dicLogSize = 0;
		for (; dictionarySize > (1 << dicLogSize); ++dicLogSize);

		this.#encoder!._distTableSize = dicLogSize * 2;
	}

	#SetMatchFinder(matchFinderIndex: number): void {
		const matchFinderIndexPrev = this.#encoder!._matchFinderType;
		this.#encoder!._matchFinderType = matchFinderIndex;

		if (this.#encoder!._matchFinder && matchFinderIndexPrev != this.#encoder!._matchFinderType) {
			this.#encoder!._dictionarySizePrev = -1;
			this.#encoder!._matchFinder = null;
		}
	}

	writeHeaderProperties(): void {
		const HEADER_SIZE = 0x5; // Total header size in bytes

		// First byte combines posStateBits, literalPosStateBits and literalContextBits
		// Format: (posStateBits * 5 + literalPosStateBits) * 9 + literalContextBits
		this.#encoder!.properties[0] = (
			(this.#encoder!._posStateBits * 5 + this.#encoder!._numLiteralPosStateBits) * 9 + this.#encoder!._numLiteralContextBits
		) & 0xFF; // Ensure byte-sized value

		// Next 4 bytes store dictionary size in little-endian format
		for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
			// Shift dictionary size right by appropriate number of bits and mask to byte
			this.#encoder!.properties[1 + byteIndex] = (
				this.#encoder!._dictionarySize >> (0x08 * byteIndex)
			) & 0xFF;
		}

		// Write the 5-byte header to output
		this.#write_0(
			this.#compressor.output,
			this.#encoder!.properties,
			0, // Starting from index 0
			HEADER_SIZE,
		);
	}

	#WriteEndMarker(positionState: number): void {
		const encoder = this.#compressor.chunker.encoder;

		this.#Encode_3(
			encoder!._isMatch,
			(encoder!._state << 4) + positionState,
			1,
		);

		this.#Encode_3(
			encoder!._isRep,
			encoder!._state,
			0,
		);

		encoder!._state = encoder!._state < 7 ? 7 : 10;
		this.#Encode_0(encoder!._lenEncoder, 0, positionState);
		let lenToPosState = this.GetLenToPosState(2);

		this.#Encode_2(
			encoder!._posSlotEncoder[lenToPosState],
			63,
		);

		this.#EncodeDirectBits(67108863, 26);
		this.#ReverseEncode(15);
	}

	GetPosSlot(pos: number): number {
		if (pos < 2048) {
			return this.#gFastPos[pos];
		}

		if (pos < 2097152) {
			return this.#gFastPos[pos >> 10] + 20;
		}

		return this.#gFastPos[pos >> 20] + 40;
	}

	GetPosSlot2(pos: number): number {
		if (pos < 131072) {
			return this.#gFastPos[pos >> 6] + 12;
		}

		if (pos < 134217728) {
			return this.#gFastPos[pos >> 16] + 32;
		}

		return this.#gFastPos[pos >> 26] + 52;
	}

	#Encode(
		encoder: LenEncoder,
		symbol: number,
		posState: number,
	): void {
		if (symbol < 8) {
			this.#Encode_3(encoder!.choice, 0, 0);
			this.#Encode_2(encoder!.lowCoder[posState], symbol);
		} else {
			symbol -= 8;
			this.#Encode_3(encoder!.choice, 0, 1);

			if (symbol < 8) {
				this.#Encode_3(encoder!.choice, 1, 0);
				this.#Encode_2(encoder!.midCoder[posState], symbol);
			} else {
				this.#Encode_3(encoder!.choice, 1, 1);
				this.#Encode_2(encoder!.highCoder, symbol - 8);
			}
		}
	}

	#createLenEncoder(): LenEncoder {
		const encoder = {} as LenEncoder;

		encoder!.choice = this.#initArray(2);
		encoder!.lowCoder = [] as BitTree[];
		encoder!.midCoder = [] as BitTree[];
		encoder!.highCoder = this.#createBitTreeEncoder(8);

		for (let posState = 0; posState < 16; ++posState) {
			encoder!.lowCoder[posState] = this.#createBitTreeEncoder(3);
			encoder!.midCoder[posState] = this.#createBitTreeEncoder(3);
		}

		return encoder;
	}

	#Init_2(encoder: LenEncoder, numPosStates: number): void {
		this.InitBitModels(encoder!.choice);

		for (let posState = 0; posState < numPosStates; ++posState) {
			this.InitBitModels(encoder!.lowCoder[posState].models);
			this.InitBitModels(encoder!.midCoder[posState].models);
		}

		this.InitBitModels(encoder!.highCoder.models);
	}

	#SetPrices(
		encoder: LenEncoder,
		posState: number,
		numSymbols: number,
		prices: number[],
		st: number,
	): void {
		let a0 = this.#probPrices[encoder!.choice[0] >>> 2];
		let a1 = this.#probPrices[2048 - encoder!.choice[0] >>> 2];
		let b0 = a1 + this.#probPrices[encoder!.choice[1] >>> 2];
		let b1 = a1 + this.#probPrices[2048 - encoder!.choice[1] >>> 2];

		let i = 0;
		for (i = 0; i < 8; ++i) {
			if (i >= numSymbols) {
				return;
			}
			prices[st + i] = a0 + this.#RangeCoder_Encoder_GetPrice_1(encoder!.lowCoder[posState], i);
		}

		for (; i < 16; ++i) {
			if (i >= numSymbols) {
				return;
			}
			prices[st + i] = b0 + this.#RangeCoder_Encoder_GetPrice_1(encoder!.midCoder[posState], i - 8);
		}

		for (; i < numSymbols; ++i) {
			prices[st + i] = b1 + this.#RangeCoder_Encoder_GetPrice_1(encoder!.highCoder, i - 8 - 8);
		}
	}

	#Encode_0(
		encoder: LenEncoder,
		symbol: number,
		posState: number,
	): void {
		this.#Encode(encoder, symbol, posState);

		if ((encoder!.counters[posState] -= 1) == 0) {
			this.#SetPrices(
				encoder,
				posState,
				encoder!.tableSize,
				encoder!.prices,
				posState * 272,
			);

			encoder!.counters[posState] = encoder!.tableSize;
		}
	}

	#createLenPriceTableEncoder(): LenEncoder {
		const encoder = this.#createLenEncoder();
		encoder!.prices = [];
		encoder!.counters = [];

		return encoder;
	}

	#RangeCoder_Encoder_GetPrice(
		encoder: LenEncoder,
		symbol: number,
		posState: number,
	): number {
		return encoder!.prices[posState * 272 + symbol];
	}

	#LZMA_LenPriceTableEncoder_UpdateTablesUpdateTables(
		encoder: LenEncoder,
		numPosStates: number,
	): void {
		for (let posState = 0; posState < numPosStates; ++posState) {
			this.#SetPrices(
				encoder,
				posState,
				encoder!.tableSize,
				encoder!.prices,
				posState * 272,
			);

			encoder!.counters[posState] = encoder!.tableSize;
		}
	}

	#LZMA_Encoder_LiteralEncoder_Create(): void {
		const encoder = this.#encoder!._literalEncoder;
		let i, numStates;

		if (
			encoder!.coders != null
			&& encoder!.numPrevBits == this.#encoder!._numLiteralContextBits
			&& encoder!.numPosBits == this.#encoder!._numLiteralPosStateBits
		) {
			return;
		}

		encoder!.numPosBits = this.#encoder!._numLiteralPosStateBits;
		encoder!.posMask = (1 << this.#encoder!._numLiteralPosStateBits) - 1;
		encoder!.numPrevBits = this.#encoder!._numLiteralContextBits;

		numStates = 1 << (encoder!.numPrevBits + encoder!.numPosBits);
		encoder!.coders = [];

		for (i = 0; i < numStates; ++i) {
			encoder!.coders[i] = this.#createLiteralEncoderEncoder2();
		}
	}

	#LZMA_Encoder_GetSubCoder(pos: number, prevByte: number): LiteralDecoderEncoder2 {
		const literalEncoder = this.#compressor.chunker.encoder!._literalEncoder;

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

	#Init_3(): void {
		const totalStates = 1 << (this.#encoder!._literalEncoder.numPrevBits
			+ this.#encoder!._literalEncoder.numPosBits);

		for (let i = 0; i < totalStates; ++i) {
			this.InitBitModels(this.#encoder!._literalEncoder.coders[i].decoders);
		}
	}

	#Encode_1(
		encoder: LiteralDecoderEncoder2,
		symbol: number,
	): void {
		let bit, context = 1;

		for (let i = 7; i >= 0; --i) {
			bit = (symbol >> i) & 1;
			this.#Encode_3(encoder!.decoders, context, bit);
			context = context << 1 | bit;
		}
	}

	#EncodeMatched(
		encoder: LiteralDecoderEncoder2,
		matchByte: number,
		symbol: number,
	): void {
		let bit, matchBit, state, same = true, context = 1;

		for (let i = 7; i >= 0; --i) {
			bit = (symbol >> i) & 1;
			state = context;

			if (same) {
				matchBit = (matchByte >> i) & 1;
				state += (1 + matchBit) << 8;
				same = matchBit === bit;
			}

			this.#Encode_3(encoder!.decoders, state, bit);
			context = context << 1 | bit;
		}
	}

	#createLiteralEncoderEncoder2(): LiteralDecoderEncoder2 {
		const encoder = {
			decoders: this.#initArray(0x300),
		} as LiteralDecoderEncoder2;

		return encoder;
	}

	#RangeCoder_Encoder_GetPrice_0(
		encoder: LiteralDecoderEncoder2,
		matchMode: boolean,
		matchByte: number,
		symbol: number,
	): number {
		let bit, context = 1, i = 7, matchBit, price = 0;

		if (matchMode) {
			for (; i >= 0; --i) {
				matchBit = (matchByte >> i) & 1;
				bit = (symbol >> i) & 1;
				price += this.GetPrice(
					encoder!.decoders[((1 + matchBit) << 8) + context],
					bit,
				);
				context = context << 1 | bit;

				if (matchBit != bit) {
					--i;
					break;
				}
			}
		}

		for (; i >= 0; --i) {
			bit = symbol >> i & 1;
			price += this.GetPrice(encoder!.decoders[context], bit);
			context = context << 1 | bit;
		}

		return price;
	}

	#MakeAsChar(optimum: Optimum): void {
		optimum.backPrev = -1;
		optimum.prev1IsChar = 0;
	}

	#MakeAsShortRep(optimum: Optimum): void {
		optimum.backPrev = 0;
		optimum.prev1IsChar = 0;
	}

	#createBitTreeDecoder(numBitLevels: number): BitTree {
		return {
			numBitLevels: numBitLevels,
			models: this.#initArray(1 << numBitLevels),
		};
	}

	#RangeCoder_BitTreeDecoder_Decoder(rangeDecoder: BitTree): number {
		let bitIndex, m = 1;

		for (bitIndex = rangeDecoder.numBitLevels; bitIndex != 0; bitIndex -= 1) {
			m = (m << 1) + this.#decodeBit(rangeDecoder.models, m);
		}

		return m - (1 << rangeDecoder.numBitLevels);
	}

	#ReverseDecode(): number {
		const positionAlignmentDecoder = this.#decompressor.chunker.decoder.posAlignDecoder;

		let symbol = 0;
		for (
			let m = 1, bitIndex = 0, bit: number;
			bitIndex < positionAlignmentDecoder.numBitLevels;
			++bitIndex
		) {
			bit = this.#decodeBit(positionAlignmentDecoder.models, m);
			m <<= 1;
			m += bit;
			symbol |= bit << bitIndex;
		}

		return symbol;
	}

	reverseDecode(
		Models: number[],
		startIndex: number,
		NumBitLevels: number,
	): number {
		let symbol = 0;

		for (
			let bitIndex = 0, m = 1, bit: number;
			bitIndex < NumBitLevels;
			++bitIndex
		) {
			bit = this.#decodeBit(Models, startIndex + m);
			m <<= 1;
			m += bit;
			symbol |= bit << bitIndex;
		}

		return symbol;
	}

	#createBitTreeEncoder(numBitLevels: number): BitTree {
		return {
			numBitLevels: numBitLevels,
			models: this.#initArray(1 << numBitLevels),
		};
	}

	#Encode_2(
		encoder: BitTree,
		symbol: number,
	): void {
		let bit, bitIndex, m = 1;

		for (bitIndex = encoder!.numBitLevels; bitIndex != 0;) {
			bitIndex -= 1;
			bit = symbol >>> bitIndex & 1;
			this.#Encode_3(encoder!.models, m, bit);
			m = m << 1 | bit;
		}
	}

	#RangeCoder_Encoder_GetPrice_1(
		encoder: BitTree,
		symbol: number,
	): number {
		let bit, bitIndex, m = 1, price = 0;

		for (bitIndex = encoder!.numBitLevels; bitIndex != 0;) {
			bitIndex -= 1;
			bit = symbol >>> bitIndex & 1;
			price += this.GetPrice(encoder!.models[m], bit);
			m = (m << 1) + bit;
		}

		return price;
	}

	#ReverseEncode(symbol: number): void {
		const posAlignEncoder = this.#compressor.chunker.encoder!._posAlignEncoder;
		let bit, m = 1;

		for (let i = 0; i < posAlignEncoder.numBitLevels; ++i) {
			bit = symbol & 1;
			this.#Encode_3(posAlignEncoder.models, m, bit);
			m = m << 1 | bit;
			symbol >>= 1;
		}
	}

	ReverseEncode(
		startIndex: number,
		NumBitLevels: number,
		symbol: number,
	): void {
		let bit, m = 1;

		for (let i = 0; i < NumBitLevels; ++i) {
			bit = symbol & 1;
			this.#Encode_3(this.#compressor.chunker.encoder!._posEncoders, startIndex + m, bit);
			m = m << 1 | bit;
			symbol >>= 1;
		}
	}

	#ReverseGetPrice(
		encoder: BitTree,
		symbol: number,
	): number {
		let bit, m = 1, price = 0;

		for (let i = encoder!.numBitLevels; i != 0; i -= 1) {
			bit = symbol & 1;
			symbol >>>= 1;
			price += this.GetPrice(encoder!.models[m], bit);
			m = m << 1 | bit;
		}

		return price;
	}

	ReverseGetPrice(
		Models: number[],
		startIndex: number,
		NumBitLevels: number,
		symbol: number,
	): number {
		let bit, m = 1, price = 0;

		for (let i = NumBitLevels; i != 0; i -= 1) {
			bit = symbol & 1;
			symbol >>>= 1;
			price += this.#probPrices[((Models[startIndex + m] - bit ^ -bit) & 2047) >>> 2];
			m = m << 1 | bit;
		}

		return price;
	}

	#decodeBit(
		probs: number[],
		index: number,
	): 0 | 1 {
		const rangeDecoder = this.#decompressor.chunker.decoder.rangeDecoder;

		let newBound, prob = probs[index];
		newBound = (rangeDecoder.rrange >>> 11) * prob;

		if ((rangeDecoder.code ^ this.#MIN_INT32) < (newBound ^ this.#MIN_INT32)) {
			rangeDecoder.rrange = newBound;
			probs[index] = prob + (2048 - prob >>> 5) << 16 >> 16;
			if (!(rangeDecoder.rrange & -16777216)) {
				rangeDecoder.code = rangeDecoder.code << 8 | this.#read(rangeDecoder.stream!);
				rangeDecoder.rrange <<= 8;
			}

			return 0;
		} else {
			rangeDecoder.rrange -= newBound;
			rangeDecoder.code -= newBound;
			probs[index] = prob - (prob >>> 5) << 16 >> 16;
			if (!(rangeDecoder.rrange & -16777216)) {
				rangeDecoder.code = rangeDecoder.code << 8 | this.#read(rangeDecoder.stream!);
				rangeDecoder.rrange <<= 8;
			}

			return 1;
		}
	}

	#DecodeDirectBits(numTotalBits: number): number {
		const rangeDecoder = this.#decompressor.chunker.decoder.rangeDecoder;
		let result = 0;

		for (let i = numTotalBits; i != 0; i -= 1) {
			rangeDecoder.rrange >>>= 1;
			let t = (rangeDecoder.code - rangeDecoder.rrange) >>> 31;
			rangeDecoder.code -= rangeDecoder.rrange & (t - 1);
			result = result << 1 | 1 - t;

			if (!(rangeDecoder.rrange & -16777216)) {
				rangeDecoder.code = rangeDecoder.code << 8 | this.#read(rangeDecoder.stream!);
				rangeDecoder.rrange <<= 8;
			}
		}

		return result;
	}

	#Init_8(): void {
		this.#decoder.rangeDecoder.code = 0;
		this.#decoder.rangeDecoder.rrange = -1;

		for (let i = 0; i < 5; ++i) {
			this.#decoder.rangeDecoder.code = this.#decoder.rangeDecoder.code << 8
				| this.#read(this.#decoder.rangeDecoder.stream!);
		}
	}

	InitBitModels(probs: number[]): void {
		for (let i = probs.length - 1; i >= 0; --i) {
			probs[i] = 1024;
		}
	}

	#Encode_3(
		probs: number[],
		index: number,
		symbol: number,
	): void {
		const rangeEncoder = this.#compressor.chunker.encoder!._rangeEncoder;

		let newBound, prob = probs[index];
		newBound = (rangeEncoder.rrange >>> 11) * prob;

		if (!symbol) {
			rangeEncoder.rrange = newBound;
			probs[index] = prob + (2048 - prob >>> 5) << 16 >> 16;
		} else {
			rangeEncoder.low = this.#add(
				rangeEncoder.low,
				this.#and(this.#fromInt(newBound), [4294967295, 0]),
			);
			rangeEncoder.rrange -= newBound;
			probs[index] = prob - (prob >>> 5) << 16 >> 16;
		}

		if (!(rangeEncoder.rrange & -16777216)) {
			rangeEncoder.rrange <<= 8;
			this.#ShiftLow();
		}
	}

	#EncodeDirectBits(
		valueToEncode: number,
		numTotalBits: number,
	): void {
		const rangeEncoder = this.#compressor.chunker.encoder!._rangeEncoder;

		for (let i = numTotalBits - 1; i >= 0; i -= 1) {
			rangeEncoder.rrange >>>= 1;
			if ((valueToEncode >>> i & 1) == 1) {
				rangeEncoder.low = this.#add(rangeEncoder.low, this.#fromInt(rangeEncoder.rrange));
			}
			if (!(rangeEncoder.rrange & -16777216)) {
				rangeEncoder.rrange <<= 8;
				this.#ShiftLow();
			}
		}
	}

	#GetProcessedSizeAdd(): [number, number] {
		const processedCacheSize = this.#add(
			this.#fromInt(this.#compressor.chunker.encoder!._rangeEncoder.cacheSize),
			this.#compressor.chunker.encoder!._rangeEncoder.position,
		);

		return this.#add(
			processedCacheSize,
			[4, 0],
		);
	}

	#Init_9(): void {
		this.#encoder!._rangeEncoder.position = this.#P0_LONG_LIT;
		this.#encoder!._rangeEncoder.low = this.#P0_LONG_LIT;
		this.#encoder!._rangeEncoder.rrange = -1;
		this.#encoder!._rangeEncoder.cacheSize = 1;
		this.#encoder!._rangeEncoder.cache = 0;
	}

	#ShiftLow(): void {
		const rangeEncoder = this.#compressor.chunker.encoder!._rangeEncoder;

		const LowHi = this.#lowBits_0(this.#shru(rangeEncoder.low, 32));
		if (LowHi != 0 || this.#compare(rangeEncoder.low, [4278190080, 0]) < 0) {
			rangeEncoder.position = this.#add(
				rangeEncoder.position,
				this.#fromInt(rangeEncoder.cacheSize),
			);

			let temp = rangeEncoder.cache;
			do {
				this.#write(rangeEncoder.stream, temp + LowHi);
				temp = 255;
			} while ((rangeEncoder.cacheSize -= 1) != 0);

			rangeEncoder.cache = this.#lowBits_0(rangeEncoder.low) >>> 24;
		}

		rangeEncoder.cacheSize += 1;
		rangeEncoder.low = this.#shl(this.#and(rangeEncoder.low, [16777215, 0]), 8);
	}

	GetPrice(Prob: number, symbol: number): number {
		return this.#probPrices[
			((Prob - symbol ^ -symbol) & 2047) >>> 2
		];
	}

	#decodeString(utf: number[]): string | number[] {
		let j = 0, x, y, z, l = utf.length, buf = [], charCodes = [];

		for (let i = 0; i < l; ++i, ++j) {
			x = utf[i] & 0xFF;
			if (!(x & 0x80)) {
				if (!x) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				charCodes[j] = x;
			} else if ((x & 0xE0) == 0xC0) {
				if (i + 1 >= l) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return String.fromCharCode(...utf);
				}
				y = utf[++i] & 0xFF;
				if ((y & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return String.fromCharCode(...utf);
				}
				charCodes[j] = ((x & 0x1F) << 6) | (y & 0x3F);
			} else if ((x & 0xF0) == 0xE0) {
				if (i + 2 >= l) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				y = utf[++i] & 0xFF;
				if ((y & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be converted to
					// a string, so just send it back.
					return utf;
				}
				z = utf[++i] & 0xFF;
				if ((z & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be converted to
					// a string, so just send it back.
					return utf;
				}
				charCodes[j] = ((x & 0x0F) << 0x0C) | ((y & 0x3F) << 6) | (z & 0x3F);
			} else {
				// It appears that this is binary data, so it cannot be converted to
				// a string, so just send it back.
				return utf;
			}
			if (j == 0x3FFF) {
				buf.push(String.fromCharCode.apply(String, charCodes));
				j = -1;
			}
		}

		if (j > 0) {
			charCodes.length = j;
			buf.push(String.fromCharCode.apply(String, charCodes));
		}

		return buf.join("");
	}

	encodeString(inputString: string): number[] {
		let ch, chars: number[] = [], elen = 0, l = inputString.length;

		this.#getChars(inputString, 0, l, chars, 0);

		// Add extra spaces in the array to break up the unicode symbols.
		for (let i = 0; i < l; ++i) {
			ch = chars[i];
			if (ch >= 1 && ch <= 127) {
				++elen;
			} else if (!ch || ch >= 128 && ch <= 2047) {
				elen += 2;
			} else {
				elen += 3;
			}
		}

		const data = [];
		elen = 0;
		for (let i = 0; i < l; ++i) {
			ch = chars[i];
			if (ch >= 1 && ch <= 127) {
				data[elen++] = ch << 24 >> 24;
			} else if (!ch || ch >= 128 && ch <= 2047) {
				data[elen++] = (192 | ch >> 6 & 31) << 24 >> 24;
				data[elen++] = (128 | ch & 63) << 24 >> 24;
			} else {
				data[elen++] = (224 | ch >> 12 & 15) << 24 >> 24;
				data[elen++] = (128 | ch >> 6 & 63) << 24 >> 24;
				data[elen++] = (128 | ch & 63) << 24 >> 24;
			}
		}

		return data;
	}

	public compress(
		data: Uint8Array | ArrayBuffer,
		mode: keyof typeof this.CompressionModes = 5,
	): Int8Array {
		const compressionMode = this.CompressionModes[mode];
		this.#byteArrayCompressor(data, compressionMode);

		while (this.#processChunkEncode());

		const result = this.#toByteArray(this.#compressor.output);
		return new Int8Array(result);
	}

	public compressString(
		data: string,
		mode: keyof typeof this.CompressionModes = 5,
	): Int8Array {
		const encodedData = this.encodeString(data);
		return this.compress(new Uint8Array(encodedData), mode);
	}

	public decompress(bytearray: Uint8Array | ArrayBuffer): number[] {
		this.#byteArrayDecompressor(bytearray);

		while (this.#processChunkDecode());

		return this.#toByteArray(this.#decompressor.output);
	}

	public decompressString(bytearray: Uint8Array | ArrayBuffer): string {
		this.#byteArrayDecompressor(bytearray);

		while (this.#processChunkDecode());

		const decodedByteArray = this.#toByteArray(this.#decompressor.output);
		const result = this.#decodeString(decodedByteArray);

		if (typeof result === "string") {
			return result;
		} else {
			// If decoding failed and returned binary data, convert to string anyway
			return String.fromCharCode(...result);
		}
	}
}
