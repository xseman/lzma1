/**
 * LZMA encoder base: codes the symbols chosen by a subclass and keeps the
 * price tables the subclasses use to choose between symbols.
 *
 * Subclasses implement `getNextSymbol()`:
 * - `LzmaEncoderFast` uses simple heuristics (levels 1-3).
 * - `LzmaEncoderNormal` searches for the cheapest symbol sequence (levels 4-9).
 *
 * Ported from XZ for Java (0BSD), `src/org/tukaani/xz/lzma/LZMAEncoder.java`,
 * by Lasse Collin and Igor Pavlov. The LZMA2 entry points and chunk limits
 * are not ported; this library produces only LZMA1 (".lzma") streams. The
 * inner coder classes take their outer encoder (or the range encoder) as
 * an explicit parameter where Java captures it implicitly.
 */

import type {
	LzEncoder,
	Matches,
} from "./lz-encoder.js";
import {
	ALIGN_BITS,
	ALIGN_MASK,
	ALIGN_SIZE,
	DIST_ALIGN,
	DIST_MODEL_END,
	DIST_MODEL_START,
	DIST_SLOT_BITS,
	DIST_SLOT_OFFSET,
	DIST_SLOTS,
	DIST_STATES,
	distSpecialOffset,
	FULL_DISTANCES,
	getDistState,
	IS_MATCH,
	IS_REP,
	IS_REP0,
	IS_REP0_LONG,
	IS_REP1,
	IS_REP2,
	isLiteralState,
	LEN_CHOICE,
	LEN_CHOICE2,
	LEN_HIGH,
	LEN_LOW,
	LEN_MID,
	LengthCoder,
	LITERAL,
	LiteralCoder,
	LiteralSubcoder,
	LOW_SYMBOLS,
	LzmaCoder,
	MATCH_LEN,
	MATCH_LEN_MAX,
	MATCH_LEN_MIN,
	MID_SYMBOLS,
	REP_LEN,
	REPS,
	State,
} from "./lzma-coder.js";
import {
	initProbs,
	type Probs,
} from "./range-coder.js";
import {
	getBitPrice,
	getBitTreePrice,
	getDirectBitsPrice,
	getReverseBitTreePrice,
	type RangeEncoder,
} from "./range-encoder.js";

const DIST_PRICE_UPDATE_INTERVAL = FULL_DISTANCES;
const ALIGN_PRICE_UPDATE_INTERVAL = ALIGN_SIZE;

/**
 * Gets an integer [0, 63] matching the highest two bits of an integer.
 * This is like bit scan reverse (BSR) on x86 except that this also
 * cares about the second highest bit.
 */
export function getDistSlot(dist: number): number {
	if (dist <= DIST_MODEL_START && dist >= 0) {
		return dist;
	}

	// 31 - Integer.numberOfLeadingZeros(dist)
	const i = 31 - Math.clz32(dist);
	return (i << 1) + ((dist >>> (i - 1)) & 1);
}

export interface LzmaEncoderConfig {
	lc: number;
	lp: number;
	pb: number;
	dictSize: number;
	niceLen: number;
}

export abstract class LzmaEncoder extends LzmaCoder {
	private rc: RangeEncoder;
	readonly lz: LzEncoder;
	readonly literalEncoder: LiteralEncoder;
	readonly matchLenEncoder: LengthEncoder;
	readonly repLenEncoder: LengthEncoder;
	readonly niceLen: number;

	private distPriceCount = 0;
	private alignPriceCount = 0;
	/** Whether a distance was encoded since the last reset. */
	private distModelsUsed = false;
	/** Whether align bits were encoded since the last reset. */
	private alignModelUsed = false;

	private readonly distSlotPricesSize: number;
	private readonly distSlotPrices: Int32Array[];
	private readonly fullDistPrices = newPriceArray(DIST_STATES, FULL_DISTANCES);
	private readonly alignPrices = new Int32Array(ALIGN_SIZE);

