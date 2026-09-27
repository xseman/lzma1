/**
 * LZMA decoder: turns range-coded symbols back into literals and matches.
 *
 * Ported from XZ for Java (0BSD) by Lasse Collin and Igor Pavlov. The main
 * loop is structured like `LzmaDec_DecodeReal` of the LZMA SDK.
 */

import type { LzDecoder } from "./lz-decoder.js";
import {
	ALIGN_BITS,
	DIST_ALIGN,
	DIST_MODEL_END,
	DIST_MODEL_START,
	DIST_SLOT_BITS,
	DIST_SLOTS,
	distSpecialOffset,
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
	LOW_SYMBOLS,
	LzmaCoder,
	MATCH_LEN,
	MATCH_LEN_MIN,
	MID_SYMBOLS,
	REP_LEN,
	stateAfterLiteral,
	stateAfterLongRep,
	stateAfterMatch,
	stateAfterShortRep,
} from "./lzma-coder.js";
import {
	BIT_MODEL_TOTAL,
	BIT_MODEL_TOTAL_BITS,
	MOVE_BITS,
	TOP_VALUE,
} from "./range-coder.js";
import type { RangeDecoder } from "./range-decoder.js";

/** Distance value that marks the end of the stream. */
const END_MARKER_DIST = -1;

export class LzmaDecoder extends LzmaCoder {
	private readonly lz: LzDecoder;
	private readonly rc: RangeDecoder;

	/** Number of bytes decoded so far. */
	outPos = 0;

	constructor(lz: LzDecoder, rc: RangeDecoder, lc: number, lp: number, pb: number, probs?: Uint16Array) {
		super(lc, lp, pb, probs);
		this.lz = lz;
		this.rc = rc;
		this.reset();
	}

