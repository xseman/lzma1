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
const PRICES = createPriceTable();

function createPriceTable(): Uint32Array {
	const prices = new Uint32Array(BIT_MODEL_TOTAL >>> MOVE_REDUCING_BITS);

	for (let i = (1 << MOVE_REDUCING_BITS) / 2; i < BIT_MODEL_TOTAL; i += 1 << MOVE_REDUCING_BITS) {
		// Approximate -log2(i / BIT_MODEL_TOTAL) using repeated squaring.
		let w = i;
		let bitCount = 0;

		for (let j = 0; j < BIT_PRICE_SHIFT_BITS; ++j) {
			w *= w;
			bitCount <<= 1;

			while (w >= 0x10000) {
				w >>>= 1;
				++bitCount;
			}
		}

		prices[i >> MOVE_REDUCING_BITS] = (BIT_MODEL_TOTAL_BITS << BIT_PRICE_SHIFT_BITS) - 15 - bitCount;
	}

	return prices;
}

export function getBitPrice(prob: number, bit: number): number {
	return PRICES[(prob ^ (-bit & (BIT_MODEL_TOTAL - 1))) >>> MOVE_REDUCING_BITS];
}

/** Price of a `bits`-bit symbol coded MSB-first with the bit tree at `offset`. */
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

/** Price of a `bits`-bit symbol coded LSB-first with the bit tree at `offset`. */
export function getReverseBitTreePrice(probs: Probs, offset: number, bits: number, symbol: number): number {
	let price = 0;
	let index = 1;

	for (let i = 0; i < bits; ++i) {
		const bit = symbol & 1;
		symbol >>>= 1;
		price += getBitPrice(probs[offset + index], bit);
		index = (index << 1) | bit;
	}

	return price;
}

/** Price of bits coded with a fixed 50% probability. */
export function getDirectBitsPrice(count: number): number {
	return count << BIT_PRICE_SHIFT_BITS;
}

/**
 * Range encoder writing to its own growable buffer.
 *
 * `low` needs 33 bits (32 bits plus a carry), so it is kept as a regular
 * number instead of an int32. Doubles represent integers up to 2^53 exactly.
 *
 * Performance: like `RangeDecoder`, the methods that encode several bits
 * keep `range` and `low` in local variables for the whole symbol.
 */
export class RangeEncoder {
	private low = 0;
	private range = 0xFFFFFFFF;
	private cache = 0;
	private cacheSize = 1;
	private buf: Uint8Array;
	private size = 0;

	constructor(initialCapacity: number) {
		this.buf = new Uint8Array(Math.max(64, initialCapacity));
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
		let low = this.low;
		for (let i = 0; i < 5; ++i) {
			low = this.shiftLow(low);
		}
		this.low = low;

		return this.size === this.buf.length ? this.buf : this.buf.slice(0, this.size);
	}

