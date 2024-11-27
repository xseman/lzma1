interface Mode {
	searchDepth: number;
	filterStrength: number;
	modeIndex: number;
}

interface BitTreeBase {
	NumBitLevels: number;
	Models: number[];
}

type BitTreeDecoder = BitTreeBase;
type BitTreeEncoder = BitTreeBase;

interface BaseStream {
	buf: RelativeIndexable<number> | Uint8Array | ArrayBuffer | number[];
	pos: number;
	count: number;
}

interface BaseWindow {
	_streamPos: number;
	_pos: number;
	_buffer: number[];
	_stream: BaseStream;
}

interface BaseRangeCoder {
	Stream: BaseStream;
}

interface RangeDecoder extends BaseRangeCoder {
	Code: number;
	Range: number;
}

interface RangeEncoder extends BaseRangeCoder {
	Low: [number, number];
	Range: number;
	_cacheSize: number;
	_cache: number;
	_position: [number, number];
}

interface OutWindow extends BaseWindow {
	_windowSize: number;
}

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

	_rangeEncoder: {
		_cache: number;
		Low: [number, number];
		Range: number;
		Stream: {
			buf: BitTreeEncoder[];
			count: number;
		};
	};

	_isMatch: number[];
	_isRep: number[];
	_isRepG0: number[];
	_isRepG1: number[];
	_isRepG2: number[];
	_isRep0Long: number[];
	_posSlotEncoder: BitTreeEncoder[];
	_posEncoders: number[];
	_posAlignEncoder: BitTreeEncoder;
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
	m_PosSlotDecoder: BitTreeDecoder[];
	m_PosDecoders: number[];
	m_PosAlignDecoder: BitTreeDecoder;
	m_LenDecoder: LenDecoder;
	m_RepLenDecoder: LenDecoder;
	m_LiteralDecoder: LiteralDecoder;
}

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

interface LenEncoder {
	_tableSize: number;
	_prices: number[];
	_counters: number[];
	_choice: BitTreeEncoder[];
	_lowCoder: BitTreeEncoder[];
	_midCoder: BitTreeEncoder[];
	_highCoder: BitTreeEncoder;
}

interface MatchFinder {
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

interface CompressionContext {
	length_0?: [number, number];
	chunker: {
		inBytesProcessed: [number, number];
		alive: number;
		encoder: Encoder | null;
		decoder: Decoder | null;
	};
	output: {
		buf: BitTreeEncoder[];
		count: number;
	};
}

type DecompressionContext = CompressionContext;

interface LiteralEncoder {
	m_NumPrevBits: number;
	m_NumPosBits: number;
	m_PosMask: number;
	m_Coders: LiteralDecoderEncoder2[];
}

interface LiteralDecoderEncoder2 {
	m_Encoders: number[];
}

interface LenDecoder {
	m_Choice: number[];
	m_LowCoder: BitTreeDecoder[];
	m_MidCoder: BitTreeDecoder[];
	m_HighCoder: BitTreeDecoder;
	m_NumPosStates: number;
}

interface LiteralDecoder {
	m_NumPrevBits: number;
	m_NumPosBits: number;
	m_PosMask: number;
	m_Coders: LiteralDecoderEncoder2[];
}

// Computed CRC32 lookup table
// const CRC32_TABLE = new Uint32Array(256);

// for (let i = 0; i < CRC32_TABLE.length; i++) {
// 	let crc = i;
// 	for (let j = 0; j < 8; j++) {
// 		crc = (crc >>> 1) ^ (0xEDB88320 * (crc & 1));
// 	}
// 	CRC32_TABLE[i] = crc;
// }

// dprint-ignore
const CRC32_TABLE = [
	0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f,
	0xe963a535, 0x9e6495a3,	0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988,
	0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2,
	0xf3b97148, 0x84be41de,	0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7,
	0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec,	0x14015c4f, 0x63066cd9,
	0xfa0f3d63, 0x8d080df5,	0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172,
	0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b,	0x35b5a8fa, 0x42b2986c,
	0xdbbbc9d6, 0xacbcf940,	0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59,
	0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423,
	0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924,
	0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d,	0x76dc4190, 0x01db7106,
	0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
	0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d,
	0x91646c97, 0xe6635c01, 0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e,
	0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
	0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65,
	0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7,
	0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0,
	0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa,
	0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
	0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81,
	0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a,
	0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683, 0xe3630b12, 0x94643b84,
	0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
	0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb,
	0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc,
	0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e,
	0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b,
	0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55,
	0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
	0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28,
	0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d,
	0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f,
	0x72076785, 0x05005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38,
	0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242,
	0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
	0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69,
	0x616bffd3, 0x166ccf45, 0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2,
	0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc,
	0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
	0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693,
	0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94,
	0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d
];

export class LZMA {
	readonly #MAX_UINT32 = 4_294_967_296;
	readonly #MAX_INT32 = 2_147_483_647;
	readonly #MIN_INT32 = -2_147_483_648;
	readonly #MAX_COMPRESSION_SIZE = 9_223_372_036_854_775_807;
	readonly #N1_LONG_LIT: [number, number];
	readonly #MIN_VALUE: [number, number];
	readonly #P0_LONG_LIT: [number, number] = [0, 0];
	readonly #P1_LONG_LIT: [number, number] = [1, 0];

	readonly CompressionModes = {
		1: { searchDepth: 16, filterStrength: 64, modeIndex: 0 },
		2: { searchDepth: 20, filterStrength: 64, modeIndex: 0 },
		3: { searchDepth: 19, filterStrength: 64, modeIndex: 1 },
		4: { searchDepth: 20, filterStrength: 64, modeIndex: 1 },
		5: { searchDepth: 21, filterStrength: 128, modeIndex: 1 },
		6: { searchDepth: 22, filterStrength: 128, modeIndex: 1 },
		7: { searchDepth: 23, filterStrength: 128, modeIndex: 1 },
		8: { searchDepth: 24, filterStrength: 255, modeIndex: 1 },
		9: { searchDepth: 25, filterStrength: 255, modeIndex: 1 },
	} as const;

	#encoder: Encoder;
	#decoder: Decoder;
	#probPrices: number[];
	#gFastPos: number[];
	#compressor: CompressionContext;
	#decompressor: DecompressionContext;

	constructor() {
		this.#N1_LONG_LIT = [4294967295, -this.#MAX_UINT32];
		this.#MIN_VALUE = [0, -9223372036854775808];

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
			_isMatch: this.#initArray(192),
			_isRep: this.#initArray(12),
			_isRepG0: this.#initArray(12),
			_isRepG1: this.#initArray(12),
			_isRepG2: this.#initArray(12),
			_isRep0Long: this.#initArray(192),
			_posSlotEncoder: [],
			_posEncoders: this.#initArray(114),
			_posAlignEncoder: this.#createBitTreeEncoder(4),
			_lenEncoder: this.#createLenPriceTableEncoder(),
			_repMatchLenEncoder: this.#createLenPriceTableEncoder(),
			_literalEncoder: {} as LiteralEncoder,
			_matchDistances: [],
			_posSlotPrices: [],
			_distancesPrices: [],
			_alignPrices: this.#initArray(16),
			reps: this.#initArray(4),
			repLens: this.#initArray(4),
			processedInSize: [this.#P0_LONG_LIT],
			processedOutSize: [this.#P0_LONG_LIT],
			finished: [0],
			properties: this.#initArray(5),
			tempPrices: this.#initArray(128),
			_longestMatchLength: 0,
			_matchFinderType: 1,
			_numDistancePairs: 0,
			_numFastBytesPrev: -1,
			backRes: 0,
		};
	}

	#initDecoder(): Decoder {
		const decoder = {
			m_OutWindow: {} as OutWindow,
			m_RangeDecoder: {} as RangeDecoder,
			m_IsMatchDecoders: this.#initArray(192),
			m_IsRepDecoders: this.#initArray(12),
			m_IsRepG0Decoders: this.#initArray(12),
			m_IsRepG1Decoders: this.#initArray(12),
			m_IsRepG2Decoders: this.#initArray(12),
			m_IsRep0LongDecoders: this.#initArray(192),
			m_PosSlotDecoder: this.#initArray(4),
			m_PosDecoders: this.#initArray(114),
			m_PosAlignDecoder: this.#createBitTreeDecoder(4),
			m_LenDecoder: this.#createLenDecoder({}),
			m_RepLenDecoder: this.#createLenDecoder({}),
			m_LiteralDecoder: {} as LiteralDecoder,
		};

		for (let i = 0; i < 4; ++i) {
			decoder.m_PosSlotDecoder[i] = this.#createBitTreeDecoder(6);
		}

		return decoder;
	}

