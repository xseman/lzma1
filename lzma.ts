// @ts-nocheck: remove when resolved all types

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
 * Represents a data stream with buffer, position and count
 */
interface BaseStream {
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
 * Base window implementation with stream and positioning information
 */
interface BaseWindow {
	_streamPos: number;
	_pos: number;
	_buffer: number[];
	_stream: BaseStream;
}

/**
 * Output window with a defined window size
 */
interface OutWindow extends BaseWindow {
	_windowSize: number;
}

/**
 * Base range coder with a stream
 */
interface BaseRangeCoder {
	Stream: BaseStream | BufferWithCount;
}

/**
 * Range decoder with code and range values
 */
interface RangeDecoder extends BaseRangeCoder {
	Code: number;
	Range: number;
	Stream: BaseStream;
}

/**
 * Range encoder with necessary state for encoding
 */
interface RangeEncoder extends BaseRangeCoder {
	Low: [number, number];
	Range: number;
	_cacheSize: number;
	_cache: number;
	_position: [number, number];
	Stream: BufferWithCount;
}

/**
 * Binary tree for probability modeling
 */
interface BitTree {
	NumBitLevels: number;
	Models: number[];
}

/**
 * Base literal decoder/encoder with decoders array
 */
interface LiteralDecoderEncoder2 {
	m_Decoders: number[];
}

/**
 * Base class for literal coders
 */
interface LiteralCoderBase {
	m_NumPrevBits: number;
	m_NumPosBits: number;
	m_PosMask: number;
	m_Coders: LiteralDecoderEncoder2[];
}

/**
 * Literal encoder implementation
 */
interface LiteralEncoder extends LiteralCoderBase {}

/**
 * Literal decoder implementation
 */
interface LiteralDecoder extends LiteralCoderBase {}

/**
 * Base length coder with probability models
 */
interface LenCoderBase {
	m_Choice: number[];
	m_LowCoder: BitTree[];
	m_MidCoder: BitTree[];
	m_HighCoder: BitTree;
}

/**
 * Length encoder with pricing information
 */
interface LenEncoder extends Partial<LenCoderBase> {
	_tableSize: number;
	_prices: number[];
	_counters: number[];
	_choice: BitTree[];
	_lowCoder: BitTree[];
	_midCoder: BitTree[];
	_highCoder: BitTree;
}

/**
 * Length decoder with position states
 */
interface LenDecoder extends LenCoderBase {
	m_NumPosStates: number;
}

/**
 * Optimization data structure
 */
interface Optimum {
	State?: number;
	Prev1IsChar?: number;
	Prev2?: number;
	PosPrev2?: number;
	BackPrev2?: number;
	Price?: number;
	PosPrev?: number;
	BackPrev?: number;
	Backs0?: number;
	Backs1?: number;
	Backs2?: number;
	Backs3?: number;
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
	_stream: BaseStream;
	HASH_ARRAY?: boolean;
	kNumHashDirectBytes?: number;
	kMinMatchCheck?: number;
	kFixHashSize?: number;
	_hashMask?: number;
	_hashSizeSum?: number;
	_hash?: number[];
	_cyclicBufferSize?: number;
	_son?: number[];
	_matchMaxLen?: number;
	_cutValue?: number;
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
	_matchFinder: MatchFinder;
	_dictionarySizePrev: number;
	_numFastBytes: number;
	_numLiteralContextBits: number;
	_numLiteralPosStateBits: number;
	_posStateBits: number;
	_posStateMask: number;
	_needReleaseMFStream: number;
	_inStream: BaseStream;
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
interface Decoder {
	m_PosStateMask: number;
	m_DictionarySize: number;
	m_DictionarySizeCheck: number;
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
	m_OutWindow: OutWindow;
	m_RangeDecoder: RangeDecoder;
	m_IsMatchDecoders: number[];
	m_IsRepDecoders: number[];
	m_IsRepG0Decoders: number[];
	m_IsRepG1Decoders: number[];
	m_IsRepG2Decoders: number[];
	m_IsRep0LongDecoders: number[];
	m_PosSlotDecoder: BitTree[];
	m_PosDecoders: number[];
	m_PosAlignDecoder: BitTree;
	m_LenDecoder: LenDecoder;
	m_RepLenDecoder: LenDecoder;
	m_LiteralDecoder: LiteralDecoder;
}

/**
 * Base chunker interface
 */
interface ChunkerBase {
	alive: number;
	inBytesProcessed: [number, number];
}

/**
 * Encoder chunker implementation
 */
interface EncoderChunker extends ChunkerBase {
	encoder: Encoder | null;
	decoder: null;
}

/**
 * Decoder chunker implementation
 */
interface DecoderChunker extends ChunkerBase {
	encoder: null;
	decoder: Decoder;
}

/**
 * Compression context
 */
interface CompressionContext {
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

/**
 * Converts a number to a signed 8-bit integer using DataView.
 *
 * Previously, this was done with bitwise operations (value << 24 >> 24), but
 * that approach was obscure and hard to understand. Using DataView improves
 * readability and ensures correct 8-bit conversion.
 */
export function toSigned8bit(value: number): number {
	const buffer = new ArrayBuffer(1);
	const view = new DataView(buffer);
	view.setInt8(0, value);

	return view.getInt8(0);
}

/**
 * Converts a number to a signed 16-bit integer using DataView.
 *
 * Previously, this was done with bitwise operations (value << 16 >> 16), but
 * that approach was obscure and hard to understand. Using DataView improves
 * readability and ensures correct 16-bit conversion.
 */
export function toSigned16bit(value: number): number {
	const buffer = new ArrayBuffer(2);
	const view = new DataView(buffer);
	view.setInt16(0, value);

	return view.getInt16(0);
}

export class LZMA {
	readonly #MAX_UINT32 = 0x100000000; // 2^32
	readonly #_MAX_UINT32 = 0xFFFFFFFF; // 2^32 - 1
	readonly #MAX_INT32 = 0x7FFFFFFF; // 2^31 - 1
	readonly #MIN_INT32 = -0x80000000; // -2^31
	readonly #MAX_UINT64 = 0x10000000000000000; // 2^64
	readonly #MAX_INT64 = 0x7FFFFFFFFFFFFFFF; // 2^63
	readonly #MIN_INT64 = -0x8000000000000000; // -2^63
	readonly #MAX_COMPRESSION_SIZE = 0x7FFFFFFFFFFFFFFF; // 2^63 - 1
	readonly #kIfinityPrice = 0xFFFFFFF; // 2^28 - 1
	readonly #dictionarySizeThreshold = 0x3FFFFFFF; // 2^30 - 1
	readonly #bitMaskForRange = -0x1000000;

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
		this.#N1_LONG_LIT = [this.#_MAX_UINT32, -this.#MAX_UINT32];
		this.#MIN_VALUE = [0, this.#MIN_INT64];

		this.#encoder = this.#initEncoder();
		this.#decoder = this.#initDecoder();
		this.#probPrices = this.#createProbPrices();
		this.#gFastPos = this.#createFastPos();
		this.#compressor = this.#initCompressor();
		this.#decompressor = this.#initDecompressor();
	}

	#initEncoder(): Encoder {
		return {
			_repDistances: this.#initArray(4),
			_optimum: [],
			_rangeEncoder: {
				Stream: {
					buf: [],
					count: 0,
				},
				Range: 0,
				_cache: 0,
				Low: [],
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
			m_OutWindow: {} as OutWindow,
			m_RangeDecoder: {} as RangeDecoder,
			m_IsMatchDecoders: this.#initArray(0xC0),
			m_IsRepDecoders: this.#initArray(0x0C),
			m_IsRepG0Decoders: this.#initArray(0x0C),
			m_IsRepG1Decoders: this.#initArray(0x0C),
			m_IsRepG2Decoders: this.#initArray(0x0C),
			m_IsRep0LongDecoders: this.#initArray(0xC0),
			m_PosSlotDecoder: this.#initArray(4),
			m_PosDecoders: this.#initArray(0x72),
			m_PosAlignDecoder: this.#createBitTreeDecoder(0x04),
			m_LenDecoder: this.#createLenDecoder(),
			m_RepLenDecoder: this.#createLenDecoder(),
			m_LiteralDecoder: {} as LiteralDecoder,
		} as unknown as Decoder;

		for (let i = 0; i < 4; ++i) {
			decoder.m_PosSlotDecoder[i] = this.#createBitTreeDecoder(0x06);
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
				decoder: null,
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

		valueHigh %= this.#MAX_UINT64;
		valueLow %= this.#MAX_UINT64;
		diffHigh = valueHigh % this.#MAX_UINT32;
		diffLow = Math.floor(valueLow / this.#MAX_UINT32) * this.#MAX_UINT32;
		valueHigh = valueHigh - diffHigh + diffLow;
		valueLow = valueLow - diffLow + diffHigh;

		while (valueLow < 0) {
			valueLow += this.#MAX_UINT32;
			valueHigh -= this.#MAX_UINT32;
		}

		while (valueLow > this.#MAX_UINT32) {
			valueLow -= this.#MAX_UINT32;
			valueHigh += this.#MAX_UINT32;
		}
		valueHigh = valueHigh % this.#MAX_UINT64;

		while (valueHigh > this.#MAX_INT64) {
			valueHigh -= this.#MAX_UINT64;
		}

		while (valueHigh < this.#MIN_INT64) {
			valueHigh += this.#MAX_UINT64;
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
		newHigh = a[1] * twoToN % this.#MAX_UINT64;
		newLow = a[0] * twoToN;
		diff = newLow - newLow % this.#MAX_UINT32;
		newHigh += diff;
		newLow -= diff;

		if (newHigh >= this.#MAX_COMPRESSION_SIZE) {
			newHigh -= this.#MAX_UINT64;
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

		return inputStream.buf[inputStream.pos++] & 0xFF;
	}

	#read_0(off: number, len: number): number {
		const stream = this.#compressor.chunker.encoder._matchFinder._stream;
		const buffer = this.#compressor.chunker.encoder._matchFinder._bufferBase;

		if (stream.pos >= stream.count) {
			return -1;
		}

		len = Math.min(len, stream.count - stream.pos);
		this.#arraycopy(stream.buf, stream.pos, buffer, off, len);
		stream.pos += len;

		return len;
	}

	#toByteArray(output: CompressionContext["output"]): number[] {
		const data = output.buf;
		data.length = output.count;

		return data;
	}

	#write(buffer: BufferWithCount, b: number): void {
		buffer.buf[buffer.count++] = toSigned8bit(b);
	}

	#write_0(
		buffer: BufferWithCount,
		buf: number[],
		off: number,
		len: number,
	): void {
		this.#arraycopy(
			buf,
			off,
			buffer.buf,
			buffer.count,
			len,
		);

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
		for (let i = 0; i < len; ++i) {
			try {
				dest[destOfs + i] = src[srcOfs + i];
			} catch (error) {
				break;
			}
		}
	}

	#configure(mode: Mode): void {
		this.#SetDictionarySize_0(0x1 << mode.searchDepth);
		this.#encoder._numFastBytes = mode.filterStrength;
		this.#SetMatchFinder(mode.modeIndex);

		// lc is always 3
		// lp is always 0
		// pb is always 2
		this.#encoder._numLiteralContextBits = 0x3;
		this.#encoder._numLiteralPosStateBits = 0x0;
		this.#encoder._posStateBits = 0x2;
		this.#encoder._posStateMask = 0x3;
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
		this.#encoder._needReleaseMFStream = 0x00;
		this.#encoder._inStream = input;
		this.#encoder._finished = 0x00;

		// Create and configure encoder
		this.#Create_2();
		this.#encoder._rangeEncoder.Stream = this.#compressor.output;
		this.#Init_4();

