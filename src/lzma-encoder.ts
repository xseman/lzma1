/**
 * LZMA encoder base: codes the symbols chosen by a subclass and keeps the
 * price tables the subclasses use to choose between symbols.
 *
 * Subclasses implement `getNextSymbol()`:
 * - `LzmaEncoderFast` uses simple heuristics (levels 1-3).
 * - `LzmaEncoderNormal` searches for the cheapest symbol sequence (levels 4-9).
 *
 * Ported from XZ for Java (0BSD) by Lasse Collin and Igor Pavlov.
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
	DIST_SLOT_COUNT,
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
	LITERAL,
	LOW_SYMBOLS,
	LzmaCoder,
	MATCH_LEN,
	MATCH_LEN_MAX,
	MATCH_LEN_MIN,
	MID_SYMBOLS,
	REP_LEN,
	REPS,
	stateAfterLiteral,
	stateAfterLongRep,
	stateAfterMatch,
	stateAfterShortRep,
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
const LEN_PRICE_UPDATE_INTERVAL = 32;

/** Returns the distance slot: roughly 2 * log2(dist), plus the next bit. */
export function getDistSlot(dist: number): number {
	if (dist <= DIST_MODEL_START && dist >= 0) {
		return dist;
	}

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
	readonly niceLen: number;

	readonly matchLenEncoder: LengthEncoder;
	readonly repLenEncoder: LengthEncoder;

	private distPriceCount = 0;
	private alignPriceCount = 0;
	/** Whether a distance or align bits were encoded since the last reset. */
	private distModelsUsed = false;
	private alignModelUsed = false;
	private readonly distSlotPricesSize: number;
	/** Price of each distance slot per distance state, `[distState << 6 | slot]`. */
	private readonly distSlotPrices = new Uint32Array(DIST_STATES << DIST_SLOT_BITS);
	/** Price of each distance below `FULL_DISTANCES` per distance state, `[distState << 7 | dist]`. */
	private readonly fullDistPrices = new Uint32Array(DIST_STATES * FULL_DISTANCES);
	private readonly alignPrices = new Uint32Array(ALIGN_SIZE);

	/**
	 * Symbol chosen by `getNextSymbol()`:
	 * -1 = literal, 0-3 = rep match, 4+ = match with distance `back - REPS`.
	 */
	protected back = 0;
	/** Bytes the match finder is ahead of the encoder. */
	protected readAhead = -1;

	constructor(rc: RangeEncoder, lz: LzEncoder, config: LzmaEncoderConfig) {
		super(config.lc, config.lp, config.pb);
		this.rc = rc;
		this.lz = lz;
		this.niceLen = config.niceLen;

		this.matchLenEncoder = new LengthEncoder(this.probs, MATCH_LEN, config.pb, config.niceLen);
		this.repLenEncoder = new LengthEncoder(this.probs, REP_LEN, config.pb, config.niceLen);
		this.distSlotPricesSize = getDistSlot(config.dictSize - 1) + 1;

		this.reset();
	}

	/** Prepares for a new, independent input written to `rc`. */
	restart(rc: RangeEncoder): void {
		this.rc = rc;
		this.lz.reset();
		this.reset();
	}

	/**
	 * Chooses the next symbol: sets `back` and returns its length.
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

	/** Encodes as much of the buffered input as the lookahead allows. */
	encode(): void {
		if (!this.lz.isStarted() && !this.encodeInit()) {
			return;
		}

		while (this.encodeSymbol()) {}
	}

	/** Encodes the end marker: a match with distance 0xFFFFFFFF. */
	encodeEndMarker(): void {
		const posState = (this.lz.getPos() - this.readAhead) & this.posMask;
		this.rc.encodeBit(this.probs, IS_MATCH + (this.state << 4) + posState, 1);
		this.rc.encodeBit(this.probs, IS_REP + this.state, 0);
		this.encodeMatch(-1, MATCH_LEN_MIN, posState);
	}

	/** The first symbol is always a literal with no previous byte. */
	private encodeInit(): boolean {
		if (!this.lz.hasEnoughData(0)) {
			return false;
		}

		this.skip(1);
		this.rc.encodeBit(this.probs, IS_MATCH + (this.state << 4), 0);
		this.encodeLiteral(this.literalOffset(0, 0));
		--this.readAhead;
		return true;
	}

	private encodeSymbol(): boolean {
		if (!this.lz.hasEnoughData(this.readAhead + 1)) {
			return false;
		}

		const len = this.getNextSymbol();
		const lz = this.lz;
		const rc = this.rc;
		const probs = this.probs;
		const pos = lz.getPos() - this.readAhead;
		const posState = pos & this.posMask;
		const back = this.back;

		if (back === -1) {
			rc.encodeBit(probs, IS_MATCH + (this.state << 4) + posState, 0);
			this.encodeLiteral(this.literalOffset(lz.getByte(1 + this.readAhead), pos));
		} else {
			rc.encodeBit(probs, IS_MATCH + (this.state << 4) + posState, 1);

			if (back < REPS) {
				rc.encodeBit(probs, IS_REP + this.state, 1);
				this.encodeRepMatch(back, len, posState);
			} else {
				rc.encodeBit(probs, IS_REP + this.state, 0);
				this.encodeMatch(back - REPS, len, posState);
			}
		}

		this.readAhead -= len;
		return true;
	}

	private encodeLiteral(offset: number): void {
		const symbol = this.lz.getByte(this.readAhead);

		if (isLiteralState(this.state)) {
			this.rc.encodeLiteral(this.probs, offset, symbol);
		} else {
			const matchByte = this.lz.getByte(this.reps[0] + 1 + this.readAhead);
			this.rc.encodeMatchedLiteral(this.probs, offset, symbol, matchByte);
		}

		this.state = stateAfterLiteral(this.state);
	}

	private encodeMatch(dist: number, len: number, posState: number): void {
		const rc = this.rc;
		const probs = this.probs;
		const reps = this.reps;

		this.state = stateAfterMatch(this.state);
		this.matchLenEncoder.encode(rc, len, posState);

		const distSlot = getDistSlot(dist);
		rc.encodeBitTree(probs, DIST_SLOTS + (getDistState(len) << DIST_SLOT_BITS), DIST_SLOT_BITS, distSlot);
		this.distModelsUsed = true;

		if (distSlot >= DIST_MODEL_START) {
			const footerBits = (distSlot >>> 1) - 1;
			const base = (2 | (distSlot & 1)) << footerBits;
			const distReduced = dist - base;

			if (distSlot < DIST_MODEL_END) {
				rc.encodeReverseBitTree(probs, distSpecialOffset(distSlot, base), footerBits, distReduced);
			} else {
				rc.encodeDirectBits(distReduced >>> ALIGN_BITS, footerBits - ALIGN_BITS);
				rc.encodeReverseBitTree(probs, DIST_ALIGN, ALIGN_BITS, distReduced & ALIGN_MASK);
				this.alignModelUsed = true;
				--this.alignPriceCount;
			}
		}

		reps[3] = reps[2];
		reps[2] = reps[1];
		reps[1] = reps[0];
		reps[0] = dist;
		--this.distPriceCount;
	}

	private encodeRepMatch(rep: number, len: number, posState: number): void {
		const rc = this.rc;
		const probs = this.probs;
		const reps = this.reps;
		const state = this.state;

		if (rep === 0) {
			rc.encodeBit(probs, IS_REP0 + state, 0);
			rc.encodeBit(probs, IS_REP0_LONG + (state << 4) + posState, len === 1 ? 0 : 1);
		} else {
			const dist = reps[rep];
			rc.encodeBit(probs, IS_REP0 + state, 1);

			if (rep === 1) {
				rc.encodeBit(probs, IS_REP1 + state, 0);
			} else {
				rc.encodeBit(probs, IS_REP1 + state, 1);
				rc.encodeBit(probs, IS_REP2 + state, rep - 2);

				if (rep === 3) {
					reps[3] = reps[2];
				}
				reps[2] = reps[1];
			}

			reps[1] = reps[0];
			reps[0] = dist;
		}

		if (len === 1) {
			this.state = stateAfterShortRep(state);
		} else {
			this.repLenEncoder.encode(rc, len, posState);
			this.state = stateAfterLongRep(state);
		}
	}

	// ── Match finder access ──

	protected getMatches(): Matches {
		++this.readAhead;
		return this.lz.getMatches();
	}

	protected skip(len: number): void {
		this.readAhead += len;
		this.lz.skip(len);
	}

	// ── Prices ──

	protected getLiteralPrice(curByte: number, matchByte: number, prevByte: number, pos: number, state: number): number {
		const probs = this.probs;
		const offset = this.literalOffset(prevByte, pos);
		const price = getBitPrice(probs[IS_MATCH + (state << 4) + (pos & this.posMask)], 0);

		return price + (isLiteralState(state)
			? getLiteralNormalPrice(probs, offset, curByte)
			: getLiteralMatchedPrice(probs, offset, curByte, matchByte));
	}

	protected getAnyMatchPrice(state: number, posState: number): number {
		return getBitPrice(this.probs[IS_MATCH + (state << 4) + posState], 1);
	}

	protected getNormalMatchPrice(anyMatchPrice: number, state: number): number {
		return anyMatchPrice + getBitPrice(this.probs[IS_REP + state], 0);
	}

	protected getAnyRepPrice(anyMatchPrice: number, state: number): number {
		return anyMatchPrice + getBitPrice(this.probs[IS_REP + state], 1);
	}

	protected getShortRepPrice(anyRepPrice: number, state: number, posState: number): number {
		const probs = this.probs;
		return anyRepPrice
			+ getBitPrice(probs[IS_REP0 + state], 0)
			+ getBitPrice(probs[IS_REP0_LONG + (state << 4) + posState], 0);
	}

	protected getLongRepPrice(anyRepPrice: number, rep: number, state: number, posState: number): number {
		const probs = this.probs;
		let price = anyRepPrice;

		if (rep === 0) {
			price += getBitPrice(probs[IS_REP0 + state], 0)
				+ getBitPrice(probs[IS_REP0_LONG + (state << 4) + posState], 1);
		} else {
			price += getBitPrice(probs[IS_REP0 + state], 1);

			if (rep === 1) {
				price += getBitPrice(probs[IS_REP1 + state], 0);
			} else {
				price += getBitPrice(probs[IS_REP1 + state], 1)
					+ getBitPrice(probs[IS_REP2 + state], rep - 2);
			}
		}

		return price;
	}

	protected getLongRepAndLenPrice(rep: number, len: number, state: number, posState: number): number {
		const anyMatchPrice = this.getAnyMatchPrice(state, posState);
		const anyRepPrice = this.getAnyRepPrice(anyMatchPrice, state);
		const longRepPrice = this.getLongRepPrice(anyRepPrice, rep, state, posState);
		return longRepPrice + this.repLenEncoder.getPrice(len, posState);
	}

	protected getMatchAndLenPrice(normalMatchPrice: number, dist: number, len: number, posState: number): number {
		return normalMatchPrice
			+ this.matchLenEncoder.getPrice(len, posState)
			+ this.getDistPrice(getDistState(len), dist);
	}

	/** Price of coding `dist` in distance state `distState`. */
	protected getDistPrice(distState: number, dist: number): number {
		if (dist < FULL_DISTANCES) {
			return this.fullDistPrices[distState * FULL_DISTANCES + dist];
		}

		// distSlotPrices includes the price of the direct bits.
		return this.distSlotPrices[(distState << DIST_SLOT_BITS) + getDistSlot(dist)]
			+ this.alignPrices[dist & ALIGN_MASK];
	}

	/** Refreshes the price tables that are due for an update. */
	protected updatePrices(): void {
		if (this.distPriceCount <= 0) {
			this.updateDistPrices();
		}

		if (this.alignPriceCount <= 0) {
			this.updateAlignPrices();
		}

		this.matchLenEncoder.updatePrices();
		this.repLenEncoder.updatePrices();
	}

	private updateDistPrices(): void {
		this.distPriceCount = DIST_PRICE_UPDATE_INTERVAL;

		if (this.distModelsUsed) {
			computeDistPrices(this.probs, this.distSlotPricesSize, this.distSlotPrices, this.fullDistPrices);
		} else {
			// The models still have their initial probabilities.
			const initial = getInitialPrices();
			this.distSlotPrices.set(initial.distSlots);
			this.fullDistPrices.set(initial.fullDists);
		}
	}

	private updateAlignPrices(): void {
		this.alignPriceCount = ALIGN_PRICE_UPDATE_INTERVAL;

		if (this.alignModelUsed) {
			computeAlignPrices(this.probs, this.alignPrices);
		} else {
			this.alignPrices.set(getInitialPrices().align);
		}
	}
}