	/**
	 * Symbol chosen by `getNextSymbol()`:
	 * -1 = literal, 0-3 = rep match, 4+ = match with distance `back - REPS`.
	 */
	protected back = 0;
	/** Bytes the match finder is ahead of the encoder. Package-private in Java. */
	readAhead = -1;

	constructor(rc: RangeEncoder, lz: LzEncoder, config: LzmaEncoderConfig) {
		super(config.lc, config.lp, config.pb);
		this.rc = rc;
		this.lz = lz;
		this.niceLen = config.niceLen;

		this.literalEncoder = new LiteralEncoder(this, config.lc, config.lp);
		this.matchLenEncoder = new LengthEncoder(this.probs, MATCH_LEN, config.pb, config.niceLen);
		this.repLenEncoder = new LengthEncoder(this.probs, REP_LEN, config.pb, config.niceLen);

		this.distSlotPricesSize = getDistSlot(config.dictSize - 1) + 1;
		this.distSlotPrices = newPriceArray(DIST_STATES, this.distSlotPricesSize);

		this.reset();
	}

	/**
	 * Prepares for a new, independent input written to `rc` (contract
	 * adaptation: lets a pooled encoder be reused by a later call).
	 */
	restart(rc: RangeEncoder): void {
		this.rc = rc;
		this.lz.reset();
		this.reset();
	}

	/**
	 * Gets the next LZMA symbol.
	 *
	 * There are three types of symbols: literal (a single byte),
	 * repeated match, and normal match. The symbol is indicated
	 * by the return value and by the variable `back`.
	 *
	 * Literal: `back == -1` and return value is `1`.
	 * The literal itself needs to be read from `lz` separately.
	 *
	 * Repeated match: `back` is in the range [0, 3] and
	 * the return value is the length of the repeated match.
	 *
	 * Normal match: `back - REPS` (`back - 4`)
	 * is the distance of the match and the return value is the length
	 * of the match.
	 */
	protected abstract getNextSymbol(): number;

	override reset(): void {
		super.reset();
		this.matchLenEncoder.reset();
		this.repLenEncoder.reset();
		this.distPriceCount = 0;
		this.alignPriceCount = 0;
		this.distModelsUsed = false;
		this.alignModelUsed = false;

		this.readAhead = -1;
	}

	/** Compress for LZMA1. */
	encode(): void {
		if (!this.lz.isStarted() && !this.encodeInit()) {
			return;
		}

		while (this.encodeSymbol()) {}
	}

	encodeEndMarker(): void {
		// End of stream marker is encoded as a match with the maximum
		// possible distance. The length is ignored by the decoder,
		// but the minimum length has been used by the LZMA SDK.
		//
		// Distance is a 32-bit unsigned integer in LZMA.
		// As an int32, UINT32_MAX becomes -1.
		const posState = (this.lz.getPos() - this.readAhead) & this.posMask;
		this.rc.encodeBit(this.probs, IS_MATCH + (this.state.get() << 4) + posState, 1);
		this.rc.encodeBit(this.probs, IS_REP + this.state.get(), 0);
		this.encodeMatch(-1, MATCH_LEN_MIN, posState);
	}

	private encodeInit(): boolean {
		if (!this.lz.hasEnoughData(0)) {
			return false;
		}

		// The first symbol must be a literal.
		this.skip(1);
		this.rc.encodeBit(this.probs, IS_MATCH + (this.state.get() << 4), 0);
		this.literalEncoder.encodeInit(this.rc);

		--this.readAhead;

		return true;
	}

