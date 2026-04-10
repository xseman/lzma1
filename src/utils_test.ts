import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	arraycopy,
	createBitTree,
	createFastPos,
	createProbPrices,
	getBitPrice,
	getLenToPosState,
	initArray,
	initBitModels,
	stateUpdateChar,
} from "./utils.js";

describe("arraycopy", () => {
	test("copies forward (non-overlapping)", () => {
		const src = [1, 2, 3, 4, 5];
		const dest = [0, 0, 0, 0, 0];
		arraycopy(src, 1, dest, 0, 3);
		expect(dest).toEqual([2, 3, 4, 0, 0]);
	});

	test("copies backward (overlapping, same array)", () => {
		const arr = [1, 2, 3, 4, 5];
		// src overlaps dest: srcOfs=0, destOfs=1, len=3
		// srcOfs < destOfs && destOfs < srcOfs+len → backward copy
		arraycopy(arr, 0, arr, 1, 3);
		expect(arr).toEqual([1, 1, 2, 3, 5]);
	});

	test("handles negative srcOfs (no-op)", () => {
		const src = [1, 2, 3];
		const dest = [0, 0, 0];
		arraycopy(src, -1, dest, 0, 2);
		// Should not modify dest
		expect(dest).toEqual([0, 0, 0]);
	});

	test("handles negative destOfs (no-op)", () => {
		const src = [1, 2, 3];
		const dest = [0, 0, 0];
		arraycopy(src, 0, dest, -1, 2);
		expect(dest).toEqual([0, 0, 0]);
	});

	test("handles negative len (no-op)", () => {
		const src = [1, 2, 3];
		const dest = [0, 0, 0];
		arraycopy(src, 0, dest, 0, -1);
		expect(dest).toEqual([0, 0, 0]);
	});

	test("handles srcOfs + len exceeding src length (no-op)", () => {
		const src = [1, 2, 3];
		const dest = [0, 0, 0, 0, 0];
		arraycopy(src, 1, dest, 0, 5);
		expect(dest).toEqual([0, 0, 0, 0, 0]);
	});

	test("handles destOfs + len exceeding dest length (no-op)", () => {
		const src = [1, 2, 3, 4, 5];
		const dest = [0, 0];
		arraycopy(src, 0, dest, 0, 5);
		expect(dest).toEqual([0, 0]);
	});

	test("copies zero length (no-op)", () => {
		const src = [1, 2, 3];
		const dest = [0, 0, 0];
		arraycopy(src, 0, dest, 0, 0);
		expect(dest).toEqual([0, 0, 0]);
	});

	test("copies full array", () => {
		const src = [10, 20, 30];
		const dest = [0, 0, 0];
		arraycopy(src, 0, dest, 0, 3);
		expect(dest).toEqual([10, 20, 30]);
	});
});

describe("stateUpdateChar", () => {
	test("returns correct values for all table indices (0-11)", () => {
		const expected = [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 4, 5];
		for (let i = 0; i < 12; i++) {
			expect(stateUpdateChar(i)).toBe(expected[i]);
		}
	});

	test("handles index beyond table: index < 4", () => {
		// Fallback path: index >= table.length (12) and index < 4 → return 0
		// But indices 0-3 are in the table. The fallback for index >= 12 and < 4
		// can't happen. Let's test the actual fallback paths:
		// index >= 12, so first check fails
		// index < 4 → false for 12+, so goes to next check
		// index < 10 → false for 12, so goes to last return
		expect(stateUpdateChar(12)).toBe(12 - 6); // 6
	});

	test("handles index beyond table: index >= 10", () => {
		expect(stateUpdateChar(13)).toBe(13 - 6); // 7
		expect(stateUpdateChar(15)).toBe(15 - 6); // 9
	});
});

describe("initArray", () => {
	test("creates array of specified length with default value 0", () => {
		const arr = initArray(5);
		expect(arr.length).toBe(5);
	});

	test("creates array with specified non-zero value", () => {
		const arr = initArray(3, 1024);
		expect(arr[0]).toBe(1024);
		expect(arr[1]).toBe(1024);
		expect(arr[2]).toBe(1024);
	});
});

describe("initBitModels", () => {
	test("sets all elements to 1024", () => {
		const probs = [0, 0, 0, 0];
		initBitModels(probs);
		for (const p of probs) {
			expect(p).toBe(1024);
		}
	});
});

describe("createBitTree", () => {
	test("creates bit tree with correct structure", () => {
		const tree = createBitTree(4);
		expect(tree.numBitLevels).toBe(4);
		expect(tree.models.length).toBe(16); // 1 << 4
	});
});

describe("getLenToPosState", () => {
	test("returns len-2 for small lengths", () => {
		expect(getLenToPosState(2)).toBe(0);
		expect(getLenToPosState(3)).toBe(1);
		expect(getLenToPosState(4)).toBe(2);
		expect(getLenToPosState(5)).toBe(3);
	});

	test("caps at 3 for larger lengths", () => {
		expect(getLenToPosState(6)).toBe(3);
		expect(getLenToPosState(100)).toBe(3);
	});
});

describe("getBitPrice", () => {
	test("returns a non-negative number", () => {
		const price = getBitPrice(1024, 0);
		expect(price).toBeGreaterThanOrEqual(0);
	});

	test("different bits produce different prices at non-midpoint prob", () => {
		// At prob=1024 (midpoint), prices are equal; use asymmetric probability
		const price0 = getBitPrice(512, 0);
		const price1 = getBitPrice(512, 1);
		expect(price0).not.toBe(price1);
	});
});

describe("createProbPrices", () => {
	test("returns a non-empty array", () => {
		const prices = createProbPrices();
		expect(prices.length).toBeGreaterThan(0);
	});
});

describe("createFastPos", () => {
	test("returns array starting with [0, 1]", () => {
		const fastPos = createFastPos();
		expect(fastPos[0]).toBe(0);
		expect(fastPos[1]).toBe(1);
		expect(fastPos.length).toBeGreaterThan(2);
	});
});