/**
 * Prices of the distance slots `[distState << 6 | slot]` (including the
 * direct bits) and of the distances below `FULL_DISTANCES`
 * `[distState * FULL_DISTANCES + dist]`.
 */
function computeDistPrices(probs: Probs, slotCount: number, slotPrices: Uint32Array, fullPrices: Uint32Array): void {
	for (let distState = 0; distState < DIST_STATES; ++distState) {
		const slots = distState << DIST_SLOT_BITS;
		const tree = DIST_SLOTS + slots;

		for (let distSlot = 0; distSlot < slotCount; ++distSlot) {
			slotPrices[slots + distSlot] = getBitTreePrice(probs, tree, DIST_SLOT_BITS, distSlot);
		}

		for (let distSlot = DIST_MODEL_END; distSlot < slotCount; ++distSlot) {
			const count = (distSlot >>> 1) - 1 - ALIGN_BITS;
			slotPrices[slots + distSlot] += getDirectBitsPrice(count);
		}

		for (let dist = 0; dist < DIST_MODEL_START; ++dist) {
			fullPrices[distState * FULL_DISTANCES + dist] = slotPrices[slots + dist];
		}
	}

	let dist = DIST_MODEL_START;
	for (let distSlot = DIST_MODEL_START; distSlot < DIST_MODEL_END; ++distSlot) {
		const footerBits = (distSlot >>> 1) - 1;
		const base = (2 | (distSlot & 1)) << footerBits;
		const tree = distSpecialOffset(distSlot, base);

		for (let i = 0; i < 1 << footerBits; ++i) {
			const price = getReverseBitTreePrice(probs, tree, footerBits, dist - base);

			for (let distState = 0; distState < DIST_STATES; ++distState) {
				fullPrices[distState * FULL_DISTANCES + dist] = slotPrices[(distState << DIST_SLOT_BITS) + distSlot] + price;
			}

			++dist;
		}
	}
}

