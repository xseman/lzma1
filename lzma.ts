import {
	bitTreeDecoder,
	bitTreeEncoder,
	bitTreeEncoderGetPrice,
	reverseDecode,
	reverseDecodeWithModels,
	reverseEncode,
	reverseEncodeWithModels,
	reverseGetPrice,
	reverseGetPriceWithModels,
} from "./bit-tree.js";
import {
	arraycopy,
	getChars,
	read,
	toByteArray,
	write,
	write_0,
} from "./io-utils.js";
import {
	codeOneBlock,
	codeOneChunk,
} from "./lzma-core.js";
import {
	getMatchesWithEncoder,
	moveMatchFinderBlock,
	readMatchFinderBlock,
	setMatchFinderType,
	skipMatchFinderBytes,
} from "./match-finder.js";
import { getOptimum } from "./optimum.js";
import {
	createBitTreeDecoder,
	createBitTreeEncoder,
	createFastPos,
	createProbPrices,
} from "./probability.js";
import {
	getBitPrice,
	lenEncoderGetPrice,
	literalEncoderGetPrice,
} from "./range-coder.js";
import {
	add,
	and,
	compare,
	fromInt,
	initArray,
	InitBitModels,
	lowBits_0,
	LZMA_CONSTANTS,
	shl,
	shr,
	shru,
} from "./utils.js";

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
export interface BaseStream {
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
export interface BufferWithCount {
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
export interface BitTree {
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
export interface LiteralDecoderEncoder2 {
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
export type LenEncoder = LenCoder & {
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
export interface Optimum {
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
export interface MatchFinder {
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
export interface Encoder {
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
export interface Decoder extends Chunker {
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
	readonly #N1_LONG_LIT: [number, number];
	readonly #MIN_VALUE: [number, number];
	readonly #kIfinityPrice = 0xFFFFFFF; // 2^28 - 1

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
		this.#N1_LONG_LIT = [LZMA_CONSTANTS._MAX_UINT32, -LZMA_CONSTANTS.MAX_UINT32];
		this.#MIN_VALUE = [0, LZMA_CONSTANTS.MIN_INT64];

		this.#encoder = this.#initEncoder();
		this.#decoder = this.#initDecoder();
		this.#probPrices = createProbPrices();
		this.#gFastPos = createFastPos();
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
			_lenEncoder: this.#createLenPriceTableEncoder(),
			_repMatchLenEncoder: this.#createLenPriceTableEncoder(),
			_literalEncoder: {} as LiteralEncoder,
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
			matchDecoders: initArray(0xC0),
			repDecoders: initArray(0x0C),
			repG0Decoders: initArray(0x0C),
			repG1Decoders: initArray(0x0C),
			repG2Decoders: initArray(0x0C),
			rep0LongDecoders: initArray(0xC0),
			posSlotDecoders: initArray(4),
			posDecoders: initArray(0x72),
			posAlignDecoder: createBitTreeDecoder(0x04),
			lenDecoder: this.#createLenDecoder(),
			repLenDecoder: this.#createLenDecoder(),
			literalDecoder: {} as LiteralCoder,
		} as unknown as Decoder;

		for (let i = 0; i < 4; ++i) {
			decoder.posSlotDecoders[i] = createBitTreeDecoder(0x06);
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
				buf: initArray(0x20),
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
				buf: initArray(0x20),
				count: 0x00,
			},
		};
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
		arraycopy(srcBuf, stream.pos, buffer, off, len);
		stream.pos += len;

		return len;
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
		if (compare(len, this.#N1_LONG_LIT) < 0) {
			throw new Error("invalid length " + len);
		}

		this.#compressor.length_0 = len;
		this.#Encoder();

		this.#configure(mode);
		this.writeHeaderProperties();

		for (let i = 0; i < 64; i += 8) {
			write(
				this.#compressor.output,
				lowBits_0(shr(len, i)) & 0xFF,
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
		this.#encoder!.nowPos64 = LZMA_CONSTANTS.P0_LONG_LIT;

		// Create new chunker with configured encoder
		this.#compressor.chunker = {
			encoder: this.#encoder,
			decoder: null,
			alive: 1,
		} as CompressionContext["chunker"];
	}

	#byteArrayCompressor(data: number[] | Uint8Array | ArrayBuffer, mode: Mode): void {
		this.#compressor.output = {
			buf: initArray(0x20),
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
			fromInt(data instanceof ArrayBuffer ? data.byteLength : data.length),
			mode,
		);
	}

	#initDecompression(input: BaseStream): void {
		let hex_length = "",
			properties = [],
			r: number | string,
			tmp_length: number;

		for (let i = 0; i < 5; ++i) {
			r = read(input);
			if (r == -1) {
				throw new Error("truncated input");
			}
			properties[i] = toSigned8bit(r);
		}

		if (!this.#SetDecoderProperties(properties)) {
			throw new Error("corrupted input");
		}

		for (let i = 0; i < 64; i += 8) {
			r = read(input);
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
			if (tmp_length > LZMA_CONSTANTS._MAX_UINT32) {
				this.#compressor.length_0 = this.#N1_LONG_LIT;
			} else {
				this.#compressor.length_0 = fromInt(tmp_length);
			}
		}

		this.#decompressor.chunker = this.#CodeInChunks(
			input,
			this.#compressor.length_0,
		);
	}

