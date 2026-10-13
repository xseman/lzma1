/**
 * Normal LZMA encoder: "optimal parsing".
 *
 * Instead of deciding one symbol at a time, it looks ahead up to `OPTS`
 * bytes and computes the cheapest way to reach every position (like a
 * shortest-path search where the edge weights are symbol prices). The
 * cheapest path is then walked backwards and returned symbol by symbol.
 *
 * Ported from XZ for Java (0BSD), `src/org/tukaani/xz/lzma/LZMAEncoderNormal.java`
 * and `Optimum.java`, by Lasse Collin and Igor Pavlov.
 */

import type {
	LzEncoder,
	Matches,
} from "./lz-encoder.js";
import {
	MATCH_LEN_MAX,
	MATCH_LEN_MIN,
	REPS,
	stateAfterLiteral,
	stateAfterLongRep,
	stateAfterMatch,
	stateAfterShortRep,
} from "./lzma-coder.js";
import {
	LzmaEncoder,
	type LzmaEncoderConfig,
} from "./lzma-encoder.js";
import type { RangeEncoder } from "./range-encoder.js";

/** Maximum number of positions optimized at once. */
export const OPTS = 4096;
export const NORMAL_EXTRA_SIZE_BEFORE = OPTS;
export const NORMAL_EXTRA_SIZE_AFTER = OPTS;

const INFINITY_PRICE = 1 << 30;

/**
 * The cheapest known way to arrive at each position. The fields of the
 * Java code's `Optimum` are stored as one typed array each, indexed by
 * position, instead of one object per position; position `i`'s reps are
 * at `reps[i * REPS]`. The arrays start at 0, the initial value of every
 * field (0 is also the value of a new `State`), and booleans are stored as
 * 1 and 0.
 */
class Optimums {
	/** The state after arriving here. */
	readonly state: Uint8Array;
	readonly reps: Int32Array;

	/** Cumulative price of arriving to this byte. */
	readonly price: Int32Array;

	readonly optPrev: Int32Array;
	readonly backPrev: Int32Array;
	readonly prev1IsLiteral: Uint8Array;

	readonly hasPrev2: Uint8Array;
	readonly optPrev2: Int32Array;
	readonly backPrev2: Int32Array;

	constructor(size: number) {
		this.state = new Uint8Array(size);
		this.reps = new Int32Array(size * REPS);
		this.price = new Int32Array(size);
		this.optPrev = new Int32Array(size);
		this.backPrev = new Int32Array(size);
		this.prev1IsLiteral = new Uint8Array(size);
		this.hasPrev2 = new Uint8Array(size);
		this.optPrev2 = new Int32Array(size);
		this.backPrev2 = new Int32Array(size);
	}

	/** Resets the price. */
	reset(i: number): void {
		this.price[i] = INFINITY_PRICE;
	}

	/** Sets to indicate one LZMA symbol (literal, rep, or match). */
	set1(i: number, newPrice: number, optCur: number, back: number): void {
		this.price[i] = newPrice;
		this.optPrev[i] = optCur;
		this.backPrev[i] = back;
		this.prev1IsLiteral[i] = 0;
	}

	/** Sets to indicate two LZMA symbols of which the first one is a literal. */
	set2(i: number, newPrice: number, optCur: number, back: number): void {
		this.price[i] = newPrice;
		this.optPrev[i] = optCur + 1;
		this.backPrev[i] = back;
		this.prev1IsLiteral[i] = 1;
		this.hasPrev2[i] = 0;
	}

	/**
	 * Sets to indicate three LZMA symbols of which the second one
	 * is a literal.
	 */
	set3(i: number, newPrice: number, optCur: number, back2: number, len2: number, back: number): void {
		this.price[i] = newPrice;
		this.optPrev[i] = optCur + len2 + 1;
		this.backPrev[i] = back;
		this.prev1IsLiteral[i] = 1;
		this.hasPrev2[i] = 1;
		this.optPrev2[i] = optCur;
		this.backPrev2[i] = back2;
	}
}