	private encodeSymbol(): boolean {
		if (!this.lz.hasEnoughData(this.readAhead + 1)) {
			return false;
		}

		const len = this.getNextSymbol();

		const posState = (this.lz.getPos() - this.readAhead) & this.posMask;

		if (this.back === -1) {
			// Literal i.e. eight-bit byte
			this.rc.encodeBit(this.probs, IS_MATCH + (this.state.get() << 4) + posState, 0);
			this.literalEncoder.encode(this.rc);
		} else {
			// Some type of match
			this.rc.encodeBit(this.probs, IS_MATCH + (this.state.get() << 4) + posState, 1);
			if (this.back < REPS) {
				// Repeated match i.e. the same distance
				// has been used earlier.
				this.rc.encodeBit(this.probs, IS_REP + this.state.get(), 1);
				this.encodeRepMatch(this.back, len, posState);
			} else {
				// Normal match
				this.rc.encodeBit(this.probs, IS_REP + this.state.get(), 0);
				this.encodeMatch(this.back - REPS, len, posState);
			}
		}

		this.readAhead -= len;

		return true;
	}

	private encodeMatch(dist: number, len: number, posState: number): void {
		this.state.updateMatch();
		this.matchLenEncoder.encode(this.rc, len, posState);

		const distSlot = getDistSlot(dist);
		this.rc.encodeBitTree(this.probs, DIST_SLOT_OFFSET + (getDistState(len) << DIST_SLOT_BITS), DIST_SLOT_BITS, distSlot);
		this.distModelsUsed = true;

		if (distSlot >= DIST_MODEL_START) {
			const footerBits = (distSlot >>> 1) - 1;
			const base = (2 | (distSlot & 1)) << footerBits;
			const distReduced = dist - base;

			if (distSlot < DIST_MODEL_END) {
				this.rc.encodeReverseBitTree(this.probs, distSpecialOffset(distSlot, base), footerBits, distReduced);
			} else {
				this.rc.encodeDirectBits(distReduced >>> ALIGN_BITS, footerBits - ALIGN_BITS);
				this.rc.encodeReverseBitTree(this.probs, DIST_ALIGN, ALIGN_BITS, distReduced & ALIGN_MASK);
				this.alignModelUsed = true;
				--this.alignPriceCount;
			}
		}

		this.reps[3] = this.reps[2];
		this.reps[2] = this.reps[1];
		this.reps[1] = this.reps[0];
		this.reps[0] = dist;

		--this.distPriceCount;
	}

	private encodeRepMatch(rep: number, len: number, posState: number): void {
		if (rep === 0) {
			this.rc.encodeBit(this.probs, IS_REP0 + this.state.get(), 0);
			this.rc.encodeBit(this.probs, IS_REP0_LONG + (this.state.get() << 4) + posState, len === 1 ? 0 : 1);
		} else {
			const dist = this.reps[rep];
			this.rc.encodeBit(this.probs, IS_REP0 + this.state.get(), 1);

			if (rep === 1) {
				this.rc.encodeBit(this.probs, IS_REP1 + this.state.get(), 0);
			} else {
				this.rc.encodeBit(this.probs, IS_REP1 + this.state.get(), 1);
				this.rc.encodeBit(this.probs, IS_REP2 + this.state.get(), rep - 2);

				if (rep === 3) {
					this.reps[3] = this.reps[2];
				}

				this.reps[2] = this.reps[1];
			}

			this.reps[1] = this.reps[0];
			this.reps[0] = dist;
		}

		if (len === 1) {
			this.state.updateShortRep();
		} else {
			this.repLenEncoder.encode(this.rc, len, posState);
			this.state.updateLongRep();
		}
	}

	protected getMatches(): Matches {
		++this.readAhead;
		return this.lz.getMatches();
	}

	protected skip(len: number): void {
		this.readAhead += len;
		this.lz.skip(len);
	}

	getAnyMatchPrice(state: number, posState: number): number {
		return getBitPrice(this.probs[IS_MATCH + (state << 4) + posState], 1);
	}

	getNormalMatchPrice(anyMatchPrice: number, state: number): number {
		return anyMatchPrice
			+ getBitPrice(this.probs[IS_REP + state], 0);
	}

