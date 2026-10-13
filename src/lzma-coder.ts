/**
 * Probability models and state machine shared by the LZMA encoder and decoder.
 *
 * Ported from XZ for Java (0BSD), `src/org/tukaani/xz/lzma/LZMACoder.java`
 * and `State.java`, by Lasse Collin and Igor Pavlov.
 *
 * The nested coder classes of the Java code (`LiteralCoder.LiteralSubcoder`,
 * `LengthCoder`) are top-level classes here, because TypeScript has no inner
 * classes; subclasses in the encoder and decoder files pass their outer
 * coder explicitly where Java captures it implicitly.
 */

import {
	initProbs,
	type Probs,
} from "./range-coder.js";

export const POS_STATES_MAX = 1 << 4;

export const MATCH_LEN_MIN = 2;
export const LOW_SYMBOLS = 1 << 3;
export const MID_SYMBOLS = 1 << 3;
export const HIGH_SYMBOLS = 1 << 8;
export const MATCH_LEN_MAX = MATCH_LEN_MIN + LOW_SYMBOLS + MID_SYMBOLS + HIGH_SYMBOLS - 1; // 273

/**
 * Layout of a length coder, relative to its offset. Lengths 2-9 use a
 * `low` tree, 10-17 a `mid` tree (both per position state), and 18-273 the
 * `high` tree.
 */
export const LEN_CHOICE = 0;
export const LEN_CHOICE2 = 1;
export const LEN_LOW = 2; // [posState][LOW_SYMBOLS]
export const LEN_MID = LEN_LOW + POS_STATES_MAX * LOW_SYMBOLS; // [posState][MID_SYMBOLS]
export const LEN_HIGH = LEN_MID + POS_STATES_MAX * MID_SYMBOLS;
export const LEN_SIZE = LEN_HIGH + HIGH_SYMBOLS;

export const DIST_STATES = 4;
export const DIST_SLOTS = 1 << 6;
/** Bits of a distance slot: the depth of the slot bit trees. */
export const DIST_SLOT_BITS = 6;
export const DIST_MODEL_START = 4;
export const DIST_MODEL_END = 14;
export const FULL_DISTANCES = 1 << (DIST_MODEL_END / 2);

export const ALIGN_BITS = 4;
export const ALIGN_SIZE = 1 << ALIGN_BITS;
export const ALIGN_MASK = ALIGN_SIZE - 1;

/** Number of recent match distances ("reps") that can be reused cheaply. */
export const REPS = 4;

/** Distances are coded with different probabilities for lengths 2, 3, 4 and 5+. */
export function getDistState(len: number): number {
	return len < DIST_STATES + MATCH_LEN_MIN
		? len - MATCH_LEN_MIN
		: DIST_STATES - 1;
}

/** Number of probabilities of a coder with `lc` and `lp` literal bits. */
export function probsSize(lc: number, lp: number): number {
	return LITERAL + (0x300 << (lc + lp));
}

/**
 * The coder state remembers the kinds of the most recent symbols
 * (literal, match, long rep, short rep). It selects which probabilities
 * are used for the next symbol.
 */
export class State {
	static readonly STATES = 12;

	private state = 0;

	constructor(other?: State) {
		if (other !== undefined) {
			this.state = other.state;
		}
	}

	reset(): void {
		this.state = LIT_LIT;
	}

	get(): number {
		return this.state;
	}

	set(other: State): void {
		this.state = other.state;
	}

	updateLiteral(): void {
		this.state = stateAfterLiteral(this.state);
	}

	updateMatch(): void {
		this.state = stateAfterMatch(this.state);
	}

	updateLongRep(): void {
		this.state = stateAfterLongRep(this.state);
	}

	updateShortRep(): void {
		this.state = stateAfterShortRep(this.state);
	}

	isLiteral(): boolean {
		return isLiteralState(this.state);
	}
}

export const STATES = State.STATES;

const LIT_STATES = 7;

const LIT_LIT = 0;
const SHORTREP_LIT_LIT = 3;
const LIT_MATCH = 7;
const LIT_LONGREP = 8;
const LIT_SHORTREP = 9;
const NONLIT_MATCH = 10;
const NONLIT_REP = 11;

/*
 * The transitions of `State` on a plain state value, so that the optimum
 * search can keep its per-position states as numbers. `State`'s methods
 * call these, so the state machine is written once.
 */