export interface LzmaEncoderNormalConfig extends LzmaEncoderConfig {
	/**
	 * Number of positions to allocate, at most `OPTS`. When the input size
	 * is known, `inputSize + 2` is enough (contract adaptation; the
	 * Java code always allocates `OPTS`).
	 */
	optsSize: number;
}

export class LzmaEncoderNormal extends LzmaEncoder {
	private readonly opts: Optimums;
	private optCur = 0;
	private optEnd = 0;

	private matches!: Matches;

	// These are fields solely to avoid allocating the objects again and
	// again on each function call.
	private readonly repLens = new Int32Array(REPS);

	/** State after the symbols being priced, as in the Java code. */
	private nextState = 0;

	constructor(rc: RangeEncoder, lz: LzEncoder, config: LzmaEncoderNormalConfig) {
		super(rc, lz, config);

		const optsSize = Math.min(config.optsSize, OPTS);
		this.opts = new Optimums(optsSize);
	}

	override reset(): void {
		this.optCur = 0;
		this.optEnd = 0;
		super.reset();
	}

	/**
	 * Converts the opts array from backward indexes to forward indexes.
	 * Then it will be simple to get the next symbol from the array
	 * in later calls to `getNextSymbol()`.
	 */
	private convertOpts(): number {
		this.optEnd = this.optCur;

		let optPrev = this.opts.optPrev[this.optCur];

		do {
			const cur = this.optCur;

			if (this.opts.prev1IsLiteral[cur] !== 0) {
				this.opts.optPrev[optPrev] = this.optCur;
				this.opts.backPrev[optPrev] = -1;
				this.optCur = optPrev--;

				if (this.opts.hasPrev2[cur] !== 0) {
					this.opts.optPrev[optPrev] = optPrev + 1;
					this.opts.backPrev[optPrev] = this.opts.backPrev2[cur];
					this.optCur = optPrev;
					optPrev = this.opts.optPrev2[cur];
				}
			}

			const temp = this.opts.optPrev[optPrev];
			this.opts.optPrev[optPrev] = this.optCur;
			this.optCur = optPrev;
			optPrev = temp;
		} while (this.optCur > 0);

		this.optCur = this.opts.optPrev[0];
		this.back = this.opts.backPrev[this.optCur];
		return this.optCur;
	}