function computeAlignPrices(probs: Probs, alignPrices: Uint32Array): void {
	for (let i = 0; i < ALIGN_SIZE; ++i) {
		alignPrices[i] = getReverseBitTreePrice(probs, DIST_ALIGN, ALIGN_BITS, i);
	}
}

/**
 * Prices of `count` lengths for `posState` with the length coder at
 * `coder`, written to `prices` from `start`.
 */
function computeLengthPrices(probs: Probs, coder: number, posState: number, prices: Uint32Array, start: number, count: number): void {
	const end = start + count;
	let i = 0;

	let choice0Price = getBitPrice(probs[coder + LEN_CHOICE], 0);
	const low = coder + LEN_LOW + posState * LOW_SYMBOLS;
	for (; i < LOW_SYMBOLS; ++i) {
		prices[start + i] = choice0Price + getBitTreePrice(probs, low, 3, i);
	}

	choice0Price = getBitPrice(probs[coder + LEN_CHOICE], 1);
	let choice1Price = getBitPrice(probs[coder + LEN_CHOICE2], 0);
	const mid = coder + LEN_MID + posState * MID_SYMBOLS;
	for (; i < LOW_SYMBOLS + MID_SYMBOLS; ++i) {
		prices[start + i] = choice0Price + choice1Price + getBitTreePrice(probs, mid, 3, i - LOW_SYMBOLS);
	}

	choice1Price = getBitPrice(probs[coder + LEN_CHOICE2], 1);
	for (; start + i < end; ++i) {
		prices[start + i] = choice0Price + choice1Price + getBitTreePrice(probs, coder + LEN_HIGH, 8, i - LOW_SYMBOLS - MID_SYMBOLS);
	}
}