	getAnyRepPrice(anyMatchPrice: number, state: number): number {
		return anyMatchPrice
			+ getBitPrice(this.probs[IS_REP + state], 1);
	}

	getShortRepPrice(anyRepPrice: number, state: number, posState: number): number {
		return anyRepPrice
			+ getBitPrice(this.probs[IS_REP0 + state], 0)
			+ getBitPrice(this.probs[IS_REP0_LONG + (state << 4) + posState], 0);
	}

	getLongRepPrice(anyRepPrice: number, rep: number, state: number, posState: number): number {
		let price = anyRepPrice;

		if (rep === 0) {
			price += getBitPrice(this.probs[IS_REP0 + state], 0)
				+ getBitPrice(this.probs[IS_REP0_LONG + (state << 4) + posState], 1);
		} else {
			price += getBitPrice(this.probs[IS_REP0 + state], 1);

			if (rep === 1) {
				price += getBitPrice(this.probs[IS_REP1 + state], 0);
			} else {
				price += getBitPrice(this.probs[IS_REP1 + state], 1)
					+ getBitPrice(this.probs[IS_REP2 + state], rep - 2);
			}
		}

		return price;
	}

	getLongRepAndLenPrice(rep: number, len: number, state: number, posState: number): number {
		const anyMatchPrice = this.getAnyMatchPrice(state, posState);
		const anyRepPrice = this.getAnyRepPrice(anyMatchPrice, state);
		const longRepPrice = this.getLongRepPrice(anyRepPrice, rep, state, posState);
		return longRepPrice + this.repLenEncoder.getPrice(len, posState);
	}

	getMatchAndLenPrice(normalMatchPrice: number, dist: number, len: number, posState: number): number {
		let price = normalMatchPrice
			+ this.matchLenEncoder.getPrice(len, posState);
		const distState = getDistState(len);

		if (dist < FULL_DISTANCES) {
			price += this.fullDistPrices[distState][dist];
		} else {
			// Note that distSlotPrices includes also
			// the price of direct bits.
			const distSlot = getDistSlot(dist);
			price += this.distSlotPrices[distState][distSlot]
				+ this.alignPrices[dist & ALIGN_MASK];
		}

		return price;
	}

	private updateDistPrices(): void {
		this.distPriceCount = DIST_PRICE_UPDATE_INTERVAL;

		if (this.distModelsUsed) {
			computeDistPrices(this.probs, this.distSlotPricesSize, this.distSlotPrices, this.fullDistPrices);
		} else {
			// The models still have their initial probabilities.
			const initial = getInitialPrices();
			for (let distState = 0; distState < DIST_STATES; ++distState) {
				this.distSlotPrices[distState].set(initial.distSlotPrices[distState].subarray(0, this.distSlotPricesSize));
				this.fullDistPrices[distState].set(initial.fullDistPrices[distState]);
			}
		}
	}

	private updateAlignPrices(): void {
		this.alignPriceCount = ALIGN_PRICE_UPDATE_INTERVAL;

		if (this.alignModelUsed) {
			computeAlignPrices(this.probs, this.alignPrices);
		} else {
			this.alignPrices.set(getInitialPrices().alignPrices);
		}
	}

	/**
	 * Updates the lookup tables used for calculating match distance
	 * and length prices. The updating is skipped for performance reasons
	 * if the tables haven't changed much since the previous update.
	 */
	updatePrices(): void {
		if (this.distPriceCount <= 0) {
			this.updateDistPrices();
		}

		if (this.alignPriceCount <= 0) {
			this.updateAlignPrices();
		}

		this.matchLenEncoder.updatePrices();
		this.repLenEncoder.updatePrices();
	}
}