	protected getNextSymbol(): number {
		// If there are pending symbols from an earlier call to this
		// function, return those symbols first.
		if (this.optCur < this.optEnd) {
			const len = this.opts.optPrev[this.optCur] - this.optCur;
			this.optCur = this.opts.optPrev[this.optCur];
			this.back = this.opts.backPrev[this.optCur];
			return len;
		}

		this.optCur = 0;
		this.optEnd = 0;
		this.back = -1;

		if (this.readAhead === -1) {
			this.matches = this.getMatches();
		}

		// Get the number of bytes available in the dictionary, but
		// not more than the maximum match length. If there aren't
		// enough bytes remaining to encode a match at all, return
		// immediately to encode this byte as a literal.
		let avail = Math.min(this.lz.getAvail(), MATCH_LEN_MAX);
		if (avail < MATCH_LEN_MIN) {
			return 1;
		}

		// Get the lengths of repeated matches.
		let repBest = 0;
		for (let rep = 0; rep < REPS; ++rep) {
			this.repLens[rep] = this.lz.getMatchLen(0, this.reps[rep], avail);

			if (this.repLens[rep] < MATCH_LEN_MIN) {
				this.repLens[rep] = 0;
				continue;
			}

			if (this.repLens[rep] > this.repLens[repBest]) {
				repBest = rep;
			}
		}

		// Return if the best repeated match is at least niceLen bytes long.
		if (this.repLens[repBest] >= this.niceLen) {
			this.back = repBest;
			this.skip(this.repLens[repBest] - 1);
			return this.repLens[repBest];
		}

		// Initialize mainLen and mainDist to the longest match found
		// by the match finder.
		let mainLen = 0;
		let mainDist = 0;
		if (this.matches.count > 0) {
			mainLen = this.matches.len[this.matches.count - 1];
			mainDist = this.matches.dist[this.matches.count - 1];

			// Return if it is at least niceLen bytes long.
			if (mainLen >= this.niceLen) {
				this.back = mainDist + REPS;
				this.skip(mainLen - 1);
				return mainLen;
			}
		}

		const curByte = this.lz.getByte(0);
		const matchByte = this.lz.getByte(this.reps[0] + 1);

		// If the match finder found no matches and this byte cannot be
		// encoded as a repeated match (short or long), we must be return
		// to have the byte encoded as a literal.
		if (mainLen < MATCH_LEN_MIN && curByte !== matchByte && this.repLens[repBest] < MATCH_LEN_MIN) {
			return 1;
		}

		let pos = this.lz.getPos();
		let posState = pos & this.posMask;

		// Calculate the price of encoding the current byte as a literal.
		{
			const prevByte = this.lz.getByte(1);
			const literalPrice = this.literalEncoder.getPrice(curByte, matchByte, prevByte, pos, this.state.get());
			this.opts.set1(1, literalPrice, 0, -1);
		}

		let anyMatchPrice = this.getAnyMatchPrice(this.state.get(), posState);
		let anyRepPrice = this.getAnyRepPrice(anyMatchPrice, this.state.get());

		// If it is possible to encode this byte as a short rep, see if
		// it is cheaper than encoding it as a literal.
		if (matchByte === curByte) {
			const shortRepPrice = this.getShortRepPrice(anyRepPrice, this.state.get(), posState);
			if (shortRepPrice < this.opts.price[1]) {
				this.opts.set1(1, shortRepPrice, 0, 0);
			}
		}

		// Return if there is neither normal nor long repeated match. Use
		// a short match instead of a literal if is is possible and cheaper.
		this.optEnd = Math.max(mainLen, this.repLens[repBest]);
		if (this.optEnd < MATCH_LEN_MIN) {
			this.back = this.opts.backPrev[1];
			return 1;
		}

		// Update the lookup tables for distances and lengths before using
		// those price calculation functions. (The price function above
		// don't need these tables.)
		this.updatePrices();

		// Initialize the state and reps of this position in opts[].
		// updateOptStateAndReps() will need these to get the new
		// state and reps for the next byte.
		this.opts.state[0] = this.state.get();
		this.opts.reps.set(this.reps, 0);

		// Initialize the prices for latter opts that will be used below.
		for (let i = this.optEnd; i >= MATCH_LEN_MIN; --i) {
			this.opts.reset(i);
		}

		// Calculate the prices of repeated matches of all lengths.
		for (let rep = 0; rep < REPS; ++rep) {
			let repLen = this.repLens[rep];
			if (repLen < MATCH_LEN_MIN) {
				continue;
			}

			const longRepPrice = this.getLongRepPrice(anyRepPrice, rep, this.state.get(), posState);
			do {
				const price = longRepPrice + this.repLenEncoder.getPrice(repLen, posState);
				if (price < this.opts.price[repLen]) {
					this.opts.set1(repLen, price, 0, rep);
				}
			} while (--repLen >= MATCH_LEN_MIN);
		}

		// Calculate the prices of normal matches that are longer than rep0.
		{
			let len = Math.max(this.repLens[0] + 1, MATCH_LEN_MIN);
			if (len <= mainLen) {
				const normalMatchPrice = this.getNormalMatchPrice(anyMatchPrice, this.state.get());

				// Set i to the index of the shortest match that is
				// at least len bytes long.
				let i = 0;
				while (len > this.matches.len[i]) {
					++i;
				}

				while (true) {
					const dist = this.matches.dist[i];
					const price = this.getMatchAndLenPrice(normalMatchPrice, dist, len, posState);
					if (price < this.opts.price[len]) {
						this.opts.set1(len, price, 0, dist + REPS);
					}

					if (len === this.matches.len[i]) {
						if (++i === this.matches.count) {
							break;
						}
					}

					++len;
				}
			}
		}

		avail = Math.min(this.lz.getAvail(), OPTS - 1);

		// Get matches for later bytes and optimize the use of LZMA symbols
		// by calculating the prices and picking the cheapest symbol
		// combinations.
		while (++this.optCur < this.optEnd) {
			this.matches = this.getMatches();
			if (this.matches.count > 0 && this.matches.len[this.matches.count - 1] >= this.niceLen) {
				break;
			}

			--avail;
			++pos;
			posState = pos & this.posMask;

			this.updateOptStateAndReps();
			anyMatchPrice = this.opts.price[this.optCur]
				+ this.getAnyMatchPrice(this.opts.state[this.optCur], posState);
			anyRepPrice = this.getAnyRepPrice(anyMatchPrice, this.opts.state[this.optCur]);

			this.calc1BytePrices(pos, posState, avail, anyRepPrice);

			if (avail >= MATCH_LEN_MIN) {
				const startLen = this.calcLongRepPrices(pos, posState, avail, anyRepPrice);
				if (this.matches.count > 0) {
					this.calcNormalMatchPrices(pos, posState, avail, anyMatchPrice, startLen);
				}
			}
		}

		return this.convertOpts();
	}

