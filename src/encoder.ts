import {
	LenEncoder,
	type RangeEncoder as LenRangeEncoder,
} from "./len-coder.js";
import { LitCoder } from "./lit-coder.js";
import type { BaseStream } from "./streams.js";
import type { LiteralDecoderEncoder2 } from "./utils.js";
import {
	add64,
	type BitTree,
	compare64,
	create64,
	createBitTree,
	fromInt64,
	G_FAST_POS,
	getBitPrice,
	getLenToPosState,
	initArray,
	initBitModels,
	lowBits64,
	PROB_PRICES,
} from "./utils.js";

const bitTreePriceCache = new Map<string, number>();

/**
 * Calculate price for direct bit encoding
 */
function getDirectBitsPrice(numBits: number): number {
	return numBits << 6;
}

/**
 * Get price for bit tree encoding with caching
 */
function getBitTreePrice(bitTree: BitTree, symbol: number): number {
	const cacheKey = `${bitTree.numBitLevels}-${symbol}`;

	if (bitTreePriceCache.has(cacheKey)) {
		return bitTreePriceCache.get(cacheKey)!;
	}

	let price = 0;
	let modelIndex = 1;

	for (let bitIndex = bitTree.numBitLevels; bitIndex > 0; bitIndex--) {
		const bit = (symbol >>> (bitIndex - 1)) & 1;
		price += getBitPrice(bitTree.models[modelIndex], bit);
		modelIndex = (modelIndex << 1) + bit;
	}

	if (bitTreePriceCache.size < 10000) {
		bitTreePriceCache.set(cacheKey, price);
	}

	return price;
}

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

export interface Optimum {
	state?: number;
	price?: number;
	posPrev?: number;
	backPrev?: number;
	prev1IsChar?: number;
	prev2?: number;
	posPrev2?: number;
	backPrev2?: number;
	backs0?: number;
	backs1?: number;
	backs2?: number;
	backs3?: number;
}

interface RangeEncoder {
	stream: {
		buf: number[];
		count: number;
	} | null;
	rrange: number;
	cache: number;
	low: [number, number];
	cacheSize: number;
	position: [number, number];
	encodeBit(probs: number[], index: number, bit: number): void;
	encodeBitTree(tree: BitTree, symbol: number): void;
	encodeDirectBits(value: number, bits: number): void;
}

/**
 * LZMA Encoder State - Encapsulates all encoder state management
 */
class EncoderState {
	// Core state
	public state: number = 0;
	public previousByte: number = 0;
	public position: [number, number] = [0, 0];

	// Repetition distances (LZ77 back-references)
	public repDistances: [number, number, number, number] = [0, 0, 0, 0];

	// Match finding state
	public longestMatchLength: number = 0;
	public longestMatchWasFound: boolean = false;
	public additionalOffset: number = 0;

	// Probability models for different encoding decisions
	public isMatch: number[] = initArray(0xC0);
	public isRep: number[] = initArray(0x0C);
	public isRepG0: number[] = initArray(0x0C);
	public isRepG1: number[] = initArray(0x0C);
	public isRepG2: number[] = initArray(0x0C);
	public isRep0Long: number[] = initArray(0xC0);

	/**
	 * Initialize all probability models to default values
	 */
	initModels(): void {
		initBitModels(this.isMatch);
		initBitModels(this.isRep);
		initBitModels(this.isRepG0);
		initBitModels(this.isRepG1);
		initBitModels(this.isRepG2);
		initBitModels(this.isRep0Long);
	}

	/**
	 * Update repetition distances when a new match is found
	 */
	updateRepDistances(newDistance: number, repIndex: number): void {
		if (repIndex === 0) {
			// New match becomes rep0, shift others
			this.repDistances[3] = this.repDistances[2];
			this.repDistances[2] = this.repDistances[1];
			this.repDistances[1] = this.repDistances[0];
			this.repDistances[0] = newDistance;
		} else {
			// Move specific rep to front, shift others
			const temp = this.repDistances[repIndex];
			for (let i = repIndex; i > 0; i--) {
				this.repDistances[i] = this.repDistances[i - 1];
			}
			this.repDistances[0] = temp;
		}
	}
}

