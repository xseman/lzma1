import {
	BIT_MODEL_TOTAL,
	BIT_MODEL_TOTAL_BITS,
	MOVE_BITS,
	type Probs,
	TOP_VALUE,
} from "./range-coder.js";

/** Number of bytes the range decoder reads on initialization. */
export const RANGE_DECODER_INIT_SIZE = 5;

/**
 * Range decoder reading from an in-memory byte array.
 *
 * `range` and `code` are unsigned 32-bit values stored in regular numbers,
 * so plain `<` comparisons are unsigned.
 *
 * The decoding methods here are the reference for the decoding steps. The
 * LZMA decoder loop (`LzmaDecoder.decode`) repeats them inline with the
 * state in local variables, which is why the state fields are public.
 */
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

	/**
	 * Decodes one bit with the adaptive probability `probs[index]`:
	 * 1. Split the range in proportion to the probability of a 0.
	 * 2. The part `code` falls into is the bit; keep that part of the range.
	 * 3. Move the probability towards the decoded bit.
	 * 4. When the range gets too small, shift in the next input byte.
	 */
	decodeBit(probs: Probs, index: number): number {
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

		if (this.range < TOP_VALUE) {
			this.range = (this.range << 8) >>> 0;
			this.code = ((this.code << 8) | this.readByte()) >>> 0;
		}

		return bit;
	}

	/** Decodes a `bits`-bit symbol coded MSB-first with the bit tree at `offset`. */
	decodeBitTree(probs: Probs, offset: number, bits: number): number {
		const end = 1 << bits;
		let symbol = 1;

		do {
			symbol = (symbol << 1) | this.decodeBit(probs, offset + symbol);
		} while (symbol < end);

		return symbol - end;
	}

	/** Decodes a `bits`-bit symbol coded LSB-first with the bit tree at `offset`. */
	decodeReverseBitTree(probs: Probs, offset: number, bits: number): number {
		let symbol = 1;
		let result = 0;

		for (let i = 0; i < bits; ++i) {
			const bit = this.decodeBit(probs, offset + symbol);
			symbol = (symbol << 1) | bit;
			result |= bit << i;
		}

		return result;
	}

	/** Decodes `count` bits coded with a fixed 50% probability. */
	decodeDirectBits(count: number): number {
		let result = 0;

		do {
			this.range >>>= 1;
			let bit = 0;

			if (this.code >= this.range) {
				this.code -= this.range;
				bit = 1;
			}

			result = ((result << 1) | bit) >>> 0;

			if (this.range < TOP_VALUE) {
				this.range = (this.range << 8) >>> 0;
				this.code = ((this.code << 8) | this.readByte()) >>> 0;
			}
		} while (--count !== 0);

		return result;
	}

	private readByte(): number {
		if (this.pos >= this.input.length) {
			throw new Error("Truncated input");
		}
		return this.input[this.pos++];
	}
}
