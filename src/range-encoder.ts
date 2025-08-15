import type { BufferWithCount } from "./streams.js";
import {
	add64,
	fromInt64,
	lowBits64,
} from "./utils.js";

export class RangeEncoder {
	private stream: BufferWithCount | null = null;
	private low: [number, number] = [0, 0];
	private rrange: number = 0;
	private cache: number = 0;
	private cacheSize: number = 0;
	private position: [number, number] = [0, 0];

	constructor() {
		// Initialize with default values
	}

	/**
	 * Set output stream for encoding
	 */
	setStream(stream: BufferWithCount | null): void {
		this.stream = stream;
	}

	/**
	 * Initialize range encoder
	 */
	init(): void {
		this.position = [0, 0];
		this.low = [0, 0];
		this.rrange = -1;
		this.cacheSize = 1;
		this.cache = 0;
	}

	/**
	 * Encode a single bit using probability model
	 */
	encodeBit(probs: number[], index: number, bit: number): void {
		const prob = probs[index];
		const newBound = (this.rrange >>> 11) * prob;

		if (bit === 0) {
			this.rrange = newBound;
			probs[index] = prob + ((2048 - prob) >>> 5) << 16 >> 16;
		} else {
			this.low = add64(this.low, fromInt64(newBound));
			this.rrange -= newBound;
			probs[index] = prob - (prob >>> 5) << 16 >> 16;
		}

		if (!(this.rrange & -0x1000000)) {
			this.rrange <<= 8;
			this.shiftLow();
		}
	}

	/**
	 * Encode direct bits (without probability model)
	 */
	encodeDirectBits(value: number, numTotalBits: number): void {
		for (let i = numTotalBits - 1; i >= 0; i--) {
			this.rrange >>>= 1;
			if (((value >>> i) & 1) === 1) {
				this.low = add64(this.low, fromInt64(this.rrange));
			}
			if (!(this.rrange & -0x1000000)) {
				this.rrange <<= 8;
				this.shiftLow();
			}
		}
	}

	/**
	 * Encode bit tree symbol
	 */
	encodeBitTree(numBitLevels: number, models: number[], symbol: number, startIndex: number = 1): void {
		let m = 1;
		for (let bitIndex = numBitLevels; bitIndex !== 0; bitIndex--) {
			const bit = (symbol >>> (bitIndex - 1)) & 1;
			this.encodeBit(models, startIndex + m - 1, bit);
			m = (m << 1) | bit;
		}
	}

	/**
	 * Reverse encode bits
	 */
	reverseEncodeBits(numBitLevels: number, models: number[], symbol: number, startIndex: number): void {
		let m = 1;
		for (let i = 0; i < numBitLevels; i++) {
			const bit = symbol & 1;
			this.encodeBit(models, startIndex + m, bit);
			m = (m << 1) | bit;
			symbol >>>= 1;
		}
	}

	/**
	 * Finish encoding and flush remaining data
	 */
	finish(): void {
		for (let i = 0; i < 5; i++) {
			this.shiftLow();
		}
	}

	/**
	 * Shift low value and write to stream
	 */
	private shiftLow(): void {
		const lowHi = lowBits64([this.low[1], 0]);

		if (lowHi !== 0 || this.low[0] < 0xFF000000) {
			this.position = add64(this.position, fromInt64(this.cacheSize));

			let temp = this.cache;
			do {
				this.writeToStream(temp + lowHi);
				temp = 255;
			} while (--this.cacheSize !== 0);

			this.cache = (this.low[0] >>> 24) & 0xFF;
		}

		this.cacheSize++;
		this.low = [(this.low[0] & 0xFFFFFF) << 8, this.low[1]];
	}

	/**
	 * Write byte to output stream
	 */
	private writeToStream(value: number): void {
		if (!this.stream) {
			return;
		}

		// Ensure buffer has enough capacity
		if (this.stream.count >= this.stream.buf.length) {
			const newSize = Math.max(this.stream.buf.length * 2, this.stream.count + 1);
			const newBuf = new Array(newSize);
			for (let i = 0; i < this.stream.count; i++) {
				newBuf[i] = this.stream.buf[i];
			}
			this.stream.buf = newBuf;
		}

		this.stream.buf[this.stream.count++] = value & 0xFF;
	}
}