/**
 * Position Encoder - Handles position slot and alignment encoding
 */
class PositionEncoder {
	private posSlotEncoder: BitTree[] = [];
	private posEncoders: number[] = initArray(0x72);
	private posAlignEncoder: BitTree;

	constructor() {
		// Initialize position slot encoders for different length states
		for (let lenState = 0; lenState < 4; lenState++) {
			this.posSlotEncoder[lenState] = createBitTree(6);
		}
		this.posAlignEncoder = createBitTree(4);
	}

	/**
	 * Initialize all position models
	 */
	init(): void {
		for (const encoder of this.posSlotEncoder) {
			initBitModels(encoder.models);
		}
		initBitModels(this.posEncoders);
		initBitModels(this.posAlignEncoder.models);
	}

	/**
	 * Encode position using optimal method
	 */
	encodePosition(
		distance: number,
		lenState: number,
		rangeEncoder: RangeEncoder,
	): void {
		const posSlot = this.getPosSlot(distance);
		rangeEncoder.encodeBitTree(this.posSlotEncoder[lenState], posSlot);

		if (posSlot >= 4) {
			const footerBits = (posSlot >> 1) - 1;
			const baseVal = (2 | (posSlot & 1)) << footerBits;
			const posReduced = distance - baseVal;

			if (posSlot < 14) {
				// Use position encoders for middle range
				this.encodeReverseBits(posReduced, footerBits, rangeEncoder);
			} else {
				// Use direct bits for high range + alignment
				rangeEncoder.encodeDirectBits(posReduced >> 4, footerBits - 4);
				rangeEncoder.encodeBitTree(this.posAlignEncoder, posReduced & 0x0F);
			}
		}
	}

	/**
	 * Calculate price for encoding a position
	 */
	getPositionPrice(distance: number, lenState: number): number {
		const posSlot = this.getPosSlot(distance);
		let price = getBitTreePrice(this.posSlotEncoder[lenState], posSlot);

		if (posSlot >= 4) {
			const footerBits = (posSlot >> 1) - 1;
			const baseVal = (2 | (posSlot & 1)) << footerBits;
			const posReduced = distance - baseVal;

			if (posSlot < 14) {
				price += this.getReverseBitsPrice(posReduced, footerBits);
			} else {
				price += getDirectBitsPrice(footerBits - 4);
				price += getBitTreePrice(this.posAlignEncoder, posReduced & 0x0F);
			}
		}

		return price;
	}

	private getPosSlot(distance: number): number {
		if (distance < 4) return distance;
		if (distance < (1 << (31 - 11))) {
			return G_FAST_POS[distance >> 6] + 12;
		}
		return G_FAST_POS[distance >> 26] + 52;
	}

	private encodeReverseBits(
		value: number,
		numBits: number,
		rangeEncoder: RangeEncoder,
	): void {
		let modelIndex = 1;
		for (let i = 0; i < numBits; i++) {
			const bit = value & 1;
			rangeEncoder.encodeBit(this.posEncoders, modelIndex, bit);
			modelIndex = (modelIndex << 1) | bit;
			value >>>= 1;
		}
	}

	private getReverseBitsPrice(value: number, numBits: number): number {
		let price = 0;
		let modelIndex = 1;
		for (let i = 0; i < numBits; i++) {
			const bit = value & 1;
			price += getBitPrice(this.posEncoders[modelIndex], bit);
			modelIndex = (modelIndex << 1) | bit;
			value >>>= 1;
		}
		return price;
	}
}

/**
 * LZMA Encoder class that handles compression operations
 */
export class Encoder implements LenRangeEncoder {
	private encoderState = new EncoderState();
	private positionEncoder = new PositionEncoder();