	#initCompressor(): CompressionContext {
		return {
			chunker: {
				alive: 0,
				encoder: null,
				decoder: null,
				inBytesProcessed: [],
			},
			output: {
				buf: this.#initArray(32),
				count: 0,
			},
		};
	}

	#initDecompressor(): DecompressionContext {
		return {
			chunker: {
				alive: 0,
				encoder: null,
				decoder: null,
				inBytesProcessed: [],
			},
			output: {
				buf: this.#initArray(32),
				count: 0,
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
		const gFastPos = [0, 1];
		let c = 2;

		for (let slotFast = 2; slotFast < 22; ++slotFast) {
			let k = 1 << ((slotFast >> 1) - 1);

			for (let j = 0; j < k; ++j, ++c) {
				gFastPos[c] = slotFast;
			}
		}

		return gFastPos;
	}

	#initArray(len: number) {
		const array = [];
		// This is MUCH faster than "new Array(len)" in newer versions of v8
		// (starting with Node.js 0.11.15, which uses v8 3.28.73).
		array[len - 1] = undefined;
		return array;
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

	#create(
		valueLow: number,
		valueHigh: number,
	): [number, number] {
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
		if (a[0] >= 2147483648) {
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
		if (n <= 30) {
			return 1 << n;
		}

		return this.#pwrAsDouble(30) * this.#pwrAsDouble(n - 30);
	}

	#shl(a: [number, number], n: number): [number, number] {
		let diff, newHigh, newLow, twoToN;
		n &= 63;

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
		n &= 63;
		let shiftFact = this.#pwrAsDouble(n);
		return this.#create(
			Math.floor(a[0] / shiftFact),
			a[1] / shiftFact,
		);
	}

	#shru(a: [number, number], n: number): [number, number] {
		let sr = this.#shr(a, n);
		n &= 63;
		if (a[1] < 0) {
			sr = this.#add(sr, this.#shl([2, 0], 63 - n));
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

		return inputStream.buf[inputStream.pos++] & 255;
	}

	#read_0(
		off: number,
		len: number,
	): number {
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

	#write(obj: { buf: number[]; count: number; }, b: number): void {
		obj.buf[obj.count++] = b << 24 >> 24;
	}

	#write_0(
		obj: { buf: number[]; count: number; },
		buf: number[],
		off: number,
		len: number,
	): void {
		this.#arraycopy(
			buf,
			off,
			obj.buf,
			obj.count,
			len,
		);

		obj.count += len;
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

	#arraycopy(src: number[], srcOfs: number, dest: number[], destOfs: number, len: number): void {
		for (let i = 0; i < len; ++i) {
			try {
				dest[destOfs + i] = src[srcOfs + i];
			} catch (error) {
				break;
			}
		}
	}

	#configure(mode: Mode): void {
		this.#SetDictionarySize_0(1 << mode.searchDepth);
		this.#encoder._numFastBytes = mode.filterStrength;
		this.#SetMatchFinder(mode.modeIndex);

		// lc is always 3
		// lp is always 0
		// pb is always 2
		this.#encoder._numLiteralContextBits = 3;
		this.#encoder._numLiteralPosStateBits = 0;
		this.#encoder._posStateBits = 2;
		this.#encoder._posStateMask = 3;
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
				this.#lowBits_0(this.#shr(len, i)) & 255,
			);
		}

		// Initialize encoder stream and properties
		this.#encoder._needReleaseMFStream = 0;
		this.#encoder._inStream = input;
		this.#encoder._finished = 0;

		// Create and configure encoder
		this.#Create_2();
		this.#encoder._rangeEncoder.Stream = this.#compressor.output;
		this.#Init_4();

		// Initialize pricing tables
		this.#FillDistancesPrices(this.#encoder);
		this.#FillAlignPrices(this.#encoder);

		// Configure length encoders
		this.#encoder._lenEncoder._tableSize = this.#encoder._numFastBytes + 1 - 2;
		this.#UpdateTables(
			this.#encoder._lenEncoder,
			1 << this.#encoder._posStateBits,
		);

		this.#encoder._repMatchLenEncoder._tableSize = this.#encoder._numFastBytes + 1 - 2;
		this.#UpdateTables(
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
			buf: this.#initArray(32),
			count: 0,
		};

		const inputBuffer: BaseStream = {
			buf: data instanceof ArrayBuffer
				? new Uint8Array(data)
				: data,
			pos: 0,
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
			r = r.toString(16);
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
			tmp_length = parseInt(hex_length, 16);
			// If the length is too long to handle, just set it to unknown.
			if (tmp_length > 4294967295) {
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
			buf: this.#initArray(32),
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

	#GetIndexByte(index: number) {
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
		if (this.#compressor.chunker.encoder._matchFinder._streamEndWasReached) {
			if (
				this.#compressor.chunker.encoder._matchFinder._pos + index + limit
					> this.#compressor.chunker.encoder._matchFinder._streamPos
			) {
				limit = this.#compressor.chunker.encoder._matchFinder._streamPos
					- (this.#compressor.chunker.encoder._matchFinder._pos + index);
			}
		}

		++distance;
		let i,
			pby = this.#compressor.chunker.encoder._matchFinder._bufferOffset
				+ this.#compressor.chunker.encoder._matchFinder._pos
				+ index;

		for (
			i = 0;
			i < limit
			&& this.#compressor.chunker.encoder._matchFinder._bufferBase[pby + i]
				== this.#compressor.chunker.encoder._matchFinder._bufferBase[pby + i - distance];
			++i
		);

		return i;
	}

	#GetNumAvailableBytes(): number {
		return (
			this.#compressor.chunker.encoder._matchFinder._streamPos
			- this.#compressor.chunker.encoder._matchFinder._pos
		);
	}

	#MoveBlock(): void {
		const matchFinder = this.#compressor.chunker.encoder._matchFinder;

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
		const matchFinder = this.#compressor.chunker.encoder._matchFinder;
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
		const matchFinder = this.#compressor.chunker.encoder._matchFinder;

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
			if (
				matchFinder._streamPos >= matchFinder._pos + matchFinder._keepSizeAfter
			) {
				matchFinder._posLimit = matchFinder._streamPos - matchFinder._keepSizeAfter;
			}
		}
	}

	#ReduceOffsets(subValue: number): void {
		this.#compressor.chunker.encoder._matchFinder._bufferOffset += subValue;
		this.#compressor.chunker.encoder._matchFinder._posLimit -= subValue;
		this.#compressor.chunker.encoder._matchFinder._pos -= subValue;
		this.#compressor.chunker.encoder._matchFinder._streamPos -= subValue;
	}

	#Create_3(
		keepAddBufferBefore: number,
		keepAddBufferAfter: number,
	): void {
		if (this.#encoder._dictionarySize < 1073741567) {
			this.#encoder._matchFinder._cutValue = 16 + (this.#encoder._numFastBytes >> 1);
			const windowReservSize = ~~((this.#encoder._dictionarySize
				+ keepAddBufferBefore
				+ this.#encoder._numFastBytes
				+ keepAddBufferAfter) / 2) + 256;

			this.#Create_4(
				this.#encoder._dictionarySize + keepAddBufferBefore,
				this.#encoder._numFastBytes + keepAddBufferAfter,
				windowReservSize,
			);

			this.#encoder._matchFinder._matchMaxLen = this.#encoder._numFastBytes;
			let cyclicBufferSize = this.#encoder._dictionarySize + 1;

			if (this.#encoder._matchFinder._cyclicBufferSize != cyclicBufferSize) {
				this.#encoder._matchFinder._son = this.#initArray(
					(this.#encoder._matchFinder._cyclicBufferSize = cyclicBufferSize) * 2,
				);
			}

			let hs = 65536;
			if (this.#encoder._matchFinder.HASH_ARRAY) {
				hs = this.#encoder._dictionarySize - 1;
				hs |= hs >> 1;
				hs |= hs >> 2;
				hs |= hs >> 4;
				hs |= hs >> 8;
				hs >>= 1;
				hs |= 65535;

				if (hs > 16777216) {
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
			temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 255] ^ matchFinder._bufferBase[cur + 1] & 255;
			hash2Value = temp & 1023;
			temp ^= (matchFinder._bufferBase[cur + 2] & 255) << 8;
			hash3Value = temp & 65535;
			hashValue = (temp ^ CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 255] << 5) & matchFinder._hashMask;
		} else {
			hashValue = matchFinder._bufferBase[cur] & 255 ^ (matchFinder._bufferBase[cur + 1] & 255) << 8;
		}

		curMatch = matchFinder._hash[matchFinder.kFixHashSize + hashValue] || 0;
		if (matchFinder.HASH_ARRAY) {
			curMatch2 = matchFinder._hash[hash2Value] || 0;
			curMatch3 = matchFinder._hash[1024 + hash3Value] || 0;
			matchFinder._hash[hash2Value] = matchFinder._pos;
			matchFinder._hash[1024 + hash3Value] = matchFinder._pos;

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
				(matchFinder._bufferBase[pby1 + len] & 255) < (matchFinder._bufferBase[cur + len] & 255)
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

		if (matchFinder._pos == 1073741823) {
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
		let value;

		for (let i = 0; i < numItems; ++i) {
			value = items[i] || 0;
			if (value <= subValue) {
				value = 0;
			} else {
				value -= subValue;
			}
			items[i] = value;
		}
	}

	#SetType(
		binTree: any,
		numHashBytes: number,
	): void {
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

		var count,
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
			if (
				matchFinder._pos + matchFinder._matchMaxLen <= matchFinder._streamPos
			) {
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
				temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 255] ^ matchFinder._bufferBase[cur + 1] & 255;
				hash2Value = temp & 1023;
				matchFinder._hash[hash2Value] = matchFinder._pos;
				temp ^= (matchFinder._bufferBase[cur + 2] & 255) << 8;
				hash3Value = temp & 65535;
				matchFinder._hash[1024 + hash3Value] = matchFinder._pos;
				hashValue = (temp ^ CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 255] << 5)
					& matchFinder._hashMask;
			} else {
				hashValue = matchFinder._bufferBase[cur] & 255 ^ (matchFinder._bufferBase[cur + 1] & 255) << 8;
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
					if (len == lenLimit) {
						matchFinder._son[ptr1] = matchFinder._son[cyclicPos];
						matchFinder._son[ptr0] = matchFinder._son[cyclicPos + 1];
						break;
					}
				}
				if (
					(matchFinder._bufferBase[pby1 + len] & 255) < (matchFinder._bufferBase[cur + len] & 255)
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
				this.#Flush_0(outputWindow);
			}
		}
	}

	#Create_5(m_OutWindow: any, windowSize: number): void {
		if (m_OutWindow._buffer == null || m_OutWindow._windowSize != windowSize) {
			m_OutWindow._buffer = this.#initArray(windowSize);
		}

		m_OutWindow._windowSize = windowSize;
		m_OutWindow._pos = 0;
		m_OutWindow._streamPos = 0;
	}

	#Flush_0(obj: any): void {
		var size = obj._pos - obj._streamPos;
		if (!size) {
			return;
		}

		this.#write_0(
			obj._stream,
			obj._buffer,
			obj._streamPos,
			size,
		);

		if (obj._pos >= obj._windowSize) {
			obj._pos = 0;
		}
		obj._streamPos = obj._pos;
	}

	#GetByte(distance: number) {
		const outputWindow = this.#decompressor.chunker.decoder.m_OutWindow;

		var pos = outputWindow._pos - distance - 1;
		if (pos < 0) {
			pos += outputWindow._windowSize;
		}
		return outputWindow._buffer[pos];
	}

	#PutByte(obj: any, b: number): void {
		obj._buffer[obj._pos] = b;
		obj._pos += 1;
		if (obj._pos >= obj._windowSize) {
			this.#Flush_0(obj);
		}
	}

	#ReleaseStream(obj: any): void {
		this.#Flush_0(obj);
		obj._stream = null;
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

		this.#decompressor.chunker.inBytesProcessed = this.#N1_LONG_LIT;
		this.#decompressor.chunker.inBytesProcessed = decoder.nowPos64;

		if (
			result
			|| this.#compare(decoder.outSize, this.#P0_LONG_LIT) >= 0
				&& this.#compare(decoder.nowPos64, decoder.outSize) >= 0
		) {
			this.#Flush_0(decoder.m_OutWindow);
			this.#ReleaseStream(decoder.m_OutWindow);
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

	#CodeInChunks(
		inStream: BaseStream,
		outSize: [number, number],
	): any {
		this.#decoder.m_RangeDecoder.Stream = inStream;
		this.#ReleaseStream(this.#decoder.m_OutWindow);
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
		let decoder2, distance, len, numDirectBits, positionSlot;

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

			this.#PutByte(decoder.m_OutWindow, decoder.prevByte);
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
					decoder.state = decoder.state < 7 ? 8 : 11;
				}
			} else {
				decoder.rep3 = decoder.rep2;
				decoder.rep2 = decoder.rep1;
				decoder.rep1 = decoder.rep0;

				len = 2 + this.#Decode(decoder.m_LenDecoder, posState);

				decoder.state = decoder.state < 7 ? 7 : 10;

				positionSlot = this.#Decode_0(decoder.m_PosSlotDecoder[this.GetLenToPosState(len)]);

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
		var dictionarySize, i, lc, lp, pb, remainder, val;
		if (properties.length < 5) {
			return 0;
		}

		val = properties[0] & 255;
		lc = val % 9;
		remainder = ~~(val / 9);
		lp = remainder % 5;
		pb = ~~(remainder / 5);

		dictionarySize = 0;
		for (i = 0; i < 4; ++i) {
			dictionarySize += (properties[1 + i] & 255) << i * 8;
		}

		// NOTE: If the input is bad, it might call for an insanely large dictionary size, which would crash the script.
		if (
			dictionarySize > 99999999 || !this.#SetLcLpPb(lc, lp, pb)
		) {
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

			this.#Create_5(
				this.#decoder.m_OutWindow,
				Math.max(this.#decoder.m_DictionarySizeCheck, 4096),
			);
		}

		return 1;
	}

	#SetLcLpPb(
		lc: number,
		lp: number,
		pb: number,
	): 0 | 1 {
		if (lc > 8 || lp > 4 || pb > 4) {
			return 0;
		}
		this.#Create_0(lp, lc);
		var numPosStates = 1 << pb;

		this.#Create(this.#decoder.m_LenDecoder, numPosStates);
		this.#Create(this.#decoder.m_RepLenDecoder, numPosStates);

		this.#decoder.m_PosStateMask = numPosStates - 1;

		return 1;
	}

	#Create(
		decoder: any,
		numPosStates: number,
	): void {
		for (; decoder.m_NumPosStates < numPosStates; decoder.m_NumPosStates += 1) {
			decoder.m_LowCoder[decoder.m_NumPosStates] = this.#createBitTreeDecoder(3);
			decoder.m_MidCoder[decoder.m_NumPosStates] = this.#createBitTreeDecoder(3);
		}
	}

	#Decode(
		obj: any,
		posState: number,
	): number {
		if (!this.#decodeBit(obj.m_Choice, 0)) {
			return this.#Decode_0(obj.m_LowCoder[posState]);
		}

		let symbol = 8;

		if (!this.#decodeBit(obj.m_Choice, 1)) {
			symbol += this.#Decode_0(obj.m_MidCoder[posState]);
		} else {
			symbol += 8 + this.#Decode_0(obj.m_HighCoder);
		}

		return symbol;
	}

	#createLenDecoder(obj: any): LenDecoder {
		obj.m_Choice = this.#initArray(2);
		obj.m_LowCoder = this.#initArray(16);
		obj.m_MidCoder = this.#initArray(16);
		obj.m_HighCoder = this.#createBitTreeDecoder(8);
		obj.m_NumPosStates = 0;

		return obj;
	}

	#Init(obj: any): void {
		this.InitBitModels(obj.m_Choice);
		for (let posState = 0; posState < obj.m_NumPosStates; ++posState) {
			this.InitBitModels(obj.m_LowCoder[posState].Models);
			this.InitBitModels(obj.m_MidCoder[posState].Models);
		}

		this.InitBitModels(obj.m_HighCoder.Models);
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
			this.#decoder.m_LiteralDecoder.m_Coders[i] = this.#createLiteralDecoderEncoder2({});
		}
	}

	#GetDecoder(
		pos: number,
		prevByte: number,
	) {
		const literalDecoder = this.#decompressor.chunker.decoder.m_LiteralDecoder;

		// Calculate index based on position and previous byte
		const positionMask = pos & literalDecoder.m_PosMask;
		const prevBitsMask = (prevByte & 255) >>> (8 - literalDecoder.m_NumPrevBits);
		const index = (positionMask << literalDecoder.m_NumPrevBits) + prevBitsMask;

		// Return decoder at calculated index
		return literalDecoder.m_Coders[index];
	}

	#Init_0(obj: any): void {
		let i, numStates;
		numStates = 1 << obj.m_NumPrevBits + obj.m_NumPosBits;

		for (i = 0; i < numStates; ++i) {
			this.InitBitModels(obj.m_Coders[i].m_Decoders);
		}
	}

	#DecodeNormal(rangeDecoder: any): number {
		const _rangeDecoder = this.#decompressor.chunker.decoder.m_RangeDecoder;

		var symbol = 1;
		do {
			symbol = symbol << 1 | this.#decodeBit(rangeDecoder.m_Decoders, symbol);
		} while (symbol < 256);

		return symbol << 24 >> 24;
	}

	#DecodeWithMatchByte(
		obj: any,
		matchByte: number,
	): number {
		let bit, matchBit, symbol = 1;
		do {
			matchBit = matchByte >> 7 & 1;
			matchByte <<= 1;
			bit = this.#decodeBit(
				obj.m_Decoders,
				(1 + matchBit << 8) + symbol,
			);
			symbol = symbol << 1 | bit;

			if (matchBit != bit) {
				while (symbol < 256) {
					symbol = symbol << 1 | this.#decodeBit(obj.m_Decoders, symbol);
				}
				break;
			}
		} while (symbol < 256);

		return symbol << 24 >> 24;
	}

	#createLiteralDecoderEncoder2(obj: any): LiteralDecoderEncoder2 {
		obj.m_Decoders = this.#initArray(768);
		return obj;
	}

	#Backward(cur: number) {
		const obj = this.#compressor.chunker.encoder;
		let backCur, backMem, posMem, posPrev;

		obj._optimumEndIndex = cur;
		posMem = obj._optimum[cur].PosPrev;
		backMem = obj._optimum[cur].BackPrev;

		do {
			if (obj._optimum[cur].Prev1IsChar) {
				this.#MakeAsChar(obj._optimum[posMem]);
				obj._optimum[posMem].PosPrev = posMem - 1;

				if (obj._optimum[cur].Prev2) {
					obj._optimum[posMem - 1].Prev1IsChar = 0;
					obj._optimum[posMem - 1].PosPrev = obj._optimum[cur].PosPrev2;
					obj._optimum[posMem - 1].BackPrev = obj._optimum[cur].BackPrev2;
				}
			}

			posPrev = posMem;
			backCur = backMem;
			backMem = obj._optimum[posPrev].BackPrev;
			posMem = obj._optimum[posPrev].PosPrev;
			obj._optimum[posPrev].BackPrev = backCur;
			obj._optimum[posPrev].PosPrev = cur;
			cur = posPrev;
		} while (cur > 0);

		obj.backRes = obj._optimum[0].BackPrev;
		obj._optimumCurrentIndex = obj._optimum[0].PosPrev;
		return obj._optimumCurrentIndex;
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
			posState = this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64)
				& this.#compressor.chunker.encoder._posStateMask;

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
				this.#GetSubCoder(
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
			posState = this.#lowBits_0(this.#compressor.chunker.encoder.nowPos64)
				& this.#compressor.chunker.encoder._posStateMask;
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
				subCoder = this.#GetSubCoder(
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
						this.#compressor.chunker.encoder._state = this.#compressor.chunker.encoder._state < 7 ? 8 : 11;
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
						0,
					);
					this.#compressor.chunker.encoder._state = this.#compressor.chunker.encoder._state < 7 ? 7 : 10;
					this.#Encode_0(
						this.#compressor.chunker.encoder._lenEncoder,
						len - 2,
						posState,
					);
					pos -= 4;
					posSlot = this.GetPosSlot(pos);
					lenToPosState = this.GetLenToPosState(len);

					this.#Encode_2(
						this.#compressor.chunker.encoder._posSlotEncoder[lenToPosState],
						posSlot,
					);

					if (posSlot >= 4) {
						footerBits = (posSlot >> 1) - 1;
						baseVal = (2 | posSlot & 1) << footerBits;
						posReduced = pos - baseVal;

						if (posSlot < 14) {
							this.ReverseEncode(
								baseVal - posSlot - 1,
								footerBits,
								posReduced,
							);
						} else {
							this.#EncodeDirectBits(posReduced >> 4, footerBits - 4);
							this.#ReverseEncode(posReduced & 15);
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
					this.#compressor.chunker.encoder._matchPriceCount += 1;
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
				if (this.#compressor.chunker.encoder._matchPriceCount >= 128) {
					this.#FillDistancesPrices(this.#compressor.chunker.encoder);
				}

				if (this.#compressor.chunker.encoder._alignPriceCount >= 16) {
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
						this.#sub(this.#compressor.chunker.encoder.nowPos64, [4096, 0]),
						[4096, 0],
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

		this.#Create_1();

		if (
			this.#encoder._dictionarySize == this.#encoder._dictionarySizePrev
			&& this.#encoder._numFastBytesPrev == this.#encoder._numFastBytes
		) {
			return;
		}

		this.#Create_3(4_096, 274);

		this.#encoder._dictionarySizePrev = this.#encoder._dictionarySize;
		this.#encoder._numFastBytesPrev = this.#encoder._numFastBytes;
	}

	#Encoder(): void {
		for (let i = 0; i < 4_096; ++i) {
			this.#encoder._optimum[i] = {};
		}

		for (let i = 0; i < 4; ++i) {
			this.#encoder._posSlotEncoder[i] = this.#createBitTreeEncoder(6);
		}
	}

	#FillAlignPrices(encoder: any): void {
		for (let i = 0; i < 16; ++i) {
			encoder._alignPrices[i] = this.#ReverseGetPrice(encoder._posAlignEncoder, i);
		}
		encoder._alignPriceCount = 0;
	}

	#FillDistancesPrices(obj: any): void {
		let baseVal, encoder, footerBits, posSlot, st, st2;

		for (let i = 4; i < 128; ++i) {
			posSlot = this.GetPosSlot(i);
			footerBits = (posSlot >> 1) - 1;
			baseVal = (2 | posSlot & 1) << footerBits;
			obj.tempPrices[i] = this.ReverseGetPrice(
				obj._posEncoders,
				baseVal - posSlot - 1,
				footerBits,
				i - baseVal,
			);
		}

		for (let lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
			encoder = obj._posSlotEncoder[lenToPosState];
			st = lenToPosState << 6;
			for (posSlot = 0; posSlot < obj._distTableSize; posSlot += 1) {
				obj._posSlotPrices[st + posSlot] = this.#GetPrice_1(
					encoder,
					posSlot,
				);
			}

			for (posSlot = 14; posSlot < obj._distTableSize; posSlot += 1) {
				obj._posSlotPrices[st + posSlot] += (posSlot >> 1) - 1 - 4 << 6;
			}

			st2 = lenToPosState * 128;
			for (let i = 0; i < 4; ++i) {
				obj._distancesPrices[st2 + i] = obj._posSlotPrices[st + i];
			}

			for (let i = 4; i < 128; ++i) {
				obj._distancesPrices[st2 + i] = obj._posSlotPrices[st + this.GetPosSlot(i)] + obj.tempPrices[i];
			}
		}

		obj._matchPriceCount = 0;
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
			lenRes = encoder._optimum[encoder._optimumCurrentIndex].PosPrev
				- encoder._optimumCurrentIndex;
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

		if (numAvailableBytes > 273) {
			numAvailableBytes = 273;
		}

		repMaxIndex = 0;
		for (let i = 0; i < 4; ++i) {
			encoder.reps[i] = encoder._repDistances[i];
			encoder.repLens[i] = this.#GetMatchLen(
				-1,
				encoder.reps[i],
				273,
			);
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
		] + this.#GetPrice_0(
			this.#GetSubCoder(
				position,
				encoder._previousByte,
			),
			encoder._state >= 7,
			matchByte,
			currentByte,
		);

		this.#MakeAsChar(encoder._optimum[1]);
		matchPrice = this.#probPrices[
			2_048
				- encoder._isMatch[(encoder._state << 4) + posState]
			>>> 2
		];

		repMatchPrice = matchPrice + this.#probPrices[
			2_048 - encoder._isRep[encoder._state] >>> 2
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
			encoder._optimum[len].Price = 268_435_455;
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
				curAndLenPrice = price_4 + this.#GetPrice(
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
				curAndLenPrice = normalMatchPrice + this.#GetPosLenPrice(distance, len, posState);
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
				encoder._longestMatchWasFound = 1;

				return this.#Backward(cur);
			}
			position += 1;
			posPrev = encoder._optimum[cur].PosPrev;

			if (encoder._optimum[cur].Prev1IsChar) {
				posPrev -= 1;
				if (encoder._optimum[cur].Prev2) {
					state = encoder._optimum[encoder._optimum[cur].PosPrev2].State;
					if (encoder._optimum[cur].BackPrev2 < 4) {
						state = (state < 7) ? 8 : 11;
					} else {
						state = (state < 7) ? 7 : 10;
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
					state = state < 7 ? 8 : 11;
				} else {
					pos = encoder._optimum[cur].BackPrev;
					if (pos < 4) {
						state = state < 7 ? 8 : 11;
					} else {
						state = state < 7 ? 7 : 10;
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

			currentByte = this.#GetIndexByte(-1);
			matchByte = this.#GetIndexByte(-encoder.reps[0] - 1 - 1);

			posState = position & encoder._posStateMask;
			curAnd1Price = curPrice
				+ this.#probPrices[encoder._isMatch[(state << 4) + posState] >>> 2]
				+ this.#GetPrice_0(
					this.#GetSubCoder(position, this.#GetIndexByte(-2)),
					state >= 7,
					matchByte,
					currentByte,
				);
			nextOptimum = encoder._optimum[cur + 1];
			nextIsChar = 0;

			if (curAnd1Price < nextOptimum.Price) {
				nextOptimum.Price = curAnd1Price;
				nextOptimum.PosPrev = cur;
				nextOptimum.BackPrev = -1;
				nextOptimum.Prev1IsChar = 0;
				nextIsChar = 1;
			}
			matchPrice = curPrice + this.#probPrices[
				2_048 - encoder._isMatch[(state << 4) + posState] >>> 2
			];
			repMatchPrice = matchPrice + this.#probPrices[2_048 - encoder._isRep[state] >>> 2];

			if (matchByte == currentByte && !(nextOptimum.PosPrev < cur && !nextOptimum.BackPrev)) {
				shortRepPrice = repMatchPrice
					+ (this.#probPrices[encoder._isRepG0[state] >>> 2] + this.#probPrices[
						encoder._isRep0Long[(state << 4) + posState] >>> 2
					]);

				if (shortRepPrice <= nextOptimum.Price) {
					nextOptimum.Price = shortRepPrice;
					nextOptimum.PosPrev = cur;
					nextOptimum.BackPrev = 0;
					nextOptimum.Prev1IsChar = 0;
					nextIsChar = 1;
				}
			}

			numAvailableBytesFull = this.#GetNumAvailableBytes() + 1;
			numAvailableBytesFull = 4_095 - cur < numAvailableBytesFull
				? 4_095 - cur
				: numAvailableBytesFull;

			numAvailableBytes = numAvailableBytesFull;

			if (numAvailableBytes < 2) {
				continue;
			}

			if (numAvailableBytes > encoder._numFastBytes) {
				numAvailableBytes = encoder._numFastBytes;
			}

			if (!nextIsChar && matchByte != currentByte) {
				t = Math.min(numAvailableBytesFull - 1, encoder._numFastBytes);
				lenTest2 = this.#GetMatchLen(
					0,
					encoder.reps[0],
					t,
				);

				if (lenTest2 >= 2) {
					state2 = this.StateUpdateChar(state);
					posStateNext = position + 1 & encoder._posStateMask;
					nextRepMatchPrice = curAnd1Price + this.#probPrices[
						2_048 - encoder._isMatch[(state2 << 4) + posStateNext] >>> 2
					] + this.#probPrices[2_048 - encoder._isRep[state2] >>> 2];
					offset = cur + 1 + lenTest2;

					while (lenEnd < offset) {
						encoder._optimum[lenEnd += 1].Price = 268_435_455;
					}

					curAndLenPrice = nextRepMatchPrice + (price = this.#GetPrice(
						encoder._repMatchLenEncoder,
						lenTest2 - 2,
						posStateNext,
					),
						price + this.#GetPureRepPrice(
							0,
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
			startLen = 2;

			for (repIndex = 0; repIndex < 4; ++repIndex) {
				lenTest = this.#GetMatchLen(
					-1,
					encoder.reps[repIndex],
					numAvailableBytes,
				);

				if (lenTest < 2) {
					continue;
				}
				lenTestTemp = lenTest;

				do {
					while (lenEnd < cur + lenTest) {
						encoder._optimum[lenEnd += 1].Price = 268_435_455;
					}
					curAndLenPrice = repMatchPrice + (price_0 = this.#GetPrice(
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
						state2 = state < 7 ? 8 : 11;
						posStateNext = position + lenTest & encoder._posStateMask;
						curAndLenCharPrice = repMatchPrice + (price_1 = this.#GetPrice(
							encoder._repMatchLenEncoder,
							lenTest - 2,
							posState,
						),
							price_1 + this.#GetPureRepPrice(
								repIndex,
								state,
								posState,
							))
							+ this.#probPrices[
								encoder._isMatch[(state2 << 4) + posStateNext] >>> 2
							] + this.#GetPrice_0(
								this.#GetSubCoder(
									position + lenTest,
									this.#GetIndexByte(lenTest - 1 - 1),
								),
								1,
								this.#GetIndexByte(lenTest - 1 - (encoder.reps[repIndex] + 1)),
								this.#GetIndexByte(lenTest - 1),
							);

						state2 = this.StateUpdateChar(state2);
						posStateNext = position + lenTest + 1 & encoder._posStateMask;
						nextMatchPrice = curAndLenCharPrice + this.#probPrices[
							2_048 - encoder._isMatch[
									(state2 << 4) + posStateNext
								] >>> 2
						];
						nextRepMatchPrice = nextMatchPrice + this.#probPrices[
							2_048 - encoder._isRep[state2] >>> 2
						];
						offset = cur + 1 + lenTest + lenTest2;
						while (lenEnd < cur + offset) {
							encoder._optimum[lenEnd += 1].Price = 268_435_455;
						}
						curAndLenPrice = nextRepMatchPrice + (price_2 = this.#GetPrice(
							encoder._repMatchLenEncoder,
							lenTest2 - 2,
							posStateNext,
						),
							price_2 + this.#GetPureRepPrice(
								0,
								state2,
								posStateNext,
							));
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
					encoder._optimum[lenEnd += 1].Price = 268_435_455;
				}
				offs = 0;

				while (startLen > encoder._matchDistances[offs]) {
					offs += 2;
				}

				for (lenTest = startLen;; lenTest += 1) {
					curBack = encoder._matchDistances[offs + 1];
					curAndLenPrice = normalMatchPrice + this.#GetPosLenPrice(curBack, lenTest, posState);
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
								curAndLenCharPrice = curAndLenPrice + this.#probPrices[
									encoder._isMatch[(state2 << 4) + posStateNext] >>> 2
								] + this.#GetPrice_0(
									this.#GetSubCoder(position + lenTest, this.#GetIndexByte(lenTest - 1 - 1)),
									1,
									this.#GetIndexByte(lenTest - (curBack + 1) - 1),
									this.#GetIndexByte(lenTest - 1),
								);
								state2 = this.StateUpdateChar(state2);
								posStateNext = position + lenTest + 1 & encoder._posStateMask;
								nextMatchPrice = curAndLenCharPrice + this.#probPrices[
									2_048 - encoder._isMatch[(state2 << 4) + posStateNext]
									>>> 2
								];
								nextRepMatchPrice = nextMatchPrice + this.#probPrices[
									2_048 - encoder._isRep[state2] >>> 2
								];
								offset = lenTest + 1 + lenTest2;
								while (lenEnd < cur + offset) {
									encoder._optimum[lenEnd += 1].Price = 268_435_455;
								}
								curAndLenPrice = nextRepMatchPrice + (price_3 = this.#GetPrice(
									encoder._repMatchLenEncoder,
									lenTest2 - 2,
									posStateNext,
								),
									price_3 + this.#GetPureRepPrice(
										0,
										state2,
										posStateNext,
									));
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

	#GetPosLenPrice(
		pos: number,
		len: number,
		posState: number,
	): number {
		let price: number, lenToPosState = this.GetLenToPosState(len);
		if (pos < 128) {
			price = this.#compressor.chunker.encoder._distancesPrices[lenToPosState * 128 + pos];
		} else {
			price = this.#compressor.chunker.encoder._posSlotPrices[(lenToPosState << 6) + this.GetPosSlot2(pos)]
				+ this.#compressor.chunker.encoder._alignPrices[pos & 15];
		}

		return price + this.#GetPrice(this.#compressor.chunker.encoder._lenEncoder, len - 2, posState);
	}

	#GetPureRepPrice(
		repIndex: number,
		state: number,
		posState: number,
	): number {
		var price;

		if (!repIndex) {
			price = this.#probPrices[this.#compressor.chunker.encoder._isRepG0[state] >>> 2];
			price += this.#probPrices[
				2_048 - this.#compressor.chunker.encoder._isRep0Long[(state << 4) + posState] >>> 2
			];
		} else {
			price = this.#probPrices[2_048 - this.#compressor.chunker.encoder._isRepG0[state] >>> 2];
			if (repIndex == 1) {
				price += this.#probPrices[this.#compressor.chunker.encoder._isRepG1[state] >>> 2];
			} else {
				price += this.#probPrices[2_048 - this.#compressor.chunker.encoder._isRepG1[state] >>> 2];
				price += this.GetPrice(this.#compressor.chunker.encoder._isRepG2[state], repIndex - 2);
			}
		}

		return price;
	}

	#GetRepLen1Price(posState: number): number {
		const state = this.#compressor.chunker.encoder._state;

		return this.#probPrices[this.#compressor.chunker.encoder._isRepG0[state] >>> 2]
			+ this.#probPrices[this.#compressor.chunker.encoder._isRep0Long[(state << 4) + posState] >>> 2];
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
		var lenRes = 0;
		this.#compressor.chunker.encoder._numDistancePairs = this.#GetMatches();

		if (this.#compressor.chunker.encoder._numDistancePairs > 0) {
			lenRes = this
				.#compressor
				.chunker
				.encoder
				._matchDistances[this.#compressor.chunker.encoder._numDistancePairs - 2];

			if (lenRes == this.#compressor.chunker.encoder._numFastBytes) {
				lenRes += this.#GetMatchLen(
					lenRes - 1,
					this
						.#compressor
						.chunker
						.encoder
						._matchDistances[this.#compressor.chunker.encoder._numDistancePairs - 1],
					273 - lenRes,
				);
			}
		}

		this.#compressor.chunker.encoder._additionalOffset += 1;
		return lenRes;
	}

	#ReleaseMFStream(): void {
		if (this.#compressor.chunker.encoder._matchFinder && this.#compressor.chunker.encoder._needReleaseMFStream) {
			this.#compressor.chunker.encoder._matchFinder._stream = null;
			this.#compressor.chunker.encoder._needReleaseMFStream = 0;
		}
	}

	#ReleaseStreams(): void {
		this.#ReleaseMFStream();
		this.#compressor.chunker.encoder._rangeEncoder.Stream = null;
	}

	#SetDictionarySize_0(dictionarySize: number): void {
		this.#encoder._dictionarySize = dictionarySize;
		for (
			var dicLogSize = 0;
			dictionarySize > (1 << dicLogSize);
			++dicLogSize
		);

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
		const HEADER_SIZE = 5; // Total header size in bytes

		// First byte combines posStateBits, literalPosStateBits and literalContextBits
		// Format: (posStateBits * 5 + literalPosStateBits) * 9 + literalContextBits
		this.#encoder.properties[0] = (
			(this.#encoder._posStateBits * 5 + this.#encoder._numLiteralPosStateBits) * 9
			+ this.#encoder._numLiteralContextBits
		) & 0xFF; // Ensure byte-sized value

		// Next 4 bytes store dictionary size in little-endian format
		for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
			// Shift dictionary size right by appropriate number of bits and mask to byte
			this.#encoder.properties[1 + byteIndex] = (
				this.#encoder._dictionarySize >> (8 * byteIndex)
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
		var lenToPosState = this.GetLenToPosState(2);

		this.#Encode_2(
			encoder._posSlotEncoder[lenToPosState],
			63,
		);

		this.#EncodeDirectBits(67108863, 26);
		this.#ReverseEncode(15);
	}

	GetPosSlot(pos: number): number {
		if (pos < 2_048) {
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
		obj: any,
		symbol: number,
		posState: number,
	): void {
		if (symbol < 8) {
			this.#Encode_3(obj._choice, 0, 0);
			this.#Encode_2(obj._lowCoder[posState], symbol);
		} else {
			symbol -= 8;
			this.#Encode_3(obj._choice, 0, 1);

			if (symbol < 8) {
				this.#Encode_3(obj._choice, 1, 0);
				this.#Encode_2(obj._midCoder[posState], symbol);
			} else {
				this.#Encode_3(obj._choice, 1, 1);
				this.#Encode_2(obj._highCoder, symbol - 8);
			}
		}
	}

	#createLenEncoder(): LenEncoder {
		const encoder = {} as LenEncoder;

		encoder._choice = this.#initArray(2);
		encoder._lowCoder = this.#initArray(16);
		encoder._midCoder = this.#initArray(16);
		encoder._highCoder = this.#createBitTreeEncoder(8);

		for (let posState = 0; posState < 16; ++posState) {
			encoder._lowCoder[posState] = this.#createBitTreeEncoder(3);
			encoder._midCoder[posState] = this.#createBitTreeEncoder(3);
		}

		return encoder;
	}

	#Init_2(obj: any, numPosStates: number): void {
		this.InitBitModels(obj._choice);
		for (let posState = 0; posState < numPosStates; ++posState) {
			this.InitBitModels(obj._lowCoder[posState].Models);
			this.InitBitModels(obj._midCoder[posState].Models);
		}
		this.InitBitModels(obj._highCoder.Models);
	}

	#SetPrices(
		obj: any,
		posState: number,
		numSymbols: number,
		prices: number[],
		st: number,
	): void {
		let a0, a1, b0, b1, i;
		a0 = this.#probPrices[obj._choice[0] >>> 2];
		a1 = this.#probPrices[2_048 - obj._choice[0] >>> 2];
		b0 = a1 + this.#probPrices[obj._choice[1] >>> 2];
		b1 = a1 + this.#probPrices[2_048 - obj._choice[1] >>> 2];
		i = 0;

		for (i = 0; i < 8; ++i) {
			if (i >= numSymbols) {
				return;
			}
			prices[st + i] = a0 + this.#GetPrice_1(obj._lowCoder[posState], i);
		}

		for (; i < 16; ++i) {
			if (i >= numSymbols) {
				return;
			}
			prices[st + i] = b0 + this.#GetPrice_1(obj._midCoder[posState], i - 8);
		}

		for (; i < numSymbols; ++i) {
			prices[st + i] = b1 + this.#GetPrice_1(obj._highCoder, i - 8 - 8);
		}
	}

	#Encode_0(
		obj: any,
		symbol: number,
		posState: number,
	): void {
		this.#Encode(obj, symbol, posState);

		if ((obj._counters[posState] -= 1) == 0) {
			this.#SetPrices(
				obj,
				posState,
				obj._tableSize,
				obj._prices,
				posState * 272,
			);

			obj._counters[posState] = obj._tableSize;
		}
	}

	#createLenPriceTableEncoder(): LenEncoder {
		const encoder = this.#createLenEncoder();
		encoder._prices = [];
		encoder._counters = [];

		return encoder;
	}

	#GetPrice(
		obj: any,
		symbol: number,
		posState: number,
	): number {
		return obj._prices[posState * 272 + symbol];
	}

	#UpdateTables(
		obj: any,
		numPosStates: number,
	): void {
		for (let posState = 0; posState < numPosStates; ++posState) {
			this.#SetPrices(
				obj,
				posState,
				obj._tableSize,
				obj._prices,
				posState * 272,
			);

			obj._counters[posState] = obj._tableSize;
		}
	}

	#Create_1(): void {
		let i, numStates;

		if (
			this.#encoder._literalEncoder.m_Coders != null
			&& this.#encoder._literalEncoder.m_NumPrevBits == this.#encoder._numLiteralContextBits
			&& this.#encoder._literalEncoder.m_NumPosBits == this.#encoder._numLiteralPosStateBits
		) {
			return;
		}

		this.#encoder._literalEncoder.m_NumPosBits = this.#encoder._numLiteralPosStateBits;
		this.#encoder._literalEncoder.m_PosMask = (1 << this.#encoder._numLiteralPosStateBits) - 1;
		this.#encoder._literalEncoder.m_NumPrevBits = this.#encoder._numLiteralContextBits;

		numStates = 1 << this.#encoder._literalEncoder.m_NumPrevBits + this.#encoder._literalEncoder.m_NumPosBits;
		this.#encoder._literalEncoder.m_Coders = this.#initArray(numStates);

		for (i = 0; i < numStates; ++i) {
			this.#encoder._literalEncoder.m_Coders[i] = this.#createLiteralEncoderEncoder2({});
		}
	}

	#GetSubCoder(pos: number, prevByte: number): number {
		const literalEncoder = this.#compressor.chunker.encoder._literalEncoder;

		// Calculate position mask bits
		const posBits = pos & literalEncoder.m_PosMask;
		const posShifted = posBits << literalEncoder.m_NumPrevBits;

		// Calculate previous byte bits
		const prevByteShift = 8 - literalEncoder.m_NumPrevBits;
		const prevByteBits = (prevByte & 255) >>> prevByteShift;

		// Combine position and prevByte bits to get final index
		const coderIndex = posShifted + prevByteBits;

		return literalEncoder.m_Coders[coderIndex];
	}

	#Init_3(): void {
		const totalStates = 1
			<< this.#encoder._literalEncoder.m_NumPrevBits + this.#encoder._literalEncoder.m_NumPosBits;

		for (let i = 0; i < totalStates; ++i) {
			this.InitBitModels(this.#encoder._literalEncoder.m_Coders[i].m_Encoders);
		}
	}

	#Encode_1(
		obj: any,
		symbol: number,
	): void {
		var bit, context = 1;

		for (let i = 7; i >= 0; --i) {
			bit = symbol >> i & 1;
			this.#Encode_3(obj.m_Encoders, context, bit);
			context = context << 1 | bit;
		}
	}

	#EncodeMatched(
		obj: any,
		matchByte: number,
		symbol: number,
	): void {
		let bit, matchBit, state, same = true, context = 1;

		for (let i = 7; i >= 0; --i) {
			bit = symbol >> i & 1;
			state = context;

			if (same) {
				matchBit = matchByte >> i & 1;
				state += 1 + matchBit << 8;
				same = matchBit === bit;
			}

			this.#Encode_3(obj.m_Encoders, state, bit);
			context = context << 1 | bit;
		}
	}

	#createLiteralEncoderEncoder2(obj: any): LiteralDecoderEncoder2 {
		obj.m_Encoders = this.#initArray(768);
		return obj;
	}

	#GetPrice_0(obj: any, matchMode: boolean, matchByte: number, symbol: number): number {
		let bit, context = 1, i = 7, matchBit, price = 0;

		if (matchMode) {
			for (; i >= 0; --i) {
				matchBit = matchByte >> i & 1;
				bit = symbol >> i & 1;
				price += this.GetPrice(
					obj.m_Encoders[(1 + matchBit << 8) + context],
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
			price += this.GetPrice(obj.m_Encoders[context], bit);
			context = context << 1 | bit;
		}
		return price;
	}

	#MakeAsChar(obj: any): void {
		obj.BackPrev = -1;
		obj.Prev1IsChar = 0;
	}

	#MakeAsShortRep(obj: any): void {
		obj.BackPrev = 0;
		obj.Prev1IsChar = 0;
	}

	#createBitTreeDecoder(numBitLevels: number): BitTreeDecoder {
		return {
			NumBitLevels: numBitLevels,
			Models: this.#initArray(1 << numBitLevels),
		};
	}

	// BitTreeDecoder.Decoder
	#Decode_0(rangeDecoder: any): number {
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

	#createBitTreeEncoder(numBitLevels: number): BitTreeEncoder {
		return {
			NumBitLevels: numBitLevels,
			Models: this.#initArray(1 << numBitLevels),
		};
	}

	#Encode_2(
		obj: any,
		symbol: number,
	): void {
		var bit, bitIndex, m = 1;
		for (bitIndex = obj.NumBitLevels; bitIndex != 0;) {
			bitIndex -= 1;
			bit = symbol >>> bitIndex & 1;
			this.#Encode_3(obj.Models, m, bit);
			m = m << 1 | bit;
		}
	}

	#GetPrice_1(obj: any, symbol: number): number {
		var bit, bitIndex, m = 1, price = 0;
		for (bitIndex = obj.NumBitLevels; bitIndex != 0;) {
			bitIndex -= 1;
			bit = symbol >>> bitIndex & 1;
			price += this.GetPrice(obj.Models[m], bit);
			m = (m << 1) + bit;
		}
		return price;
	}

	#ReverseEncode(symbol: number): void {
		const posAlignEncoder = this.#compressor.chunker.encoder._posAlignEncoder;

		var bit, m = 1;
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
		obj: any,
		symbol: number,
	): number {
		let bit, m = 1, price = 0;

		for (let i = obj.NumBitLevels; i != 0; i -= 1) {
			bit = symbol & 1;
			symbol >>>= 1;
			price += this.GetPrice(obj.Models[m], bit);
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
		var bit, m = 1, price = 0;
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
		const rangeDecoder = this.#decompressor.chunker.decoder.m_RangeDecoder;

		let newBound, prob = probs[index];
		newBound = (rangeDecoder.Range >>> 11) * prob;

		if ((rangeDecoder.Code ^ this.#MIN_INT32) < (newBound ^ this.#MIN_INT32)) {
			rangeDecoder.Range = newBound;
			probs[index] = prob + (2_048 - prob >>> 5) << 16 >> 16;
			if (!(rangeDecoder.Range & -16777216)) {
				rangeDecoder.Code = rangeDecoder.Code << 8 | this.#read(rangeDecoder.Stream);
				rangeDecoder.Range <<= 8;
			}

			return 0;
		} else {
			rangeDecoder.Range -= newBound;
			rangeDecoder.Code -= newBound;
			probs[index] = prob - (prob >>> 5) << 16 >> 16;
			if (!(rangeDecoder.Range & -16777216)) {
				rangeDecoder.Code = rangeDecoder.Code << 8 | this.#read(rangeDecoder.Stream);
				rangeDecoder.Range <<= 8;
			}

			return 1;
		}
	}

	#DecodeDirectBits(numTotalBits: number): number {
		const rangeDecoder = this.#decompressor.chunker.decoder.m_RangeDecoder;
		let result = 0;

		for (let i = numTotalBits; i != 0; i -= 1) {
			rangeDecoder.Range >>>= 1;
			let t = rangeDecoder.Code - rangeDecoder.Range >>> 31;
			rangeDecoder.Code -= rangeDecoder.Range & t - 1;
			result = result << 1 | 1 - t;

			if (!(rangeDecoder.Range & -16777216)) {
				rangeDecoder.Code = rangeDecoder.Code << 8 | this.#read(rangeDecoder.Stream);
				rangeDecoder.Range <<= 8;
			}
		}

		return result;
	}

	#Init_8(): void {
		this.#decoder.m_RangeDecoder.Code = 0;
		this.#decoder.m_RangeDecoder.Range = -1;

		for (let i = 0; i < 5; ++i) {
			this.#decoder.m_RangeDecoder.Code = this.#decoder.m_RangeDecoder.Code << 8
				| this.#read(this.#decoder.m_RangeDecoder.Stream);
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
		const rangeEncoder = this.#compressor.chunker.encoder._rangeEncoder;

		var newBound, prob = probs[index];
		newBound = (rangeEncoder.Range >>> 11) * prob;

		if (!symbol) {
			rangeEncoder.Range = newBound;
			probs[index] = prob + (2_048 - prob >>> 5) << 16 >> 16;
		} else {
			rangeEncoder.Low = this.#add(
				rangeEncoder.Low,
				this.#and(this.#fromInt(newBound), [4294967295, 0]),
			);
			rangeEncoder.Range -= newBound;
			probs[index] = prob - (prob >>> 5) << 16 >> 16;
		}

		if (!(rangeEncoder.Range & -16777216)) {
			rangeEncoder.Range <<= 8;
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
			if (!(rangeEncoder.Range & -16777216)) {
				rangeEncoder.Range <<= 8;
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

		const LowHi = this.#lowBits_0(this.#shru(rangeEncoder.Low, 32));
		if (LowHi != 0 || this.#compare(rangeEncoder.Low, [4278190080, 0]) < 0) {
			rangeEncoder._position = this.#add(
				rangeEncoder._position,
				this.#fromInt(rangeEncoder._cacheSize),
			);

			let temp = rangeEncoder._cache;
			do {
				this.#write(rangeEncoder.Stream, temp + LowHi);
				temp = 255;
			} while ((rangeEncoder._cacheSize -= 1) != 0);

			rangeEncoder._cache = this.#lowBits_0(rangeEncoder.Low) >>> 24;
		}

		rangeEncoder._cacheSize += 1;
		rangeEncoder.Low = this.#shl(this.#and(rangeEncoder.Low, [16777215, 0]), 8);
	}

	GetPrice(Prob: number, symbol: number): number {
		return this.#probPrices[
			((Prob - symbol ^ -symbol) & 2047) >>> 2
		];
	}

	#decode(utf: number[]): string | number[] {
		let j = 0, x, y, z, l = utf.length, buf = [], charCodes = [];

		for (let i = 0; i < l; ++i, ++j) {
			x = utf[i] & 255;
			if (!(x & 128)) {
				if (!x) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				charCodes[j] = x;
			} else if ((x & 224) == 192) {
				if (i + 1 >= l) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				y = utf[++i] & 255;
				if ((y & 192) != 128) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				charCodes[j] = ((x & 31) << 6) | (y & 63);
			} else if ((x & 240) == 224) {
				if (i + 2 >= l) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				y = utf[++i] & 255;
				if ((y & 192) != 128) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				z = utf[++i] & 255;
				if ((z & 192) != 128) {
					// It appears that this is binary data, so it cannot be converted to
					// a string, so just send it back.
					return utf;
				}
				charCodes[j] = ((x & 15) << 12) | ((y & 63) << 6) | (z & 63);
			} else {
				// It appears that this is binary data, so it cannot be converted to
				// a string, so just send it back.
				return utf;
			}
			if (j == 16383) {
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

	encode(inputString: string | Uint8Array): number[] | Uint8Array {
		let ch, chars = [], elen = 0, l = inputString.length;

		// Be able to handle binary arrays and buffers.
		if (typeof inputString === "object") {
			return inputString;
		} else {
			this.#getChars(inputString, 0, l, chars, 0);
		}

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
		data: string | Uint8Array | ArrayBuffer,
		mode: keyof typeof this.CompressionModes = 5,
	): Int8Array {
		const encodedData = this.encode(data);
		const compressionMode = this.CompressionModes[mode];

		this.#byteArrayCompressor(
			encodedData,
			compressionMode,
		);

		while (this.#processChunkEncode());

		const compressedByteArray = this.#toByteArray(this.#compressor.output);
		return new Int8Array(compressedByteArray);
	}

	public decompress(
		bytearray: Uint8Array | ArrayBuffer,
	): Int8Array | string {
		this.#byteArrayDecompressor(bytearray);

		while (this.#processChunkDecode());

		const decodedByteArray = this.#toByteArray(this.#decompressor.output);
		const decoded = this.#decode(decodedByteArray);

		return decoded instanceof Array
			? new Int8Array(decoded)
			: decoded;
	}
}

type CompressionMode = keyof LZMA["CompressionModes"];

/**
 * Compresses data using LZMA algorithm
 *
 * @param data Data to compress - can be string, Uint8Array or ArrayBuffer
 * @param mode Compression mode (1-9), defaults to 5
 * @returns Compressed data as Int8Array
 */
export function compress(
	data: string | Uint8Array | ArrayBuffer,
	mode: CompressionMode = 5,
): Int8Array {
	const lzma = new LZMA();
	return lzma.compress(data, mode);
}

/**
 * Decompresses LZMA compressed data
 *
 * @param data Compressed data as Uint8Array or ArrayBuffer
 * @returns Decompressed data as string if input was string, or Int8Array if input was binary
 */
export function decompress(
	data: Uint8Array | ArrayBuffer,
): string | Int8Array {
	const lzma = new LZMA();
	return lzma.decompress(data);
}