function computeDistPrices(probs: Probs, distSlotPricesSize: number, distSlotPrices: Int32Array[], fullDistPrices: Int32Array[]): void {
	for (let distState = 0; distState < DIST_STATES; ++distState) {
		for (let distSlot = 0; distSlot < distSlotPricesSize; ++distSlot) {
			distSlotPrices[distState][distSlot] = getBitTreePrice(probs, DIST_SLOT_OFFSET + (distState << DIST_SLOT_BITS), DIST_SLOT_BITS, distSlot);
		}

		for (let distSlot = DIST_MODEL_END; distSlot < distSlotPricesSize; ++distSlot) {
			const count = (distSlot >>> 1) - 1 - ALIGN_BITS;
			distSlotPrices[distState][distSlot] += getDirectBitsPrice(count);
		}

		for (let dist = 0; dist < DIST_MODEL_START; ++dist) {
			fullDistPrices[distState][dist] = distSlotPrices[distState][dist];
		}
	}

	let dist = DIST_MODEL_START;
	for (let distSlot = DIST_MODEL_START; distSlot < DIST_MODEL_END; ++distSlot) {
		const footerBits = (distSlot >>> 1) - 1;
		const base = (2 | (distSlot & 1)) << footerBits;

		const limit = 1 << footerBits;
		for (let i = 0; i < limit; ++i) {
			const distReduced = dist - base;
			const price = getReverseBitTreePrice(probs, distSpecialOffset(distSlot, base), footerBits, distReduced);

			for (let distState = 0; distState < DIST_STATES; ++distState) {
				fullDistPrices[distState][dist] = distSlotPrices[distState][distSlot] + price;
			}

			++dist;
		}
	}
}

function computeAlignPrices(probs: Probs, alignPrices: Int32Array): void {
	for (let i = 0; i < ALIGN_SIZE; ++i) {
		alignPrices[i] = getReverseBitTreePrice(probs, DIST_ALIGN, ALIGN_BITS, i);
	}
}

function newPriceArray(count: number, size: number): Int32Array[] {
	return Array.from({ length: count }, () => new Int32Array(size));
}

export class LiteralEncoder extends LiteralCoder {
	private readonly encoder: LzmaEncoder;
	private readonly subencoders: LiteralSubencoder[];

	constructor(encoder: LzmaEncoder, lc: number, lp: number) {
		super(lc, lp);
		this.encoder = encoder;

		this.subencoders = Array.from(
			{ length: 1 << (lc + lp) },
			(_, i) => new LiteralSubencoder(encoder, LITERAL + 0x300 * i),
		);
	}

	encodeInit(rc: RangeEncoder): void {
		// When encoding the first byte of the stream, there is
		// no previous byte in the dictionary so the encode function
		// wouldn't work.
		this.subencoders[0].encode(rc);
	}

	encode(rc: RangeEncoder): void {
		const encoder = this.encoder;
		const i = this.getSubcoderIndex(
			encoder.lz.getByte(1 + encoder.readAhead),
			encoder.lz.getPos() - encoder.readAhead,
		);
		this.subencoders[i].encode(rc);
	}

	getPrice(curByte: number, matchByte: number, prevByte: number, pos: number, state: number): number {
		const encoder = this.encoder;
		let price = getBitPrice(encoder.probs[IS_MATCH + (state << 4) + (pos & encoder.posMask)], 0);

		const i = this.getSubcoderIndex(prevByte, pos);
		price += isLiteralState(state)
			? this.subencoders[i].getNormalPrice(curByte)
			: this.subencoders[i].getMatchedPrice(curByte, matchByte);

		return price;
	}
}

class LiteralSubencoder extends LiteralSubcoder {
	private readonly encoder: LzmaEncoder;

	constructor(encoder: LzmaEncoder, literalOffset: number) {
		super(encoder.probs, literalOffset);
		this.encoder = encoder;
	}