	// Core state properties
	_state: number = 0;
	_previousByte: number = 0;
	_distTableSize: number = 0;
	_longestMatchWasFound: number = 0;
	_optimumEndIndex: number = 0;
	_optimumCurrentIndex: number = 0;
	_additionalOffset: number = 0;

	// Dictionary and match finding
	_dictionarySize: number = 0;
	_matchFinder: MatchFinder | null = null;
	_dictionarySizePrev: number = 0;
	_numFastBytes: number = 0;

	// Literal encoding configuration
	_numLiteralContextBits: number = 0;
	_numLiteralPosStateBits: number = 0;
	_posStateBits: number = 0;
	_posStateMask: number = 0;

	// Stream and processing state
	_needReleaseMFStream: number = 0;
	_inStream: BaseStream | null = null;
	_finished: number = 0;
	nowPos64: [number, number] = [0, 0];

	// Distance and repetition arrays
	_repDistances: number[] = initArray(4);
	_optimum: Optimum[] = [];

	// Range encoder
	_rangeEncoder: RangeEncoder = {
		stream: {
			buf: [],
			count: 0,
		},
		rrange: 0,
		cache: 0,
		low: [0, 0],
		cacheSize: 0,
		position: [0, 0],
		encodeBit: () => {},
		encodeBitTree: () => {},
		encodeDirectBits: () => {},
	};

	// Bit model arrays for different types of encoding decisions
	_isMatch: number[] = initArray(0xC0);
	_isRep: number[] = initArray(0x0C);
	_isRepG0: number[] = initArray(0x0C);
	_isRepG1: number[] = initArray(0x0C);
	_isRepG2: number[] = initArray(0x0C);
	_isRep0Long: number[] = initArray(0xC0);

	// Position and alignment encoders
	_posSlotEncoder: BitTree[] = [];
	_posEncoders: number[] = initArray(0x72);
	_posAlignEncoder: BitTree | null = null;

	// Length encoders
	_lenEncoder: LenEncoder | null = null;
	_repMatchLenEncoder: LenEncoder | null = null;

	// Literal encoder
	_literalEncoder: LitCoder | null = null;

	// Distance and price arrays
	_matchDistances: number[] = [];
	_posSlotPrices: number[] = [];
	_distancesPrices: number[] = [];
	_alignPrices: number[] = initArray(0x10);
	_matchPriceCount: number = 0;
	_alignPriceCount: number = 0;

	// Optimization arrays
	reps: number[] = initArray(4);
	repLens: number[] = initArray(4);

	// Processing counters
	processedInSize: [number, number][] = [[0, 0]];
	processedOutSize: [number, number][] = [[0, 0]];
	finished: number[] = [0];
	properties: number[] = initArray(5);
	tempPrices: number[] = initArray(0x80); // 128

	// Match finding properties
	_longestMatchLength: number = 0;
	_matchFinderType: number = 1;
	_numDistancePairs: number = 0;
	_numFastBytesPrev: number = -1;
	backRes: number = 0;

	constructor() {
		// Encoder is initialized with default values above
		// Additional initialization will be done through specific init methods
	}

	/**
	 * Initialize basic encoder state
	 */
	baseInit(): void {
		this._state = 0;
		this._previousByte = 0;

		for (let i = 0; i < 4; ++i) {
			this._repDistances[i] = 0;
		}
	}

	/**
	 * Get optimum array
	 */
	getOptimum(): Optimum[] {
		return this._optimum;
	}

	/**
	 * Get back result
	 */
	getBackRes(): number {
		return this.backRes;
	}

	setBackRes(backRes: number): void {
		this.backRes = backRes;
	}

