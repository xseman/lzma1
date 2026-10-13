/**
 * Range encoder writing to its own growable buffer.
 *
 * Ported from XZ for Java (0BSD), `src/org/tukaani/xz/rangecoder/RangeEncoder.java`
 * and `RangeEncoderToBuffer.java`, by Lasse Collin and Igor Pavlov.
 *
 * Integer adaptations (see the hazard checklist in `docs/verification.md`):
 * - `low` needs 33 bits (32 bits plus a carry), so it is a regular number;
 *   doubles represent integers up to 2^53 exactly. The carry test uses
 *   division instead of `low >>> 32`.
 * - `range` is an unsigned 32-bit value in a regular number: `<<` is
 *   followed by `>>> 0`, and `(range & TOP_MASK) == 0` becomes an
 *   unsigned `range < TOP_VALUE`.
 * - Bitwise ops on values that may exceed 2^31 are kept off the signed
 *   int32 path (`low`'s 24-bit wrap multiplies by 256 instead of
 *   shifting).
 */

import {
	BIT_MODEL_TOTAL,
	BIT_MODEL_TOTAL_BITS,
	MOVE_BITS,
	type Probs,
	TOP_VALUE,
} from "./range-coder.js";

const MOVE_REDUCING_BITS = 4;
const BIT_PRICE_SHIFT_BITS = 4;

/**
 * Price (approximate cost in 1/16 bits) of encoding a bit with a given
 * probability, indexed by `probability >>> MOVE_REDUCING_BITS`.
 */
const prices = createPriceTable();

function createPriceTable(): Uint32Array {
	const table = new Uint32Array(BIT_MODEL_TOTAL >>> MOVE_REDUCING_BITS);

	for (let i = (1 << MOVE_REDUCING_BITS) / 2; i < BIT_MODEL_TOTAL; i += 1 << MOVE_REDUCING_BITS) {
		let w = i;
		let bitCount = 0;

		for (let j = 0; j < BIT_PRICE_SHIFT_BITS; ++j) {
			w *= w;
			bitCount <<= 1;

			while ((w & 0xFFFF0000) !== 0) {
				w >>>= 1;
				++bitCount;
			}
		}

		table[i >> MOVE_REDUCING_BITS] = (BIT_MODEL_TOTAL_BITS << BIT_PRICE_SHIFT_BITS) - 15 - bitCount;
	}

	return table;
}

export function getBitPrice(prob: number, bit: number): number {
	// NOTE: Unlike in encodeBit(), here bit must be 0 or 1.
	return prices[(prob ^ (-bit & (BIT_MODEL_TOTAL - 1))) >>> MOVE_REDUCING_BITS];
}

export function getBitTreePrice(probs: Probs, offset: number, bits: number, symbol: number): number {
	let price = 0;
	symbol |= 1 << bits;

	do {
		const bit = symbol & 1;
		symbol >>>= 1;
		price += getBitPrice(probs[offset + symbol], bit);
	} while (symbol !== 1);

	return price;
}

export function getReverseBitTreePrice(probs: Probs, offset: number, bits: number, symbol: number): number {
	let price = 0;
	let index = 1;
	symbol |= 1 << bits;

	do {
		const bit = symbol & 1;
		symbol >>>= 1;
		price += getBitPrice(probs[offset + index], bit);
		index = (index << 1) | bit;
	} while (symbol !== 1);

	return price;
}

export function getDirectBitsPrice(count: number): number {
	return count << BIT_PRICE_SHIFT_BITS;
}

export class RangeEncoder {
	private low = 0;
	private range = 0xFFFFFFFF;
	private cache = 0;
	/**
	 * NOTE: int is OK for LZMA2 because a compressed chunk is not more
	 * than 64 KiB, but with LZMA1 there is no chunking so in theory
	 * cacheSize can grow very big. A JS number counts well past 2^32.
	 */
	private cacheSize = 1;