	#byteArrayDecompressor(data: Uint8Array | ArrayBuffer): void {
		this.#decompressor.output = {
			buf: initArray(0x20),
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
			this.#encoder!._matchFinder!._bufferBase == null
			|| this.#encoder!._matchFinder!._blockSize != blockSize
		) {
			this.#encoder!._matchFinder!._bufferBase = initArray(blockSize);
			this.#encoder!._matchFinder!._blockSize = blockSize;
		}

		this.#encoder!._matchFinder!._pointerToLastSafePosition = this.#encoder!._matchFinder!._blockSize - keepSizeAfter;
	}

	#GetIndexByte(index: number): number {
		return this.#compressor.chunker.encoder!._matchFinder!._bufferBase[
			this.#compressor.chunker.encoder!._matchFinder!._bufferOffset
			+ this.#compressor.chunker.encoder!._matchFinder!._pos
			+ index
		];
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

	#MovePos_1(): void {
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder!;
		let pointerToPostion;

		matchFinder._pos += 1;

		if (matchFinder._pos > matchFinder._posLimit) {
			pointerToPostion = matchFinder._bufferOffset + matchFinder._pos;
			if (pointerToPostion > matchFinder._pointerToLastSafePosition) {
				moveMatchFinderBlock(matchFinder);
			}

			readMatchFinderBlock(
				matchFinder,
				(offset: number, length: number) => this.#read_0(offset, length),
			);
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

		if (dictionarySize < LZMA_CONSTANTS.dictionarySizeThreshold) {
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
				this.#encoder!._matchFinder!._son = initArray(
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
				this.#encoder!._matchFinder!._hash = initArray(this.#encoder!._matchFinder!._hashSizeSum = hs);
			}
		}
	}

	#GetMatches(): number {
		const matchFinder = this.#compressor.chunker.encoder!._matchFinder!;
		const distances = this.#compressor.chunker.encoder!._matchDistances;

		return getMatchesWithEncoder(matchFinder, distances, () => this.#MovePos_0());
	}

	#Init_5(): void {
		this.#compressor.chunker.encoder!._matchFinder!._bufferOffset = 0;
		this.#compressor.chunker.encoder!._matchFinder!._pos = 0;
		this.#compressor.chunker.encoder!._matchFinder!._streamPos = 0;
		this.#compressor.chunker.encoder!._matchFinder!._streamEndWasReached = 0;
		readMatchFinderBlock(
			this.#compressor.chunker.encoder!._matchFinder!,
			(offset: number, length: number) => this.#read_0(offset, length),
		);

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

		if (matchFinder._pos == LZMA_CONSTANTS.dictionarySizeThreshold) {
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
			outWin._buffer = initArray(windowSize);
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

		write_0(
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

	#GetByte(distance: number) {
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

		const isOutputComplete = (compare(decoder.outSize, LZMA_CONSTANTS.P0_LONG_LIT) >= 0)
			&& (compare(decoder.nowPos64, decoder.outSize) >= 0);

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
		this.#decoder.nowPos64 = LZMA_CONSTANTS.P0_LONG_LIT;
		this.#decoder.prevByte = 0;

		this.#decoder.decoder = this.#decoder;
		this.#decoder.encoder = null;
		this.#decoder.alive = 1;

		return this.#decoder;
	}

	#CodeOneChunk(): 0 | 1 | -1 {
		const decoder = this.#decompressor.chunker.decoder;

		return codeOneChunk(
			decoder,
			(models, index) => this.#decodeBit(models, index) === 1,
			(pos, prevByte) => this.#GetDecoder(pos, prevByte),
			(decoder2) => this.#DecodeNormal(decoder2),
			(decoder2, matchByte) => this.#DecodeWithMatchByte(decoder2, matchByte),
			(distance) => this.#GetByte(distance),
			(byte) => this.#PutByte(byte),
			(decoder, posState) => this.#Decode(decoder, posState),
			(state) => this.StateUpdateChar(state),
			(bitTree) => this.#RangeCoder_BitTreeDecoder_Decoder(bitTree),
			(models, startIndex, numDirectBits) => this.reverseDecode(models, startIndex, numDirectBits),
			(numDirectBits) => this.#DecodeDirectBits(numDirectBits),
			() => this.#ReverseDecode(),
			(len) => this.#CopyBlock(len),
			(len) => this.GetLenToPosState(len),
		);
	}

	#Init_1(): void {
		this.#decoder.outWin._streamPos = 0;
		this.#decoder.outWin._pos = 0;

		InitBitModels(this.#decoder.matchDecoders);
		InitBitModels(this.#decoder.rep0LongDecoders);
		InitBitModels(this.#decoder.repDecoders);
		InitBitModels(this.#decoder.repG0Decoders);
		InitBitModels(this.#decoder.repG1Decoders);
		InitBitModels(this.#decoder.repG2Decoders);
		InitBitModels(this.#decoder.posDecoders);

		this.#Init_0(this.#decoder.literalDecoder);

		for (let i = 0; i < 4; ++i) {
			InitBitModels(this.#decoder.posSlotDecoders[i].models);
		}

		this.#Init(this.#decoder.lenDecoder);
		this.#Init(this.#decoder.repLenDecoder);
		InitBitModels(this.#decoder.posAlignDecoder.models);
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

	#SetLcPb(lc: number, pb: number): 0 | 1 {
		if (lc > 0x08 || pb > 4) {
			return 0;
		}

		this.#Create_0(0, lc);
		let numPosStates = 0x01 << pb;

		this.#Create(this.#decoder.lenDecoder, numPosStates);
		this.#Create(this.#decoder.repLenDecoder, numPosStates);

		this.#decoder.posStateMask = numPosStates - 1;

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
			decoder.lowCoder[decoder.numPosStates] = createBitTreeDecoder(3);
			decoder.midCoder[decoder.numPosStates] = createBitTreeDecoder(3);
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
			choice: initArray(2),
			lowCoder: [] as BitTree[],
			midCoder: [] as BitTree[],
			highCoder: createBitTreeDecoder(0x08),
			numPosStates: 0x00,
		};

		return decoder;
	}

	#Init(decoder: LenDecoder): void {
		InitBitModels(decoder.choice);

		for (let posState = 0; posState < decoder.numPosStates; ++posState) {
			InitBitModels(decoder.lowCoder[posState].models);
			InitBitModels(decoder.midCoder[posState].models);
		}

		InitBitModels(decoder.highCoder.models);
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

		numStates = 1 << this.#decoder.literalDecoder.numPrevBits + this.#decoder.literalDecoder.numPosBits;

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
		const prevBitsMask = (prevByte & 0xFF) >>> (0x08 - literalDecoder.numPrevBits);
		const index = (positionMask << literalDecoder.numPrevBits) + prevBitsMask;

		// Return decoder at calculated index
		return literalDecoder.coders[index];
	}

	#Init_0(decoder: LiteralCoder): void {
		let i, numStates;
		numStates = 1 << decoder.numPrevBits + decoder.numPosBits;

		for (i = 0; i < numStates; ++i) {
			InitBitModels(decoder.coders[i].decoders);
		}
	}

	#DecodeNormal(decoder: LiteralDecoderEncoder2): number {
		let symbol = 1;
		do {
			symbol = symbol << 1 | this.#decodeBit(decoder.decoders, symbol);
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
				encoder!.decoders,
				(1 + matchBit << 0x08) + symbol,
			);
			symbol = symbol << 1 | bit;

			if (matchBit != bit) {
				while (symbol < 0x100) {
					symbol = symbol << 1 | this.#decodeBit(encoder!.decoders, symbol);
				}
				break;
			}
		} while (symbol < 0x100);

		return toSigned8bit(symbol);
	}

	#createLiteralDecoderEncoder2(): LiteralDecoderEncoder2 {
		const literalDecoder = {
			decoders: initArray(0x300),
		};

		return literalDecoder;
	}

	#BaseInit(): void {
		this.#encoder!._state = 0;
		this.#encoder!._previousByte = 0;

		for (let i = 0; i < 4; ++i) {
			this.#encoder!._repDistances[i] = 0;
		}
	}

	#CodeOneBlock(): void {
		codeOneBlock(
			this.#compressor.chunker.encoder!,
			this.#probPrices,
			this.#GetIndexByte.bind(this),
			this.#GetMatchLen.bind(this),
			this.#GetNumAvailableBytes.bind(this),
			this.#GetOptimum.bind(this),
			this.#ReadMatchDistances.bind(this),
			this.#Flush.bind(this),
			this.#Encode_3.bind(this),
			this.#Encode_0.bind(this),
			this.#Encode_1.bind(this),
			this.#Encode_2.bind(this),
			this.#EncodeDirectBits.bind(this),
			this.#EncodeMatched.bind(this),
			this.#ReverseEncode.bind(this),
			this.ReverseEncode.bind(this),
			this.#LZMA_Encoder_GetSubCoder.bind(this),
			this.StateUpdateChar.bind(this),
			this.GetLenToPosState.bind(this),
			this.GetPosSlot.bind(this),
			this.#FillDistancesPrices.bind(this),
			this.#FillAlignPrices.bind(this),
			this.#GetProcessedSizeAdd.bind(this),
			this.#Init_5.bind(this),
		);
	}

	#Create_2(): void {
		let binTree, numHashBytes;

		if (!this.#encoder!._matchFinder) {
			binTree = {} as MatchFinder;
			numHashBytes = 4;

			if (!this.#encoder!._matchFinderType) {
				numHashBytes = 2;
			}

			setMatchFinderType(binTree, numHashBytes);
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
			this.#encoder!._posSlotEncoder[i] = createBitTreeEncoder(6);
		}
	}

	#FillAlignPrices(encoder: Encoder): void {
		for (let i = 0; i < 0x10; ++i) {
			encoder!._alignPrices[i] = this.#ReverseGetPrice(encoder!._posAlignEncoder, i);
		}

		encoder!._alignPriceCount = 0;
	}

	#FillDistancesPrices(encoder: Encoder): void {
		let baseVal, bitTreeEncoder: BitTree, footerBits, posSlot, st, st2;

		for (let i = 0x04; i < 0x80; ++i) {
			posSlot = this.GetPosSlot(i);
			footerBits = (posSlot >> 1) - 1;
			baseVal = (2 | posSlot & 1) << footerBits;

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

			st2 = lenToPosState * 0x80;
			for (let i = 0; i < 4; ++i) {
				encoder!._distancesPrices[st2 + i] = encoder!._posSlotPrices[st + i];
			}

			for (let i = 4; i < 0x80; ++i) {
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

	#GetOptimum(position: number): number {
		return getOptimum(
			this.#compressor.chunker.encoder!,
			this.#probPrices,
			position,
			this.#GetIndexByte.bind(this),
			this.#GetMatchLen.bind(this),
			this.#GetNumAvailableBytes.bind(this),
			this.#ReadMatchDistances.bind(this),
			this.#MovePos.bind(this),
			this.#LZMA_Encoder_GetSubCoder.bind(this),
			this.#RangeCoder_Encoder_GetPrice_0.bind(this),
			this.#RangeCoder_Encoder_GetPrice.bind(this),
			this.#LZMA_Encoder_GetPosLenPrice.bind(this),
			this.StateUpdateChar.bind(this),
			this.#kIfinityPrice,
		);
	}

	#LZMA_Encoder_GetPosLenPrice(
		pos: number,
		len: number,
		posState: number,
	): number {
		const encoder = this.#compressor.chunker.encoder;
		let price: number, lenToPosState = this.GetLenToPosState(len);

		if (pos < 0x80) {
			price = encoder!._distancesPrices[lenToPosState * 0x80 + pos];
		} else {
			const position = (lenToPosState << 6) + this.GetPosSlot2(pos);
			price = encoder!._posSlotPrices[position] + encoder!._alignPrices[pos & 0x0F];
		}

		return price + this.#RangeCoder_Encoder_GetPrice(
			encoder!._lenEncoder,
			len - 2,
			posState,
		);
	}

	#Init_4(): void {
		this.#BaseInit();
		this.#Init_9();
		InitBitModels(this.#encoder!._isMatch);
		InitBitModels(this.#encoder!._isRep0Long);
		InitBitModels(this.#encoder!._isRep);
		InitBitModels(this.#encoder!._isRepG0);
		InitBitModels(this.#encoder!._isRepG1);
		InitBitModels(this.#encoder!._isRepG2);
		InitBitModels(this.#encoder!._posEncoders);

		this.#Init_3();
		for (let i = 0; i < 4; ++i) {
			InitBitModels(this.#encoder!._posSlotEncoder[i].models);
		}

		this.#Init_2(this.#encoder!._lenEncoder, 1 << this.#encoder!._posStateBits);
		this.#Init_2(this.#encoder!._repMatchLenEncoder, 1 << this.#encoder!._posStateBits);
		InitBitModels(this.#encoder!._posAlignEncoder.models);

		this.#encoder!._longestMatchWasFound = 0;
		this.#encoder!._optimumEndIndex = 0;
		this.#encoder!._optimumCurrentIndex = 0;
		this.#encoder!._additionalOffset = 0;
	}

	#MovePos(num: number): void {
		if (num > 0) {
			skipMatchFinderBytes(
				this.#compressor.chunker.encoder!._matchFinder!,
				num,
				() => this.#MovePos_0(),
			);
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
		write_0(
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
			this.#Encode_3(encoder!.choice, 0, 0);
			this.#Encode_2(encoder!.lowCoder[posState], symbol);
		} else {
			symbol -= 0x08;
			this.#Encode_3(encoder!.choice, 0, 1);

			if (symbol < 0x08) {
				this.#Encode_3(encoder!.choice, 1, 0);
				this.#Encode_2(encoder!.midCoder[posState], symbol);
			} else {
				this.#Encode_3(encoder!.choice, 1, 1);
				this.#Encode_2(encoder!.highCoder, symbol - 0x08);
			}
		}
	}

	#createLenEncoder(): LenEncoder {
		const encoder = {} as LenEncoder;

		encoder!.choice = initArray(2);
		encoder!.lowCoder = [] as BitTree[];
		encoder!.midCoder = [] as BitTree[];
		encoder!.highCoder = createBitTreeEncoder(0x08);

		for (let posState = 0; posState < 0x10; ++posState) {
			encoder!.lowCoder[posState] = createBitTreeEncoder(3);
			encoder!.midCoder[posState] = createBitTreeEncoder(3);
		}

		return encoder;
	}

	#Init_2(encoder: LenEncoder, numPosStates: number): void {
		InitBitModels(encoder!.choice);

		for (let posState = 0; posState < numPosStates; ++posState) {
			InitBitModels(encoder!.lowCoder[posState].models);
			InitBitModels(encoder!.midCoder[posState].models);
		}

		InitBitModels(encoder!.highCoder.models);
	}

	#SetPrices(
		encoder: LenEncoder,
		posState: number,
		numSymbols: number,
		prices: number[],
		st: number,
	): void {
		let a0 = this.#probPrices[encoder!.choice[0] >>> 2];
		let a1 = this.#probPrices[0x800 - encoder!.choice[0] >>> 2];
		let b0 = a1 + this.#probPrices[encoder!.choice[1] >>> 2];
		let b1 = a1 + this.#probPrices[0x800 - encoder!.choice[1] >>> 2];

		let i = 0;
		for (i = 0; i < 8; ++i) {
			if (i >= numSymbols) {
				return;
			}
			prices[st + i] = a0 + this.#RangeCoder_Encoder_GetPrice_1(encoder!.lowCoder[posState], i);
		}

		for (; i < 0x10; ++i) {
			if (i >= numSymbols) {
				return;
			}
			prices[st + i] = b0 + this.#RangeCoder_Encoder_GetPrice_1(encoder!.midCoder[posState], i - 0x08);
		}

		for (; i < numSymbols; ++i) {
			prices[st + i] = b1 + this.#RangeCoder_Encoder_GetPrice_1(encoder!.highCoder, i - 0x08 - 0x08);
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
				posState * 0x110,
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
		return lenEncoderGetPrice(encoder, symbol, posState);
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
				posState * 0x110,
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

		numStates = 1 << encoder!.numPrevBits + encoder!.numPosBits;
		encoder!.coders = [];

		for (i = 0; i < numStates; ++i) {
			encoder!.coders[i] = this.#createLiteralDecoderEncoder2();
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
		const totalStates = 1 << this.#encoder!._literalEncoder.numPrevBits
				+ this.#encoder!._literalEncoder.numPosBits;

		for (let i = 0; i < totalStates; ++i) {
			InitBitModels(this.#encoder!._literalEncoder.coders[i].decoders);
		}
	}

	#Encode_1(
		encoder: LiteralDecoderEncoder2,
		symbol: number,
	): void {
		let bit, context = 1;

		for (let i = 7; i >= 0; --i) {
			bit = symbol >> i & 1;
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
			bit = symbol >> i & 1;
			state = context;

			if (same) {
				matchBit = matchByte >> i & 1;
				state += 1 + matchBit << 0x08;
				same = matchBit === bit;
			}

			this.#Encode_3(encoder!.decoders, state, bit);
			context = context << 1 | bit;
		}
	}

	#createLiteralEncoderEncoder2(): LiteralDecoderEncoder2 {
		const encoder = {
			decoders: initArray(0x300),
		} as LiteralDecoderEncoder2;

		return encoder;
	}

	#RangeCoder_Encoder_GetPrice_0(
		pos: number,
		prevByte: number,
		matchMode: boolean,
		matchByte: number,
		symbol: number,
	): number {
		const encoder = this.#LZMA_Encoder_GetSubCoder(pos, prevByte);
		return literalEncoderGetPrice(encoder, symbol, matchMode, matchByte, (prob, symbol) => this.GetPrice(prob, symbol));
	}

	#RangeCoder_BitTreeDecoder_Decoder(rangeDecoder: BitTree): number {
		return bitTreeDecoder(rangeDecoder, (probs, index) => this.#decodeBit(probs, index));
	}

	#ReverseDecode(): number {
		const positionAlignmentDecoder = this.#decompressor.chunker.decoder.posAlignDecoder;
		return reverseDecode(positionAlignmentDecoder, (probs, index) => this.#decodeBit(probs, index));
	}

	reverseDecode(
		Models: number[],
		startIndex: number,
		NumBitLevels: number,
	): number {
		return reverseDecodeWithModels(Models, startIndex, NumBitLevels, (probs, index) => this.#decodeBit(probs, index));
	}

	#Encode_2(
		encoder: BitTree,
		symbol: number,
	): void {
		bitTreeEncoder(encoder, symbol, (models, index, bit) => this.#Encode_3(models, index, bit));
	}

	#RangeCoder_Encoder_GetPrice_1(
		encoder: BitTree,
		symbol: number,
	): number {
		return bitTreeEncoderGetPrice(encoder, symbol, (prob, symbol) => this.GetPrice(prob, symbol));
	}

	#ReverseEncode(symbol: number): void {
		const posAlignEncoder = this.#compressor.chunker.encoder!._posAlignEncoder;
		reverseEncode(posAlignEncoder, symbol, (models, index, bit) => this.#Encode_3(models, index, bit));
	}

	ReverseEncode(
		startIndex: number,
		NumBitLevels: number,
		symbol: number,
	): void {
		reverseEncodeWithModels(
			this.#compressor.chunker.encoder!._posEncoders,
			startIndex,
			NumBitLevels,
			symbol,
			(models, index, bit) => this.#Encode_3(models, index, bit),
		);
	}

	#ReverseGetPrice(
		encoder: BitTree,
		symbol: number,
	): number {
		return reverseGetPrice(encoder, symbol, (prob, symbol) => this.GetPrice(prob, symbol));
	}

	ReverseGetPrice(
		Models: number[],
		startIndex: number,
		NumBitLevels: number,
		symbol: number,
	): number {
		return reverseGetPriceWithModels(Models, startIndex, NumBitLevels, symbol, this.#probPrices);
	}

	#decodeBit(
		probs: number[],
		index: number,
	): 0 | 1 {
		const rangeDecoder = this.#decompressor.chunker.decoder.rangeDecoder;

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

	#DecodeDirectBits(numTotalBits: number): number {
		const rangeDecoder = this.#decompressor.chunker.decoder.rangeDecoder;
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

	#Init_8(): void {
		this.#decoder.rangeDecoder.code = 0;
		this.#decoder.rangeDecoder.rrange = -1;

		for (let i = 0; i < 5; ++i) {
			this.#decoder.rangeDecoder.code = this.#decoder.rangeDecoder.code << 0x08
				| read(this.#decoder.rangeDecoder.stream!);
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
		const rangeEncoder = this.#compressor.chunker.encoder!._rangeEncoder;

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
				rangeEncoder.low = add(rangeEncoder.low, fromInt(rangeEncoder.rrange));
			}
			if (!(rangeEncoder.rrange & LZMA_CONSTANTS.bitMaskForRange)) {
				rangeEncoder.rrange <<= 0x08;
				this.#ShiftLow();
			}
		}
	}

	#GetProcessedSizeAdd(): [number, number] {
		const processedCacheSize = add(
			fromInt(this.#compressor.chunker.encoder!._rangeEncoder.cacheSize),
			this.#compressor.chunker.encoder!._rangeEncoder.position,
		);

		return add(
			processedCacheSize,
			[4, 0],
		);
	}

	#Init_9(): void {
		this.#encoder!._rangeEncoder.position = LZMA_CONSTANTS.P0_LONG_LIT;
		this.#encoder!._rangeEncoder.low = LZMA_CONSTANTS.P0_LONG_LIT;
		this.#encoder!._rangeEncoder.rrange = -1;
		this.#encoder!._rangeEncoder.cacheSize = 1;
		this.#encoder!._rangeEncoder.cache = 0;
	}

	#ShiftLow(): void {
		const rangeEncoder = this.#compressor.chunker.encoder!._rangeEncoder;

		const LowHi = lowBits_0(shru(rangeEncoder.low, 0x20));
		if (LowHi !== 0 || compare(rangeEncoder.low, [0xFF000000, 0]) < 0) {
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

	GetPrice(Prob: number, symbol: number): number {
		return getBitPrice(this.#probPrices, Prob, symbol);
	}

	#decodeString(utf: number[]): string {
		let j = 0, x, y, z, l = utf.length, buf = [], charCodes = [];

		for (let i = 0; i < l; ++i, ++j) {
			x = utf[i] & 0xFF;
			if (!(x & 0x80)) {
				if (!x) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return String.fromCharCode(...utf);
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
					return String.fromCharCode(...utf);
				}
				y = utf[++i] & 0xFF;
				if ((y & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be converted to
					// a string, so just send it back.
					return String.fromCharCode(...utf);
				}
				z = utf[++i] & 0xFF;
				if ((z & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be converted to
					// a string, so just send it back.
					return String.fromCharCode(...utf);
				}
				charCodes[j] = ((x & 0x0F) << 0x0C) | ((y & 0x3F) << 6) | (z & 0x3F);
			} else {
				// It appears that this is binary data, so it cannot be converted to
				// a string, so just send it back.
				return String.fromCharCode(...utf);
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

		getChars(inputString, 0, l, chars, 0);

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

		const compressedByteArray = toByteArray(this.#compressor.output);
		return compressedByteArray;
	}

	public compressString(
		data: string,
		mode: keyof typeof this.CompressionModes = 5,
	): number[] {
		const encodedData = this.encodeString(data);
		return Array.from(this.compress(new Uint8Array(encodedData), mode));
	}

	public decompress(
		bytearray: Uint8Array | ArrayBuffer,
	): number[] {
		this.#byteArrayDecompressor(bytearray);

		while (this.#processChunkDecode());

		const decodedByteArray = toByteArray(this.#decompressor.output);
		return decodedByteArray;
	}

	public decompressString(
		bytearray: Uint8Array | ArrayBuffer,
	): string {
		this.#byteArrayDecompressor(bytearray);

		while (this.#processChunkDecode());

		const decodedByteArray = toByteArray(this.#decompressor.output);
		const decoded = this.#decodeString(decodedByteArray);
		return decoded;
	}
}