	init(): void {
		this.baseInit();

		this.encoderState.initModels();
		this.positionEncoder.init();

		// Initialize optimum array properly
		this._optimum = [];
		for (let i = 0; i < 0x1000; i++) {
			this._optimum[i] = {};
		}

		this.initEncoderState();
		initBitModels(this._isMatch);
		initBitModels(this._isRep0Long);
		initBitModels(this._isRep);
		initBitModels(this._isRepG0);
		initBitModels(this._isRepG1);
		initBitModels(this._isRepG2);
		initBitModels(this._posEncoders);

		this.initLiteralEncoder();
		for (let i = 0; i < 4; ++i) {
			initBitModels(this._posSlotEncoder[i].models);
		}

		if (this._lenEncoder) {
			this._lenEncoder.init(1 << this._posStateBits);
		}
		if (this._repMatchLenEncoder) {
			this._repMatchLenEncoder.init(1 << this._posStateBits);
		}
		if (this._posAlignEncoder) {
			initBitModels(this._posAlignEncoder.models);
		}

		this._longestMatchWasFound = 0;
		this._optimumEndIndex = 0;
		this._optimumCurrentIndex = 0;
		this._additionalOffset = 0;
	}

	/**
	 * Initialize encoder range coder
	 */
	initEncoderState(): void {
		this._rangeEncoder.low = [0, 0];
		this._rangeEncoder.rrange = 0xFFFFFFFF;
		this._rangeEncoder.cacheSize = 1;
		this._rangeEncoder.cache = 0;
		this._rangeEncoder.position = [0, 0];
	}

	/**
	 * Initialize literal encoder
	 */
	initLiteralEncoder(): void {
		const totalStates = 1 << (this._literalEncoder!.numPrevBits + this._literalEncoder!.numPosBits);

		for (let i = 0; i < totalStates; ++i) {
			initBitModels(this._literalEncoder!.coders[i].decoders);
		}
	}

	/**
	 * Create optimum structures
	 */
	createOptimumStructures(): void {
		for (let i = 0; i < 0x1000; ++i) {
			this._optimum[i] = {};
		}

		for (let i = 0; i < 4; ++i) {
			this._posSlotEncoder[i] = createBitTree(6);
		}
	}

	/**
	 * Create length price table encoder
	 */
	createLenPriceTableEncoder(): LenEncoder {
		const encoder = new LenEncoder();
		encoder.initPriceTable();
		return encoder;
	}

	/**
	 * Create literal encoder encoder2
	 */
	createLiteralEncoderEncoder2(): LiteralDecoderEncoder2 {
		const encoder = {
			decoders: initArray(0x300),
		} as LiteralDecoderEncoder2;

		return encoder;
	}

	/**
	 * Create literal encoder
	 */
	createLiteralEncoder(): void {
		// Check if we need to recreate the encoder
		if (
			this._literalEncoder != null
			&& this._literalEncoder.numPrevBits == this._numLiteralContextBits
			&& this._literalEncoder.numPosBits == this._numLiteralPosStateBits
		) {
			return;
		}

		// Replace #LZMA_Encoder_LiteralEncoder_Create with LitCoder instantiation
		this._literalEncoder = new LitCoder(
			this._numLiteralPosStateBits,
			this._numLiteralContextBits,
		);
	}

	/**
	 * Initialize completely with proper encoder state
	 */
	initialize(): void {
		// Initialize encoder structures first
		this._lenEncoder = this.createLenPriceTableEncoder();
		this._repMatchLenEncoder = this.createLenPriceTableEncoder();
		this._posAlignEncoder = createBitTree(0x04);

		// Initialize optimum array
		this._optimum = [];
		this.createOptimumStructures();

		// Create literal encoder
		this.createLiteralEncoder();

		// Now call init to set up the state
		this.init();
	}

	/**
	 * Configure encoder settings
	 */
	configure(mode: { searchDepth: number; filterStrength: number; modeIndex: number; }): void {
		this.setDictionarySize(0x1 << mode.searchDepth);
		this._numFastBytes = mode.filterStrength;
		this._matchFinderType = mode.modeIndex;

		// lc is always 3, lp is always 0, pb is always 2
		this._numLiteralContextBits = 0x3;
		this._numLiteralPosStateBits = 0x0;
		this._posStateBits = 0x2;
		this._posStateMask = 0x3;
	}

