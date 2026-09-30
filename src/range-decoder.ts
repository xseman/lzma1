/** Number of bytes the range decoder reads on initialization. */
export const RANGE_DECODER_INIT_SIZE = 5;

/**
 * Range decoder reading from an in-memory byte array.
 *
 * `range` and `code` are unsigned 32-bit values stored in regular numbers,
 * so plain `<` comparisons are unsigned.
 *
 * The LZMA decoder loop (`LzmaDecoder.decode`) does the decoding steps
 * inline with the state in local variables, which is why the state fields
 * are public. `range-coder_test.ts` has the reference implementations.
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

	private readByte(): number {
		if (this.pos >= this.input.length) {
			throw new Error("Truncated input");
		}
		return this.input[this.pos++];
	}
}