	// Instead of the fixed output array of RangeEncoderToBuffer, the
	// buffer grows on demand and the written bytes are handed out with
	// take()/finish(), because the compressed size isn't known in advance
	// here (contract adaptation).
	private buf: Uint8Array;
	private size = 0;

	constructor(initialCapacity: number) {
		this.buf = new Uint8Array(Math.max(64, initialCapacity));
	}

	reset(): void {
		this.low = 0;
		this.range = 0xFFFFFFFF;
		this.cache = 0x00;
		this.cacheSize = 1;
	}

	/** Appends bytes that are not range coded, e.g. a header. */
	writeBytes(bytes: Uint8Array): void {
		this.ensureCapacity(bytes.length);
		this.buf.set(bytes, this.size);
		this.size += bytes.length;
	}

	/** Returns a copy of the output written so far and empties the buffer. */
	take(): Uint8Array {
		const bytes = this.buf.slice(0, this.size);
		this.size = 0;
		return bytes;
	}

	/** Flushes all pending bytes and returns the rest of the output. */
	finish(): Uint8Array {
		for (let i = 0; i < 5; ++i) {
			this.shiftLow();
		}

		return this.size === this.buf.length ? this.buf : this.buf.slice(0, this.size);
	}

	private writeByte(b: number): void {
		this.ensureCapacity(1);
		this.buf[this.size++] = b;
	}

	private shiftLow(): void {
		// (int)(low >>> 32), the pending carry: 0 or 1.
		const lowHi = Math.floor(this.low / 0x100000000);

		if (lowHi !== 0 || this.low < 0xFF000000) {
			let temp = this.cache;

			do {
				this.writeByte(temp + lowHi);
				temp = 0xFF;
			} while (--this.cacheSize !== 0);

			this.cache = (this.low >>> 24) & 0xFF;
		}

		++this.cacheSize;
		// (low & 0x00FFFFFF) << 8, kept exact above 2^31 with * 256.
		this.low = (this.low & 0x00FFFFFF) * 256;
	}

	encodeBit(probs: Probs, index: number, bit: number): void {
		const prob = probs[index];
		const bound = (this.range >>> BIT_MODEL_TOTAL_BITS) * prob;

		// NOTE: Any non-zero value for bit is taken as 1.
		if (bit === 0) {
			this.range = bound;
			probs[index] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
		} else {
			this.low += bound;
			this.range -= bound;
			probs[index] = prob - (prob >>> MOVE_BITS);
		}

		if (this.range < TOP_VALUE) {
			this.range = (this.range << 8) >>> 0;
			this.shiftLow();
		}
	}

	encodeBitTree(probs: Probs, offset: number, bits: number, symbol: number): void {
		let index = 1;
		let mask = 1 << bits;

		do {
			mask >>>= 1;
			const bit = symbol & mask;
			this.encodeBit(probs, offset + index, bit);

			index <<= 1;
			if (bit !== 0) {
				index |= 1;
			}
		} while (mask !== 1);
	}

	encodeReverseBitTree(probs: Probs, offset: number, bits: number, symbol: number): void {
		let index = 1;
		symbol |= 1 << bits;

		do {
			const bit = symbol & 1;
			symbol >>>= 1;
			this.encodeBit(probs, offset + index, bit);
			index = (index << 1) | bit;
		} while (symbol !== 1);
	}

	encodeDirectBits(value: number, count: number): void {
		do {
			this.range >>>= 1;
			this.low += this.range & (0 - ((value >>> --count) & 1));

			if (this.range < TOP_VALUE) {
				this.range = (this.range << 8) >>> 0;
				this.shiftLow();
			}
		} while (count !== 0);
	}

	private ensureCapacity(extra: number): void {
		if (this.size + extra > this.buf.length) {
			const grown = new Uint8Array(Math.max(this.size + extra, this.buf.length * 2));
			grown.set(this.buf.subarray(0, this.size));
			this.buf = grown;
		}
	}
}