	/**
	 * Decodes symbols until `outLimit` bytes have been produced or the input
	 * position passes `inLimit`.
	 *
	 * Performance: this is the hot loop of decompression. The range decoder
	 * state, the coder state and the reps live in local variables, and the
	 * bit decoding step of `RangeDecoder.decodeBit` is repeated inline:
	 *
	 *     prob = probs[i];
	 *     bound = (range >>> 11) * prob;
	 *     if (code < bound) { range = bound; probs[i] = prob + ((2048 - prob) >>> 5); bit 0 }
	 *     else { range -= bound; code -= bound; probs[i] = prob - (prob >>> 5); bit 1 }
	 *     if (range < 2^24) { shift in the next input byte }
	 *
	 * With the state in object fields, engines store and reload it around
	 * every probability update, which costs 10-15% on V8.
	 *
	 * @returns `true` if the end marker was decoded
	 */
	decode(outLimit: number, inLimit: number): boolean {
		const probs = this.probs;
		const lz = this.lz;
		const reps = this.reps;
		const posMask = this.posMask;
		const rc = this.rc;
		const input = rc.input;
		const inputEnd = input.length;

		let range = rc.range;
		let code = rc.code;
		let inPos = rc.pos;
		let state = this.state;
		let outPos = this.outPos;
		let rep0 = reps[0];
		let rep1 = reps[1];
		let rep2 = reps[2];
		let rep3 = reps[3];
		let endMarker = false;

		let i = 0;
		let prob = 0;
		let bound = 0;

		while (outPos < outLimit && inPos <= inLimit) {
			const posState = outPos & posMask;

			// ── Literal or match? ──
			i = IS_MATCH + (state << 4) + posState;
			prob = probs[i];
			bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;

			if (code < bound) {
				range = bound;
				probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
				if (range < TOP_VALUE) {
					if (inPos >= inputEnd) throw truncated();
					range = (range << 8) >>> 0;
					code = ((code << 8) | input[inPos++]) >>> 0;
				}

				// ── Literal: 8 bits, MSB first ──
				const offset = this.literalOffset(lz.getByte(0), outPos);
				let symbol = 1;

				if (isLiteralState(state)) {
					do {
						i = offset + symbol;
						prob = probs[i];
						bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
						if (code < bound) {
							range = bound;
							probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
							symbol <<= 1;
						} else {
							range -= bound;
							code -= bound;
							probs[i] = prob - (prob >>> MOVE_BITS);
							symbol = (symbol << 1) | 1;
						}
						if (range < TOP_VALUE) {
							if (inPos >= inputEnd) throw truncated();
							range = (range << 8) >>> 0;
							code = ((code << 8) | input[inPos++]) >>> 0;
						}
					} while (symbol < 0x100);
				} else {
					// After a match, the bits of the byte at rep0 select the
					// probabilities until the first bit that differs.
					let matchByte = lz.getByte(rep0);
					let matchOffset = 0x100;

					do {
						matchByte <<= 1;
						const matchBit = matchByte & matchOffset;
						i = offset + matchOffset + matchBit + symbol;
						prob = probs[i];
						bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
						if (code < bound) {
							range = bound;
							probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
							symbol <<= 1;
							matchOffset &= ~matchBit;
						} else {
							range -= bound;
							code -= bound;
							probs[i] = prob - (prob >>> MOVE_BITS);
							symbol = (symbol << 1) | 1;
							matchOffset &= matchBit;
						}
						if (range < TOP_VALUE) {
							if (inPos >= inputEnd) throw truncated();
							range = (range << 8) >>> 0;
							code = ((code << 8) | input[inPos++]) >>> 0;
						}
					} while (symbol < 0x100);
				}

				lz.putByte(symbol & 0xFF);
				state = stateAfterLiteral(state);
				++outPos;
				continue;
			}

			range -= bound;
			code -= bound;
			probs[i] = prob - (prob >>> MOVE_BITS);
			if (range < TOP_VALUE) {
				if (inPos >= inputEnd) throw truncated();
				range = (range << 8) >>> 0;
				code = ((code << 8) | input[inPos++]) >>> 0;
			}

			// ── Match or rep match? ──
			let lenCoder: number;

			i = IS_REP + state;
			prob = probs[i];
			bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
			if (code < bound) {
				range = bound;
				probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
				if (range < TOP_VALUE) {
					if (inPos >= inputEnd) throw truncated();
					range = (range << 8) >>> 0;
					code = ((code << 8) | input[inPos++]) >>> 0;
				}

				// Match: the distance follows the length.
				state = stateAfterMatch(state);
				rep3 = rep2;
				rep2 = rep1;
				rep1 = rep0;
				lenCoder = MATCH_LEN;
			} else {
				range -= bound;
				code -= bound;
				probs[i] = prob - (prob >>> MOVE_BITS);
				if (range < TOP_VALUE) {
					if (inPos >= inputEnd) throw truncated();
					range = (range << 8) >>> 0;
					code = ((code << 8) | input[inPos++]) >>> 0;
				}

				// Rep match: one of the four recent distances.
				i = IS_REP0 + state;
				prob = probs[i];
				bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
				if (code < bound) {
					range = bound;
					probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
					if (range < TOP_VALUE) {
						if (inPos >= inputEnd) throw truncated();
						range = (range << 8) >>> 0;
						code = ((code << 8) | input[inPos++]) >>> 0;
					}

					// rep0: a single byte ("short rep") or a longer match?
					i = IS_REP0_LONG + (state << 4) + posState;
					prob = probs[i];
					bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
					if (code < bound) {
						range = bound;
						probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
						if (range < TOP_VALUE) {
							if (inPos >= inputEnd) throw truncated();
							range = (range << 8) >>> 0;
							code = ((code << 8) | input[inPos++]) >>> 0;
						}

						state = stateAfterShortRep(state);
						if (outPos >= outLimit) throw exceedsSize();
						lz.repeat(rep0, 1);
						++outPos;
						continue;
					}

					range -= bound;
					code -= bound;
					probs[i] = prob - (prob >>> MOVE_BITS);
					if (range < TOP_VALUE) {
						if (inPos >= inputEnd) throw truncated();
						range = (range << 8) >>> 0;
						code = ((code << 8) | input[inPos++]) >>> 0;
					}
				} else {
					range -= bound;
					code -= bound;
					probs[i] = prob - (prob >>> MOVE_BITS);
					if (range < TOP_VALUE) {
						if (inPos >= inputEnd) throw truncated();
						range = (range << 8) >>> 0;
						code = ((code << 8) | input[inPos++]) >>> 0;
					}

					let dist: number;

					// rep1, or rep2/rep3?
					i = IS_REP1 + state;
					prob = probs[i];
					bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
					if (code < bound) {
						range = bound;
						probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
						dist = rep1;
					} else {
						range -= bound;
						code -= bound;
						probs[i] = prob - (prob >>> MOVE_BITS);
						if (range < TOP_VALUE) {
							if (inPos >= inputEnd) throw truncated();
							range = (range << 8) >>> 0;
							code = ((code << 8) | input[inPos++]) >>> 0;
						}

						// rep2 or rep3?
						i = IS_REP2 + state;
						prob = probs[i];
						bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
						if (code < bound) {
							range = bound;
							probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
							dist = rep2;
						} else {
							range -= bound;
							code -= bound;
							probs[i] = prob - (prob >>> MOVE_BITS);
							dist = rep3;
							rep3 = rep2;
						}

						rep2 = rep1;
					}

					if (range < TOP_VALUE) {
						if (inPos >= inputEnd) throw truncated();
						range = (range << 8) >>> 0;
						code = ((code << 8) | input[inPos++]) >>> 0;
					}

					rep1 = rep0;
					rep0 = dist;
				}

				state = stateAfterLongRep(state);
				lenCoder = REP_LEN;
			}

			// ── Length: choice bits select the low, mid or high tree ──
			let treeOffset: number;
			let treeBits: number;
			let len: number;

			i = lenCoder + LEN_CHOICE;
			prob = probs[i];
			bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
			if (code < bound) {
				range = bound;
				probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
				treeOffset = lenCoder + LEN_LOW + posState * LOW_SYMBOLS;
				treeBits = 3;
				len = MATCH_LEN_MIN;
			} else {
				range -= bound;
				code -= bound;
				probs[i] = prob - (prob >>> MOVE_BITS);
				if (range < TOP_VALUE) {
					if (inPos >= inputEnd) throw truncated();
					range = (range << 8) >>> 0;
					code = ((code << 8) | input[inPos++]) >>> 0;
				}

				i = lenCoder + LEN_CHOICE2;
				prob = probs[i];
				bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
				if (code < bound) {
					range = bound;
					probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
					treeOffset = lenCoder + LEN_MID + posState * MID_SYMBOLS;
					treeBits = 3;
					len = MATCH_LEN_MIN + LOW_SYMBOLS;
				} else {
					range -= bound;
					code -= bound;
					probs[i] = prob - (prob >>> MOVE_BITS);
					treeOffset = lenCoder + LEN_HIGH;
					treeBits = 8;
					len = MATCH_LEN_MIN + LOW_SYMBOLS + MID_SYMBOLS;
				}
			}

			if (range < TOP_VALUE) {
				if (inPos >= inputEnd) throw truncated();
				range = (range << 8) >>> 0;
				code = ((code << 8) | input[inPos++]) >>> 0;
			}

			{
				const end = 1 << treeBits;
				let symbol = 1;
				do {
					i = treeOffset + symbol;
					prob = probs[i];
					bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
					if (code < bound) {
						range = bound;
						probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
						symbol <<= 1;
					} else {
						range -= bound;
						code -= bound;
						probs[i] = prob - (prob >>> MOVE_BITS);
						symbol = (symbol << 1) | 1;
					}
					if (range < TOP_VALUE) {
						if (inPos >= inputEnd) throw truncated();
						range = (range << 8) >>> 0;
						code = ((code << 8) | input[inPos++]) >>> 0;
					}
				} while (symbol < end);
				len += symbol - end;
			}

			// ── Distance (normal matches only) ──
			if (lenCoder === MATCH_LEN) {
				// Distance slot: 6 bits, MSB first
				const slotTree = DIST_SLOTS + (getDistState(len) << DIST_SLOT_BITS);
				let distSlot = 1;
				do {
					i = slotTree + distSlot;
					prob = probs[i];
					bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
					if (code < bound) {
						range = bound;
						probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
						distSlot <<= 1;
					} else {
						range -= bound;
						code -= bound;
						probs[i] = prob - (prob >>> MOVE_BITS);
						distSlot = (distSlot << 1) | 1;
					}
					if (range < TOP_VALUE) {
						if (inPos >= inputEnd) throw truncated();
						range = (range << 8) >>> 0;
						code = ((code << 8) | input[inPos++]) >>> 0;
					}
				} while (distSlot < 1 << DIST_SLOT_BITS);
				distSlot -= 1 << DIST_SLOT_BITS;

				if (distSlot < DIST_MODEL_START) {
					rep0 = distSlot;
				} else {
					// The slot gives the top two bits; the footer bits follow.
					const footerBits = (distSlot >>> 1) - 1;
					let dist = (2 | (distSlot & 1)) << footerBits;
					let reverseTree: number;
					let reverseBits: number;

					if (distSlot < DIST_MODEL_END) {
						reverseTree = distSpecialOffset(distSlot, dist);
						reverseBits = footerBits;
					} else {
						// Direct bits with a fixed 50% probability, then 4
						// align bits with probabilities.
						let direct = 0;
						for (let k = footerBits - ALIGN_BITS; k > 0; --k) {
							range >>>= 1;
							let bit = 0;
							if (code >= range) {
								code -= range;
								bit = 1;
							}
							direct = ((direct << 1) | bit) >>> 0;
							if (range < TOP_VALUE) {
								if (inPos >= inputEnd) throw truncated();
								range = (range << 8) >>> 0;
								code = ((code << 8) | input[inPos++]) >>> 0;
							}
						}

						dist |= direct << ALIGN_BITS;
						reverseTree = DIST_ALIGN;
						reverseBits = ALIGN_BITS;
					}

					// Footer or align bits, LSB first
					let symbol = 1;
					for (let k = 0; k < reverseBits; ++k) {
						i = reverseTree + symbol;
						prob = probs[i];
						bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;
						if (code < bound) {
							range = bound;
							probs[i] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
							symbol <<= 1;
						} else {
							range -= bound;
							code -= bound;
							probs[i] = prob - (prob >>> MOVE_BITS);
							symbol = (symbol << 1) | 1;
							dist |= 1 << k;
						}
						if (range < TOP_VALUE) {
							if (inPos >= inputEnd) throw truncated();
							range = (range << 8) >>> 0;
							code = ((code << 8) | input[inPos++]) >>> 0;
						}
					}

					// As int32, the end marker distance 0xFFFFFFFF is -1.
					rep0 = dist | 0;

					if (rep0 === END_MARKER_DIST) {
						endMarker = true;
						break;
					}
				}
			}

			if (len > outLimit - outPos) throw exceedsSize();
			lz.repeat(rep0, len);
			outPos += len;
		}

		rc.range = range;
		rc.code = code;
		rc.pos = inPos;
		this.state = state;
		this.outPos = outPos;
		reps[0] = rep0;
		reps[1] = rep1;
		reps[2] = rep2;
		reps[3] = rep3;

		return endMarker;
	}
}

function truncated(): Error {
	return new Error("Truncated input");
}

function exceedsSize(): Error {
	return new Error("Corrupted input: data exceeds the declared size");
}
