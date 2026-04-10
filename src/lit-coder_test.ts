import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	LitCoder,
	LitSubCoder,
} from "./lit-coder.js";
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

function createMockEncoder(): BasicRangeEncoder & { calls: { probs: number[]; index: number; bit: number; }[]; } {
	const calls: { probs: number[]; index: number; bit: number; }[] = [];
	return {
		calls,
		encodeBit(probs: number[], index: number, bit: number): void {
			calls.push({ probs, index, bit });
		},
	};
}

describe("LitSubCoder", () => {
	test("decodeNormal returns correct symbol", () => {
		// symbol starts at 1, shifts left and ORs with bit, until >= 0x100
		// To get symbol = 0x41 ('A' = 0b01000001):
		// bits: 0,1,0,0,0,0,0,1
		const bits = [0, 1, 0, 0, 0, 0, 0, 1];
		const rd = createMockDecoder(bits);
		const coder = new LitSubCoder();

		const result = coder.decodeNormal(rd);
		expect(result).toBe(0x41);
	});

	test("decodeWithMatchByte with matching bits", () => {
		// matchByte = 0xFF → all matchBits are 1
		// Provide bits that always match (all 1s)
		const bits = [1, 1, 1, 1, 1, 1, 1, 1];
		const rd = createMockDecoder(bits);
		const coder = new LitSubCoder();

		const result = coder.decodeWithMatchByte(rd, 0xFF);
		expect(result).toBe(0xFF);
	});

	test("decodeWithMatchByte with diverging match byte", () => {
		// matchByte = 0x80 (10000000) → first matchBit=1
		// First decoded bit = 0 (diverges), then decode remaining 7 bits normally
		const bits = [0, 0, 0, 0, 0, 0, 0, 0];
		const rd = createMockDecoder(bits);
		const coder = new LitSubCoder();

		const result = coder.decodeWithMatchByte(rd, 0x80);
		expect(result).toBe(0x00);
	});

	test("encode calls encodeBit for each bit of the symbol", () => {
		const re = createMockEncoder();
		const coder = new LitSubCoder();

		// Encode 0x41 = 0b01000001
		coder.encode(re, 0x41);
		expect(re.calls.length).toBe(8);

		// Verify bit sequence: 0,1,0,0,0,0,0,1
		const expectedBits = [0, 1, 0, 0, 0, 0, 0, 1];
		for (let i = 0; i < 8; i++) {
			expect(re.calls[i].bit).toBe(expectedBits[i]);
		}
	});

	test("encodeMatched with same match byte and symbol", () => {
		const re = createMockEncoder();
		const coder = new LitSubCoder();

		coder.encodeMatched(re, 0x41, 0x41);
		expect(re.calls.length).toBe(8);
	});

	test("encodeMatched with diverging match byte", () => {
		const re = createMockEncoder();
		const coder = new LitSubCoder();

		// matchByte = 0xFF, symbol = 0x00 → diverges immediately at bit 7
		coder.encodeMatched(re, 0xFF, 0x00);
		expect(re.calls.length).toBe(8);
		// First call should use matched context (state includes matchBit offset)
		expect(re.calls[0].bit).toBe(0);
	});

	test("getPrice returns a number for non-match mode", () => {
		const coder = new LitSubCoder();
		const price = coder.getPrice(false, 0, 0x41);
		expect(typeof price).toBe("number");
		expect(price).toBeGreaterThanOrEqual(0);
	});

	test("getPrice returns a number for match mode", () => {
		const coder = new LitSubCoder();
		const price = coder.getPrice(true, 0x41, 0x41);
		expect(typeof price).toBe("number");
	});

	test("getPrice match mode with diverging bytes", () => {
		const coder = new LitSubCoder();
		const price = coder.getPrice(true, 0xFF, 0x00);
		expect(typeof price).toBe("number");
	});

	test("reset sets all coders to 1024", () => {
		const coder = new LitSubCoder();
		// Verify decoders exist and modify them
		const decoders = coder.decoders;
		expect(decoders.length).toBe(0x300);

		// Modify a value
		decoders[0] = 999;
		coder.reset();
		expect(coder.decoders[0]).toBe(1024);
	});

	test("decoders getter returns coders array", () => {
		const coder = new LitSubCoder();
		const decoders = coder.decoders;
		expect(Array.isArray(decoders)).toBe(true);
		expect(decoders.length).toBe(0x300);
	});
});

describe("LitCoder", () => {
	test("constructor creates correct number of sub-coders", () => {
		const coder = new LitCoder(2, 3); // numPosBits=2, numPrevBits=3
		const numStates = 1 << (3 + 2); // 32
		expect(coder.coders.length).toBe(numStates);
	});

	test("getSubCoder returns appropriate sub-coder", () => {
		const coder = new LitCoder(1, 2); // numPosBits=1, numPrevBits=2
		const sub1 = coder.getSubCoder(0, 0);
		const sub2 = coder.getSubCoder(1, 0);

		expect(sub1).toBeInstanceOf(LitSubCoder);
		expect(sub2).toBeInstanceOf(LitSubCoder);
	});

	test("getSubCoder returns different coders for different positions", () => {
		const coder = new LitCoder(1, 2);
		const sub1 = coder.getSubCoder(0, 0);
		const sub2 = coder.getSubCoder(1, 0);

		// Different positions should yield different sub-coders
		expect(sub1).not.toBe(sub2);
	});

	test("reset resets all sub-coders", () => {
		const coder = new LitCoder(0, 1);
		// Modify a sub-coder
		const sub = coder.getSubCoder(0, 0);
		sub.decoders[0] = 999;

		coder.reset();
		expect(sub.decoders[0]).toBe(1024);
	});

	test("numPrevBits getter", () => {
		const coder = new LitCoder(2, 3);
		expect(coder.numPrevBits).toBe(3);
	});

	test("numPosBits getter", () => {
		const coder = new LitCoder(2, 3);
		expect(coder.numPosBits).toBe(2);
	});

	test("posMask getter", () => {
		const coder = new LitCoder(2, 3);
		expect(coder.posMask).toBe((1 << 2) - 1); // 3
	});

	test("coders getter returns array of LitSubCoder", () => {
		const coder = new LitCoder(1, 1);
		const coders = coder.coders;
		expect(Array.isArray(coders)).toBe(true);
		for (const c of coders) {
			expect(c).toBeInstanceOf(LitSubCoder);
		}
	});
});