	encode(rc: RangeEncoder): void {
		const encoder = this.encoder;
		const probs = this.probs;
		let symbol = encoder.lz.getByte(encoder.readAhead) | 0x100;

		if (encoder.state.isLiteral()) {
			let subencoderIndex: number;
			let bit: number;

			do {
				subencoderIndex = symbol >>> 8;
				bit = (symbol >>> 7) & 1;
				rc.encodeBit(probs, this.literalOffset + subencoderIndex, bit);
				symbol <<= 1;
			} while (symbol < 0x10000);
		} else {
			let matchByte = encoder.lz.getByte(encoder.reps[0] + 1 + encoder.readAhead);
			let offset = 0x100;
			let subencoderIndex: number;
			let matchBit: number;
			let bit: number;

			do {
				matchByte <<= 1;
				matchBit = matchByte & offset;
				subencoderIndex = offset + matchBit + (symbol >>> 8);
				bit = (symbol >>> 7) & 1;
				rc.encodeBit(probs, this.literalOffset + subencoderIndex, bit);
				symbol <<= 1;
				offset &= ~(matchByte ^ symbol);
			} while (symbol < 0x10000);
		}

		encoder.state.updateLiteral();
	}

	getNormalPrice(symbol: number): number {
		const probs = this.probs;
		let price = 0;
		let subencoderIndex: number;
		let bit: number;

		symbol |= 0x100;

		do {
			subencoderIndex = symbol >>> 8;
			bit = (symbol >>> 7) & 1;
			price += getBitPrice(probs[this.literalOffset + subencoderIndex], bit);
			symbol <<= 1;
		} while (symbol < (0x100 << 8));

		return price;
	}

	getMatchedPrice(symbol: number, matchByte: number): number {
		const probs = this.probs;
		let price = 0;
		let offset = 0x100;
		let subencoderIndex: number;
		let matchBit: number;
		let bit: number;

		symbol |= 0x100;

		do {
			matchByte <<= 1;
			matchBit = matchByte & offset;
			subencoderIndex = offset + matchBit + (symbol >>> 8);
			bit = (symbol >>> 7) & 1;
			price += getBitPrice(probs[this.literalOffset + subencoderIndex], bit);
			symbol <<= 1;
			offset &= ~(matchByte ^ symbol);
		} while (symbol < (0x100 << 8));

		return price;
	}
}

export class LengthEncoder extends LengthCoder {
	/**
	 * The prices are updated after at least
	 * `PRICE_UPDATE_INTERVAL` many lengths
	 * have been encoded with the same posState.
	 */
	private static readonly PRICE_UPDATE_INTERVAL = 32;

	private readonly counters: Int32Array;
	private readonly prices: Int32Array[];
	/** Whether a length was encoded since the last reset. */
	private used = false;

	constructor(probs: Probs, coder: number, pb: number, niceLen: number) {
		super(probs, coder);
		const posStates = 1 << pb;
		this.counters = new Int32Array(posStates);

		// Always allocate at least LOW_SYMBOLS + MID_SYMBOLS because
		// it makes updatePrices slightly simpler. The prices aren't
		// usually needed anyway if niceLen < 18.
		const lenSymbols = Math.max(niceLen - MATCH_LEN_MIN + 1, LOW_SYMBOLS + MID_SYMBOLS);
		this.prices = newPriceArray(posStates, lenSymbols);
	}

	reset(): void {
		// Reset counters to zero to force price update before
		// the prices are needed.
		this.counters.fill(0);
		this.used = false;
	}

	encode(rc: RangeEncoder, len: number, posState: number): void {
		len -= MATCH_LEN_MIN;

		if (len < LOW_SYMBOLS) {
			rc.encodeBit(this.probs, this.coder + LEN_CHOICE, 0);
			rc.encodeBitTree(this.probs, this.coder + LEN_LOW + posState * LOW_SYMBOLS, 3, len);
		} else {
			rc.encodeBit(this.probs, this.coder + LEN_CHOICE, 1);
			len -= LOW_SYMBOLS;

			if (len < MID_SYMBOLS) {
				rc.encodeBit(this.probs, this.coder + LEN_CHOICE2, 0);
				rc.encodeBitTree(this.probs, this.coder + LEN_MID + posState * MID_SYMBOLS, 3, len);
			} else {
				rc.encodeBit(this.probs, this.coder + LEN_CHOICE2, 1);
				rc.encodeBitTree(this.probs, this.coder + LEN_HIGH, 8, len - MID_SYMBOLS);
			}
		}

		--this.counters[posState];
		this.used = true;
	}