	encodeBit(probs: Probs, index: number, bit: number): void {
		const prob = probs[index];
		const bound = (this.range >>> BIT_MODEL_TOTAL_BITS) * prob;

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
			this.low = this.shiftLow(this.low);
		}
	}

	/** Encodes a `bits`-bit symbol MSB-first with the bit tree at `offset`. */
	encodeBitTree(probs: Probs, offset: number, bits: number, symbol: number): void {
		let range = this.range;
		let low = this.low;
		let index = 1;

		for (let i = bits - 1; i >= 0; --i) {
			const bit = (symbol >>> i) & 1;
			const prob = probs[offset + index];
			const bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;

			if (bit === 0) {
				range = bound;
				probs[offset + index] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
			} else {
				low += bound;
				range -= bound;
				probs[offset + index] = prob - (prob >>> MOVE_BITS);
			}

			if (range < TOP_VALUE) {
				range = (range << 8) >>> 0;
				low = this.shiftLow(low);
			}

			index = (index << 1) | bit;
		}

		this.range = range;
		this.low = low;
	}

	/** Encodes a `bits`-bit symbol LSB-first with the bit tree at `offset`. */
	encodeReverseBitTree(probs: Probs, offset: number, bits: number, symbol: number): void {
		let range = this.range;
		let low = this.low;
		let index = 1;

		for (let i = 0; i < bits; ++i) {
			const bit = symbol & 1;
			symbol >>>= 1;
			const prob = probs[offset + index];
			const bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;

			if (bit === 0) {
				range = bound;
				probs[offset + index] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
			} else {
				low += bound;
				range -= bound;
				probs[offset + index] = prob - (prob >>> MOVE_BITS);
			}

			if (range < TOP_VALUE) {
				range = (range << 8) >>> 0;
				low = this.shiftLow(low);
			}

			index = (index << 1) | bit;
		}

		this.range = range;
		this.low = low;
	}

	/** Encodes a literal byte with the 0x100-leaf bit tree at `offset`. */
	encodeLiteral(probs: Probs, offset: number, symbol: number): void {
		this.encodeBitTree(probs, offset, 8, symbol);
	}

	/**
	 * Encodes a literal after a match. The bits of `matchByte` (the byte at
	 * rep0) select separate probabilities until the first bit that differs.
	 */
	encodeMatchedLiteral(probs: Probs, offset: number, symbol: number, matchByte: number): void {
		let range = this.range;
		let low = this.low;
		let matchOffset = 0x100;
		symbol |= 0x100;

		do {
			matchByte <<= 1;
			const matchBit = matchByte & matchOffset;
			const index = offset + matchOffset + matchBit + (symbol >>> 8);
			const bit = (symbol >>> 7) & 1;
			const prob = probs[index];
			const bound = (range >>> BIT_MODEL_TOTAL_BITS) * prob;

			if (bit === 0) {
				range = bound;
				probs[index] = prob + ((BIT_MODEL_TOTAL - prob) >>> MOVE_BITS);
			} else {
				low += bound;
				range -= bound;
				probs[index] = prob - (prob >>> MOVE_BITS);
			}

			if (range < TOP_VALUE) {
				range = (range << 8) >>> 0;
				low = this.shiftLow(low);
			}

			symbol <<= 1;
			matchOffset &= ~(matchByte ^ symbol);
		} while (symbol < 0x10000);

		this.range = range;
		this.low = low;
	}

	/** Encodes the `count` low bits of `value` with a fixed 50% probability. */
	encodeDirectBits(value: number, count: number): void {
		let range = this.range;
		let low = this.low;

		do {
			range >>>= 1;

			if (((value >>> --count) & 1) !== 0) {
				low += range;
			}

			if (range < TOP_VALUE) {
				range = (range << 8) >>> 0;
				low = this.shiftLow(low);
			}
		} while (count !== 0);

		this.range = range;
		this.low = low;
	}

	/**
	 * Moves the top byte of `low` to the output and returns the new `low`.
	 * A run of 0xFF bytes is held back (`cache` + `cacheSize`) until it is
	 * known whether a carry will propagate into it.
	 */
	private shiftLow(low: number): number {
		if (low < 0xFF000000 || low >= 0x100000000) {
			const carry = low >= 0x100000000 ? 1 : 0;
			this.ensureCapacity(this.cacheSize);

			const buf = this.buf;
			let size = this.size;
			buf[size++] = (this.cache + carry) & 0xFF;
			for (let i = 1; i < this.cacheSize; ++i) {
				buf[size++] = (0xFF + carry) & 0xFF;
			}

			this.size = size;
			this.cacheSize = 0;
			this.cache = (low >>> 24) & 0xFF;
		}

		++this.cacheSize;
		return (low & 0x00FFFFFF) * 256;
	}

	private ensureCapacity(extra: number): void {
		if (this.size + extra > this.buf.length) {
			const grown = new Uint8Array(Math.max(this.size + extra, this.buf.length * 2));
			grown.set(this.buf.subarray(0, this.size));
			this.buf = grown;
		}
	}
}
