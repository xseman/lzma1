/**
 * Normal LZMA encoder: "optimal parsing".
 *
 * Instead of deciding one symbol at a time, it looks ahead up to `OPTS`
 * bytes and computes the cheapest way to reach every position (like a
 * shortest-path search where the edge weights are symbol prices). The
 * cheapest path is then walked backwards and returned symbol by symbol.
 *
 * Ported from XZ for Java (0BSD) by Lasse Collin and Igor Pavlov. The path
 * representation (`len`, `dist`, `extra`) follows the LZMA SDK of 7-Zip.
 */

import type { Matches } from "./lz-encoder.js";
import type { LzEncoder } from "./lz-encoder.js";
import {
	DIST_STATES,
	IS_MATCH,
	isLiteralState,
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
import {
	getBitPrice,
	type RangeEncoder,
} from "./range-encoder.js";

/** Maximum number of positions optimized at once. */
export const OPTS = 4096;
export const NORMAL_EXTRA_SIZE_BEFORE = OPTS;
export const NORMAL_EXTRA_SIZE_AFTER = OPTS;

const INFINITY_PRICE = 1 << 30;

/** `dist` value of a literal (see `LzmaEncoder.back`). */
const LITERAL = -1;

/**
 * The cheapest known way to reach each position, as parallel arrays
 * indexed by position ("structure of arrays"): a few allocations instead
 * of thousands of small objects, and cheap resets.
 *
 * The last step to a position is one of:
 * - `extra = 0`: one symbol `dist` of `len` bytes
 * - `extra = 1`: a literal, then a rep0 of `len` bytes
 * - `extra > 1`: symbol `dist` of `extra - 1` bytes, a literal, then a rep0
 *   of `len` bytes
 *
 * so the step starts at position `i - len - extra`.
 */
class Optimums {
	readonly price: Int32Array;
	/** Coder state after reaching the position. */
	readonly state: Uint8Array;
	/** Rep distances after reaching the position, `[i * REPS + rep]`. */
	readonly reps: Int32Array;
	readonly len: Int32Array;
	/** Symbol, as in `LzmaEncoder.back`: -1 literal, 0-3 rep, 4+ match. */
	readonly dist: Int32Array;
	readonly extra: Int32Array;

	constructor(size: number) {
		this.price = new Int32Array(size);
		this.state = new Uint8Array(size);
		this.reps = new Int32Array(size * REPS);
		this.len = new Int32Array(size);
		this.dist = new Int32Array(size);
		this.extra = new Int32Array(size);
		this.clear();
	}

	/** Returns all entries to their initial values. */
	clear(): void {
		this.price.fill(INFINITY_PRICE);
		this.state.fill(0);
		this.reps.fill(0);
		this.len.fill(0);
		this.dist.fill(0);
		this.extra.fill(0);
	}

	/** Position `i` is reached from `from` with the symbol `dist`. */
	setSymbol(i: number, price: number, from: number, dist: number): void {
		this.price[i] = price;
		this.len[i] = i - from;
		this.dist[i] = dist;
		this.extra[i] = 0;
	}

	/** Position `i` is reached from `from` with a literal and a rep0. */
	setLiteralRep0(i: number, price: number, from: number): void {
		this.price[i] = price;
		this.len[i] = i - from - 1;
		this.dist[i] = 0;
		this.extra[i] = 1;
	}

	/** Position `i` is reached from `from` with `dist` of `len` bytes, a literal and a rep0. */
	setSymbolLiteralRep0(i: number, price: number, from: number, dist: number, len: number): void {
		this.price[i] = price;
		this.len[i] = i - from - len - 1;
		this.dist[i] = dist;
		this.extra[i] = len + 1;
	}
}

export interface LzmaEncoderNormalConfig extends LzmaEncoderConfig {
	/**
	 * Number of positions to allocate, at most `OPTS`. When the input size
	 * is known, `inputSize + 2` is enough.
	 */
	optsSize: number;
}

export class LzmaEncoderNormal extends LzmaEncoder {
	private readonly opts: Optimums;
	/**
	 * While optimizing: the current and the furthest reached position.
	 * Afterwards: the next and the end index of the symbols in `opts.len`
	 * and `opts.dist` that `backward()` stored.
	 */
	private optCur = 0;
	private optEnd = 0;
	private matches!: Matches;
	private readonly repLens = new Int32Array(REPS);

	constructor(rc: RangeEncoder, lz: LzEncoder, config: LzmaEncoderNormalConfig) {
		super(rc, lz, config);
		this.opts = new Optimums(Math.min(config.optsSize, OPTS));
	}

	override reset(): void {
		this.optCur = 0;
		this.optEnd = 0;
		// Not initialized yet when called from the base class constructor.
		this.opts?.clear();
		super.reset();
	}

	protected getNextSymbol(): number {
		const opts = this.opts;
		const lz = this.lz;
		const reps = this.reps;
		const repLens = this.repLens;

		// Return symbols left over from the previous optimization first.
		if (this.optCur < this.optEnd) {
			const i = this.optCur++;
			this.back = opts.dist[i];
			return opts.len[i];
		}

		this.optCur = 0;
		this.optEnd = 0;
		this.back = -1;

		if (this.readAhead === -1) {
			this.matches = this.getMatches();
		}

		// Not enough bytes left for a match: encode a literal.
		let avail = Math.min(lz.getAvail(), MATCH_LEN_MAX);
		if (avail < MATCH_LEN_MIN) {
			return 1;
		}

		// Lengths of the rep matches.
		let repBest = 0;
		for (let rep = 0; rep < REPS; ++rep) {
			repLens[rep] = lz.getMatchLen(0, reps[rep], avail);

			if (repLens[rep] < MATCH_LEN_MIN) {
				repLens[rep] = 0;
				continue;
			}

			if (repLens[rep] > repLens[repBest]) {
				repBest = rep;
			}
		}

		// A long enough rep match is taken without further search.
		if (repLens[repBest] >= this.niceLen) {
			this.back = repBest;
			this.skip(repLens[repBest] - 1);
			return repLens[repBest];
		}

		// Longest match from the match finder.
		let mainLen = 0;
		let mainDist = 0;
		const matches = this.matches;

		if (matches.count > 0) {
			mainLen = matches.len[matches.count - 1];
			mainDist = matches.dist[matches.count - 1];

			if (mainLen >= this.niceLen) {
				this.back = mainDist + REPS;
				this.skip(mainLen - 1);
				return mainLen;
			}
		}

		const curByte = lz.getByte(0);
		const matchByte = lz.getByte(reps[0] + 1);

		// Neither a match nor a short rep is possible: encode a literal.
		if (mainLen < MATCH_LEN_MIN && curByte !== matchByte && repLens[repBest] < MATCH_LEN_MIN) {
			return 1;
		}

		let pos = lz.getPos();
		let posState = pos & this.posMask;

		// Price of the current byte as a literal.
		{
			const prevByte = lz.getByte(1);
			const literalPrice = this.getLiteralPrice(curByte, matchByte, prevByte, pos, this.state);
			opts.setSymbol(1, literalPrice, 0, LITERAL);
		}

		let anyMatchPrice = this.getAnyMatchPrice(this.state, posState);
		let anyRepPrice = this.getAnyRepPrice(anyMatchPrice, this.state);

		// A short rep (one byte at rep0) may be cheaper than the literal.
		if (matchByte === curByte) {
			const shortRepPrice = this.getShortRepPrice(anyRepPrice, this.state, posState);
			if (shortRepPrice < opts.price[1]) {
				opts.setSymbol(1, shortRepPrice, 0, 0);
			}
		}

		// No match of two or more bytes: use the literal or the short rep.
		this.optEnd = Math.max(mainLen, repLens[repBest]);
		if (this.optEnd < MATCH_LEN_MIN) {
			this.back = opts.dist[1];
			return 1;
		}

		// The price functions below use the cached tables.
		this.updatePrices();

		opts.state[0] = this.state;
		opts.reps[0] = reps[0];
		opts.reps[1] = reps[1];
		opts.reps[2] = reps[2];
		opts.reps[3] = reps[3];

		for (let i = this.optEnd; i >= MATCH_LEN_MIN; --i) {
			opts.price[i] = INFINITY_PRICE;
		}

		// Prices of rep matches of all lengths.
		for (let rep = 0; rep < REPS; ++rep) {
			let repLen = repLens[rep];
			if (repLen < MATCH_LEN_MIN) continue;

			const longRepPrice = this.getLongRepPrice(anyRepPrice, rep, this.state, posState);

			do {
				const price = longRepPrice + this.repLenEncoder.getPrice(repLen, posState);
				if (price < opts.price[repLen]) {
					opts.setSymbol(repLen, price, 0, rep);
				}
			} while (--repLen >= MATCH_LEN_MIN);
		}

		// Prices of normal matches longer than rep0.
		{
			let len = Math.max(repLens[0] + 1, MATCH_LEN_MIN);

			if (len <= mainLen) {
				const normalMatchPrice = this.getNormalMatchPrice(anyMatchPrice, this.state);

				// Index of the shortest match that is at least `len` bytes.
				let i = 0;
				while (len > matches.len[i]) {
					++i;
				}

				while (true) {
					const dist = matches.dist[i];
					const price = this.getMatchAndLenPrice(normalMatchPrice, dist, len, posState);
					if (price < opts.price[len]) {
						opts.setSymbol(len, price, 0, dist + REPS);
					}

					if (len === matches.len[i] && ++i === matches.count) {
						break;
					}

					++len;
				}
			}
		}

		avail = Math.min(lz.getAvail(), OPTS - 1);

		// Walk forward, extending the cheapest paths from each position.
		while (++this.optCur < this.optEnd) {
			this.matches = this.getMatches();

			if (this.matches.count > 0 && this.matches.len[this.matches.count - 1] >= this.niceLen) {
				break;
			}

			--avail;
			++pos;
			posState = pos & this.posMask;

			this.updateOptStateAndReps();
			const state = opts.state[this.optCur];
			anyMatchPrice = opts.price[this.optCur] + this.getAnyMatchPrice(state, posState);
			anyRepPrice = this.getAnyRepPrice(anyMatchPrice, state);

			this.calc1BytePrices(pos, posState, avail, anyRepPrice);

			if (avail >= MATCH_LEN_MIN) {
				const startLen = this.calcLongRepPrices(pos, posState, avail, anyRepPrice);

				if (this.matches.count > 0) {
					this.calcNormalMatchPrices(pos, posState, avail, anyMatchPrice, startLen);
				}
			}
		}

		return this.backward(this.optCur);
	}

	/**
	 * Walks the cheapest path to `end` backwards and stores its symbols in
	 * forward order in `opts.len` and `opts.dist`, from index `optCur` to
	 * `optEnd`. Sets `back` and returns the length of the first symbol.
	 */
	private backward(end: number): number {
		const { len: lens, dist: dists, extra: extras } = this.opts;
		let cur = end;
		let write = end + 1;
		this.optEnd = write;

		while (true) {
			let dist = dists[cur];
			let len = lens[cur];
			const extra = extras[cur];
			cur -= len;

			if (extra !== 0) {
				// The rep0 at the end of the step...
				lens[--write] = len;
				dists[write] = 0;
				cur -= extra;
				len = extra;

				if (extra === 1) {
					// ...after a literal.
					dist = LITERAL;
				} else {
					// ...after a literal after the symbol `dist`.
					lens[--write] = 1;
					dists[write] = LITERAL;
					--len;
				}
			}

			if (cur === 0) {
				this.optCur = write;
				this.back = dist;
				return len;
			}

			lens[--write] = len;
			dists[write] = dist;
		}
	}

	/** Derives the state and reps at `optCur` from the step that reaches it. */
	private updateOptStateAndReps(): void {
		const { state: states, reps, len: lens, dist: dists, extra: extras } = this.opts;
		const cur = this.optCur;
		const len = lens[cur];
		const dist = dists[cur];
		const extra = extras[cur];
		const prev = cur - len - extra;
		const to = cur * REPS;
		const from = prev * REPS;
		let state = states[prev];

		if (extra === 0) {
			if (len === 1) {
				// A literal or a short rep: the reps don't change.
				states[cur] = dist === LITERAL ? stateAfterLiteral(state) : stateAfterShortRep(state);
				reps[to] = reps[from];
				reps[to + 1] = reps[from + 1];
				reps[to + 2] = reps[from + 2];
				reps[to + 3] = reps[from + 3];
				return;
			}

			state = dist < REPS ? stateAfterLongRep(state) : stateAfterMatch(state);
		} else {
			if (extra > 1) {
				state = dist < REPS ? stateAfterLongRep(state) : stateAfterMatch(state);
			}
			// The literal and the rep0.
			state = stateAfterLongRep(stateAfterLiteral(state));
		}

		states[cur] = state;

		// The rep0 at the end of a step doesn't change the reps, the
		// symbol `dist` does.
		if (dist < REPS) {
			// Move the used rep to the front.
			reps[to] = reps[from + dist];
			let rep = 1;
			for (; rep <= dist; ++rep) {
				reps[to + rep] = reps[from + rep - 1];
			}
			for (; rep < REPS; ++rep) {
				reps[to + rep] = reps[from + rep];
			}
		} else {
			reps[to] = dist - REPS;
			reps[to + 1] = reps[from];
			reps[to + 2] = reps[from + 1];
			reps[to + 3] = reps[from + 2];
		}
	}

	/**
	 * Prices of a literal, a short rep, and a literal + rep0.
	 *
	 * Candidates that can't be the cheapest are skipped without computing
	 * their price, as in the LZMA SDK since 7-Zip 18.
	 */
	private calc1BytePrices(pos: number, posState: number, avail: number, anyRepPrice: number): void {
		const opts = this.opts;
		const lz = this.lz;
		const cur = this.optCur;
		const next = cur + 1;
		const nextPrice = opts.price[next];
		const state = opts.state[cur];
		const rep0 = opts.reps[cur * REPS];
		let nextIsByte = false;

		const curByte = lz.getByte(0);
		const matchByte = lz.getByte(rep0 + 1);

		// Literal: skipped if `next` is reached already and a short rep is
		// possible, or if even the price of the "literal" flag is too high.
		// Then the literal + rep0 is skipped too.
		let literalPrice = 0;
		const literalFlagPrice = opts.price[cur] + getBitPrice(this.probs[IS_MATCH + (state << 4) + posState], 0);

		if (!(nextPrice < INFINITY_PRICE && matchByte === curByte) && literalFlagPrice <= nextPrice) {
			literalPrice = opts.price[cur] + this.getLiteralPrice(curByte, matchByte, lz.getByte(1), pos, state);
			if (literalPrice < opts.price[next]) {
				opts.setSymbol(next, literalPrice, cur, LITERAL);
				nextIsByte = true;
			}
		}

		// Short rep: only after a literal, and only if the "rep" flags alone
		// are cheaper than the current price of `next`. As in XZ for Java,
		// only if `next` is reached with a single symbol that is from here,
		// or that isn't a rep0.
		if (
			matchByte === curByte
			&& isLiteralState(state)
			&& anyRepPrice < opts.price[next]
			&& opts.extra[next] === 0
			&& (opts.len[next] === 1 || opts.dist[next] !== 0)
		) {
			const shortRepPrice = this.getShortRepPrice(anyRepPrice, state, posState);
			if (shortRepPrice <= opts.price[next]) {
				opts.setSymbol(next, shortRepPrice, cur, 0);
				nextIsByte = true;
			}
		}

		// Literal + rep0, if neither of the above was the cheapest.
		if (!nextIsByte && literalPrice !== 0 && matchByte !== curByte && avail > MATCH_LEN_MIN) {
			const lenLimit = Math.min(this.niceLen, avail - 1);
			const len = lz.getMatchLen(1, rep0, lenLimit);

			if (len >= MATCH_LEN_MIN) {
				const nextState = stateAfterLiteral(state);
				const nextPosState = (pos + 1) & this.posMask;
				const price = literalPrice + this.getLongRepAndLenPrice(0, len, nextState, nextPosState);

				const i = next + len;
				this.extendOptEnd(i);
				if (price < opts.price[i]) {
					opts.setLiteralRep0(i, price, cur);
				}
			}
		}
	}

	/**
	 * Prices of long reps and long rep + literal + rep0.
	 *
	 * @returns the shortest normal match length worth checking
	 */
	private calcLongRepPrices(pos: number, posState: number, avail: number, anyRepPrice: number): number {
		const opts = this.opts;
		const optPrice = opts.price;
		const lz = this.lz;
		const cur = this.optCur;
		const state = opts.state[cur];
		const repsOffset = cur * REPS;
		let startLen = MATCH_LEN_MIN;
		const lenLimit = Math.min(avail, this.niceLen);

		for (let rep = 0; rep < REPS; ++rep) {
			const dist = opts.reps[repsOffset + rep];
			const len = lz.getMatchLen(0, dist, lenLimit);
			if (len < MATCH_LEN_MIN) continue;

			this.extendOptEnd(cur + len);

			const longRepPrice = this.getLongRepPrice(anyRepPrice, rep, state, posState);

			const lenPrices = this.repLenEncoder.prices;
			const lenOffset = this.repLenEncoder.priceOffset(posState);
			for (let i = len; i >= MATCH_LEN_MIN; --i) {
				const price = longRepPrice + lenPrices[lenOffset + i];
				if (price < optPrice[cur + i]) {
					opts.setSymbol(cur + i, price, cur, rep);
				}
			}

			if (rep === 0) {
				startLen = len + 1;
			}

			const len2Limit = Math.min(avail - len - 1, this.niceLen);
			if (len2Limit < MATCH_LEN_MIN) continue;

			const len2 = lz.getMatchLen(len + 1, dist, len2Limit);
			if (len2 < MATCH_LEN_MIN) continue;

			// Rep
			let price = longRepPrice + this.repLenEncoder.getPrice(len, posState);
			let nextState = stateAfterLongRep(state);

			// Literal
			const curByte = lz.getByteAt(len, 0);
			const matchByte = lz.getByte(0); // same as lz.getByteAt(len, len)
			const prevByte = lz.getByteAt(len, 1);
			price += this.getLiteralPrice(curByte, matchByte, prevByte, pos + len, nextState);
			nextState = stateAfterLiteral(nextState);

			// Rep0
			const nextPosState = (pos + len + 1) & this.posMask;
			price += this.getLongRepAndLenPrice(0, len2, nextState, nextPosState);

			const i = cur + len + 1 + len2;
			this.extendOptEnd(i);
			if (price < optPrice[i]) {
				opts.setSymbolLiteralRep0(i, price, cur, rep, len);
			}
		}

		return startLen;
	}

	/** Prices of normal matches and match + literal + rep0. */
	private calcNormalMatchPrices(pos: number, posState: number, avail: number, anyMatchPrice: number, startLen: number): void {
		const opts = this.opts;
		const optPrice = opts.price;
		const lz = this.lz;
		const cur = this.optCur;
		const state = opts.state[cur];
		const matches = this.matches;
		const matchLens = matches.len;
		const matchDists = matches.dist;

		// Shorten the matches that don't fit into the remaining input.
		if (matchLens[matches.count - 1] > avail) {
			matches.count = 0;
			while (matchLens[matches.count] < avail) {
				++matches.count;
			}
			matchLens[matches.count++] = avail;
		}

		const count = matches.count;
		if (matchLens[count - 1] < startLen) {
			return;
		}

		this.extendOptEnd(cur + matchLens[count - 1]);

		const normalMatchPrice = this.getNormalMatchPrice(anyMatchPrice, state);

		let match = 0;
		while (startLen > matchLens[match]) {
			++match;
		}

		const lenPrices = this.matchLenEncoder.prices;
		const lenOffset = this.matchLenEncoder.priceOffset(posState);
		let dist = matchDists[match];
		// Distances of matches of 5+ bytes share one price (distance state 3).
		let longDistPrice = this.getDistPrice(DIST_STATES - 1, dist);

		for (let len = startLen;; ++len) {
			// Match of `len` bytes from the nearest possible distance.
			const distPrice = len < DIST_STATES + MATCH_LEN_MIN ? this.getDistPrice(len - MATCH_LEN_MIN, dist) : longDistPrice;
			const matchAndLenPrice = normalMatchPrice + lenPrices[lenOffset + len] + distPrice;
			if (matchAndLenPrice < optPrice[cur + len]) {
				opts.setSymbol(cur + len, matchAndLenPrice, cur, dist + REPS);
			}

			if (len !== matchLens[match]) {
				continue;
			}

			// Match + literal + rep0
			const len2Limit = Math.min(avail - len - 1, this.niceLen);
			if (len2Limit >= MATCH_LEN_MIN) {
				const len2 = lz.getMatchLen(len + 1, dist, len2Limit);

				if (len2 >= MATCH_LEN_MIN) {
					let nextState = stateAfterMatch(state);

					// Literal
					const curByte = lz.getByteAt(len, 0);
					const matchByte = lz.getByte(0); // same as lz.getByteAt(len, len)
					const prevByte = lz.getByteAt(len, 1);
					let price = matchAndLenPrice + this.getLiteralPrice(curByte, matchByte, prevByte, pos + len, nextState);
					nextState = stateAfterLiteral(nextState);

					// Rep0
					const nextPosState = (pos + len + 1) & this.posMask;
					price += this.getLongRepAndLenPrice(0, len2, nextState, nextPosState);

					const i = cur + len + 1 + len2;
					this.extendOptEnd(i);
					if (price < optPrice[i]) {
						opts.setSymbolLiteralRep0(i, price, cur, dist + REPS, len);
					}
				}
			}

			if (++match === count) {
				break;
			}

			dist = matchDists[match];
			longDistPrice = this.getDistPrice(DIST_STATES - 1, dist);
		}
	}

	/** Grows the optimized range to `end`, resetting the new entries. */
	private extendOptEnd(end: number): void {
		// A loop, because fill() is a native call, slow for the few entries added here.
		const price = this.opts.price;
		while (this.optEnd < end) {
			price[++this.optEnd] = INFINITY_PRICE;
		}
	}
}