interface InitialPrices {
	distSlots: Uint32Array;
	fullDists: Uint32Array;
	align: Uint32Array;
	/** Prices of all lengths, the same for every position state. */
	lengths: Uint32Array;
}

let initialPrices: InitialPrices | undefined;

/**
 * Price tables for models that still have their initial probabilities.
 * They are the same for every encoder, so they are computed once. Copying
 * them saves about a quarter of the time of compressing a small input.
 */
function getInitialPrices(): InitialPrices {
	if (initialPrices === undefined) {
		const probs = new Uint16Array(LITERAL);
		initProbs(probs);

		const distSlots = new Uint32Array(DIST_STATES << DIST_SLOT_BITS);
		const fullDists = new Uint32Array(DIST_STATES * FULL_DISTANCES);
		computeDistPrices(probs, DIST_SLOT_COUNT, distSlots, fullDists);

		const align = new Uint32Array(ALIGN_SIZE);
		computeAlignPrices(probs, align);

		const lengths = new Uint32Array(MATCH_LEN_MAX - MATCH_LEN_MIN + 1);
		computeLengthPrices(probs, MATCH_LEN, 0, lengths, 0, lengths.length);

		initialPrices = { distSlots, fullDists, align, lengths };
	}

	return initialPrices;
}

function getLiteralNormalPrice(probs: Probs, offset: number, symbol: number): number {
	let price = 0;
	symbol |= 0x100;

	do {
		price += getBitPrice(probs[offset + (symbol >>> 8)], (symbol >>> 7) & 1);
		symbol <<= 1;
	} while (symbol < 0x10000);

	return price;
}

