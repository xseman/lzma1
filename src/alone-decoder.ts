/**
 * Decoder for the `.lzma` format: header followed by raw LZMA data.
 *
 * Input may arrive in chunks. Decoding pauses whenever fewer than
 * `INPUT_MARGIN` bytes are left, so a symbol never runs out of input halfway.
 */

import {
	decodeHeader,
	HEADER_SIZE,
	type LzmaHeader,
	UNKNOWN_SIZE,
} from "./header.js";
import { LzDecoder } from "./lz-decoder.js";
import { probsSize } from "./lzma-coder.js";
import { LzmaDecoder } from "./lzma-decoder.js";
import {
	RANGE_DECODER_INIT_SIZE,
	RangeDecoder,
} from "./range-decoder.js";

/**
 * Upper bound of input bytes a single symbol can consume. The range decoder
 * reads at most one byte per bit, and the longest symbol (a match with the
 * largest distance) is 48 bits.
 */
const INPUT_MARGIN = 64;

const DICT_SIZE_MIN = 1 << 12;

/**
 * Probability arrays of finished one-shot decoders, reused by the next ones
 * with the same size. Allocating and zeroing a new one is a large part of
 * decompressing a small input. Only arrays up to 128 KiB (lc + lp <= 6) are kept.
 */
const SPARE_PROBS_MAX_SIZE = 1 << 16;
const spareProbs = new Map<number, Uint16Array>();

export class AloneDecoder {
	private readonly sink: (chunk: Uint8Array) => void;
	private readonly rc = new RangeDecoder();
	private header: LzmaHeader | null = null;
	private lzma: LzmaDecoder | null = null;
	private lz: LzDecoder | null = null;
	/** Unconsumed input carried over to the next `write()`. */
	private pending: Uint8Array = new Uint8Array(0);
	private rcStarted = false;
	private done = false;
	private readonly preallocateLimit: number;
	private readonly reuse: boolean;

	/**
	 * True when the whole output fits into the dictionary buffer, which is
	 * then allocated at once: the chunks passed to the sink are consecutive
	 * views of one buffer that is never overwritten. Known after the header.
	 */
	contiguousOutput = false;

	/**
	 * @param sink Receives decompressed data. The chunk is only valid during
	 *        the call, unless `contiguousOutput` is set.
	 * @param preallocateLimit Largest declared size for which the output
	 *        buffer is allocated at once
	 * @param reuse Reuse probability arrays of earlier decoders. Only for
	 *        synchronous one-shot decompression.
	 */
	constructor(sink: (chunk: Uint8Array) => void, preallocateLimit = 0, reuse = false) {
		this.sink = sink;
		this.preallocateLimit = preallocateLimit;
		this.reuse = reuse;
	}

	/** Uncompressed size from the header, once it has been read. */
	get uncompressedSize(): number | undefined {
		return this.header?.uncompressedSize;
	}

	/** Decodes as much of `chunk` as possible. */
	write(chunk: Uint8Array): void {
		if (this.done) return;
		this.decode(concat(this.pending, chunk), false);
	}

	/** Decodes the remaining input. Throws if the stream is incomplete. */
	end(): void {
		if (this.done) return;
		this.decode(this.pending, true);

		if (!this.done) {
			throw new Error("Truncated input");
		}
	}

	private decode(input: Uint8Array, isLast: boolean): void {
		let pos = 0;

		if (this.header === null) {
			if (input.length < HEADER_SIZE) {
				this.pending = input.slice();
				return;
			}

			this.start(decodeHeader(input));
			pos = HEADER_SIZE;

			if (this.header!.uncompressedSize === 0) {
				this.done = true;
				return;
			}
		}

		const lzma = this.lzma!;
		const lz = this.lz!;
		const rc = this.rc;

		if (!this.rcStarted) {
			if (input.length - pos < RANGE_DECODER_INIT_SIZE) {
				if (isLast) throw new Error("Truncated input");
				this.pending = input.slice(pos);
				return;
			}
			rc.init(input, pos);
			this.rcStarted = true;
		} else {
			rc.setInput(input, pos);
		}

		const size = this.header!.uncompressedSize;
		const outLimit = size === UNKNOWN_SIZE ? Infinity : size;
		const inLimit = isLast ? Infinity : input.length - INPUT_MARGIN;

		const endMarker = lzma.decode(outLimit, inLimit);
		lz.flush();

		if (endMarker) {
			// An end marker before the declared size is accepted, as in
			// earlier versions: some producers write a size that is too large.
			if (!rc.isFinished()) {
				throw new Error("Corrupted input: invalid end marker");
			}
			this.done = true;
		} else if (lzma.outPos === size) {
			this.done = true;
		}

		if (this.done) {
			this.pending = new Uint8Array(0);
			this.release();
		} else {
			this.pending = input.slice(rc.pos);
		}
	}

	/** Returns the probability array for reuse by a later decoder. */
	private release(): void {
		const probs = this.lzma?.probs;
		if (this.reuse && probs !== undefined && probs.length <= SPARE_PROBS_MAX_SIZE) {
			spareProbs.set(probs.length, probs);
		}
	}

	private start(header: LzmaHeader): void {
		this.header = header;

		let dictSize = Math.max(header.dictSize, DICT_SIZE_MIN);
		if (header.uncompressedSize !== UNKNOWN_SIZE) {
			// Matches can't reach further back than the start of the output.
			dictSize = Math.max(Math.min(dictSize, header.uncompressedSize), 1);
		}

		const size = header.uncompressedSize;
		this.contiguousOutput = size !== UNKNOWN_SIZE && size > 0 && dictSize === size && size <= this.preallocateLimit;

		this.lz = new LzDecoder(dictSize, this.sink, this.contiguousOutput);
		let probs: Uint16Array | undefined;
		if (this.reuse) {
			const size = probsSize(header.lc, header.lp);
			probs = spareProbs.get(size);
			spareProbs.delete(size);
		}

		this.lzma = new LzmaDecoder(this.lz, this.rc, header.lc, header.lp, header.pb, probs);
	}
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
	if (a.length === 0) return b;
	if (b.length === 0) return a;

	const result = new Uint8Array(a.length + b.length);
	result.set(a);
	result.set(b, a.length);
	return result;
}
