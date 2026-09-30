import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	getDistState,
	isLiteralState,
	LITERAL,
	LzmaCoder,
	stateAfterLiteral,
	stateAfterLongRep,
	stateAfterMatch,
	stateAfterShortRep,
	STATES,
} from "./lzma-coder.js";
import { getDistSlot } from "./lzma-encoder.js";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("state machine", () => {
	// Transition tables from the LZMA specification (lzma-specification.txt).
	test("after literal", () => {
		expect(range(STATES).map(stateAfterLiteral)).toEqual([0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 4, 5]);
	});

	test("after match", () => {
		expect(range(STATES).map(stateAfterMatch)).toEqual([7, 7, 7, 7, 7, 7, 7, 10, 10, 10, 10, 10]);
	});

	test("after long rep", () => {
		expect(range(STATES).map(stateAfterLongRep)).toEqual([8, 8, 8, 8, 8, 8, 8, 11, 11, 11, 11, 11]);
	});

	test("after short rep", () => {
		expect(range(STATES).map(stateAfterShortRep)).toEqual([9, 9, 9, 9, 9, 9, 9, 11, 11, 11, 11, 11]);
	});

	test("literal states", () => {
		expect(range(STATES).map(isLiteralState)).toEqual(range(STATES).map((s) => s < 7));
	});
});

describe("distances", () => {
	test("distance state depends on the match length", () => {
		expect([2, 3, 4, 5, 6, 273].map(getDistState)).toEqual([0, 1, 2, 3, 3, 3]);
	});

	test("distance slot matches its definition", () => {
		// Slot s >= 4 covers distances [(2 | (s & 1)) << (s/2 - 1), next slot).
		const slotOf = (dist: number) => {
			if (dist < 4) return dist;
			const bits = Math.floor(Math.log2(dist));
			return bits * 2 + ((dist >>> (bits - 1)) & 1);
		};

		for (const dist of [...range(5000), 0x7FFF, 0x8000, 0x12345678, 0x7FFFFFFF]) {
			expect(getDistSlot(dist)).toBe(slotOf(dist));
		}
		expect(getDistSlot(-1)).toBe(63);
	});
});

describe("literal coders", () => {
	test("are selected by previous byte and position", () => {
		const coder = new LzmaCoder(3, 2, 2);
		expect(coder.literalOffset(0x00, 0)).toBe(coder.literalOffset(0x1F, 4));
		expect(coder.literalOffset(0x00, 0)).not.toBe(coder.literalOffset(0x20, 0));
		expect(coder.literalOffset(0x00, 0)).not.toBe(coder.literalOffset(0x00, 1));
		expect(coder.literalOffset(0xFF, 3) + 0x300).toBe(coder.probs.length);
	});

	test("lc = 0 and lp = 0 use a single set", () => {
		const coder = new LzmaCoder(0, 0, 0);
		expect(coder.literalOffset(0xFF, 123)).toBe(LITERAL);
		expect(coder.probs.length).toBe(LITERAL + 0x300);
	});
});