	/** Updates the state and reps for the current byte in the opts array. */
	private updateOptStateAndReps(): void {
		let optPrev = this.opts.optPrev[this.optCur];

		if (this.opts.prev1IsLiteral[this.optCur] !== 0) {
			--optPrev;

			if (this.opts.hasPrev2[this.optCur] !== 0) {
				this.opts.state[this.optCur] = this.opts.state[this.opts.optPrev2[this.optCur]];
				if (this.opts.backPrev2[this.optCur] < REPS) {
					this.opts.state[this.optCur] = stateAfterLongRep(this.opts.state[this.optCur]);
				} else {
					this.opts.state[this.optCur] = stateAfterMatch(this.opts.state[this.optCur]);
				}
			} else {
				this.opts.state[this.optCur] = this.opts.state[optPrev];
			}

			this.opts.state[this.optCur] = stateAfterLiteral(this.opts.state[this.optCur]);
		} else {
			this.opts.state[this.optCur] = this.opts.state[optPrev];
		}

		if (optPrev === this.optCur - 1) {
			// Must be either a short rep or a literal.
			if (this.opts.backPrev[this.optCur] === 0) {
				this.opts.state[this.optCur] = stateAfterShortRep(this.opts.state[this.optCur]);
			} else {
				this.opts.state[this.optCur] = stateAfterLiteral(this.opts.state[this.optCur]);
			}

			this.opts.reps.copyWithin(this.optCur * REPS, optPrev * REPS, optPrev * REPS + REPS);
		} else {
			let back: number;
			if (this.opts.prev1IsLiteral[this.optCur] !== 0 && this.opts.hasPrev2[this.optCur] !== 0) {
				optPrev = this.opts.optPrev2[this.optCur];
				back = this.opts.backPrev2[this.optCur];
				this.opts.state[this.optCur] = stateAfterLongRep(this.opts.state[this.optCur]);
			} else {
				back = this.opts.backPrev[this.optCur];
				if (back < REPS) {
					this.opts.state[this.optCur] = stateAfterLongRep(this.opts.state[this.optCur]);
				} else {
					this.opts.state[this.optCur] = stateAfterMatch(this.opts.state[this.optCur]);
				}
			}

			if (back < REPS) {
				this.opts.reps[this.optCur * REPS] = this.opts.reps[optPrev * REPS + back];

				let rep: number;
				for (rep = 1; rep <= back; ++rep) {
					this.opts.reps[this.optCur * REPS + rep] = this.opts.reps[optPrev * REPS + rep - 1];
				}

				for (; rep < REPS; ++rep) {
					this.opts.reps[this.optCur * REPS + rep] = this.opts.reps[optPrev * REPS + rep];
				}
			} else {
				this.opts.reps[this.optCur * REPS] = back - REPS;
				this.opts.reps.copyWithin(this.optCur * REPS + 1, optPrev * REPS, optPrev * REPS + REPS - 1);
			}
		}
	}