		// Initialize pricing tables
		this.#FillDistancesPrices(this.#encoder);
		this.#FillAlignPrices(this.#encoder);

		// Configure length encoders
		this.#encoder._lenEncoder._tableSize = this.#encoder._numFastBytes + 1 - 2;
		this.#LZMA_LenPriceTableEncoder_UpdateTablesUpdateTables(
			this.#encoder._lenEncoder,
			1 << this.#encoder._posStateBits,
		);

		this.#encoder._repMatchLenEncoder._tableSize = this.#encoder._numFastBytes + 1 - 2;
		this.#LZMA_LenPriceTableEncoder_UpdateTablesUpdateTables(
			this.#encoder._repMatchLenEncoder,
			1 << this.#encoder._posStateBits,
		);

		// Reset position counter
		this.#encoder.nowPos64 = this.#P0_LONG_LIT;

		// Create new chunker with configured encoder
		this.#compressor.chunker = {
			encoder: this.#encoder,
			decoder: null,
			alive: 1,
		} as CompressionContext["chunker"];
	}

	#byteArrayCompressor(data: number[] | Uint8Array, mode: Mode): void {
		this.#compressor.output = {
			buf: this.#initArray(0x20),
			count: 0x00,
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
			this.#fromInt(data.length),
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
			properties[i] = toSigned8bit(r);
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
		this.#decompressor.output = {
			buf: this.#initArray(0x20),
			count: 0,
		};

		const inputBuffer = {
			buf: data,
			pos: 0,
			count: data.length,
		};

		this.#initDecompression(inputBuffer);
	}

	#Create_4(
		keepSizeBefore: number,
		keepSizeAfter: number,
		keepSizeReserv: number,
	): void {
		let blockSize;
		this.#encoder._matchFinder._keepSizeBefore = keepSizeBefore;
		this.#encoder._matchFinder._keepSizeAfter = keepSizeAfter;
		blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserv;

		if (
			this.#encoder._matchFinder._bufferBase == null || this.#encoder._matchFinder._blockSize != blockSize
		) {
			this.#encoder._matchFinder._bufferBase = null;
			this.#encoder._matchFinder._blockSize = blockSize;
			this.#encoder._matchFinder._bufferBase = this.#initArray(this.#encoder._matchFinder._blockSize);
		}

		this.#encoder._matchFinder._pointerToLastSafePosition = this.#encoder._matchFinder._blockSize - keepSizeAfter;
	}

	#GetIndexByte(index: number): number {
		return this.#compressor.chunker.encoder._matchFinder._bufferBase[
			this.#compressor.chunker.encoder._matchFinder._bufferOffset
			+ this.#compressor.chunker.encoder._matchFinder._pos
			+ index
		];
	}

	#GetMatchLen(
		index: number,
		distance: number,
		limit: number,
	): number {
		const encoder = this.#compressor.chunker.encoder!;

		if (encoder._matchFinder._streamEndWasReached) {
			if (
				encoder._matchFinder._pos + index + limit
					> encoder._matchFinder._streamPos
			) {
				limit = encoder._matchFinder._streamPos
					- (encoder._matchFinder._pos + index);
			}
		}

		++distance;
		let i,
			pby = encoder._matchFinder._bufferOffset
				+ encoder._matchFinder._pos
				+ index;

		for (
			i = 0;
			i < limit
			&& encoder._matchFinder._bufferBase[pby + i]
				== encoder._matchFinder._bufferBase[pby + i - distance];
			++i
		);

		return i;
	}

	#GetNumAvailableBytes(): number {
		const encoder = this.#compressor.chunker.encoder!;

		return encoder._matchFinder._streamPos - encoder._matchFinder._pos;
	}

	#MoveBlock(): void {
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder;

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
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder;
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
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder;

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
		this.#compressor.chunker.encoder!._matchFinder._bufferOffset += subValue;
		this.#compressor.chunker.encoder!._matchFinder._posLimit -= subValue;
		this.#compressor.chunker.encoder!._matchFinder._pos -= subValue;
		this.#compressor.chunker.encoder!._matchFinder._streamPos -= subValue;
	}

	#Create_3(
		keepAddBufferBefore: number,
		keepAddBufferAfter: number,
	): void {
		const dictionarySize = this.#encoder._dictionarySize;
		const numFastBytes = this.#encoder._numFastBytes;

		if (dictionarySize < this.#dictionarySizeThreshold) {
			this.#encoder._matchFinder._cutValue = 0x10 + (numFastBytes >> 1);
			const windowReservSize = ~~((dictionarySize
				+ keepAddBufferBefore
				+ numFastBytes
				+ keepAddBufferAfter) / 2) + 0x100;

			this.#Create_4(
				dictionarySize + keepAddBufferBefore,
				numFastBytes + keepAddBufferAfter,
				windowReservSize,
			);

			this.#encoder._matchFinder._matchMaxLen = numFastBytes;
			let cyclicBufferSize = dictionarySize + 1;

			if (this.#encoder._matchFinder._cyclicBufferSize != cyclicBufferSize) {
				this.#encoder._matchFinder._son = this.#initArray(
					(this.#encoder._matchFinder._cyclicBufferSize = cyclicBufferSize) * 2,
				);
			}

			let hs = 0x10000;
			if (this.#encoder._matchFinder.HASH_ARRAY) {
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

				this.#encoder._matchFinder._hashMask = hs;
				hs += 1;
				hs += this.#encoder._matchFinder.kFixHashSize;
			}

			if (hs != this.#encoder._matchFinder._hashSizeSum) {
				this.#encoder._matchFinder._hash = this.#initArray(this.#encoder._matchFinder._hashSizeSum = hs);
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

		const matchFinder = this.#compressor.chunker.encoder._matchFinder;
		const distances = this.#compressor.chunker.encoder._matchDistances;

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
			temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 0xFF] ^ matchFinder._bufferBase[cur + 1] & 0xFF;
			hash2Value = temp & 0x3FF;
			temp ^= (matchFinder._bufferBase[cur + 2] & 0xFF) << 0x08;
			hash3Value = temp & 0xFFFF;
			hashValue = (temp ^ CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 0xFF] << 5) & matchFinder._hashMask;
		} else {
			hashValue = matchFinder._bufferBase[cur] & 0xFF ^ (matchFinder._bufferBase[cur + 1] & 0xFF) << 0x08;
		}

		curMatch = matchFinder._hash[matchFinder.kFixHashSize + hashValue] || 0;
		if (matchFinder.HASH_ARRAY) {
			curMatch2 = matchFinder._hash[hash2Value] || 0;
			curMatch3 = matchFinder._hash[0x400 + hash3Value] || 0;
			matchFinder._hash[hash2Value] = matchFinder._pos;
			matchFinder._hash[0x400 + hash3Value] = matchFinder._pos;

			if (curMatch2 > matchMinPos) {
				if (
					matchFinder._bufferBase[matchFinder._bufferOffset + curMatch2] == matchFinder._bufferBase[cur]
				) {
					distances[offset++] = maxLen = 2;
					distances[offset++] = matchFinder._pos - curMatch2 - 1;
				}
			}

			if (curMatch3 > matchMinPos) {
				if (
					matchFinder._bufferBase[matchFinder._bufferOffset + curMatch3] == matchFinder._bufferBase[cur]
				) {
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
		this.#compressor.chunker.encoder._matchFinder._bufferOffset = 0;
		this.#compressor.chunker.encoder._matchFinder._pos = 0;
		this.#compressor.chunker.encoder._matchFinder._streamPos = 0;
		this.#compressor.chunker.encoder._matchFinder._streamEndWasReached = 0;
		this.#ReadBlock();

		this.#compressor.chunker.encoder._matchFinder._cyclicBufferPos = 0;
		this.#ReduceOffsets(-1);
	}

	#MovePos_0(): void {
		let subValue;
		const matchFinder = this.#compressor.chunker.encoder._matchFinder;

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
		const items = this.#compressor.chunker.encoder._matchFinder._son;

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
		const matchFinder = this.#compressor.chunker.encoder._matchFinder;

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
				temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 0xFF] ^ matchFinder._bufferBase[cur + 1] & 0xFF;
				hash2Value = temp & 0x3FF;
				matchFinder._hash[hash2Value] = matchFinder._pos;
				temp ^= (matchFinder._bufferBase[cur + 2] & 0xFF) << 0x08;
				hash3Value = temp & 0xFFFF;
				matchFinder._hash[0x400 + hash3Value] = matchFinder._pos;
				hashValue = (temp ^ CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 0xFF] << 5) & matchFinder._hashMask;
			} else {
				hashValue = matchFinder._bufferBase[cur] & 0xFF ^ (matchFinder._bufferBase[cur + 1] & 0xFF) << 0x08;
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
		const outputWindow = this.#decompressor.chunker.decoder.m_OutWindow;
		const distance = this.#decompressor.chunker.decoder.rep0;

		let pos = outputWindow._pos - distance - 1;

		if (pos < 0) {
			pos += outputWindow._windowSize;
		}

		for (; len != 0; len -= 1) {
			if (pos >= outputWindow._windowSize) {
				pos = 0;
			}
			outputWindow._buffer[outputWindow._pos] = outputWindow._buffer[pos];
			outputWindow._pos += 1;
			pos += 1;

			if (outputWindow._pos >= outputWindow._windowSize) {
				this.#Flush_0();
			}
		}
	}

	#OutWindow_Create(windowSize: number): void {
		const m_OutWindow = this.#decoder.m_OutWindow;

		if (m_OutWindow._buffer == null || m_OutWindow._windowSize != windowSize) {
			m_OutWindow._buffer = this.#initArray(windowSize);
		}

		m_OutWindow._windowSize = windowSize;
		m_OutWindow._pos = 0;
		m_OutWindow._streamPos = 0;
	}

	#Flush_0(): void {
		let size = this.#decoder.m_OutWindow._pos - this.#decoder.m_OutWindow._streamPos;

		if (!size) {
			return;
		}

		this.#write_0(
			this.#decoder.m_OutWindow._stream,
			this.#decoder.m_OutWindow._buffer,
			this.#decoder.m_OutWindow._streamPos,
			size,
		);

		if (this.#decoder.m_OutWindow._pos >= this.#decoder.m_OutWindow._windowSize) {
			this.#decoder.m_OutWindow._pos = 0;
		}

		this.#decoder.m_OutWindow._streamPos = this.#decoder.m_OutWindow._pos;
	}

	#GetByte(distance: number) {
		const outputWindow = this.#decompressor.chunker.decoder.m_OutWindow;

		let pos = outputWindow._pos - distance - 1;
		if (pos < 0) {
			pos += outputWindow._windowSize;
		}

		return outputWindow._buffer[pos];
	}

	#PutByte(b: number): void {
		this.#decoder.m_OutWindow._buffer[this.#decoder.m_OutWindow._pos] = b;
		this.#decoder.m_OutWindow._pos += 1;

		if (this.#decoder.m_OutWindow._pos >= this.#decoder.m_OutWindow._windowSize) {
			this.#Flush_0();
		}
	}

	#OutWindow_ReleaseStream(): void {
		this.#Flush_0();
		this.#decoder.m_OutWindow._stream = null;
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

	#Chunker_0() {
		const chunker = {
			encoder: this.#encoder,
			decoder: null,
			alive: 1,
		};

		return chunker;
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
			decoder.m_RangeDecoder.Stream = null;
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
		this.#compressor.chunker.inBytesProcessed = this.#compressor.chunker.encoder.processedInSize[0];

		if (this.#compressor.chunker.encoder.finished[0]) {
			this.#ReleaseStreams();
			this.#compressor.chunker.alive = 0;
		}

		return this.#compressor.chunker.alive;
	}

	#CodeInChunks(inStream: BaseStream, outSize: [number, number]): Decoder {
		this.#decoder.m_RangeDecoder.Stream = inStream;
		this.#OutWindow_ReleaseStream();
		this.#decoder.m_OutWindow._stream = this.#decompressor.output;

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
			& decoder.m_PosStateMask;

		if (!this.#decodeBit(decoder.m_IsMatchDecoders, (decoder.state << 4) + posState)) {
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
			if (this.#decodeBit(decoder.m_IsRepDecoders, decoder.state)) {
				len = 0;
				if (!this.#decodeBit(decoder.m_IsRepG0Decoders, decoder.state)) {
					if (!this.#decodeBit(decoder.m_IsRep0LongDecoders, (decoder.state << 4) + posState)) {
						decoder.state = decoder.state < 7
							? 9
							: 11;

						len = 1;
					}
				} else {
					if (
						!this.#decodeBit(
							decoder.m_IsRepG1Decoders,
							decoder.state,
						)
					) {
						distance = decoder.rep1;
					} else {
						if (!this.#decodeBit(decoder.m_IsRepG2Decoders, decoder.state)) {
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
					len = this.#Decode(decoder.m_RepLenDecoder, posState) + 2;
					decoder.state = decoder.state < 7 ? 0x08 : 11;
				}
			} else {
				decoder.rep3 = decoder.rep2;
				decoder.rep2 = decoder.rep1;
				decoder.rep1 = decoder.rep0;

				len = 2 + this.#Decode(decoder.m_LenDecoder, posState);

				decoder.state = decoder.state < 7 ? 7 : 10;

				positionSlot = this.#RangeCoder_BitTreeDecoder_Decoder(
					decoder.m_PosSlotDecoder[this.GetLenToPosState(len)],
				);

				if (positionSlot >= 4) {
					numDirectBits = (positionSlot >> 1) - 1;
					decoder.rep0 = (2 | positionSlot & 1) << numDirectBits;

					if (positionSlot < 14) {
						decoder.rep0 += this.reverseDecode(
							decoder.m_PosDecoders,
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
				|| decoder.rep0 >= decoder.m_DictionarySizeCheck
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
		this.#decoder.m_OutWindow._streamPos = 0;
		this.#decoder.m_OutWindow._pos = 0;

		this.InitBitModels(this.#decoder.m_IsMatchDecoders);
		this.InitBitModels(this.#decoder.m_IsRep0LongDecoders);
		this.InitBitModels(this.#decoder.m_IsRepDecoders);
		this.InitBitModels(this.#decoder.m_IsRepG0Decoders);
		this.InitBitModels(this.#decoder.m_IsRepG1Decoders);
		this.InitBitModels(this.#decoder.m_IsRepG2Decoders);
		this.InitBitModels(this.#decoder.m_PosDecoders);

		this.#Init_0(this.#decoder.m_LiteralDecoder);

		for (let i = 0; i < 4; ++i) {
			this.InitBitModels(this.#decoder.m_PosSlotDecoder[i].Models);
		}

		this.#Init(this.#decoder.m_LenDecoder);
		this.#Init(this.#decoder.m_RepLenDecoder);
		this.InitBitModels(this.#decoder.m_PosAlignDecoder.Models);
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
			dictionarySize += (properties[1 + i] & 0xFF) << i * 0x08;
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

		if (this.#decoder.m_DictionarySize != dictionarySize) {
			this.#decoder.m_DictionarySize = dictionarySize;

			this.#decoder.m_DictionarySizeCheck = Math.max(
				this.#decoder.m_DictionarySize,
				1,
			);

			this.#OutWindow_Create(Math.max(this.#decoder.m_DictionarySizeCheck, 0x1000));
		}

		return 1;
	}

	#SetLcLpPb(lc: number, lp: number, pb: number): 0 | 1 {
		if (lc > 0x08 || lp > 4 || pb > 4) {
			return 0;
		}

		this.#Create_0(lp, lc);
		let numPosStates = 0x01 << pb;

		this.#Create(this.#decoder.m_LenDecoder, numPosStates);
		this.#Create(this.#decoder.m_RepLenDecoder, numPosStates);

		this.#decoder.m_PosStateMask = numPosStates - 1;

		return 1;
	}

	#Create(decoder: LenDecoder, numPosStates: number): void {
		for (; decoder.m_NumPosStates < numPosStates; decoder.m_NumPosStates += 1) {
			decoder.m_LowCoder[decoder.m_NumPosStates] = this.#createBitTreeDecoder(3);
			decoder.m_MidCoder[decoder.m_NumPosStates] = this.#createBitTreeDecoder(3);
		}
	}

	#Decode(
		decoder: LenDecoder,
		posState: number,
	): number {
		if (!this.#decodeBit(decoder.m_Choice, 0)) {
			return this.#RangeCoder_BitTreeDecoder_Decoder(decoder.m_LowCoder[posState]);
		}

		let symbol = 0x08;

		if (!this.#decodeBit(decoder.m_Choice, 1)) {
			symbol += this.#RangeCoder_BitTreeDecoder_Decoder(decoder.m_MidCoder[posState]);
		} else {
			symbol += 0x08 + this.#RangeCoder_BitTreeDecoder_Decoder(decoder.m_HighCoder);
		}

		return symbol;
	}

	#createLenDecoder(): LenDecoder {
		const decoder = {
			m_Choice: this.#initArray(2),
			m_LowCoder: this.#initArray(0x10),
			m_MidCoder: this.#initArray(0x10),
			m_HighCoder: this.#createBitTreeDecoder(0x08),
			m_NumPosStates: 0x00,
		};

		return decoder;
	}

	#Init(decoder: LenDecoder): void {
		this.InitBitModels(decoder.m_Choice);

		for (let posState = 0; posState < decoder.m_NumPosStates; ++posState) {
			this.InitBitModels(decoder.m_LowCoder[posState].Models);
			this.InitBitModels(decoder.m_MidCoder[posState].Models);
		}

		this.InitBitModels(decoder.m_HighCoder.Models);
	}

	#Create_0(
		numPosBits: number,
		numPrevBits: number,
	): void {
		let i, numStates;

		if (
			this.#decoder.m_LiteralDecoder.m_Coders !== null
			&& this.#decoder.m_LiteralDecoder.m_NumPrevBits == numPrevBits
			&& this.#decoder.m_LiteralDecoder.m_NumPosBits == numPosBits
		) {
			return;
		}

		this.#decoder.m_LiteralDecoder.m_NumPosBits = numPosBits;
		this.#decoder.m_LiteralDecoder.m_PosMask = (1 << numPosBits) - 1;
		this.#decoder.m_LiteralDecoder.m_NumPrevBits = numPrevBits;

		numStates = 1 << this.#decoder.m_LiteralDecoder.m_NumPrevBits + this.#decoder.m_LiteralDecoder.m_NumPosBits;

		this.#decoder.m_LiteralDecoder.m_Coders = this.#initArray(numStates);

		for (i = 0; i < numStates; ++i) {
			this.#decoder.m_LiteralDecoder.m_Coders[i] = this.#createLiteralDecoderEncoder2();
		}
	}

	#GetDecoder(
		pos: number,
		prevByte: number,
	): LiteralDecoderEncoder2 {
		const literalDecoder = this.#decompressor.chunker.decoder.m_LiteralDecoder;

		// Calculate index based on position and previous byte
		const positionMask = pos & literalDecoder.m_PosMask;
		const prevBitsMask = (prevByte & 0xFF) >>> (0x08 - literalDecoder.m_NumPrevBits);
		const index = (positionMask << literalDecoder.m_NumPrevBits) + prevBitsMask;

		// Return decoder at calculated index
		return literalDecoder.m_Coders[index];
	}

	#Init_0(decoder: LiteralDecoder): void {
		let i, numStates;
		numStates = 1 << decoder.m_NumPrevBits + decoder.m_NumPosBits;

		for (i = 0; i < numStates; ++i) {
			this.InitBitModels(decoder.m_Coders[i].m_Decoders);
		}
	}

	#DecodeNormal(decoder: LiteralDecoderEncoder2): number {
		let symbol = 1;
		do {
			symbol = symbol << 1 | this.#decodeBit(decoder.m_Decoders, symbol);
		} while (symbol < 0x100);

		return toSigned8bit(symbol);
	}

	#DecodeWithMatchByte(
		encoder: LiteralDecoderEncoder2,
		matchByte: number,
	): number {
		let bit, matchBit, symbol = 1;
		do {
			matchBit = matchByte >> 7 & 1;
			matchByte <<= 1;
			bit = this.#decodeBit(
				encoder.m_Decoders,
				(1 + matchBit << 0x08) + symbol,
			);
			symbol = symbol << 1 | bit;

			if (matchBit != bit) {
				while (symbol < 0x100) {
					symbol = symbol << 1 | this.#decodeBit(encoder.m_Decoders, symbol);
				}
				break;
			}
		} while (symbol < 0x100);

		return toSigned8bit(symbol);
	}

	#createLiteralDecoderEncoder2(): LiteralDecoderEncoder2 {
		const literalDecoder = {
			m_Decoders: this.#initArray(0x300),
		};

		return literalDecoder;
	}

	#Backward(cur: number): number {
		const encoder = this.#compressor.chunker.encoder;
		let backCur, backMem, posMem, posPrev;

		encoder._optimumEndIndex = cur;
		posMem = encoder._optimum[cur].PosPrev;
		backMem = encoder._optimum[cur].BackPrev;

		do {
			if (encoder._optimum[cur].Prev1IsChar) {
				this.#MakeAsChar(encoder._optimum[posMem]);
				encoder._optimum[posMem].PosPrev = posMem - 1;

				if (encoder._optimum[cur].Prev2) {
					encoder._optimum[posMem - 1].Prev1IsChar = 0;
					encoder._optimum[posMem - 1].PosPrev = encoder._optimum[cur].PosPrev2;
					encoder._optimum[posMem - 1].BackPrev = encoder._optimum[cur].BackPrev2;
				}
			}

			posPrev = posMem;
			backCur = backMem;
			backMem = encoder._optimum[posPrev].BackPrev;
			posMem = encoder._optimum[posPrev].PosPrev;
			encoder._optimum[posPrev].BackPrev = backCur;
			encoder._optimum[posPrev].PosPrev = cur;
			cur = posPrev;
		} while (cur > 0);

		encoder.backRes = encoder._optimum[0].BackPrev;
		encoder._optimumCurrentIndex = encoder._optimum[0].PosPrev;

		return encoder._optimumCurrentIndex;
	}

	#BaseInit(): void {
		this.#encoder._state = 0;
		this.#encoder._previousByte = 0;

		for (let i = 0; i < 4; ++i) {
			this.#encoder._repDistances[i] = 0;
		}
	}

	#CodeOneBlock(): void {
		let baseVal,
			complexState,
			curByte,
			distance,
			footerBits,
			i,
			len,
			lenToPosState,
			matchByte,
			pos,
			posReduced,
			posSlot,
			posState,
			progressPosValuePrev,
			subCoder;

		this.#compressor.chunker.encoder.processedInSize[0] = this.#P0_LONG_LIT;
		this.#compressor.chunker.encoder.processedOutSize[0] = this.#P0_LONG_LIT;
		this.#compressor.chunker.encoder.finished[0] = 1;

		if (this.#compressor.chunker.encoder._inStream) {
			this.#compressor.chunker.encoder._matchFinder._stream = this.#compressor.chunker.encoder._inStream;
			this.#Init_5();
			this.#compressor.chunker.encoder._needReleaseMFStream = 1;
			this.#compressor.chunker.encoder._inStream = null;
		}

		if (this.#compressor.chunker.encoder._finished) {
			return;
		}

		this.#compressor.chunker.encoder._finished = 1;
		progressPosValuePrev = this.#compressor.chunker.encoder.nowPos64;

		if (this.#eq(this.#compressor.chunker.encoder.nowPos64, this.#P0_LONG_LIT)) {
			if (!this.#GetNumAvailableBytes()) {
				this.#Flush(this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64));
				return;
			}

			this.#ReadMatchDistances();
			posState = this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64) & this.#compressor.chunker.encoder._posStateMask;

			this.#Encode_3(
				this.#compressor.chunker.encoder._isMatch,
				(this.#compressor.chunker.encoder._state << 4) + posState,
				0,
			);

			this.#compressor.chunker.encoder._state = this.StateUpdateChar(this.#compressor.chunker.encoder._state);
			curByte = this.#GetIndexByte(
				-this.#compressor.chunker.encoder._additionalOffset,
			);

			this.#Encode_1(
				this.#LZMA_Encoder_GetSubCoder(
					this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64),
					this.#compressor.chunker.encoder._previousByte,
				),
				curByte,
			);

			this.#compressor.chunker.encoder._previousByte = curByte;
			this.#compressor.chunker.encoder._additionalOffset -= 1;
			this.#compressor.chunker.encoder.nowPos64 = this.#add(
				this.#compressor.chunker.encoder.nowPos64,
				this.#P1_LONG_LIT,
			);
		}

		if (!this.#GetNumAvailableBytes()) {
			this.#Flush(this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64));
			return;
		}

		while (1) {
			len = this.#GetOptimum(this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64));
			pos = this.#compressor.chunker.encoder.backRes;
			posState = this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64) & this.#compressor.chunker.encoder._posStateMask;
			complexState = (this.#compressor.chunker.encoder._state << 4) + posState;

			if (len == 1 && pos == -1) {
				this.#Encode_3(
					this.#compressor.chunker.encoder._isMatch,
					complexState,
					0,
				);

				curByte = this.#GetIndexByte(
					-this.#compressor.chunker.encoder._additionalOffset,
				);

				subCoder = this.#LZMA_Encoder_GetSubCoder(
					this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64),
					this.#compressor.chunker.encoder._previousByte,
				);

				if (this.#compressor.chunker.encoder._state < 7) {
					this.#Encode_1(subCoder, curByte);
				} else {
					matchByte = this.#GetIndexByte(
						-this.#compressor.chunker.encoder._repDistances[0]
							- 1
							- this.#compressor.chunker.encoder._additionalOffset,
					);

					this.#EncodeMatched(
						subCoder,
						matchByte,
						curByte,
					);
				}
				this.#compressor.chunker.encoder._previousByte = curByte;
				this.#compressor.chunker.encoder._state = this.StateUpdateChar(this.#compressor.chunker.encoder._state);
			} else {
				this.#Encode_3(
					this.#compressor.chunker.encoder._isMatch,
					complexState,
					1,
				);
				if (pos < 4) {
					this.#Encode_3(
						this.#compressor.chunker.encoder._isRep,
						this.#compressor.chunker.encoder._state,
						1,
					);

					if (!pos) {
						this.#Encode_3(
							this.#compressor.chunker.encoder._isRepG0,
							this.#compressor.chunker.encoder._state,
							0,
						);

						if (len == 1) {
							this.#Encode_3(
								this.#compressor.chunker.encoder._isRep0Long,
								complexState,
								0,
							);
						} else {
							this.#Encode_3(
								this.#compressor.chunker.encoder._isRep0Long,
								complexState,
								1,
							);
						}
					} else {
						this.#Encode_3(
							this.#compressor.chunker.encoder._isRepG0,
							this.#compressor.chunker.encoder._state,
							1,
						);

						if (pos == 1) {
							this.#Encode_3(
								this.#compressor.chunker.encoder._isRepG1,
								this.#compressor.chunker.encoder._state,
								0,
							);
						} else {
							this.#Encode_3(
								this.#compressor.chunker.encoder._isRepG1,
								this.#compressor.chunker.encoder._state,
								1,
							);
							this.#Encode_3(
								this.#compressor.chunker.encoder._isRepG2,
								this.#compressor.chunker.encoder._state,
								pos - 2,
							);
						}
					}

					if (len == 1) {
						this.#compressor.chunker.encoder._state = this.#compressor.chunker.encoder._state < 7 ? 9 : 11;
					} else {
						this.#Encode_0(
							this.#compressor.chunker.encoder._repMatchLenEncoder,
							len - 2,
							posState,
						);
						this.#compressor.chunker.encoder._state = this.#compressor.chunker.encoder._state < 7
							? 0x08
							: 11;
					}

					distance = this.#compressor.chunker.encoder._repDistances[pos];
					if (pos != 0) {
						for (let i = pos; i >= 1; --i) {
							this.#compressor.chunker.encoder._repDistances[i] = this
								.#compressor
								.chunker
								.encoder
								._repDistances[i - 1];
						}
						this.#compressor.chunker.encoder._repDistances[0] = distance;
					}
				} else {
					this.#Encode_3(
						this.#compressor.chunker.encoder._isRep,
						this.#compressor.chunker.encoder._state,
						0x00,
					);

					this.#compressor.chunker.encoder._state = this.#compressor.chunker.encoder._state < 7 ? 7 : 10;
					this.#Encode_0(
						this.#compressor.chunker.encoder._lenEncoder,
						len - 0x02,
						posState,
					);

					pos -= 0x04;
					posSlot = this.GetPosSlot(pos);
					lenToPosState = this.GetLenToPosState(len);

					this.#Encode_2(
						this.#compressor.chunker.encoder._posSlotEncoder[lenToPosState],
						posSlot,
					);

					if (posSlot >= 0x04) {
						footerBits = (posSlot >> 0x01) - 0x01;
						baseVal = (0x02 | posSlot & 0x01) << footerBits;
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
							this.#compressor.chunker.encoder._alignPriceCount += 1;
						}
					}

					distance = pos;
					for (let i = 3; i >= 1; --i) {
						this.#compressor.chunker.encoder._repDistances[i] = this
							.#compressor
							.chunker
							.encoder
							._repDistances[i - 1];
					}

					this.#compressor.chunker.encoder._repDistances[0] = distance;
					this.#compressor.chunker.encoder._matchPriceCount += 0x01;
				}

				this.#compressor.chunker.encoder._previousByte = this.#GetIndexByte(
					len - 1 - this.#compressor.chunker.encoder._additionalOffset,
				);
			}

			this.#compressor.chunker.encoder._additionalOffset -= len;
			this.#compressor.chunker.encoder.nowPos64 = this.#add(
				this.#compressor.chunker.encoder.nowPos64,
				this.#fromInt(len),
			);

			if (!this.#compressor.chunker.encoder._additionalOffset) {
				if (this.#compressor.chunker.encoder._matchPriceCount >= 0x80) {
					this.#FillDistancesPrices(this.#compressor.chunker.encoder);
				}

				if (this.#compressor.chunker.encoder._alignPriceCount >= 0x10) {
					this.#FillAlignPrices(this.#compressor.chunker.encoder);
				}

				this.#compressor.chunker.encoder.processedInSize[0] = this.#compressor.chunker.encoder.nowPos64;
				this.#compressor.chunker.encoder.processedOutSize[0] = this.#GetProcessedSizeAdd();

				if (!this.#GetNumAvailableBytes()) {
					this.#Flush(this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64));

					return;
				}

				if (
					this.#compare(
						this.#sub(this.#compressor.chunker.encoder.nowPos64, [0x1000, 0]),
						[0x1000, 0],
					) >= 0
				) {
					this.#compressor.chunker.encoder._finished = 0;
					this.#compressor.chunker.encoder.finished[0] = 0;

					return;
				}
			}
		}
	}

	#Create_2(): void {
		let binTree, numHashBytes;

		if (!this.#encoder._matchFinder) {
			binTree = {} as MatchFinder;
			numHashBytes = 4;

			if (!this.#encoder._matchFinderType) {
				numHashBytes = 2;
			}

			this.#SetType(binTree, numHashBytes);
			this.#encoder._matchFinder = binTree;
		}

		this.#LZMA_Encoder_LiteralEncoder_Create();

		if (
			this.#encoder._dictionarySize == this.#encoder._dictionarySizePrev
			&& this.#encoder._numFastBytesPrev == this.#encoder._numFastBytes
		) {
			return;
		}

		this.#Create_3(0x1000, 0x0112);

		this.#encoder._dictionarySizePrev = this.#encoder._dictionarySize;
		this.#encoder._numFastBytesPrev = this.#encoder._numFastBytes;
	}

	#Encoder(): void {
		for (let i = 0; i < 0x1000; ++i) {
			this.#encoder._optimum[i] = {};
		}

		for (let i = 0; i < 4; ++i) {
			this.#encoder._posSlotEncoder[i] = this.#createBitTreeEncoder(6);
		}
	}

	#FillAlignPrices(encoder: Encoder): void {
		for (let i = 0; i < 0x10; ++i) {
			encoder._alignPrices[i] = this.#ReverseGetPrice(encoder._posAlignEncoder, i);
		}

		encoder._alignPriceCount = 0;
	}

	#FillDistancesPrices(encoder: Encoder): void {
		let baseVal, bitTreeEncoder: BitTree, footerBits, posSlot, st, st2;

		for (let i = 0x04; i < 0x80; ++i) {
			posSlot = this.GetPosSlot(i);
			footerBits = (posSlot >> 1) - 1;
			baseVal = (2 | posSlot & 1) << footerBits;

			encoder.tempPrices[i] = this.ReverseGetPrice(
				encoder._posEncoders,
				baseVal - posSlot - 1,
				footerBits,
				i - baseVal,
			);
		}

		for (let lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
			bitTreeEncoder = encoder._posSlotEncoder[lenToPosState];
			st = lenToPosState << 6;

			for (posSlot = 0; posSlot < encoder._distTableSize; posSlot += 1) {
				encoder._posSlotPrices[st + posSlot] = this.#RangeCoder_Encoder_GetPrice_1(bitTreeEncoder, posSlot);
			}

			for (posSlot = 14; posSlot < encoder._distTableSize; posSlot += 1) {
				encoder._posSlotPrices[st + posSlot] += (posSlot >> 1) - 1 - 4 << 6;
			}

			st2 = lenToPosState * 0x80;
			for (let i = 0; i < 4; ++i) {
				encoder._distancesPrices[st2 + i] = encoder._posSlotPrices[st + i];
			}

			for (let i = 4; i < 0x80; ++i) {
				encoder._distancesPrices[st2 + i] = encoder._posSlotPrices[st + this.GetPosSlot(i)] + encoder.tempPrices[i];
			}
		}

		encoder._matchPriceCount = 0;
	}

	#Flush(nowPos: number): void {
		this.#ReleaseMFStream();
		this.#WriteEndMarker(nowPos & this.#compressor.chunker.encoder._posStateMask);

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

		if (encoder._optimumEndIndex != encoder._optimumCurrentIndex) {
			lenRes = encoder._optimum[encoder._optimumCurrentIndex].PosPrev - encoder._optimumCurrentIndex;
			encoder.backRes = encoder._optimum[encoder._optimumCurrentIndex].BackPrev;
			encoder._optimumCurrentIndex = encoder._optimum[encoder._optimumCurrentIndex].PosPrev;

			return lenRes;
		}

		encoder._optimumCurrentIndex = encoder._optimumEndIndex = 0;
		if (encoder._longestMatchWasFound) {
			lenMain = encoder._longestMatchLength;
			encoder._longestMatchWasFound = 0;
		} else {
			lenMain = this.#ReadMatchDistances();
		}

		numDistancePairs = encoder._numDistancePairs;
		numAvailableBytes = this.#GetNumAvailableBytes() + 1;

		if (numAvailableBytes < 2) {
			encoder.backRes = -1;
			return 1;
		}

		if (numAvailableBytes > 0x0111) {
			numAvailableBytes = 0x0111;
		}

		repMaxIndex = 0;
		for (let i = 0; i < 4; ++i) {
			encoder.reps[i] = encoder._repDistances[i];
			encoder.repLens[i] = this.#GetMatchLen(-1, encoder.reps[i], 0x0111);

			if (encoder.repLens[i] > encoder.repLens[repMaxIndex]) {
				repMaxIndex = i;
			}
		}

		if (encoder.repLens[repMaxIndex] >= encoder._numFastBytes) {
			encoder.backRes = repMaxIndex;
			lenRes = encoder.repLens[repMaxIndex];
			this.#MovePos(lenRes - 1);

			return lenRes;
		}

		if (lenMain >= encoder._numFastBytes) {
			encoder.backRes = this.#compressor.chunker.encoder._matchDistances[numDistancePairs - 1] + 4;

			this.#MovePos(lenMain - 1);
			return lenMain;
		}

		currentByte = this.#GetIndexByte(-1);
		matchByte = this.#GetIndexByte(-encoder._repDistances[0] - 1 - 1);

		if (lenMain < 2 && currentByte != matchByte && encoder.repLens[repMaxIndex] < 2) {
			encoder.backRes = -1;
			return 1;
		}

		encoder._optimum[0].State = encoder._state;
		posState = position & encoder._posStateMask;
		encoder._optimum[1].Price = this.#probPrices[
			encoder._isMatch[(encoder._state << 4) + posState] >>> 2
		] + this.#RangeCoder_Encoder_GetPrice_0(
			this.#LZMA_Encoder_GetSubCoder(
				position,
				encoder._previousByte,
			),
			encoder._state >= 7,
			matchByte,
			currentByte,
		);

		this.#MakeAsChar(encoder._optimum[1]);
		matchPrice = this.#probPrices[
			0x800 - encoder._isMatch[(encoder._state << 4) + posState]
			>>> 0x02
		];

		repMatchPrice = matchPrice + this.#probPrices[
			0x800 - encoder._isRep[encoder._state] >>> 2
		];

		if (matchByte == currentByte) {
			shortRepPrice = repMatchPrice + this.#GetRepLen1Price(posState);
			if (shortRepPrice < encoder._optimum[1].Price) {
				encoder._optimum[1].Price = shortRepPrice;
				this.#MakeAsShortRep(encoder._optimum[1]);
			}
		}

		lenEnd = lenMain >= encoder.repLens[repMaxIndex]
			? lenMain
			: encoder.repLens[repMaxIndex];

		if (lenEnd < 2) {
			encoder.backRes = encoder._optimum[1].BackPrev;
			return 1;
		}

		encoder._optimum[1].PosPrev = 0;
		encoder._optimum[0].Backs0 = encoder.reps[0];
		encoder._optimum[0].Backs1 = encoder.reps[1];
		encoder._optimum[0].Backs2 = encoder.reps[2];
		encoder._optimum[0].Backs3 = encoder.reps[3];
		len = lenEnd;

		do {
			encoder._optimum[len].Price = this.#kIfinityPrice;
			len -= 1;
		} while (len >= 2);

		for (let i = 0; i < 4; ++i) {
			repLen = encoder.repLens[i];
			if (repLen < 2) {
				continue;
			}
			price_4 = repMatchPrice + this.#GetPureRepPrice(
				i,
				encoder._state,
				posState,
			);

			do {
				curAndLenPrice = price_4 + this.#RangeCoder_Encoder_GetPrice(
					encoder._repMatchLenEncoder,
					repLen - 2,
					posState,
				);
				optimum = encoder._optimum[repLen];
				if (curAndLenPrice < optimum.Price) {
					optimum.Price = curAndLenPrice;
					optimum.PosPrev = 0;
					optimum.BackPrev = i;
					optimum.Prev1IsChar = 0;
				}
			} while ((repLen -= 1) >= 2);
		}

		normalMatchPrice = matchPrice
			+ this.#probPrices[encoder._isRep[encoder._state] >>> 2];

		len = encoder.repLens[0] >= 2 ? encoder.repLens[0] + 1 : 2;

		if (len <= lenMain) {
			offs = 0;
			while (len > encoder._matchDistances[offs]) {
				offs += 2;
			}

			for (;; len += 1) {
				distance = encoder._matchDistances[offs + 1];
				curAndLenPrice = normalMatchPrice + this.#LZMA_Encoder_GetPosLenPrice(distance, len, posState);
				optimum = encoder._optimum[len];

				if (curAndLenPrice < optimum.Price) {
					optimum.Price = curAndLenPrice;
					optimum.PosPrev = 0;
					optimum.BackPrev = distance + 4;
					optimum.Prev1IsChar = 0;
				}

				if (len == encoder._matchDistances[offs]) {
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
			numDistancePairs = encoder._numDistancePairs;

			if (newLen >= encoder._numFastBytes) {
				encoder._longestMatchLength = newLen;
				encoder._longestMatchWasFound = 0x01;

				return this.#Backward(cur);
			}
			position += 0x01;
			posPrev = encoder._optimum[cur].PosPrev;

			if (encoder._optimum[cur].Prev1IsChar) {
				posPrev -= 0x01;
				if (encoder._optimum[cur].Prev2) {
					state = encoder._optimum[encoder._optimum[cur].PosPrev2].State;
					if (encoder._optimum[cur].BackPrev2 < 0x04) {
						state = (state < 0x07) ? 0x08 : 0x0B;
					} else {
						state = (state < 0x07) ? 0x07 : 0x0A;
					}
				} else {
					state = encoder._optimum[posPrev].State;
				}
				state = this.StateUpdateChar(state);
			} else {
				state = encoder._optimum[posPrev].State;
			}

			if (posPrev == cur - 1) {
				if (!encoder._optimum[cur].BackPrev) {
					state = state < 7 ? 9 : 11;
				} else {
					state = this.StateUpdateChar(state);
				}
			} else {
				if (
					encoder._optimum[cur].Prev1IsChar
					&& encoder._optimum[cur].Prev2
				) {
					posPrev = encoder._optimum[cur].PosPrev2;
					pos = encoder._optimum[cur].BackPrev2;
					state = state < 0x07 ? 0x08 : 0x0B;
				} else {
					pos = encoder._optimum[cur].BackPrev;
					if (pos < 4) {
						state = state < 0x07 ? 0x08 : 0x0B;
					} else {
						state = state < 0x07 ? 0x07 : 0x0A;
					}
				}
				opt = encoder._optimum[posPrev];

				if (pos < 4) {
					if (!pos) {
						encoder.reps[0] = opt.Backs0;
						encoder.reps[1] = opt.Backs1;
						encoder.reps[2] = opt.Backs2;
						encoder.reps[3] = opt.Backs3;
					} else if (pos == 1) {
						encoder.reps[0] = opt.Backs1;
						encoder.reps[1] = opt.Backs0;
						encoder.reps[2] = opt.Backs2;
						encoder.reps[3] = opt.Backs3;
					} else if (pos == 2) {
						encoder.reps[0] = opt.Backs2;
						encoder.reps[1] = opt.Backs0;
						encoder.reps[2] = opt.Backs1;
						encoder.reps[3] = opt.Backs3;
					} else {
						encoder.reps[0] = opt.Backs3;
						encoder.reps[1] = opt.Backs0;
						encoder.reps[2] = opt.Backs1;
						encoder.reps[3] = opt.Backs2;
					}
				} else {
					encoder.reps[0] = pos - 4;
					encoder.reps[1] = opt.Backs0;
					encoder.reps[2] = opt.Backs1;
					encoder.reps[3] = opt.Backs2;
				}
			}

			encoder._optimum[cur].State = state;
			encoder._optimum[cur].Backs0 = encoder.reps[0];
			encoder._optimum[cur].Backs1 = encoder.reps[1];
			encoder._optimum[cur].Backs2 = encoder.reps[2];
			encoder._optimum[cur].Backs3 = encoder.reps[3];
			curPrice = encoder._optimum[cur].Price;

			currentByte = this.#GetIndexByte(-0x01);
			matchByte = this.#GetIndexByte(-encoder.reps[0] - 1 - 1);

			posState = position & encoder._posStateMask;
			curAnd1Price = curPrice
				+ this.#probPrices[encoder._isMatch[(state << 0x04) + posState] >>> 2]
				+ this.#RangeCoder_Encoder_GetPrice_0(
					this.#LZMA_Encoder_GetSubCoder(position, this.#GetIndexByte(-2)),
					state >= 7,
					matchByte,
					currentByte,
				);

			nextOptimum = encoder._optimum[cur + 1];
			nextIsChar = 0;

			if (curAnd1Price < nextOptimum.Price) {
				nextOptimum.Price = curAnd1Price;
				nextOptimum.PosPrev = cur;
				nextOptimum.BackPrev = -0x01;
				nextOptimum.Prev1IsChar = 0x00;
				nextIsChar = 1;
			}

			matchPrice = curPrice + this.#probPrices[
				0x800 - encoder._isMatch[(state << 0x04) + posState] >>> 0x02
			];

			repMatchPrice = matchPrice + this.#probPrices[0x800 - encoder._isRep[state] >>> 0x02];

			if (matchByte == currentByte && !(nextOptimum.PosPrev < cur && !nextOptimum.BackPrev)) {
				shortRepPrice = repMatchPrice
					+ (this.#probPrices[encoder._isRepG0[state] >>> 0x02] + this.#probPrices[encoder._isRep0Long[(state << 0x04) + posState] >>> 0x02]);

				if (shortRepPrice <= nextOptimum.Price) {
					nextOptimum.Price = shortRepPrice;
					nextOptimum.PosPrev = cur;
					nextOptimum.BackPrev = 0x00;
					nextOptimum.Prev1IsChar = 0x00;
					nextIsChar = 0x01;
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

			if (numAvailableBytes > encoder._numFastBytes) {
				numAvailableBytes = encoder._numFastBytes;
			}

			if (!nextIsChar && matchByte != currentByte) {
				t = Math.min(numAvailableBytesFull - 1, encoder._numFastBytes);
				lenTest2 = this.#GetMatchLen(0x00, encoder.reps[0], t);

				if (lenTest2 >= 0x02) {
					state2 = this.StateUpdateChar(state);
					posStateNext = position + 1 & encoder._posStateMask;
					nextRepMatchPrice = curAnd1Price
						+ this.#probPrices[0x800 - encoder._isMatch[(state2 << 4) + posStateNext] >>> 2]
						+ this.#probPrices[0x800 - encoder._isRep[state2] >>> 2];

					offset = cur + 1 + lenTest2;

					while (lenEnd < offset) {
						encoder._optimum[lenEnd += 1].Price = this.#kIfinityPrice;
					}

					curAndLenPrice = nextRepMatchPrice + (price = this.#RangeCoder_Encoder_GetPrice(
						encoder._repMatchLenEncoder,
						lenTest2 - 0x02,
						posStateNext,
					),
						price + this.#GetPureRepPrice(
							0x00,
							state2,
							posStateNext,
						));
					optimum = encoder._optimum[offset];

					if (curAndLenPrice < optimum.Price) {
						optimum.Price = curAndLenPrice;
						optimum.PosPrev = cur + 1;
						optimum.BackPrev = 0;
						optimum.Prev1IsChar = 1;
						optimum.Prev2 = 0;
					}
				}
			}
			startLen = 0x02;

			for (repIndex = 0; repIndex < 4; ++repIndex) {
				lenTest = this.#GetMatchLen(
					-0x01,
					encoder.reps[repIndex],
					numAvailableBytes,
				);

				if (lenTest < 2) {
					continue;
				}
				lenTestTemp = lenTest;

				do {
					while (lenEnd < cur + lenTest) {
						encoder._optimum[lenEnd += 1].Price = this.#kIfinityPrice;
					}

					curAndLenPrice = repMatchPrice + (price_0 = this.#RangeCoder_Encoder_GetPrice(
						encoder._repMatchLenEncoder,
						lenTest - 2,
						posState,
					),
						price_0 + this.#GetPureRepPrice(
							repIndex,
							state,
							posState,
						));

					optimum = encoder._optimum[cur + lenTest];

					if (curAndLenPrice < optimum.Price) {
						optimum.Price = curAndLenPrice;
						optimum.PosPrev = cur;
						optimum.BackPrev = repIndex;
						optimum.Prev1IsChar = 0;
					}
				} while ((lenTest -= 1) >= 2);

				lenTest = lenTestTemp;

				if (!repIndex) {
					startLen = lenTest + 1;
				}

				if (lenTest < numAvailableBytesFull) {
					t = Math.min(
						numAvailableBytesFull - 1 - lenTest,
						encoder._numFastBytes,
					);
					lenTest2 = this.#GetMatchLen(
						lenTest,
						encoder.reps[repIndex],
						t,
					);

					if (lenTest2 >= 2) {
						state2 = state < 7 ? 0x08 : 11;
						posStateNext = position + lenTest & encoder._posStateMask;
						curAndLenCharPrice = repMatchPrice
							+ (price_1 = this.#RangeCoder_Encoder_GetPrice(encoder._repMatchLenEncoder, lenTest - 2, posState), price_1 + this.#GetPureRepPrice(repIndex, state, posState))
							+ this.#probPrices[encoder._isMatch[(state2 << 4) + posStateNext] >>> 2]
							+ this.#RangeCoder_Encoder_GetPrice_0(
								this.#LZMA_Encoder_GetSubCoder(position + lenTest, this.#GetIndexByte(lenTest - 1 - 1)),
								1,
								this.#GetIndexByte(lenTest - 1 - (encoder.reps[repIndex] + 1)),
								this.#GetIndexByte(lenTest - 1),
							);

						state2 = this.StateUpdateChar(state2);
						posStateNext = position + lenTest + 1 & encoder._posStateMask;

						nextMatchPrice = curAndLenCharPrice + this.#probPrices[
							0x800 - encoder._isMatch[(state2 << 4) + posStateNext] >>> 2
						];

						nextRepMatchPrice = nextMatchPrice + this.#probPrices[
							0x800 - encoder._isRep[state2] >>> 2
						];

						offset = cur + 1 + lenTest + lenTest2;

						while (lenEnd < cur + offset) {
							encoder._optimum[lenEnd += 1].Price = this.#kIfinityPrice;
						}

						curAndLenPrice = nextRepMatchPrice + (price_2 = this.#RangeCoder_Encoder_GetPrice(encoder._repMatchLenEncoder, lenTest2 - 2, posStateNext), price_2 + this.#GetPureRepPrice(0, state2, posStateNext));
						optimum = encoder._optimum[cur + offset];

						if (curAndLenPrice < optimum.Price) {
							optimum.Price = curAndLenPrice;
							optimum.PosPrev = cur + lenTest + 1;
							optimum.BackPrev = 0;
							optimum.Prev1IsChar = 1;
							optimum.Prev2 = 1;
							optimum.PosPrev2 = cur;
							optimum.BackPrev2 = repIndex;
						}
					}
				}
			}

			if (newLen > numAvailableBytes) {
				newLen = numAvailableBytes;
				for (
					numDistancePairs = 0;
					newLen > encoder._matchDistances[numDistancePairs];
					numDistancePairs += 2
				) {}
				encoder._matchDistances[numDistancePairs] = newLen;
				numDistancePairs += 2;
			}

			if (newLen >= startLen) {
				normalMatchPrice = matchPrice + this.#probPrices[encoder._isRep[state] >>> 2];

				while (lenEnd < cur + newLen) {
					encoder._optimum[lenEnd += 1].Price = this.#kIfinityPrice;
				}
				offs = 0;

				while (startLen > encoder._matchDistances[offs]) {
					offs += 2;
				}

				for (lenTest = startLen;; lenTest += 1) {
					curBack = encoder._matchDistances[offs + 1];
					curAndLenPrice = normalMatchPrice + this.#LZMA_Encoder_GetPosLenPrice(curBack, lenTest, posState);
					optimum = encoder._optimum[cur + lenTest];

					if (curAndLenPrice < optimum.Price) {
						optimum.Price = curAndLenPrice;
						optimum.PosPrev = cur;
						optimum.BackPrev = curBack + 4;
						optimum.Prev1IsChar = 0;
					}

					if (lenTest == encoder._matchDistances[offs]) {
						if (lenTest < numAvailableBytesFull) {
							t = Math.min(
								numAvailableBytesFull - 1 - lenTest,
								encoder._numFastBytes,
							);
							lenTest2 = this.#GetMatchLen(
								lenTest,
								curBack,
								t,
							);

							if (lenTest2 >= 2) {
								state2 = state < 7 ? 7 : 10;
								posStateNext = position + lenTest & encoder._posStateMask;

								curAndLenCharPrice = curAndLenPrice
									+ this.#probPrices[encoder._isMatch[(state2 << 4) + posStateNext] >>> 2]
									+ this.#RangeCoder_Encoder_GetPrice_0(
										this.#LZMA_Encoder_GetSubCoder(
											position + lenTest,
											this.#GetIndexByte(lenTest - 1 - 1),
										),
										1,
										this.#GetIndexByte(lenTest - (curBack + 1) - 1),
										this.#GetIndexByte(lenTest - 1),
									);

								state2 = this.StateUpdateChar(state2);
								posStateNext = position + lenTest + 1 & encoder._posStateMask;

								nextMatchPrice = curAndLenCharPrice + this.#probPrices[
									0x800 - encoder._isMatch[(state2 << 4) + posStateNext]
									>>> 2
								];

								nextRepMatchPrice = nextMatchPrice + this.#probPrices[
									0x800 - encoder._isRep[state2] >>> 2
								];

								offset = lenTest + 1 + lenTest2;

								while (lenEnd < cur + offset) {
									encoder._optimum[lenEnd += 1].Price = this.#kIfinityPrice;
								}

								curAndLenPrice = nextRepMatchPrice + (price_3 = this.#RangeCoder_Encoder_GetPrice(encoder._repMatchLenEncoder, lenTest2 - 2, posStateNext), price_3 + this.#GetPureRepPrice(0, state2, posStateNext));
								optimum = encoder._optimum[cur + offset];

								if (curAndLenPrice < optimum.Price) {
									optimum.Price = curAndLenPrice;
									optimum.PosPrev = cur + lenTest + 1;
									optimum.BackPrev = 0;
									optimum.Prev1IsChar = 1;
									optimum.Prev2 = 1;
									optimum.PosPrev2 = cur;
									optimum.BackPrev2 = curBack + 4;
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
	}

	#LZMA_Encoder_GetPosLenPrice(
		pos: number,
		len: number,
		posState: number,
	): number {
		const encoder = this.#compressor.chunker.encoder;
		let price: number, lenToPosState = this.GetLenToPosState(len);

		if (pos < 0x80) {
			price = encoder._distancesPrices[lenToPosState * 0x80 + pos];
		} else {
			const position = (lenToPosState << 6) + this.GetPosSlot2(pos);
			price = encoder._posSlotPrices[position] + encoder._alignPrices[pos & 0x0F];
		}

		return price + this.#RangeCoder_Encoder_GetPrice(
			encoder._lenEncoder,
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
			price = this.#probPrices[encoder._isRepG0[state] >>> 2];
			price += this.#probPrices[
				0x800 - this.#compressor.chunker.encoder._isRep0Long[(state << 4) + posState] >>> 2
			];
		} else {
			price = this.#probPrices[0x800 - this.#compressor.chunker.encoder._isRepG0[state] >>> 2];
			if (repIndex == 1) {
				price += this.#probPrices[this.#compressor.chunker.encoder._isRepG1[state] >>> 2];
			} else {
				price += this.#probPrices[0x800 - this.#compressor.chunker.encoder._isRepG1[state] >>> 2];
				price += this.GetPrice(this.#compressor.chunker.encoder._isRepG2[state], repIndex - 2);
			}
		}

		return price;
	}

	#GetRepLen1Price(posState: number): number {
		const encoder = this.#compressor.chunker.encoder;

		const repG0Price = this.#probPrices[encoder._isRepG0[encoder._state] >>> 2];
		const rep0LongPrice = this.#probPrices[encoder._isRep0Long[(encoder._state << 4) + posState] >>> 2];

		return repG0Price + rep0LongPrice;
	}

	#Init_4(): void {
		this.#BaseInit();
		this.#Init_9();
		this.InitBitModels(this.#encoder._isMatch);
		this.InitBitModels(this.#encoder._isRep0Long);
		this.InitBitModels(this.#encoder._isRep);
		this.InitBitModels(this.#encoder._isRepG0);
		this.InitBitModels(this.#encoder._isRepG1);
		this.InitBitModels(this.#encoder._isRepG2);
		this.InitBitModels(this.#encoder._posEncoders);

		this.#Init_3();
		for (let i = 0; i < 4; ++i) {
			this.InitBitModels(this.#encoder._posSlotEncoder[i].Models);
		}

		this.#Init_2(this.#encoder._lenEncoder, 1 << this.#encoder._posStateBits);
		this.#Init_2(this.#encoder._repMatchLenEncoder, 1 << this.#encoder._posStateBits);
		this.InitBitModels(this.#encoder._posAlignEncoder.Models);

		this.#encoder._longestMatchWasFound = 0;
		this.#encoder._optimumEndIndex = 0;
		this.#encoder._optimumCurrentIndex = 0;
		this.#encoder._additionalOffset = 0;
	}

	#MovePos(num: number): void {
		if (num > 0) {
			this.#Skip(num);
			this.#compressor.chunker.encoder._additionalOffset += num;
		}
	}

	#ReadMatchDistances(): number {
		let lenRes = 0;
		const encoder = this.#compressor.chunker.encoder!;
		encoder._numDistancePairs = this.#GetMatches();

		if (encoder._numDistancePairs > 0) {
			lenRes = encoder._matchDistances[encoder._numDistancePairs - 2];

			if (lenRes == encoder._numFastBytes) {
				lenRes += this.#GetMatchLen(lenRes - 1, encoder._matchDistances[encoder._numDistancePairs - 1], 0x0111 - lenRes);
			}
		}

		encoder._additionalOffset += 1;

		return lenRes;
	}

	#ReleaseMFStream(): void {
		const encoder = this.#compressor.chunker.encoder;

		if (encoder._matchFinder && encoder._needReleaseMFStream) {
			encoder._matchFinder._stream = null;
			encoder._needReleaseMFStream = 0;
		}
	}

	#ReleaseStreams(): void {
		this.#ReleaseMFStream();
		this.#compressor.chunker.encoder._rangeEncoder.Stream = null;
	}

	#SetDictionarySize_0(dictionarySize: number): void {
		this.#encoder._dictionarySize = dictionarySize;

		let dicLogSize = 0;
		for (; dictionarySize > (1 << dicLogSize); ++dicLogSize);

		this.#encoder._distTableSize = dicLogSize * 2;
	}

	#SetMatchFinder(matchFinderIndex: number): void {
		const matchFinderIndexPrev = this.#encoder._matchFinderType;
		this.#encoder._matchFinderType = matchFinderIndex;

		if (this.#encoder._matchFinder && matchFinderIndexPrev != this.#encoder._matchFinderType) {
			this.#encoder._dictionarySizePrev = -1;
			this.#encoder._matchFinder = null;
		}
	}

	writeHeaderProperties(): void {
		const HEADER_SIZE = 0x5; // Total header size in bytes

		// First byte combines posStateBits, literalPosStateBits and literalContextBits
		// Format: (posStateBits * 5 + literalPosStateBits) * 9 + literalContextBits
		this.#encoder.properties[0] = (
			(this.#encoder._posStateBits * 5 + this.#encoder._numLiteralPosStateBits) * 9 + this.#encoder._numLiteralContextBits
		) & 0xFF; // Ensure byte-sized value

		// Next 4 bytes store dictionary size in little-endian format
		for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
			// Shift dictionary size right by appropriate number of bits and mask to byte
			this.#encoder.properties[1 + byteIndex] = (
				this.#encoder._dictionarySize >> (0x08 * byteIndex)
			) & 0xFF;
		}

		// Write the 5-byte header to output
		this.#write_0(
			this.#compressor.output,
			this.#encoder.properties,
			0, // Starting from index 0
			HEADER_SIZE,
		);
	}

	#WriteEndMarker(positionState: number): void {
		const encoder = this.#compressor.chunker.encoder;

		this.#Encode_3(
			encoder._isMatch,
			(encoder._state << 4) + positionState,
			1,
		);

		this.#Encode_3(
			encoder._isRep,
			encoder._state,
			0,
		);

		encoder._state = encoder._state < 7 ? 7 : 10;
		this.#Encode_0(encoder._lenEncoder, 0, positionState);
		let lenToPosState = this.GetLenToPosState(2);

		this.#Encode_2(
			encoder._posSlotEncoder[lenToPosState],
			0x3F,
		);

		this.#EncodeDirectBits(0x3FFFFFF, 0x1A);
		this.#ReverseEncode(0x0F);
	}

	GetPosSlot(pos: number): number {
		if (pos < 0x800) {
			return this.#gFastPos[pos];
		}

		if (pos < 0x200000) {
			return this.#gFastPos[pos >> 10] + 0x14;
		}

		return this.#gFastPos[pos >> 0x14] + 0x28;
	}

	GetPosSlot2(pos: number): number {
		if (pos < 0x20000) {
			return this.#gFastPos[pos >> 6] + 0x0C;
		}

		if (pos < 0x8000000) {
			return this.#gFastPos[pos >> 0x10] + 0x20;
		}

		return this.#gFastPos[pos >> 0x1A] + 0x34;
	}

	#Encode(
		encoder: LenEncoder,
		symbol: number,
		posState: number,
	): void {
		if (symbol < 0x08) {
			this.#Encode_3(encoder._choice, 0, 0);
			this.#Encode_2(encoder._lowCoder[posState], symbol);
		} else {
			symbol -= 0x08;
			this.#Encode_3(encoder._choice, 0, 1);

			if (symbol < 0x08) {
				this.#Encode_3(encoder._choice, 1, 0);
				this.#Encode_2(encoder._midCoder[posState], symbol);
			} else {
				this.#Encode_3(encoder._choice, 1, 1);
				this.#Encode_2(encoder._highCoder, symbol - 0x08);
			}
		}
	}

	#createLenEncoder(): LenEncoder {
		const encoder = {} as LenEncoder;

		encoder._choice = this.#initArray(2);
		encoder._lowCoder = this.#initArray(0x10);
		encoder._midCoder = this.#initArray(0x10);
		encoder._highCoder = this.#createBitTreeEncoder(0x08);

		for (let posState = 0; posState < 0x10; ++posState) {
			encoder._lowCoder[posState] = this.#createBitTreeEncoder(3);
			encoder._midCoder[posState] = this.#createBitTreeEncoder(3);
		}

		return encoder;
	}

	#Init_2(encoder: LenEncoder, numPosStates: number): void {
		this.InitBitModels(encoder._choice);

		for (let posState = 0; posState < numPosStates; ++posState) {
			this.InitBitModels(encoder._lowCoder[posState].Models);
			this.InitBitModels(encoder._midCoder[posState].Models);
		}

		this.InitBitModels(encoder._highCoder.Models);
	}

	#SetPrices(
		encoder: LenEncoder,
		posState: number,
		numSymbols: number,
		prices: number[],
		st: number,
	): void {
		let a0 = this.#probPrices[encoder._choice[0] >>> 2];
		let a1 = this.#probPrices[0x800 - encoder._choice[0] >>> 2];
		let b0 = a1 + this.#probPrices[encoder._choice[1] >>> 2];
		let b1 = a1 + this.#probPrices[0x800 - encoder._choice[1] >>> 2];

		let i = 0;
		for (i = 0; i < 8; ++i) {
			if (i >= numSymbols) {
				return;
			}
			prices[st + i] = a0 + this.#RangeCoder_Encoder_GetPrice_1(encoder._lowCoder[posState], i);
		}

		for (; i < 0x10; ++i) {
			if (i >= numSymbols) {
				return;
			}
			prices[st + i] = b0 + this.#RangeCoder_Encoder_GetPrice_1(encoder._midCoder[posState], i - 0x08);
		}

		for (; i < numSymbols; ++i) {
			prices[st + i] = b1 + this.#RangeCoder_Encoder_GetPrice_1(encoder._highCoder, i - 0x08 - 0x08);
		}
	}

	#Encode_0(
		encoder: LenEncoder,
		symbol: number,
		posState: number,
	): void {
		this.#Encode(encoder, symbol, posState);

		if ((encoder._counters[posState] -= 1) == 0) {
			this.#SetPrices(
				encoder,
				posState,
				encoder._tableSize,
				encoder._prices,
				posState * 0x110,
			);

			encoder._counters[posState] = encoder._tableSize;
		}
	}

	#createLenPriceTableEncoder(): LenEncoder {
		const encoder = this.#createLenEncoder();
		encoder._prices = [];
		encoder._counters = [];

		return encoder;
	}

	#RangeCoder_Encoder_GetPrice(
		encoder: LenEncoder,
		symbol: number,
		posState: number,
	): number {
		return encoder._prices[posState * 0x110 + symbol];
	}

	#LZMA_LenPriceTableEncoder_UpdateTablesUpdateTables(
		encoder: LenEncoder,
		numPosStates: number,
	): void {
		for (let posState = 0; posState < numPosStates; ++posState) {
			this.#SetPrices(
				encoder,
				posState,
				encoder._tableSize,
				encoder._prices,
				posState * 0x110,
			);

			encoder._counters[posState] = encoder._tableSize;
		}
	}

	#LZMA_Encoder_LiteralEncoder_Create(): void {
		const encoder = this.#encoder._literalEncoder;
		let i, numStates;

		if (
			encoder.m_Coders != null
			&& encoder.m_NumPrevBits == this.#encoder._numLiteralContextBits
			&& encoder.m_NumPosBits == this.#encoder._numLiteralPosStateBits
		) {
			return;
		}

		encoder.m_NumPosBits = this.#encoder._numLiteralPosStateBits;
		encoder.m_PosMask = (1 << this.#encoder._numLiteralPosStateBits) - 1;
		encoder.m_NumPrevBits = this.#encoder._numLiteralContextBits;

		numStates = 1 << encoder.m_NumPrevBits + encoder.m_NumPosBits;
		encoder.m_Coders = this.#initArray(numStates);

		for (i = 0; i < numStates; ++i) {
			encoder.m_Coders[i] = this.#createLiteralEncoderEncoder2();
		}
	}

	#LZMA_Encoder_GetSubCoder(pos: number, prevByte: number): LiteralDecoderEncoder2 {
		const literalEncoder = this.#compressor.chunker.encoder._literalEncoder;

		// Calculate position mask bits
		const posBits = pos & literalEncoder.m_PosMask;
		const posShifted = posBits << literalEncoder.m_NumPrevBits;

		// Calculate previous byte bits
		const prevByteShift = 0x08 - literalEncoder.m_NumPrevBits;
		const prevByteBits = (prevByte & 0xFF) >>> prevByteShift;

		// Combine position and prevByte bits to get final index
		const coderIndex = posShifted + prevByteBits;

		return literalEncoder.m_Coders[coderIndex];
	}

	#Init_3(): void {
		const totalStates = 1 << this.#encoder._literalEncoder.m_NumPrevBits
				+ this.#encoder._literalEncoder.m_NumPosBits;

		for (let i = 0; i < totalStates; ++i) {
			this.InitBitModels(this.#encoder._literalEncoder.m_Coders[i].m_Decoders);
		}
	}

	#Encode_1(
		encoder: LiteralDecoderEncoder2,
		symbol: number,
	): void {
		let bit, context = 1;

		for (let i = 7; i >= 0; --i) {
			bit = symbol >> i & 1;
			this.#Encode_3(encoder.m_Decoders, context, bit);
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
			bit = symbol >> i & 1;
			state = context;

			if (same) {
				matchBit = matchByte >> i & 1;
				state += 1 + matchBit << 0x08;
				same = matchBit === bit;
			}

			this.#Encode_3(encoder.m_Decoders, state, bit);
			context = context << 1 | bit;
		}
	}

	#createLiteralEncoderEncoder2(): LiteralDecoderEncoder2 {
		const encoder = {
			m_Decoders: this.#initArray(0x300),
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
				matchBit = matchByte >> i & 1;
				bit = symbol >> i & 1;
				price += this.GetPrice(
					encoder.m_Decoders[(1 + matchBit << 0x08) + context],
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
			price += this.GetPrice(encoder.m_Decoders[context], bit);
			context = context << 1 | bit;
		}

		return price;
	}

	#MakeAsChar(optimum: Optimum): void {
		optimum.BackPrev = -1;
		optimum.Prev1IsChar = 0;
	}

	#MakeAsShortRep(optimum: Optimum): void {
		optimum.BackPrev = 0;
		optimum.Prev1IsChar = 0;
	}

	#createBitTreeDecoder(numBitLevels: number): BitTree {
		return {
			NumBitLevels: numBitLevels,
			Models: this.#initArray(1 << numBitLevels),
		};
	}

	#RangeCoder_BitTreeDecoder_Decoder(rangeDecoder: BitTree): number {
		const _rangeDecoder = this.#decompressor.chunker.decoder.m_RangeDecoder;

		let bitIndex, m = 1;

		for (bitIndex = rangeDecoder.NumBitLevels; bitIndex != 0; bitIndex -= 1) {
			m = (m << 1) + this.#decodeBit(rangeDecoder.Models, m);
		}

		return m - (1 << rangeDecoder.NumBitLevels);
	}

	#ReverseDecode(): number {
		const positionAlignmentDecoder = this.#decompressor.chunker.decoder.m_PosAlignDecoder;

		let symbol = 0;
		for (
			let m = 1, bitIndex = 0, bit: number;
			bitIndex < positionAlignmentDecoder.NumBitLevels;
			++bitIndex
		) {
			bit = this.#decodeBit(positionAlignmentDecoder.Models, m);
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
		const rangeDecoder = this.#decompressor.chunker.decoder.m_RangeDecoder;
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
			NumBitLevels: numBitLevels,
			Models: this.#initArray(1 << numBitLevels),
		};
	}

	#Encode_2(
		encoder: BitTree,
		symbol: number,
	): void {
		let bit, bitIndex, m = 1;

		for (bitIndex = encoder.NumBitLevels; bitIndex != 0;) {
			bitIndex -= 1;
			bit = symbol >>> bitIndex & 1;
			this.#Encode_3(encoder.Models, m, bit);
			m = m << 1 | bit;
		}
	}

	#RangeCoder_Encoder_GetPrice_1(
		encoder: BitTree,
		symbol: number,
	): number {
		let bit, bitIndex, m = 1, price = 0;

		for (bitIndex = encoder.NumBitLevels; bitIndex != 0;) {
			bitIndex -= 1;
			bit = symbol >>> bitIndex & 1;
			price += this.GetPrice(encoder.Models[m], bit);
			m = (m << 1) + bit;
		}

		return price;
	}

	#ReverseEncode(symbol: number): void {
		const posAlignEncoder = this.#compressor.chunker.encoder._posAlignEncoder;
		let bit, m = 1;

		for (let i = 0; i < posAlignEncoder.NumBitLevels; ++i) {
			bit = symbol & 1;
			this.#Encode_3(posAlignEncoder.Models, m, bit);
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
			this.#Encode_3(this.#compressor.chunker.encoder._posEncoders, startIndex + m, bit);
			m = m << 1 | bit;
			symbol >>= 1;
		}
	}

	#ReverseGetPrice(
		encoder: BitTree,
		symbol: number,
	): number {
		let bit, m = 1, price = 0;

		for (let i = encoder.NumBitLevels; i != 0; i -= 1) {
			bit = symbol & 1;
			symbol >>>= 1;
			price += this.GetPrice(encoder.Models[m], bit);
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
			price += this.#probPrices[((Models[startIndex + m] - bit ^ -bit) & 0x7FF) >>> 2];
			m = m << 1 | bit;
		}

		return price;
	}

	#decodeBit(
		probs: number[],
		index: number,
	): 0 | 1 {
		const rangeDecoder = this.#decompressor.chunker.decoder.m_RangeDecoder;

		let newBound, prob = probs[index];
		newBound = (rangeDecoder.Range >>> 11) * prob;

		if ((rangeDecoder.Code ^ this.#MIN_INT32) < (newBound ^ this.#MIN_INT32)) {
			rangeDecoder.Range = newBound;
			probs[index] = toSigned16bit(prob + (0x800 - prob >>> 5));
			if (!(rangeDecoder.Range & this.#bitMaskForRange)) {
				rangeDecoder.Code = rangeDecoder.Code << 0x08 | this.#read(rangeDecoder.Stream);
				rangeDecoder.Range <<= 0x08;
			}

			return 0;
		} else {
			rangeDecoder.Range -= newBound;
			rangeDecoder.Code -= newBound;
			probs[index] = toSigned16bit(prob - (prob >>> 5));
			if (!(rangeDecoder.Range & this.#bitMaskForRange)) {
				rangeDecoder.Code = rangeDecoder.Code << 0x08 | this.#read(rangeDecoder.Stream);
				rangeDecoder.Range <<= 0x08;
			}

			return 1;
		}
	}

	#DecodeDirectBits(numTotalBits: number): number {
		const rangeDecoder = this.#decompressor.chunker.decoder.m_RangeDecoder;
		let result = 0;

		for (let i = numTotalBits; i != 0; i -= 1) {
			rangeDecoder.Range >>>= 1;
			let t = rangeDecoder.Code - rangeDecoder.Range >>> 0x1F;
			rangeDecoder.Code -= rangeDecoder.Range & t - 1;
			result = result << 1 | 1 - t;

			if (!(rangeDecoder.Range & this.#bitMaskForRange)) {
				rangeDecoder.Code = rangeDecoder.Code << 0x08 | this.#read(rangeDecoder.Stream);
				rangeDecoder.Range <<= 0x08;
			}
		}

		return result;
	}

	#Init_8(): void {
		this.#decoder.m_RangeDecoder.Code = 0;
		this.#decoder.m_RangeDecoder.Range = -1;

		for (let i = 0; i < 5; ++i) {
			this.#decoder.m_RangeDecoder.Code = this.#decoder.m_RangeDecoder.Code << 0x08
				| this.#read(this.#decoder.m_RangeDecoder.Stream);
		}
	}

	InitBitModels(probs: number[]): void {
		for (let i = probs.length - 1; i >= 0; --i) {
			probs[i] = 0x400;
		}
	}

	#Encode_3(
		probs: number[],
		index: number,
		symbol: number,
	): void {
		const rangeEncoder = this.#compressor.chunker.encoder._rangeEncoder;

		let newBound, prob = probs[index];
		newBound = (rangeEncoder.Range >>> 11) * prob;

		if (!symbol) {
			rangeEncoder.Range = newBound;
			probs[index] = toSigned16bit(prob + (0x800 - prob >>> 5));
		} else {
			rangeEncoder.Low = this.#add(
				rangeEncoder.Low,
				this.#and(this.#fromInt(newBound), [this.#_MAX_UINT32, 0]),
			);
			rangeEncoder.Range -= newBound;
			probs[index] = toSigned16bit(prob - (prob >>> 5));
		}

		if (!(rangeEncoder.Range & this.#bitMaskForRange)) {
			rangeEncoder.Range <<= 0x08;
			this.#ShiftLow();
		}
	}

	#EncodeDirectBits(
		valueToEncode: number,
		numTotalBits: number,
	): void {
		const rangeEncoder = this.#compressor.chunker.encoder._rangeEncoder;

		for (let i = numTotalBits - 1; i >= 0; i -= 1) {
			rangeEncoder.Range >>>= 1;
			if ((valueToEncode >>> i & 1) == 1) {
				rangeEncoder.Low = this.#add(rangeEncoder.Low, this.#fromInt(rangeEncoder.Range));
			}
			if (!(rangeEncoder.Range & this.#bitMaskForRange)) {
				rangeEncoder.Range <<= 0x08;
				this.#ShiftLow();
			}
		}
	}

	#GetProcessedSizeAdd(): [number, number] {
		const processedCacheSize = this.#add(
			this.#fromInt(this.#compressor.chunker.encoder._rangeEncoder._cacheSize),
			this.#compressor.chunker.encoder._rangeEncoder._position,
		);

		return this.#add(
			processedCacheSize,
			[4, 0],
		);
	}

	#Init_9(): void {
		this.#encoder._rangeEncoder._position = this.#P0_LONG_LIT;
		this.#encoder._rangeEncoder.Low = this.#P0_LONG_LIT;
		this.#encoder._rangeEncoder.Range = -1;
		this.#encoder._rangeEncoder._cacheSize = 1;
		this.#encoder._rangeEncoder._cache = 0;
	}

	#ShiftLow(): void {
		const rangeEncoder = this.#compressor.chunker.encoder._rangeEncoder;

		const LowHi = this.#lowBits_0(this.#shru(rangeEncoder.Low, 0x20));
		if (LowHi !== 0 || this.#compare(rangeEncoder.Low, [0xFF000000, 0]) < 0) {
			rangeEncoder._position = this.#add(
				rangeEncoder._position,
				this.#fromInt(rangeEncoder._cacheSize),
			);

			let temp = rangeEncoder._cache;
			do {
				this.#write(rangeEncoder.Stream, temp + LowHi);
				temp = 0xFF;
			} while ((rangeEncoder._cacheSize -= 1) != 0);

			rangeEncoder._cache = this.#lowBits_0(rangeEncoder.Low) >>> 0x18;
		}

		rangeEncoder._cacheSize += 1;
		rangeEncoder.Low = this.#shl(this.#and(rangeEncoder.Low, [0xFFFFFF, 0]), 0x08);
	}

	GetPrice(Prob: number, symbol: number): number {
		return this.#probPrices[
			((Prob - symbol ^ -symbol) & 0x7FF) >>> 2
		];
	}

	#decodeString(utf: number[]): string {
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
					return utf;
				}
				y = utf[++i] & 0xFF;
				if ((y & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
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

	encodeString(inputString: string): number[]  {
		let ch, chars = [], elen = 0, l = inputString.length;

	  this.#getChars(inputString, 0, l, chars, 0);

		// Add extra spaces in the array to break up the unicode symbols.
		for (let i = 0; i < l; ++i) {
			ch = chars[i];
			if (ch >= 1 && ch <= 0x7F) {
				++elen;
			} else if (!ch || ch >= 0x80 && ch <= 0x7FF) {
				elen += 2;
			} else {
				elen += 3;
			}
		}

		const data = [];
		elen = 0;
		for (let i = 0; i < l; ++i) {
			ch = chars[i];
			if (ch >= 1 && ch <= 0x7F) {
				data[elen++] = toSigned8bit(ch);
			} else if (!ch || (ch >= 0x80 && ch <= 0x7FF)) {
				data[elen++] = toSigned8bit(0xC0 | (ch >> 6 & 0x1F));
				data[elen++] = toSigned8bit(0x80 | (ch & 0x3F));
			} else {
				data[elen++] = toSigned8bit(0xE0 | (ch >> 0x0C) & 0x0F);
				data[elen++] = toSigned8bit(0x80 | ((ch >> 6) & 0x3F));
				data[elen++] = toSigned8bit(0x80 | (ch & 0x3F));
			}
		}

		return data;
	}

	public compress(
		data: Uint8Array | ArrayBuffer,
		mode: keyof typeof this.CompressionModes = 5,
	): number[] {
		const compressionMode = this.CompressionModes[mode];

		this.#byteArrayCompressor(
			data,
			compressionMode,
		);

		while (this.#processChunkEncode());

		const compressedByteArray = this.#toByteArray(this.#compressor.output);
		return compressedByteArray;
	}

  public compressString(
		data: string,
		mode: keyof typeof this.CompressionModes = 5,
	): number[] {
		const encodedData = this.encodeString(data);
		return compress(encodedData, mode);
	}

	public decompress(
		bytearray: Uint8Array | ArrayBuffer,
	): number[] {
		this.#byteArrayDecompressor(bytearray);

		while (this.#processChunkDecode());

		const decodedByteArray = this.#toByteArray(this.#decompressor.output);
		return decodedByteArray;
	}

	public decompressString(
		bytearray: Uint8Array | ArrayBuffer,
	): string {
		this.#byteArrayDecompressor(bytearray);

		while (this.#processChunkDecode());

		const decodedByteArray = this.#toByteArray(this.#decompressor.output);
		const decoded = this.#decodeString(decodedByteArray);
		return decoded;
	}
}

/**
 * Compresses data using LZMA algorithm
 *
 * @param data Data to compress - can be Uint8Array or ArrayBuffer
 * @param mode Compression mode (1-9), defaults to 5
 * @returns Compressed data as a byte array
 */
export function compress(
	data: Uint8Array | ArrayBuffer,
	mode: keyof LZMA["CompressionModes"] = 5,
): Uint8Array {
	const lzma = new LZMA();
	return new Uint8Array(lzma.compress(data, mode));
}

/**
 * Compresses data using LZMA algorithm
 *
 * @param data String to compress
 * @param mode Compression mode (1-9), defaults to 5
 * @returns Compressed data as byte array
 */
export function compressString(
	data: string,
	mode: keyof LZMA["CompressionModes"] = 5,
): Uint8Array {
	const lzma = new LZMA();
	return lzma.compressString(data, mode);
}

/**
 * Decompresses LZMA compressed data
 *
 * @param data Compressed data as Uint8Array or ArrayBuffer
 * @returns Decompressed data
 */
export function decompress(data: Uint8Array | ArrayBuffer): Uint8Array {
	const lzma = new LZMA();
	return new Uint8Array(lzma.decompress(data));
}

/**
 * Decompresses LZMA compressed data
 *
 * @param data Compressed data as Uint8Array or ArrayBuffer
 * @returns Decompressed data as string
 */
export function decompressString(data: Uint8Array | ArrayBuffer): string {
	const lzma = new LZMA();
	return lzma.decompressString(data);
}