	/**
	 * Set dictionary size
	 */
	setDictionarySize(dictionarySize: number): void {
		this._dictionarySize = dictionarySize;

		let dicLogSize = 0;
		for (; dictionarySize > (1 << dicLogSize); ++dicLogSize);

		this._distTableSize = dicLogSize * 2;
	}

	/**
	 * Encode a bit using range coder
	 */
	encodeBit(probs: number[], index: number, symbol: number): void {
		const rangeEncoder = this._rangeEncoder;

		let newBound, prob = probs[index];
		newBound = (rangeEncoder.rrange >>> 11) * prob;

		if (!symbol) {
			rangeEncoder.rrange = newBound;
			probs[index] = prob + (2048 - prob >>> 5) << 16 >> 16;
		} else {
			// Need helper methods for 64-bit arithmetic
			rangeEncoder.low = add64(
				rangeEncoder.low,
				this.and64(fromInt64(newBound), [0xFFFFFFFF, 0]),
			);
			rangeEncoder.rrange -= newBound;
			probs[index] = prob - (prob >>> 5) << 16 >> 16;
		}

		if (!(rangeEncoder.rrange & -0x1000000)) {
			rangeEncoder.rrange <<= 8;
			this.shiftLow();
		}
	}

	/**
	 * Encode bit tree
	 */
	encodeBitTree(encoder: BitTree, symbol: number): void {
		let bit, bitIndex, m = 1;

		for (bitIndex = encoder.numBitLevels; bitIndex != 0;) {
			bitIndex -= 1;
			bit = symbol >>> bitIndex & 1;
			this.encodeBit(encoder.models, m, bit);
			m = m << 1 | bit;
		}
	}

	/**
	 * Encode literal
	 */
	encodeLiteral(encoder: LiteralDecoderEncoder2, symbol: number): void {
		let bit, context = 1;

		for (let i = 7; i >= 0; --i) {
			bit = (symbol >> i) & 1;
			this.encodeBit(encoder.decoders, context, bit);
			context = context << 1 | bit;
		}
	}

	/**
	 * Encode matched literal
	 */
	encodeMatched(encoder: LiteralDecoderEncoder2, matchByte: number, symbol: number): void {
		let bit, matchBit, state, same = true, context = 1;

		for (let i = 7; i >= 0; --i) {
			bit = (symbol >> i) & 1;
			state = context;

			if (same) {
				matchBit = (matchByte >> i) & 1;
				state += (1 + matchBit) << 8;
				same = matchBit === bit;
			}

			this.encodeBit(encoder.decoders, state, bit);
			context = context << 1 | bit;
		}
	}

	/**
	 * Encode length using direct method calls
	 */
	encodeLength(encoder: LenEncoder, symbol: number, posState: number): void {
		encoder.encode(symbol, posState, this);
	}

	/**
	 * Encode direct bits
	 */
	encodeDirectBits(valueToEncode: number, numTotalBits: number): void {
		const rangeEncoder = this._rangeEncoder;

		for (let i = numTotalBits - 1; i >= 0; i -= 1) {
			rangeEncoder.rrange >>>= 1;
			if ((valueToEncode >>> i & 1) == 1) {
				rangeEncoder.low = add64(rangeEncoder.low, fromInt64(rangeEncoder.rrange));
			}
			if (!(rangeEncoder.rrange & -0x1000000)) {
				rangeEncoder.rrange <<= 8;
				this.shiftLow();
			}
		}
	}

	/**
	 * Reverse encode
	 */
	reverseEncode(symbol: number): void {
		const posAlignEncoder = this._posAlignEncoder;
		if (!posAlignEncoder) return;

		let bit, m = 1;

		for (let i = 0; i < posAlignEncoder.numBitLevels; ++i) {
			bit = symbol & 1;
			this.encodeBit(posAlignEncoder.models, m, bit);
			m = m << 1 | bit;
			symbol >>= 1;
		}
	}

