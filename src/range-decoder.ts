/**
 * Range decoder reading from an in-memory byte array.
 *
 * Ported from XZ for Java (0BSD), `src/org/tukaani/xz/rangecoder/RangeDecoder.java`
 * and `RangeDecoderFromStream.java`, by Lasse Collin and Igor Pavlov.
 *
 * Integer adaptations: `range` and `code` are unsigned 32-bit values in
 * regular numbers (`<<` followed by `>>> 0`), so `Integer.compareUnsigned`
 * becomes a plain `<`, and `(range & TOP_MASK) == 0` becomes `range <
 * TOP_VALUE`. In `decodeDirectBits`, `(code - range) >>> 31` wraps to the
 * same 32-bit pattern as Java's int subtraction.
 *
 * Contract adaptations: instead of an input stream, the input arrives in
 * chunks (`setInput`) and running out of it throws, so a truncated stream
 * is detected like the Java code's read past the end of the stream.
 */

import {
	BIT_MODEL_TOTAL,
	BIT_MODEL_TOTAL_BITS,
	MOVE_BITS,
	type Probs,
	TOP_VALUE,
} from "./range-coder.js";

/** Number of bytes the range decoder reads on initialization. */
export const RANGE_DECODER_INIT_SIZE = 5;

export class RangeDecoder {
	range = 0;
	code = 0;
	input: Uint8Array = new Uint8Array(0);
	/** Position of the next unread input byte. */
	pos = 0;

	/** Reads the initial bytes from `input` starting at `pos`. */
	init(input: Uint8Array, pos: number): void {
		this.setInput(input, pos);

		if (this.readByte() !== 0x00) {
			throw new Error("Corrupted input: invalid range coder header");
		}

		this.range = 0xFFFFFFFF;
		this.code = 0;
		for (let i = 1; i < RANGE_DECODER_INIT_SIZE; ++i) {
			this.code = ((this.code << 8) | this.readByte()) >>> 0;
		}

		if (this.code === this.range) {
			throw new Error("Corrupted input: invalid range coder header");
		}
	}

	/** Continues decoding from a different buffer (used when streaming). */
	setInput(input: Uint8Array, pos: number): void {
		this.input = input;
		this.pos = pos;
	}

	/** True when the encoder's flush bytes have been consumed exactly. */
	isFinished(): boolean {
		return this.code === 0;
	}

	private readByte(): number {
		if (this.pos >= this.input.length) {
			throw new Error("Truncated input");
		}
		return this.input[this.pos++];
	}

	normalize(): void {
		if (this.range < TOP_VALUE) {
			this.code = ((this.code << 8) | this.readByte()) >>> 0;
			this.range = (this.range << 8) >>> 0;
		}
	}

	decodeBit(probs: Probs, index: number): number {
		this.normalize();

		const prob = probs[index];
		const bound = (this.range >>> BIT_MODEL_TOTAL_BITS) * prob;
		let bit: number;

		if (this.code < bound) {
			this.range = bound;
			probs[index] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
			bit = 0;
		} else {
			this.range -= bound;
			this.code -= bound;
			probs[index] = prob - (prob >>> MOVE_BITS);
			bit = 1;
		}

		return bit;
	}

	decodeBitTree(probs: Probs, offset: number, bits: number): number {
		let symbol = 1;

		do {
			symbol = (symbol << 1) | this.decodeBit(probs, offset + symbol);
		} while (symbol < 1 << bits);

		return symbol - (1 << bits);
	}

	decodeReverseBitTree(probs: Probs, offset: number, bits: number): number {
		let symbol = 1;
		let i = 0;
		let result = 0;

		do {
			const bit = this.decodeBit(probs, offset + symbol);
			symbol = (symbol << 1) | bit;
			result |= bit << i++;
		} while (symbol < 1 << bits);

		return result;
	}

	decodeDirectBits(count: number): number {
		let result = 0;

		do {
			this.normalize();

			this.range >>>= 1;
			// 1 when code < range as 32-bit values (the subtraction wraps
			// to the same bit pattern as Java's int arithmetic).
			const t = (this.code - this.range) >>> 31;
			this.code = (this.code - (this.range & (t - 1))) >>> 0;
			result = (result << 1) | (1 - t);
		} while (--count !== 0);

		return result;
	}
}