	/** Calculates prices of a literal, a short rep, and literal + rep0. */
	private calc1BytePrices(pos: number, posState: number, avail: number, anyRepPrice: number): void {
		// This will be set to true if using a literal or a short rep.
		let nextIsByte = false;

		const curByte = this.lz.getByte(0);
		const matchByte = this.lz.getByte(this.opts.reps[this.optCur * REPS] + 1);

		// Try a literal.
		const literalPrice = this.opts.price[this.optCur]
			+ this.literalEncoder.getPrice(curByte, matchByte, this.lz.getByte(1), pos, this.opts.state[this.optCur]);
		if (literalPrice < this.opts.price[this.optCur + 1]) {
			this.opts.set1(this.optCur + 1, literalPrice, this.optCur, -1);
			nextIsByte = true;
		}

		// Try a short rep.
		if (
			matchByte === curByte
			&& (this.opts.optPrev[this.optCur + 1] === this.optCur
				|| this.opts.backPrev[this.optCur + 1] !== 0)
		) {
			const shortRepPrice = this.getShortRepPrice(anyRepPrice, this.opts.state[this.optCur], posState);
			if (shortRepPrice <= this.opts.price[this.optCur + 1]) {
				this.opts.set1(this.optCur + 1, shortRepPrice, this.optCur, 0);
				nextIsByte = true;
			}
		}

		// If neither a literal nor a short rep was the cheapest choice,
		// try literal + long rep0.
		if (!nextIsByte && matchByte !== curByte && avail > MATCH_LEN_MIN) {
			const lenLimit = Math.min(this.niceLen, avail - 1);
			const len = this.lz.getMatchLen(1, this.opts.reps[this.optCur * REPS], lenLimit);

			if (len >= MATCH_LEN_MIN) {
				this.nextState = this.opts.state[this.optCur];
				this.nextState = stateAfterLiteral(this.nextState);
				const nextPosState = (pos + 1) & this.posMask;
				const price = literalPrice
					+ this.getLongRepAndLenPrice(0, len, this.nextState, nextPosState);

				const i = this.optCur + 1 + len;
				while (this.optEnd < i) {
					this.opts.reset(++this.optEnd);
				}

				if (price < this.opts.price[i]) {
					this.opts.set2(i, price, this.optCur, 0);
				}
			}
		}
	}

	/**
	 * Calculates prices of long rep and long rep + literal + rep0.
	 */
	private calcLongRepPrices(pos: number, posState: number, avail: number, anyRepPrice: number): number {
		let startLen = MATCH_LEN_MIN;
		const lenLimit = Math.min(avail, this.niceLen);

		for (let rep = 0; rep < REPS; ++rep) {
			const len = this.lz.getMatchLen(0, this.opts.reps[this.optCur * REPS + rep], lenLimit);
			if (len < MATCH_LEN_MIN) {
				continue;
			}

			while (this.optEnd < this.optCur + len) {
				this.opts.reset(++this.optEnd);
			}

			const longRepPrice = this.getLongRepPrice(anyRepPrice, rep, this.opts.state[this.optCur], posState);

			for (let i = len; i >= MATCH_LEN_MIN; --i) {
				const price = longRepPrice
					+ this.repLenEncoder.getPrice(i, posState);
				if (price < this.opts.price[this.optCur + i]) {
					this.opts.set1(this.optCur + i, price, this.optCur, rep);
				}
			}

			if (rep === 0) {
				startLen = len + 1;
			}

			let len2Limit = avail - len - 1;
			if (len2Limit < MATCH_LEN_MIN) {
				continue;
			}

			if (len2Limit > this.niceLen) {
				len2Limit = this.niceLen;
			}

			const len2 = this.lz.getMatchLen(len + 1, this.opts.reps[this.optCur * REPS + rep], len2Limit);

			if (len2 >= MATCH_LEN_MIN) {
				// Rep
				let price = longRepPrice
					+ this.repLenEncoder.getPrice(len, posState);
				this.nextState = this.opts.state[this.optCur];
				this.nextState = stateAfterLongRep(this.nextState);

				// Literal
				const curByte = this.lz.getByteAt(len, 0);
				const matchByte = this.lz.getByte(0); // lz.getByteAt(len, len)
				const prevByte = this.lz.getByteAt(len, 1);
				price += this.literalEncoder.getPrice(curByte, matchByte, prevByte, pos + len, this.nextState);
				this.nextState = stateAfterLiteral(this.nextState);

				// Rep0
				const nextPosState = (pos + len + 1) & this.posMask;
				price += this.getLongRepAndLenPrice(0, len2, this.nextState, nextPosState);

				const i = this.optCur + len + 1 + len2;
				while (this.optEnd < i) {
					this.opts.reset(++this.optEnd);
				}

				if (price < this.opts.price[i]) {
					this.opts.set3(i, price, this.optCur, rep, len, 0);
				}
			}
		}

		return startLen;
	}

