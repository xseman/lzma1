import type { BaseStream } from "./streams.js";

export class RangeDecoder {
	public stream: BaseStream | null = null;
	public code: number = 0;
	public rrange: number = 0;

	/**
	 * Set input stream for decoding
	 */
	setStream(stream: BaseStream | null): void {
		this.stream = stream;
	}

	/**
	 * Initialize range decoder
	 */
	init(): void {
		this.code = 0;
		this.rrange = -1;

		for (let i = 0; i < 5; ++i) {
			this.code = this.code << 8 | this.readFromStream();
		}
	}

	/**
	 * Decode a single bit using probability model
	 */
	decodeBit(probs: number[], index: number): 0 | 1 {
		let newBound, prob = probs[index];
		newBound = (this.rrange >>> 11) * prob;

		if ((this.code ^ -0x80000000) < (newBound ^ -0x80000000)) {
			this.rrange = newBound;
			probs[index] = prob + (2048 - prob >>> 5) << 16 >> 16;
			if (!(this.rrange & -0x1000000)) {
				this.code = this.code << 8 | this.readFromStream();
				this.rrange <<= 8;
			}
			return 0;
		} else {
			this.rrange -= newBound;
			this.code -= newBound;
			probs[index] = prob - (prob >>> 5) << 16 >> 16;
			if (!(this.rrange & -0x1000000)) {
				this.code = this.code << 8 | this.readFromStream();
				this.rrange <<= 8;
			}
			return 1;
		}
	}

	/**
	 * Decode direct bits (without probability model)
	 */
	decodeDirectBits(numTotalBits: number): number {
		let result = 0;

		for (let i = numTotalBits; i != 0; i -= 1) {
			this.rrange >>>= 1;
			let t = (this.code - this.rrange) >>> 31;
			this.code -= this.rrange & (t - 1);
			result = result << 1 | 1 - t;

			if (!(this.rrange & -0x1000000)) {
				this.code = this.code << 8 | this.readFromStream();
				this.rrange <<= 8;
			}
		}

		return result;
	}

	/**
	 * Get current code value (for compatibility)
	 */
	get currentCode(): number {
		return this.code;
	}

	/**
	 * Get current range value (for compatibility)
	 */
	get currentRange(): number {
		return this.rrange;
	}

	/**
	 * Read a single byte from the input stream
	 */
	private readFromStream(): number {
		if (!this.stream) {
			return 0;
		}

		if (this.stream.pos >= this.stream.count) {
			return -1;
		}

		let value: number;
		if (this.stream.buf instanceof ArrayBuffer) {
			value = new Uint8Array(this.stream.buf)[this.stream.pos++];
		} else if (this.stream.buf instanceof Uint8Array) {
			value = this.stream.buf[this.stream.pos++];
		} else {
			value = (this.stream.buf as any)[this.stream.pos++];
		}

		return value & 0xFF;
	}
}