function getLiteralMatchedPrice(probs: Probs, offset: number, symbol: number, matchByte: number): number {
	let price = 0;
	let matchOffset = 0x100;
	symbol |= 0x100;

	do {
		matchByte <<= 1;
		const matchBit = matchByte & matchOffset;
		price += getBitPrice(probs[offset + matchOffset + matchBit + (symbol >>> 8)], (symbol >>> 7) & 1);
		symbol <<= 1;
		matchOffset &= ~(matchByte ^ symbol);
	} while (symbol < 0x10000);

	return price;
}

/**
 * Length encoder with cached prices. Prices of each position state are
 * recalculated after every `LEN_PRICE_UPDATE_INTERVAL` encoded lengths.
 */
export class LengthEncoder {
	private readonly probs: Probs;
	/** Offset of this length coder in `probs`. */
	private readonly coder: number;
	private readonly counters: Int32Array;
	/** Whether a length was encoded since the last reset. */
	private used = false;
	/** Prices per position state, `[posState * lenSymbols + len - MATCH_LEN_MIN]`. */
	readonly prices: Uint32Array;
	readonly lenSymbols: number;

	constructor(probs: Probs, coder: number, pb: number, niceLen: number) {
		this.probs = probs;
		this.coder = coder;
		const posStates = 1 << pb;
		this.counters = new Int32Array(posStates);

		// Always allocate at least LOW_SYMBOLS + MID_SYMBOLS entries to keep
		// updatePrices() simple.
		this.lenSymbols = Math.max(niceLen - MATCH_LEN_MIN + 1, LOW_SYMBOLS + MID_SYMBOLS);
		this.prices = new Uint32Array(posStates * this.lenSymbols);
	}

	reset(): void {
		// Zero counters force a price update before the prices are needed.
		this.counters.fill(0);
		this.used = false;
	}

	encode(rc: RangeEncoder, len: number, posState: number): void {
		const probs = this.probs;
		const coder = this.coder;
		len -= MATCH_LEN_MIN;

		if (len < LOW_SYMBOLS) {
			rc.encodeBit(probs, coder + LEN_CHOICE, 0);
			rc.encodeBitTree(probs, coder + LEN_LOW + posState * LOW_SYMBOLS, 3, len);
		} else {
			rc.encodeBit(probs, coder + LEN_CHOICE, 1);
			len -= LOW_SYMBOLS;

			if (len < MID_SYMBOLS) {
				rc.encodeBit(probs, coder + LEN_CHOICE2, 0);
				rc.encodeBitTree(probs, coder + LEN_MID + posState * MID_SYMBOLS, 3, len);
			} else {
				rc.encodeBit(probs, coder + LEN_CHOICE2, 1);
				rc.encodeBitTree(probs, coder + LEN_HIGH, 8, len - MID_SYMBOLS);
			}
		}

		--this.counters[posState];
		this.used = true;
	}

	getPrice(len: number, posState: number): number {
		return this.prices[posState * this.lenSymbols + len - MATCH_LEN_MIN];
	}

	/** Offset in `prices` such that `prices[offset + len]` is the price of `len`. */
	priceOffset(posState: number): number {
		return posState * this.lenSymbols - MATCH_LEN_MIN;
	}

	updatePrices(): void {
		for (let posState = 0; posState < this.counters.length; ++posState) {
			if (this.counters[posState] <= 0) {
				this.counters[posState] = LEN_PRICE_UPDATE_INTERVAL;
				this.updatePosStatePrices(posState);
			}
		}
	}

	private updatePosStatePrices(posState: number): void {
		const start = posState * this.lenSymbols;

		if (this.used) {
			computeLengthPrices(this.probs, this.coder, posState, this.prices, start, this.lenSymbols);
		} else {
			// The model still has its initial probabilities.
			const initial = getInitialPrices().lengths;
			for (let i = 0; i < this.lenSymbols; ++i) {
				this.prices[start + i] = initial[i];
			}
		}
	}
}
