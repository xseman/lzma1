import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	getDistState,
	LiteralCoder,
	State,
	STATES,
} from "./lzma-coder.js";
import { getDistSlot } from "./lzma-encoder.js";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/**
 * Builds a `State` at a wanted raw value by replaying a transition walk
 * from the reset state; the raw values are otherwise not constructible,
 * as in the Java code.
 */
function stateAt(value: number): State {
	const walks: Record<number, string> = {
		0: "",
		1: "ML L",
		2: "RL L",
		3: "SL L",
		4: "ML",
		5: "RL",
		6: "SL",
		7: "M",
		8: "R",
		9: "S",
		10: "MM",
		11: "MR",
	};

	const state = new State();
	state.reset();
	for (const step of walks[value]) {
		if (step === "M") state.updateMatch();
		else if (step === "R") state.updateLongRep();
		else if (step === "S") state.updateShortRep();
		else if (step === "L") state.updateLiteral();
	}
	expect(state.get()).toBe(value);
	return state;
}

describe("state machine", () => {
	// Transition tables from the LZMA specification (lzma-specification.txt).
	test("after literal", () => {
		const after = range(STATES).map((s) => {
			const state = stateAt(s);
			state.updateLiteral();
			return state.get();
		});
		expect(after).toEqual([0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 4, 5]);
	});

	test("after match", () => {
		const after = range(STATES).map((s) => {
			const state = stateAt(s);
			state.updateMatch();
			return state.get();
		});
		expect(after).toEqual([7, 7, 7, 7, 7, 7, 7, 10, 10, 10, 10, 10]);
	});

	test("after long rep", () => {
		const after = range(STATES).map((s) => {
			const state = stateAt(s);
			state.updateLongRep();
			return state.get();
		});
		expect(after).toEqual([8, 8, 8, 8, 8, 8, 8, 11, 11, 11, 11, 11]);
	});

	test("after short rep", () => {
		const after = range(STATES).map((s) => {
			const state = stateAt(s);
			state.updateShortRep();
			return state.get();
		});
		expect(after).toEqual([9, 9, 9, 9, 9, 9, 9, 11, 11, 11, 11, 11]);
	});

	test("literal states", () => {
		expect(range(STATES).map((s) => stateAt(s).isLiteral())).toEqual(range(STATES).map((s) => s < 7));
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
	class TestLiteralCoder extends LiteralCoder {}

	test("are selected by previous byte and position", () => {
		// lc = 3 (high bits of the previous byte), lp = 2 (low
		// bits of the position).
		const coder = new TestLiteralCoder(3, 2);

		expect(coder.getSubcoderIndex(0x00, 0)).toBe(coder.getSubcoderIndex(0x1F, 4));
		expect(coder.getSubcoderIndex(0x00, 0)).not.toBe(coder.getSubcoderIndex(0x20, 0));
		expect(coder.getSubcoderIndex(0x00, 0)).not.toBe(coder.getSubcoderIndex(0x00, 1));
		expect(coder.getSubcoderIndex(0xFF, 3) + 1).toBe(1 << (3 + 2));
	});

	test("lc = 0 and lp = 0 use a single subcoder", () => {
		const coder = new TestLiteralCoder(0, 0);
		expect(coder.getSubcoderIndex(0xFF, 123)).toBe(0);
	});
});
