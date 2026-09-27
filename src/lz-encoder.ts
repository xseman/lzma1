/**
 * Encoder-side LZ window and the base class of the match finders.
 *
 * The window holds `keepSizeBefore` bytes of history (the dictionary plus
 * what the encoder needs) and `keepSizeAfter` bytes of lookahead. When the
 * read position gets close to the end of the buffer, the window is moved
 * back to the start of the buffer.
 *
 * Ported from XZ for Java (0BSD) by Lasse Collin and Igor Pavlov.
 */

export type MatchFinderType = "hc4" | "bt4";

/** Matches found at one position, sorted by increasing length. */
export class Matches {
	readonly len: Int32Array;
	/** Distances minus one (0 means the previous byte). */
	readonly dist: Int32Array;
	count = 0;

	constructor(countMax: number) {
		this.len = new Int32Array(countMax);
		this.dist = new Int32Array(countMax);
	}
}

/**
 * Returns how many bytes starting at `off + len` equal the bytes `delta`
 * positions earlier, up to `lenLimit` in total.
 */
export function getMatchLen(buf: Uint8Array, off: number, delta: number, len: number, lenLimit: number): number {
	const end = off + lenLimit;
	let i = off + len;

	while (i < end && buf[i] === buf[i - delta]) {
		++i;
	}

	return i - off;
}

/** Subtracts `offset` from all positions, clamping at zero. */
export function normalizePositions(positions: Int32Array, offset: number): void {
	for (let i = 0; i < positions.length; ++i) {
		positions[i] = positions[i] <= offset ? 0 : positions[i] - offset;
	}
}

export interface LzEncoderConfig {
	dictSize: number;
	extraSizeBefore: number;
	extraSizeAfter: number;
	niceLen: number;
	matchLenMax: number;
	/** Search depth limit, 0 = automatic */
	depthLimit: number;
	/** Total input size, when known in advance, to avoid oversized buffers */
	inputSize?: number;
}

export abstract class LzEncoder {
	private readonly keepSizeBefore: number;
	private readonly keepSizeAfter: number;
	readonly matchLenMax: number;
	readonly niceLen: number;
	readonly buf: Uint8Array;

	/** Position of the byte most recently returned by the match finder. */
	protected readPos = -1;
	private readLimit = -1;
	private finishing = false;
	private writePos = 0;
	/** Bytes that were skipped because there wasn't enough lookahead yet. */
	private pendingSize = 0;

	constructor(config: LzEncoderConfig) {
		this.keepSizeBefore = config.extraSizeBefore + config.dictSize;
		this.keepSizeAfter = config.extraSizeAfter + config.matchLenMax;
		this.matchLenMax = config.matchLenMax;
		this.niceLen = config.niceLen;

		const reserveSize = Math.min((config.dictSize >>> 1) + (256 << 10), 512 << 20);
		let bufSize = this.keepSizeBefore + this.keepSizeAfter + reserveSize;

		if (config.inputSize !== undefined) {
			// The whole input fits, so the window never has to move.
			bufSize = Math.min(bufSize, config.inputSize + this.keepSizeAfter);
		}

		this.buf = new Uint8Array(bufSize);
	}

	/** Prepares the window for a new, independent input. */
	reset(): void {
		this.readPos = -1;
		this.readLimit = -1;
		this.finishing = false;
		this.writePos = 0;
		this.pendingSize = 0;
	}

	/** Returns matches at the next position. */
	abstract getMatches(): Matches;

	/** Advances `len` positions, updating the match finder structures. */
	abstract skip(len: number): void;

	/**
	 * Copies input into the window.
	 *
	 * @returns number of bytes consumed; call again with the rest
	 */
	fillWindow(input: Uint8Array, off: number, len: number): number {
		if (this.readPos >= this.buf.length - this.keepSizeAfter) {
			this.moveWindow();
		}

		len = Math.min(len, this.buf.length - this.writePos);
		this.buf.set(input.subarray(off, off + len), this.writePos);
		this.writePos += len;

		if (this.writePos >= this.keepSizeAfter) {
			this.readLimit = this.writePos - this.keepSizeAfter;
		}

		this.processPendingBytes();
		return len;
	}

	/** Marks the end of input so that the lookahead can be used up. */
	setFinishing(): void {
		this.readLimit = this.writePos - 1;
		this.finishing = true;
		this.processPendingBytes();
	}

	isStarted(): boolean {
		return this.readPos !== -1;
	}

	/** True if there is enough input to encode more symbols. */
	hasEnoughData(alreadyReadLen: number): boolean {
		return this.readPos - alreadyReadLen < this.readLimit;
	}

	/** Bytes available from the read position, including it. */
	getAvail(): number {
		return this.writePos - this.readPos;
	}

	getPos(): number {
		return this.readPos;
	}

	/** Byte `backward` positions before the read position. */
	getByte(backward: number): number {
		return this.buf[this.readPos - backward];
	}

	/** Byte `backward` positions before `forward` bytes after the read position. */
	getByteAt(forward: number, backward: number): number {
		return this.buf[this.readPos + forward - backward];
	}

	/** Length of the match at distance `dist` starting `forward` bytes ahead. */
	getMatchLen(forward: number, dist: number, lenLimit: number): number {
		return getMatchLen(this.buf, this.readPos + forward, dist + 1, 0, lenLimit);
	}

	/**
	 * Advances the read position.
	 *
	 * @returns number of bytes available, or 0 if the position must be
	 *          processed later when more input has arrived
	 */
	protected movePos(requiredForFlushing: number, requiredForFinishing: number): number {
		++this.readPos;
		let avail = this.writePos - this.readPos;

		if (avail < requiredForFlushing) {
			if (avail < requiredForFinishing || !this.finishing) {
				++this.pendingSize;
				avail = 0;
			}
		}

		return avail;
	}

	private moveWindow(): void {
		// Keep the offset a multiple of 16 so that the low bits of positions,
		// which select probabilities, don't change.
		const moveOffset = (this.readPos + 1 - this.keepSizeBefore) & ~15;

		this.buf.copyWithin(0, moveOffset, this.writePos);
		this.readPos -= moveOffset;
		this.readLimit -= moveOffset;
		this.writePos -= moveOffset;
	}

	private processPendingBytes(): void {
		if (this.pendingSize > 0 && this.readPos < this.readLimit) {
			this.readPos -= this.pendingSize;
			const oldPendingSize = this.pendingSize;
			this.pendingSize = 0;
			this.skip(oldPendingSize);
		}
	}
}
