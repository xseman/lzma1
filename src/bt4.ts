/**
 * Binary tree match finder with 2-, 3- and 4-byte hashing.
 *
 * Every position is inserted into a binary search tree sorted by the bytes
 * that follow it. Searching the tree finds the longest matches at the cost
 * of more work per byte than the hash chain finder.
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

export class BT4 extends LzEncoder {
	private readonly hash: Hash234;
	/** Two child links (smaller, larger) per position in the cyclic buffer. */
	private readonly tree: Int32Array;
	private readonly matches: Matches;
	private readonly depthLimit: number;
	private readonly cyclicSize: number;
	private cyclicPos = -1;
	/** Position counter stored in the hash tables and tree. */
	private lzPos: number;

	constructor(config: LzEncoderConfig) {
		super(config);
		this.cyclicSize = config.dictSize + 1;
		this.lzPos = this.cyclicSize;
		this.hash = new Hash234(config.dictSize);
		this.tree = new Int32Array(this.cyclicSize * 2);
		this.matches = new Matches(config.niceLen - 1);
		this.depthLimit = config.depthLimit > 0 ? config.depthLimit : 16 + (config.niceLen >>> 1);
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
			this.tree.fill(0);
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
		const currentMatch = this.hash.getHash4Pos();
		this.hash.updateTables(this.lzPos);

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

			if (lenBest >= niceLenLimit) {
				this.updateTree(niceLenLimit, currentMatch);
				return matches;
			}
		}

		if (lenBest < 3) lenBest = 3;

		// Search the tree, inserting the current position on the way.
		const tree = this.tree;
		const lzPos = this.lzPos;
		const cyclicPos = this.cyclicPos;
		const cyclicSize = this.cyclicSize;
		const matchLens = matches.len;
		const matchDists = matches.dist;
		let count = matches.count;
		let match = currentMatch;
		let depth = this.depthLimit;
		let ptr0 = (cyclicPos << 1) + 1;
		let ptr1 = cyclicPos << 1;
		let len0 = 0;
		let len1 = 0;

		while (true) {
			const delta = lzPos - match;

			if (depth-- === 0 || delta >= cyclicSize) {
				tree[ptr0] = 0;
				tree[ptr1] = 0;
				break;
			}

			// Tree node of the position `delta` bytes back. Its children are
			// loaded before comparing bytes, so the memory reads overlap
			// (as in the LZMA SDK).
			const pair = (cyclicPos - delta + (delta > cyclicPos ? cyclicSize : 0)) << 1;
			const smaller = tree[pair];
			const larger = tree[pair + 1];
			let len = Math.min(len0, len1);

			if (buf[readPos + len - delta] === buf[readPos + len]) {
				len = getMatchLen(buf, readPos, delta, len + 1, matchLenLimit);

				if (len > lenBest) {
					lenBest = len;
					matchLens[count] = len;
					matchDists[count] = delta - 1;
					++count;

					if (len >= niceLenLimit) {
						tree[ptr1] = smaller;
						tree[ptr0] = larger;
						break;
					}
				}
			}

			if (buf[readPos + len - delta] < buf[readPos + len]) {
				tree[ptr1] = match;
				ptr1 = pair + 1;
				match = larger;
				len1 = len;
			} else {
				tree[ptr0] = match;
				ptr0 = pair;
				match = smaller;
				len0 = len;
			}
		}

		matches.count = count;
		return matches;
	}

	skip(len: number): void {
		while (len-- > 0) {
			let niceLenLimit = this.niceLen;
			const avail = this.movePosition();

			if (avail < niceLenLimit) {
				if (avail === 0) continue;
				niceLenLimit = avail;
			}

			this.hash.calcHashes(this.buf, this.readPos);
			const currentMatch = this.hash.getHash4Pos();
			this.hash.updateTables(this.lzPos);
			this.updateTree(niceLenLimit, currentMatch);
		}
	}

	/** Inserts the current position into the tree without collecting matches. */
	private updateTree(niceLenLimit: number, currentMatch: number): void {
		const buf = this.buf;
		const tree = this.tree;
		const readPos = this.readPos;
		const lzPos = this.lzPos;
		const cyclicPos = this.cyclicPos;
		const cyclicSize = this.cyclicSize;
		let match = currentMatch;
		let depth = this.depthLimit;
		let ptr0 = (cyclicPos << 1) + 1;
		let ptr1 = cyclicPos << 1;
		let len0 = 0;
		let len1 = 0;

		while (true) {
			const delta = lzPos - match;

			if (depth-- === 0 || delta >= cyclicSize) {
				tree[ptr0] = 0;
				tree[ptr1] = 0;
				return;
			}

			const pair = (cyclicPos - delta + (delta > cyclicPos ? cyclicSize : 0)) << 1;
			const smaller = tree[pair];
			const larger = tree[pair + 1];
			let len = Math.min(len0, len1);

			if (buf[readPos + len - delta] === buf[readPos + len]) {
				len = getMatchLen(buf, readPos, delta, len + 1, niceLenLimit);

				if (len === niceLenLimit) {
					tree[ptr1] = smaller;
					tree[ptr0] = larger;
					return;
				}
			}

			if (buf[readPos + len - delta] < buf[readPos + len]) {
				tree[ptr1] = match;
				ptr1 = pair + 1;
				match = larger;
				len1 = len;
			} else {
				tree[ptr0] = match;
				ptr0 = pair;
				match = smaller;
				len0 = len;
			}
		}
	}

	private movePosition(): number {
		const avail = this.movePos(this.niceLen, 4);

		if (avail !== 0) {
			if (++this.lzPos === MAX_POS) {
				const offset = MAX_POS - this.cyclicSize;
				this.hash.normalize(offset);
				normalizePositions(this.tree, offset);
				this.lzPos -= offset;
			}

			if (++this.cyclicPos === this.cyclicSize) {
				this.cyclicPos = 0;
			}
		}

		return avail;
	}
}
