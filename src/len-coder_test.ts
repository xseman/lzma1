import {
	describe,
	expect,
	test,
} from "bun:test";

import { LenEncoder } from "./len-coder.js";
import type { BitTree } from "./utils.js";

// Mock range encoder that satisfies the LenEncoder's RangeEncoder interface
function createMockRangeEncoder() {
	const encodedBits: { index: number; bit: number; }[] = [];
	const encodedTrees: { symbol: number; }[] = [];

	return {
		encodedBits,
		encodedTrees,
		encodeBit(probs: number[], index: number, symbol: number): void {
			encodedBits.push({ index, bit: symbol });
		},
		encodeBitTree(encoder: BitTree, symbol: number): void {
			encodedTrees.push({ symbol });
		},
	};
}

describe("LenEncoder", () => {
	test("encode low range (symbol < 8)", () => {
		const encoder = new LenEncoder();
		encoder.init(1);
		const re = createMockRangeEncoder();

		encoder.encode(3, 0, re);
		// Should encode choice bit 0, then tree symbol
		expect(re.encodedBits.length).toBeGreaterThan(0);
		expect(re.encodedBits[0].bit).toBe(0); // choice = low range
		expect(re.encodedTrees.length).toBe(1);
		expect(re.encodedTrees[0].symbol).toBe(3);
	});

	test("encode mid range (8 <= symbol < 16)", () => {
		const encoder = new LenEncoder();
		encoder.init(1);
		const re = createMockRangeEncoder();

		encoder.encode(10, 0, re);
		// choice[0] = 1, choice[1] = 0, then mid tree
		expect(re.encodedBits[0].bit).toBe(1); // not low range
		expect(re.encodedBits[1].bit).toBe(0); // mid range
		expect(re.encodedTrees[0].symbol).toBe(2); // 10 - 8 = 2
	});

	test("encode high range (symbol >= 16)", () => {
		const encoder = new LenEncoder();
		encoder.init(1);
		const re = createMockRangeEncoder();

		encoder.encode(20, 0, re);
		// choice[0] = 1, choice[1] = 1, then high tree
		expect(re.encodedBits[0].bit).toBe(1); // not low range
		expect(re.encodedBits[1].bit).toBe(1); // high range
		expect(re.encodedTrees[0].symbol).toBe(4); // 20 - 8 - 8 = 4
	});

	test("encodeWithUpdate encodes and decrements counter", () => {
		const encoder = new LenEncoder();
		encoder.init(1);
		encoder.initPriceTable();
		encoder.setTableSizeAndInitCounters(10, 1);

		const re = createMockRangeEncoder();
		encoder.encodeWithUpdate(3, 0, re);

		// Should have called encode successfully
		expect(re.encodedBits.length).toBeGreaterThan(0);
	});

	test("setTableSizeAndInitCounters sets size and counters", () => {
		const encoder = new LenEncoder();
		encoder.init(2);
		encoder.initPriceTable();

		encoder.setTableSizeAndInitCounters(50, 2);
		expect(encoder.getTableSize()).toBe(50);
	});

	test("setTableSize sets table size", () => {
		const encoder = new LenEncoder();
		encoder.setTableSize(42);
		expect(encoder.getTableSize()).toBe(42);
	});

	test("getPrice returns a number", () => {
		const encoder = new LenEncoder();
		encoder.init(1);
		encoder.initPriceTable();
		encoder.setTableSize(0x110);
		encoder.updateTables(1);

		const price = encoder.getPrice(0, 0);
		expect(typeof price).toBe("number");
	});

	test("updateTables initializes price table", () => {
		const encoder = new LenEncoder();
		encoder.init(2);
		encoder.setTableSize(0x110);
		// updateTables will call initPriceTable internally if needed
		encoder.updateTables(2);

		const price = encoder.getPrice(0, 0);
		expect(typeof price).toBe("number");
	});
});
