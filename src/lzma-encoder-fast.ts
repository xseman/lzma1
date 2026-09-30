/**
 * Fast LZMA encoder: picks symbols with simple heuristics, similar to a
 * lazy-matching LZ77 encoder.
 *
 * Ported from XZ for Java (0BSD) by Lasse Collin and Igor Pavlov.
 */

import type { Matches } from "./lz-encoder.js";
import {
	MATCH_LEN_MAX,
	MATCH_LEN_MIN,
	REPS,
} from "./lzma-coder.js";
import { LzmaEncoder } from "./lzma-encoder.js";

export const FAST_EXTRA_SIZE_BEFORE = 1;
export const FAST_EXTRA_SIZE_AFTER = MATCH_LEN_MAX - 1;

/** True if `smallDist` is so much shorter that it's worth a byte of length. */
function changePair(smallDist: number, bigDist: number): boolean {
	return smallDist < bigDist >>> 7;
}

export class LzmaEncoderFast extends LzmaEncoder {
	private matches: Matches | null = null;

	protected getNextSymbol(): number {
		// Get the matches for the next byte unless they were already read
		// during the previous call.
		if (this.readAhead === -1) {
			this.matches = this.getMatches();
		}

		this.back = -1;

		// Not enough bytes left for a match: encode a literal.
		const avail = Math.min(this.lz.getAvail(), MATCH_LEN_MAX);
		if (avail < MATCH_LEN_MIN) {
			return 1;
		}

		// Look for a match at one of the four recent distances.
		let bestRepLen = 0;
		let bestRepIndex = 0;

		for (let rep = 0; rep < REPS; ++rep) {
			const len = this.lz.getMatchLen(0, this.reps[rep], avail);
			if (len < MATCH_LEN_MIN) continue;

			// Long enough: take it.
			if (len >= this.niceLen) {
				this.back = rep;
				this.skip(len - 1);
				return len;
			}

			if (len > bestRepLen) {
				bestRepIndex = rep;
				bestRepLen = len;
			}
		}

		let mainLen = 0;
		let mainDist = 0;
		let matches = this.matches!;

		if (matches.count > 0) {
			mainLen = matches.len[matches.count - 1];
			mainDist = matches.dist[matches.count - 1];

			if (mainLen >= this.niceLen) {
				this.back = mainDist + REPS;
				this.skip(mainLen - 1);
				return mainLen;
			}

			// Prefer a one byte shorter match if its distance is much smaller.
			while (matches.count > 1 && mainLen === matches.len[matches.count - 2] + 1) {
				if (!changePair(matches.dist[matches.count - 2], mainDist)) break;

				--matches.count;
				mainLen = matches.len[matches.count - 1];
				mainDist = matches.dist[matches.count - 1];
			}

			// A 2-byte match with a big distance costs more than two literals.
			if (mainLen === MATCH_LEN_MIN && mainDist >= 0x80) {
				mainLen = 1;
			}
		}

		// Prefer a rep match unless the normal match is clearly longer.
		if (bestRepLen >= MATCH_LEN_MIN) {
			if (
				bestRepLen + 1 >= mainLen
				|| (bestRepLen + 2 >= mainLen && mainDist >= 1 << 9)
				|| (bestRepLen + 3 >= mainLen && mainDist >= 1 << 15)
			) {
				this.back = bestRepIndex;
				this.skip(bestRepLen - 1);
				return bestRepLen;
			}
		}

		if (mainLen < MATCH_LEN_MIN || avail <= MATCH_LEN_MIN) {
			return 1;
		}

		// Lazy matching: if the next position has a better match, encode
		// the current byte as a literal.
		matches = this.matches = this.getMatches();

		if (matches.count > 0) {
			const newLen = matches.len[matches.count - 1];
			const newDist = matches.dist[matches.count - 1];

			if (
				(newLen >= mainLen && newDist < mainDist)
				|| (newLen === mainLen + 1 && !changePair(mainDist, newDist))
				|| newLen > mainLen + 1
				|| (newLen + 1 >= mainLen && mainLen >= MATCH_LEN_MIN + 1 && changePair(newDist, mainDist))
			) {
				return 1;
			}
		}

		// A rep match of almost the same length is cheaper.
		const limit = Math.max(mainLen - 1, MATCH_LEN_MIN);
		for (let rep = 0; rep < REPS; ++rep) {
			if (this.lz.getMatchLen(0, this.reps[rep], limit) === limit) {
				return 1;
			}
		}

		this.back = mainDist + REPS;
		this.skip(mainLen - 2);
		return mainLen;
	}
}