export function stateAfterLiteral(state: number): number {
	if (state <= SHORTREP_LIT_LIT) {
		return LIT_LIT;
	} else if (state <= LIT_SHORTREP) {
		return state - 3;
	} else {
		return state - 6;
	}
}

export function stateAfterMatch(state: number): number {
	return state < LIT_STATES ? LIT_MATCH : NONLIT_MATCH;
}

export function stateAfterLongRep(state: number): number {
	return state < LIT_STATES ? LIT_LONGREP : NONLIT_REP;
}

export function stateAfterShortRep(state: number): number {
	return state < LIT_STATES ? LIT_SHORTREP : NONLIT_REP;
}

export function isLiteralState(state: number): boolean {
	return state < LIT_STATES;
}

/**
 * Layout of the probability array. All probabilities of a coder live in one
 * `Uint16Array`, like in the LZMA SDK and liblzma, instead of the
 * Java code's per-model arrays: one allocation, and the hot loops index a
 * single array.
 *
 * Bit trees of `2^n` leaves occupy `2^n` entries starting at their offset;
 * index 0 of a tree is unused.
 */
export const IS_MATCH = 0; // [state][posState]
export const IS_REP = IS_MATCH + STATES * POS_STATES_MAX; // [state]
export const IS_REP0 = IS_REP + STATES; // [state]
export const IS_REP1 = IS_REP0 + STATES; // [state]
export const IS_REP2 = IS_REP1 + STATES; // [state]
export const IS_REP0_LONG = IS_REP2 + STATES; // [state][posState]
/** Bit trees of 6 bits per distance state. */
export const DIST_SLOT_OFFSET = IS_REP0_LONG + STATES * POS_STATES_MAX;
/** Reverse bit trees for the low bits of distances in slots 4-13. */
export const DIST_SPECIAL = DIST_SLOT_OFFSET + DIST_STATES * DIST_SLOTS;
/** Reverse bit tree for the lowest 4 bits of distances in slots 14+. */
export const DIST_ALIGN = DIST_SPECIAL + FULL_DISTANCES - DIST_MODEL_END;
export const MATCH_LEN = DIST_ALIGN + ALIGN_SIZE;
export const REP_LEN = MATCH_LEN + LEN_SIZE;
/** `2^(lc + lp)` literal coders of 0x300 probabilities each. */
export const LITERAL = REP_LEN + LEN_SIZE;

/**
 * Offset of the reverse bit tree for the footer bits of `distSlot` (4-13).
 * The trees are packed like in the LZMA SDK: the tree of a slot starts at
 * `base - distSlot - 1` where `base` is the slot's lowest distance, so the
 * trees of all slots fill `FULL_DISTANCES - DIST_MODEL_END` entries.
 */
export function distSpecialOffset(distSlot: number, base: number): number {
	return DIST_SPECIAL + base - distSlot - 1;
}

export abstract class LzmaCoder {
	readonly posMask: number;

	readonly reps = new Int32Array(REPS);
	readonly state = new State();

	readonly probs: Probs;

	/**
	 * @param probs Probability array to reuse, of `probsSize(lc, lp)` entries.
	 *        Its contents are overwritten by `reset()`.
	 */
	constructor(lc: number, lp: number, pb: number, probs?: Probs) {
		this.posMask = (1 << pb) - 1;
		this.probs = probs ?? new Uint16Array(probsSize(lc, lp));
	}

	reset(): void {
		this.reps[0] = 0;
		this.reps[1] = 0;
		this.reps[2] = 0;
		this.reps[3] = 0;
		this.state.reset();

		initProbs(this.probs);
	}
}

export abstract class LiteralCoder {
	private readonly lc: number;
	private readonly literalPosMask: number;

	constructor(lc: number, lp: number) {
		this.lc = lc;
		this.literalPosMask = (1 << lp) - 1;
	}

	getSubcoderIndex(prevByte: number, pos: number): number {
		const low = prevByte >> (8 - this.lc);
		const high = (pos & this.literalPosMask) << this.lc;
		return low + high;
	}
}

export abstract class LiteralSubcoder {
	readonly probs: Probs;
	/** Offset of this subcoder's 0x300 probabilities in `probs`. */
	readonly literalOffset: number;

	constructor(probs: Probs, literalOffset: number) {
		this.probs = probs;
		this.literalOffset = literalOffset;
	}
}

export abstract class LengthCoder {
	readonly probs: Probs;
	/** Offset of this length coder in `probs`. */
	readonly coder: number;

	constructor(probs: Probs, coder: number) {
		this.probs = probs;
		this.coder = coder;
	}
}
