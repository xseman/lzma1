/**
 * Hash chain match finder with 2-, 3- and 4-byte hashing.
 *
 * Every position links to the previous position with the same 4-byte hash.
 * Faster than the binary tree finder but finds fewer long matches.
 *
 * Ported from XZ for Java (0BSD) by Lasse Collin and Igor Pavlov.
 */

import { Hash234 } from "./hash234.js";
import {
	getMatchLen,
	LzEncoder,
	type LzEncoderConfig,
	Matches,
	normalizePositions,
} from "./lz-encoder.js";

const MAX_POS = 0x7FFFFFFF;

export class HC4 extends LzEncoder {
	private readonly hash: Hash234;
	/** Previous position with the same hash, per position in the cyclic buffer. */
	private readonly chain: Int32Array;
	private readonly matches: Matches;
	private readonly depthLimit: number;
	private readonly cyclicSize: number;
	private cyclicPos = -1;
	/** Position counter stored in the hash tables and chain. */
	private lzPos: number;

	constructor(config: LzEncoderConfig) {
		super(config);
		this.hash = new Hash234(config.dictSize);
		this.cyclicSize = config.dictSize + 1;
		this.chain = new Int32Array(this.cyclicSize);
		this.lzPos = this.cyclicSize;
		this.matches = new Matches(config.niceLen - 1);
		this.depthLimit = config.depthLimit > 0 ? config.depthLimit : 4 + (config.niceLen >>> 2);
	}

	/**
	 * Prepares for a new input without clearing the tables: positions
	 * continue after the previous input, so its entries are too far back
	 * (`delta >= cyclicSize`) and get ignored like empty ones.
	 */
	override reset(): void {
		super.reset();
		this.cyclicPos = -1;
		this.lzPos += this.cyclicSize;

		if (this.lzPos >= MAX_POS - this.cyclicSize) {
			this.hash.clear();
			this.chain.fill(0);
			this.lzPos = this.cyclicSize;
		}
	}

	getMatches(): Matches {
		const matches = this.matches;
		const buf = this.buf;
		matches.count = 0;

		let matchLenLimit = this.matchLenMax;
		let niceLenLimit = this.niceLen;
		const avail = this.movePosition();

		if (avail < matchLenLimit) {
			if (avail === 0) return matches;

			matchLenLimit = avail;
			if (niceLenLimit > avail) niceLenLimit = avail;
		}

		const readPos = this.readPos;
		this.hash.calcHashes(buf, readPos);
		let delta2 = this.lzPos - this.hash.getHash2Pos();
		const delta3 = this.lzPos - this.hash.getHash3Pos();
		let match = this.hash.getHash4Pos();
		this.hash.updateTables(this.lzPos);
		this.chain[this.cyclicPos] = match;

		let lenBest = 0;

		// A 2-byte match from the hash table.
		if (delta2 < this.cyclicSize && buf[readPos - delta2] === buf[readPos]) {
			lenBest = 2;
			matches.len[0] = 2;
			matches.dist[0] = delta2 - 1;
			matches.count = 1;
		}

		// A 3-byte match, if it's at a different distance.
		if (delta2 !== delta3 && delta3 < this.cyclicSize && buf[readPos - delta3] === buf[readPos]) {
			lenBest = 3;
			matches.dist[matches.count++] = delta3 - 1;
			delta2 = delta3;
		}

		// Extend the hashed match as far as possible.
		if (matches.count > 0) {
			lenBest = getMatchLen(buf, readPos, delta2, lenBest, matchLenLimit);
			matches.len[matches.count - 1] = lenBest;

			if (lenBest >= niceLenLimit) return matches;
		}

		if (lenBest < 3) lenBest = 3;

		// Follow the chain of earlier positions with the same 4-byte hash.
		let depth = this.depthLimit;

		while (true) {
			const delta = this.lzPos - match;

			if (depth-- === 0 || delta >= this.cyclicSize) {
				return matches;
			}

			match = this.chain[this.cyclicPos - delta + (delta > this.cyclicPos ? this.cyclicSize : 0)];

			// Cheap checks first: a longer match must differ from the best
			// one at `lenBest`, and must start with the same byte.
			if (buf[readPos + lenBest - delta] === buf[readPos + lenBest] && buf[readPos - delta] === buf[readPos]) {
				const len = getMatchLen(buf, readPos, delta, 1, matchLenLimit);

				if (len > lenBest) {
					lenBest = len;
					matches.len[matches.count] = len;
					matches.dist[matches.count] = delta - 1;
					++matches.count;

					if (len >= niceLenLimit) return matches;
				}
			}
		}
	}

	skip(len: number): void {
		while (len-- > 0) {
			if (this.movePosition() !== 0) {
				this.hash.calcHashes(this.buf, this.readPos);
				this.chain[this.cyclicPos] = this.hash.getHash4Pos();
				this.hash.updateTables(this.lzPos);
			}
		}
	}

	private movePosition(): number {
		const avail = this.movePos(4, 4);

		if (avail !== 0) {
			if (++this.lzPos === MAX_POS) {
				const offset = MAX_POS - this.cyclicSize;
				this.hash.normalize(offset);
				normalizePositions(this.chain, offset);
				this.lzPos -= offset;
			}

			if (++this.cyclicPos === this.cyclicSize) {
				this.cyclicPos = 0;
			}
		}

		return avail;
	}
}