	/**
	 * Reverse encode range
	 */
	reverseEncodeRange(
		startIndex: number,
		numBitLevels: number,
		symbol: number,
	): void {
		let bit, m = 1;

		for (let i = 0; i < numBitLevels; ++i) {
			bit = symbol & 1;
			this.encodeBit(this._posEncoders, startIndex + m, bit);
			m = m << 1 | bit;
			symbol >>= 1;
		}
	}

	/**
	 * Write end marker
	 */
	writeEndMarker(positionState: number): void {
		this.encodeBit(
			this._isMatch,
			(this._state << 4) + positionState,
			1,
		);

		this.encodeBit(
			this._isRep,
			this._state,
			0,
		);

		this._state = this._state < 7 ? 7 : 10;
		this.encodeLength(this._lenEncoder!, 0, positionState);

		const posSlot = 63;
		const lenToPosState = getLenToPosState(2); // Length to position state for minimum length

		this.encodeBitTree(this._posSlotEncoder[lenToPosState], posSlot);

		this.encodeDirectBits(67108863, 26);
		this.reverseEncode(15);
	}

	/**
	 * Encode length with price table update
	 */
	encodeLengthWithPriceUpdate(encoder: LenEncoder, symbol: number, posState: number): void {
		encoder.encodeWithUpdate(symbol, posState, this);
	}

	private and64(a: [number, number], b: [number, number]): [number, number] {
		const highBits = ~~Math.max(
			Math.min(a[1] / 0x100000000, 0x7FFFFFFF),
			-0x80000000,
		) & ~~Math.max(
			Math.min(b[1] / 0x100000000, 0x7FFFFFFF),
			-0x80000000,
		);

		const lowBits = lowBits64(a) & lowBits64(b);

		let high = highBits * 0x100000000;
		let low = lowBits;
		if (lowBits < 0) {
			low += 0x100000000;
		}

		return [low, high];
	}

	private shru64(a: [number, number], n: number): [number, number] {
		n &= 0x3F;
		let shiftFact = this.pwrAsDouble(n);
		let sr = create64(
			Math.floor(a[0] / shiftFact),
			a[1] / shiftFact,
		);
		if (a[1] < 0) {
			sr = add64(sr, this.shl64([2, 0], 0x3F - n));
		}
		return sr;
	}

	private shl64(a: [number, number], n: number): [number, number] {
		let diff, newHigh, newLow, twoToN;
		n &= 0x3F;

		if (a[0] == 0 && a[1] == -9223372036854775808) {
			if (!n) {
				return a;
			}
			return [0, 0];
		}

		if (a[1] < 0) {
			throw new Error("Neg");
		}
		twoToN = this.pwrAsDouble(n);
		newHigh = a[1] * twoToN % 1.8446744073709552E19;
		newLow = a[0] * twoToN;
		diff = newLow - newLow % 0x100000000;
		newHigh += diff;
		newLow -= diff;

		if (newHigh >= 9223372036854775807) {
			newHigh -= 1.8446744073709552E19;
		}

		return [newLow, newHigh];
	}

	private pwrAsDouble(n: number): number {
		if (n <= 0x1E) {
			return 1 << n;
		}

		return this.pwrAsDouble(0x1E) * this.pwrAsDouble(n - 0x1E);
	}