	getPrice(len: number, posState: number): number {
		return this.prices[posState][len - MATCH_LEN_MIN];
	}

	updatePrices(): void {
		for (let posState = 0; posState < this.counters.length; ++posState) {
			if (this.counters[posState] <= 0) {
				this.counters[posState] = LengthEncoder.PRICE_UPDATE_INTERVAL;
				this.updatePosStatePrices(posState);
			}
		}
	}

	private updatePosStatePrices(posState: number): void {
		if (this.used) {
			computeLengthPrices(this.probs, this.coder, posState, this.prices[posState]);
		} else {
			// The model still has its initial probabilities.
			const prices = this.prices[posState];
			prices.set(getInitialPrices().lengthPrices.subarray(0, prices.length));
		}
	}
}

function computeLengthPrices(probs: Probs, coder: number, posState: number, prices: Int32Array): void {
	let choice0Price = getBitPrice(probs[coder + LEN_CHOICE], 0);

	let i = 0;
	for (; i < LOW_SYMBOLS; ++i) {
		prices[i] = choice0Price
			+ getBitTreePrice(probs, coder + LEN_LOW + posState * LOW_SYMBOLS, 3, i);
	}

	choice0Price = getBitPrice(probs[coder + LEN_CHOICE], 1);
	let choice1Price = getBitPrice(probs[coder + LEN_CHOICE2], 0);

	for (; i < LOW_SYMBOLS + MID_SYMBOLS; ++i) {
		prices[i] = choice0Price + choice1Price
			+ getBitTreePrice(probs, coder + LEN_MID + posState * MID_SYMBOLS, 3, i - LOW_SYMBOLS);
	}

	choice1Price = getBitPrice(probs[coder + LEN_CHOICE2], 1);

	for (; i < prices.length; ++i) {
		prices[i] = choice0Price + choice1Price
			+ getBitTreePrice(probs, coder + LEN_HIGH, 8, i - LOW_SYMBOLS - MID_SYMBOLS);
	}
}

interface InitialPrices {
	distSlotPrices: Int32Array[];
	fullDistPrices: Int32Array[];
	alignPrices: Int32Array;
	/** Prices of all lengths, the same for every length coder and position state. */
	lengthPrices: Int32Array;
}

let initialPrices: InitialPrices | undefined;

/**
 * Price tables for models that still have their initial probabilities.
 * They are the same for every encoder, so they are computed once, by the
 * same functions the encoders use, on an array of initial probabilities.
 */
function getInitialPrices(): InitialPrices {
	if (initialPrices === undefined) {
		const probs = new Uint16Array(LITERAL);
		initProbs(probs);

		const distSlotPrices = newPriceArray(DIST_STATES, DIST_SLOTS);
		const fullDistPrices = newPriceArray(DIST_STATES, FULL_DISTANCES);
		computeDistPrices(probs, DIST_SLOTS, distSlotPrices, fullDistPrices);

		const alignPrices = new Int32Array(ALIGN_SIZE);
		computeAlignPrices(probs, alignPrices);

		const lengthPrices = new Int32Array(MATCH_LEN_MAX - MATCH_LEN_MIN + 1);
		computeLengthPrices(probs, MATCH_LEN, 0, lengthPrices);

		initialPrices = { distSlotPrices, fullDistPrices, alignPrices, lengthPrices };
	}

	return initialPrices;
}