	/**
	 * Calculates prices of a normal match and normal match + literal + rep0.
	 */
	private calcNormalMatchPrices(pos: number, posState: number, avail: number, anyMatchPrice: number, startLen: number): void {
		// If the longest match is so long that it would not fit into
		// the opts array, shorten the matches.
		if (this.matches.len[this.matches.count - 1] > avail) {
			this.matches.count = 0;
			while (this.matches.len[this.matches.count] < avail) {
				++this.matches.count;
			}

			this.matches.len[this.matches.count++] = avail;
		}

		if (this.matches.len[this.matches.count - 1] < startLen) {
			return;
		}

		while (this.optEnd < this.optCur + this.matches.len[this.matches.count - 1]) {
			this.opts.reset(++this.optEnd);
		}

		const normalMatchPrice = this.getNormalMatchPrice(anyMatchPrice, this.opts.state[this.optCur]);

		let match = 0;
		while (startLen > this.matches.len[match]) {
			++match;
		}

		for (let len = startLen;; ++len) {
			const dist = this.matches.dist[match];

			// Calculate the price of a match of len bytes from the nearest
			// possible distance.
			const matchAndLenPrice = this.getMatchAndLenPrice(normalMatchPrice, dist, len, posState);
			if (matchAndLenPrice < this.opts.price[this.optCur + len]) {
				this.opts.set1(this.optCur + len, matchAndLenPrice, this.optCur, dist + REPS);
			}

			if (len !== this.matches.len[match]) {
				continue;
			}

			// Try match + literal + rep0. First get the length of the rep0.
			let len2Limit = avail - len - 1;
			if (len2Limit >= MATCH_LEN_MIN) {
				if (len2Limit > this.niceLen) {
					len2Limit = this.niceLen;
				}

				const len2 = this.lz.getMatchLen(len + 1, dist, len2Limit);
				if (len2 >= MATCH_LEN_MIN) {
					this.nextState = this.opts.state[this.optCur];
					this.nextState = stateAfterMatch(this.nextState);

					// Literal
					const curByte = this.lz.getByteAt(len, 0);
					const matchByte = this.lz.getByte(0); // lz.getByteAt(len, len)
					const prevByte = this.lz.getByteAt(len, 1);
					let price = matchAndLenPrice
						+ this.literalEncoder.getPrice(curByte, matchByte, prevByte, pos + len, this.nextState);
					this.nextState = stateAfterLiteral(this.nextState);

					// Rep0
					const nextPosState = (pos + len + 1) & this.posMask;
					price += this.getLongRepAndLenPrice(0, len2, this.nextState, nextPosState);

					const i = this.optCur + len + 1 + len2;
					while (this.optEnd < i) {
						this.opts.reset(++this.optEnd);
					}

					if (price < this.opts.price[i]) {
						this.opts.set3(i, price, this.optCur, dist + REPS, len, 0);
					}
				}
			}

			if (++match === this.matches.count) {
				break;
			}
		}
	}
}