	/**
	 * Shift low helper (proper implementation) - public method for external access
	 */
	shiftLow(): void {
		const rangeEncoder = this._rangeEncoder;

		const LowHi = lowBits64(this.shru64(rangeEncoder.low, 32));
		if (LowHi != 0 || compare64(rangeEncoder.low, [4278190080, 0]) < 0) {
			rangeEncoder.position = add64(
				rangeEncoder.position,
				fromInt64(rangeEncoder.cacheSize),
			);

			let temp = rangeEncoder.cache;
			do {
				this.writeToStream(rangeEncoder.stream, temp + LowHi);
				temp = 255;
			} while ((rangeEncoder.cacheSize -= 1) != 0);

			rangeEncoder.cache = lowBits64(rangeEncoder.low) >>> 24;
		}

		rangeEncoder.cacheSize += 1;
		rangeEncoder.low = this.shl64(this.and64(rangeEncoder.low, [16777215, 0]), 8);
	}

	/**
	 * Write byte to stream
	 */
	private writeToStream(stream: { buf: number[]; count: number; } | null, b: number): void {
		if (!stream) return;

		// Ensure buffer has enough capacity
		if (stream.count >= stream.buf.length) {
			const newSize = Math.max(stream.buf.length * 2, stream.count + 1);
			const newBuf = new Array(newSize);
			for (let i = 0; i < stream.count; i++) {
				newBuf[i] = stream.buf[i];
			}
			stream.buf = newBuf;
		}

		stream.buf[stream.count++] = b << 24 >> 24;
	}

	initRangeEncoder(): void {
		this._rangeEncoder.position = [0, 0];
		this._rangeEncoder.low = [0, 0];
		this._rangeEncoder.rrange = -1;
		this._rangeEncoder.cacheSize = 1;
		this._rangeEncoder.cache = 0;
	}

	/**
	 * Fill alignment prices for position alignment encoder
	 */
	fillAlignPrices(): void {
		for (let i = 0; i < 16; ++i) {
			this._alignPrices[i] = this.reverseGetPrice(this._posAlignEncoder!, i);
		}
		this._alignPriceCount = 0;
	}

	/**
	 * Fill distance prices for position encoders
	 */
	fillDistancesPrices(): void {
		let baseVal, bitTreeEncoder: BitTree, footerBits, posSlot, st, st2;

		for (let i = 4; i < 0x80; ++i) {
			posSlot = this.getPosSlot(i);
			footerBits = (posSlot >> 1) - 1;
			baseVal = (2 | (posSlot & 1)) << footerBits;

			this.tempPrices[i] = this.reverseGetPriceArray(
				this._posEncoders,
				baseVal - posSlot - 1,
				footerBits,
				i - baseVal,
			);
		}

		for (let lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
			bitTreeEncoder = this._posSlotEncoder[lenToPosState];
			st = lenToPosState << 6;

			for (posSlot = 0; posSlot < this._distTableSize; posSlot += 1) {
				this._posSlotPrices[st + posSlot] = this.rangeCoder_Encoder_GetPrice_1(bitTreeEncoder, posSlot);
			}

			for (posSlot = 14; posSlot < this._distTableSize; posSlot += 1) {
				this._posSlotPrices[st + posSlot] += (posSlot >> 1) - 1 - 4 << 6;
			}

			st2 = lenToPosState * 0x80;
			for (let i = 0; i < 4; ++i) {
				this._distancesPrices[st2 + i] = this._posSlotPrices[st + i];
			}

			for (let i = 4; i < 0x80; ++i) {
				this._distancesPrices[st2 + i] = this._posSlotPrices[st + this.getPosSlot(i)] + this.tempPrices[i];
			}
		}

		this._matchPriceCount = 0;
	}

	/**
	 * Get position slot for a distance value
	 */
	getPosSlot(pos: number): number {
		if (pos < 0x800) {
			return G_FAST_POS[pos];
		}

		if (pos < 0x200000) {
			return G_FAST_POS[pos >> 10] + 20;
		}

		return G_FAST_POS[pos >> 20] + 40;
	}

	/**
	 * Get reverse price for bit tree encoder
	 */
	reverseGetPrice(encoder: BitTree, symbol: number): number {
		let bit, m = 1, price = 0;

		for (let i = encoder.numBitLevels; i != 0; i -= 1) {
			bit = symbol & 1;
			symbol >>>= 1;
			price += this.getPrice(encoder.models[m], bit);
			m = m << 1 | bit;
		}

		return price;
	}

