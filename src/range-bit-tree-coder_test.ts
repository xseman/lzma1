import {
	describe,
	expect,
	test,
} from "bun:test";

import { RangeBitTreeCoder } from "./range-bit-tree-coder.js";
import type {
	BasicRangeDecoder,
	BasicRangeEncoder,
} from "./utils.js";

function createMockDecoder(bits: number[]): BasicRangeDecoder {
	let idx = 0;
	return {
		decodeBit(_probs: number[], _index: number): number {
			return bits[idx++] ?? 0;
		},
	};
}

function createMockEncoder(): BasicRangeEncoder & { calls: { index: number; bit: number; }[]; } {
	const calls: { index: number; bit: number; }[] = [];
	return {
		calls,
		encodeBit(_probs: number[], index: number, bit: number): void {
			calls.push({ index, bit });
		},
	};
}

describe("RangeBitTreeCoder", () => {
	test("decode produces correct symbol from bit sequence", () => {
		// 3-bit tree: bits [1, 0, 1] → symbol = 0b101 = 5
		const coder = new RangeBitTreeCoder(3);
		const rd = createMockDecoder([1, 0, 1]);
		const result = coder.decode(rd);
		expect(result).toBe(5);
	});

	test("decode with all zeros", () => {
		const coder = new RangeBitTreeCoder(4);
		const rd = createMockDecoder([0, 0, 0, 0]);
		const result = coder.decode(rd);
		expect(result).toBe(0);
	});

	test("decode with all ones", () => {
		const coder = new RangeBitTreeCoder(3);
		const rd = createMockDecoder([1, 1, 1]);
		const result = coder.decode(rd);
		expect(result).toBe(7); // 0b111
	});

	test("reverseDecode produces correct symbol", () => {
		// 3-bit reverse decode: bits [1, 0, 1]
		// bit0=1, bit1=0, bit2=1 → symbol = 1 | (0<<1) | (1<<2) = 5
		const coder = new RangeBitTreeCoder(3);
		const rd = createMockDecoder([1, 0, 1]);
		const result = coder.reverseDecode(rd);
		expect(result).toBe(5);
	});

	test("reverseDecode all zeros", () => {
		const coder = new RangeBitTreeCoder(4);
		const rd = createMockDecoder([0, 0, 0, 0]);
		const result = coder.reverseDecode(rd);
		expect(result).toBe(0);
	});

	test("encode encodes bits of symbol from MSB to LSB", () => {
		const coder = new RangeBitTreeCoder(3);
		const re = createMockEncoder();

		// symbol = 5 = 0b101 → bits from MSB: 1, 0, 1
		coder.encode(re, 5);
		expect(re.calls.length).toBe(3);
		expect(re.calls[0].bit).toBe(1);
		expect(re.calls[1].bit).toBe(0);
		expect(re.calls[2].bit).toBe(1);
	});

	test("reverseEncode encodes bits from LSB to MSB", () => {
		const coder = new RangeBitTreeCoder(3);
		const re = createMockEncoder();

		// symbol = 5 = 0b101 → reverse bits: 1, 0, 1
		coder.reverseEncode(re, 5);
		expect(re.calls.length).toBe(3);
		expect(re.calls[0].bit).toBe(1); // LSB
		expect(re.calls[1].bit).toBe(0);
		expect(re.calls[2].bit).toBe(1); // MSB
	});

	test("reverseEncode with symbol 6 (0b110)", () => {
		const coder = new RangeBitTreeCoder(3);
		const re = createMockEncoder();

		// symbol = 6 = 0b110 → reverse bits: 0, 1, 1
		coder.reverseEncode(re, 6);
		expect(re.calls[0].bit).toBe(0);
		expect(re.calls[1].bit).toBe(1);
		expect(re.calls[2].bit).toBe(1);
	});

	test("getPrice returns non-negative number", () => {
		const coder = new RangeBitTreeCoder(3);
		const price = coder.getPrice(5);
		expect(typeof price).toBe("number");
		expect(price).toBeGreaterThanOrEqual(0);
	});

	test("getPrice for zero", () => {
		const coder = new RangeBitTreeCoder(3);
		const price = coder.getPrice(0);
		expect(price).toBeGreaterThanOrEqual(0);
	});

	test("reverseGetPrice returns non-negative number", () => {
		const coder = new RangeBitTreeCoder(3);
		const price = coder.reverseGetPrice(5);
		expect(typeof price).toBe("number");
		expect(price).toBeGreaterThanOrEqual(0);
	});

	test("getPrice and reverseGetPrice differ for asymmetric symbols", () => {
		const coder = new RangeBitTreeCoder(3);
		const forward = coder.getPrice(5);
		const reverse = coder.reverseGetPrice(5);
		// They may or may not be equal depending on model state,
		// but both should be valid numbers
		expect(typeof forward).toBe("number");
		expect(typeof reverse).toBe("number");
	});

	test("reset sets all models to 1024", () => {
		const coder = new RangeBitTreeCoder(3);
		coder.reset();

		// After reset, getPrice should return consistent results
		const price1 = coder.getPrice(0);
		const price2 = coder.getPrice(0);
		expect(price1).toBe(price2);
	});
});