	/**
	 * Get reverse price for array of models
	 */
	reverseGetPriceArray(
		Models: number[],
		startIndex: number,
		NumBitLevels: number,
		symbol: number,
	): number {
		let bit, m = 1, price = 0;

		for (let i = NumBitLevels; i != 0; i -= 1) {
			bit = symbol & 1;
			symbol >>>= 1;
			price += PROB_PRICES[((Models[startIndex + m] - bit ^ -bit) & 2047) >>> 2];
			m = m << 1 | bit;
		}

		return price;
	}

	/**
	 * Get price for probability model (optimized)
	 */
	getPrice(Prob: number, symbol: number): number {
		return getBitPrice(Prob, symbol);
	}

	/**
	 * Get price for bit tree encoder (optimized)
	 */
	rangeCoder_Encoder_GetPrice_1(encoder: BitTree, symbol: number): number {
		return getBitTreePrice(encoder, symbol);
	}

	/**
	 * Create encoder optimization structures (optimized)
	 */
	createEncoderStructures(): void {
		// Pre-allocate optimum array with proper size
		// Initialize optimum array properly
		this._optimum = [];
		for (let i = 0; i < 0x1000; i++) {
			this._optimum[i] = {};
		}
		for (let i = 0; i < 0x1000; ++i) {
			this._optimum[i] = {};
		}

		// Initialize position slot encoders
		this._posSlotEncoder = new Array(4);
		for (let i = 0; i < 4; ++i) {
			this._posSlotEncoder[i] = createBitTree(6);
		}
	}

	/**
	 * Create match finder and encoder structures (replaces #Create_2)
	 */
	createMatchFinderAndStructures(): void {
		// Create match finder if needed
		if (!this._matchFinder) {
			const binTree = {} as MatchFinder;
			let numHashBytes = 4;

			if (!this._matchFinderType) {
				numHashBytes = 2;
			}

			// Set match finder type (replaces #SetType)
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

			// Initialize other match finder properties
			binTree._cyclicBufferSize = 0;
			binTree._cyclicBufferPos = 0;
			binTree._streamPos = 0;
			binTree._cutValue = 0xff;
			binTree._matchMaxLen = 0;
			binTree._streamEndWasReached = 0;
			binTree._pos = 0;
			binTree._posLimit = 0;
			binTree._son = [];
			binTree._hash = [];
			binTree._bufferBase = [];
			binTree._blockSize = 0;
			binTree._keepSizeAfter = 0;
			binTree._keepSizeBefore = 0;
			binTree._pointerToLastSafePosition = 0;

			this._matchFinder = binTree;
		}

		// Create literal encoder if needed
		this.createLiteralEncoder();

		// Check if we need to recreate structures
		if (
			this._dictionarySize == this._dictionarySizePrev
			&& this._numFastBytesPrev == this._numFastBytes
		) {
			return;
		}

		// This would call equivalent of #Create_3(0x1000, 0x0112) logic
		// For now, we'll handle the basic setup
		this._dictionarySizePrev = this._dictionarySize;
		this._numFastBytesPrev = this._numFastBytes;
	}

	/**
	 * Get literal encoder subcoder (utility method)
	 */
	getSubCoderUtility(pos: number, prevByte: number): LiteralDecoderEncoder2 {
		// Calculate position mask bits
		const posBits = pos & this._literalEncoder!.posMask;
		const posShifted = posBits << this._literalEncoder!.numPrevBits;

		// Calculate previous byte bits
		const prevByteShift = 0x08 - this._literalEncoder!.numPrevBits;
		const prevByteBits = (prevByte & 0xFF) >>> prevByteShift;

		// Combine position and prevByte bits to get final index
		const coderIndex = posShifted + prevByteBits;

		return this._literalEncoder!.coders[coderIndex];
	}
}
