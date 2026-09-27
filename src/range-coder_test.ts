import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	initProbs,
	PROB_INIT,
} from "./range-coder.js";
import { RangeDecoder } from "./range-decoder.js";
import {
	getBitPrice,
	getBitTreePrice,
	getDirectBitsPrice,
	getReverseBitTreePrice,
	RangeEncoder,
} from "./range-encoder.js";

function createRandom(seed: number): () => number {
	return () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
}

function probs(size: number): Uint16Array {
	const p = new Uint16Array(size);
	initProbs(p);
	return p;
}

function encode(fn: (rc: RangeEncoder) => void): Uint8Array {
	const rc = new RangeEncoder(16);
	fn(rc);
	return rc.finish();
}

/** Reference decoding of a matched literal, see `LzmaDecoder.decode`. */
function decodeMatchedLiteral(rc: RangeDecoder, p: Uint16Array, offset: number, matchByte: number): number {
	let symbol = 1;
	let matchOffset = 0x100;
	do {
		matchByte <<= 1;
		const matchBit = matchByte & matchOffset;
		const bit = rc.decodeBit(p, offset + matchOffset + matchBit + symbol);
		symbol = (symbol << 1) | bit;
		matchOffset &= bit === 0 ? ~matchBit : matchBit;
	} while (symbol < 0x100);
	return symbol & 0xFF;
}

function decoder(bytes: Uint8Array): RangeDecoder {
	const rc = new RangeDecoder();
	rc.init(bytes, 0);
	return rc;
}

describe("range coder", () => {
	test("round-trips skewed and uniform bits", () => {
		const random = createRandom(42);
		const bits = Array.from({ length: 20_000 }, (_, i) => (random() < (i < 10_000 ? 0.05 : 0.5) ? 1 : 0));

		const bytes = encode((rc) => {
			const p = probs(2);
			for (const [i, bit] of bits.entries()) rc.encodeBit(p, i < 10_000 ? 0 : 1, bit);
		});

		const rc = decoder(bytes);
		const p = probs(2);
		expect(bits.map((_, i) => rc.decodeBit(p, i < 10_000 ? 0 : 1))).toEqual(bits);
		expect(rc.pos).toBe(bytes.length);
		expect(rc.isFinished()).toBe(true);
	});

	test("skewed bits compress well", () => {
		const bytes = encode((rc) => {
			const p = probs(1);
			for (let i = 0; i < 80_000; i++) rc.encodeBit(p, 0, i % 100 === 0 ? 1 : 0);
		});
		// 80,000 bits = 10,000 bytes uncompressed.
		expect(bytes.length).toBeLessThan(1500);
	});

	test("round-trips bit trees, reverse bit trees, literals and direct bits", () => {
		const random = createRandom(7);
		const symbols = Array.from({ length: 2000 }, () => Math.floor(random() * 256));
		const matchBytes = Array.from({ length: 2000 }, (_, i) => (random() < 0.5 ? symbols[i] : Math.floor(random() * 256)));
		const directs = Array.from({ length: 2000 }, () => Math.floor(random() * 2 ** 26));

		// One array holding several models at different offsets.
		const TREE = 0;
		const REVERSE = 64;
		const LITERAL = 80;

		const bytes = encode((rc) => {
			const p = probs(LITERAL + 0x300);
			for (let i = 0; i < symbols.length; i++) {
				rc.encodeBitTree(p, TREE, 6, symbols[i] & 63);
				rc.encodeReverseBitTree(p, REVERSE, 4, symbols[i] & 15);
				rc.encodeLiteral(p, LITERAL, symbols[i]);
				rc.encodeMatchedLiteral(p, LITERAL, symbols[i], matchBytes[i]);
				rc.encodeDirectBits(directs[i], 26);
			}
		});

		const rc = decoder(bytes);
		const p = probs(LITERAL + 0x300);
		for (let i = 0; i < symbols.length; i++) {
			expect(rc.decodeBitTree(p, TREE, 6)).toBe(symbols[i] & 63);
			expect(rc.decodeReverseBitTree(p, REVERSE, 4)).toBe(symbols[i] & 15);
			expect(rc.decodeBitTree(p, LITERAL, 8)).toBe(symbols[i]);
			expect(decodeMatchedLiteral(rc, p, LITERAL, matchBytes[i])).toBe(symbols[i]);
			expect(rc.decodeDirectBits(26)).toBe(directs[i]);
		}
		expect(rc.isFinished()).toBe(true);
	});

	test("bit trees throw when input runs out", () => {
		const rc = decoder(new Uint8Array([0, 0, 0, 0, 0]));
		const p = probs(0x100);
		expect(() => {
			for (let i = 0; i < 100; i++) rc.decodeBitTree(p, 0, 8);
		}).toThrow("Truncated input");
	});

	test("carry propagates through a run of 0xFF bytes", () => {
		// Direct bits of all ones push `low` towards the carry boundary.
		const bytes = encode((rc) => {
			for (let i = 0; i < 100; i++) rc.encodeDirectBits(0x3FFFFFF, 26);
			rc.encodeDirectBits(0, 26);
		});

		const rc = decoder(bytes);
		for (let i = 0; i < 100; i++) expect(rc.decodeDirectBits(26)).toBe(0x3FFFFFF);
		expect(rc.decodeDirectBits(26)).toBe(0);
	});

	test("decoder rejects a non-zero first byte", () => {
		expect(() => decoder(new Uint8Array([1, 0, 0, 0, 0]))).toThrow("Corrupted input");
	});

	test("decoder throws when input runs out", () => {
		const rc = decoder(new Uint8Array([0, 0, 0, 0, 0]));
		const p = probs(1);
		expect(() => {
			for (let i = 0; i < 100; i++) rc.decodeBit(p, 0);
		}).toThrow("Truncated input");
	});
});

describe("prices", () => {
	test("a bit at 50% probability costs about one bit (16 units)", () => {
		expect(getBitPrice(PROB_INIT, 0)).toBe(16);
		expect(getBitPrice(PROB_INIT, 1)).toBe(17);
		expect(getDirectBitsPrice(3)).toBe(48);
	});

	test("likely bits are cheaper than unlikely bits", () => {
		const likelyZero = 2000;
		expect(getBitPrice(likelyZero, 0)).toBeLessThan(getBitPrice(likelyZero, 1));
		expect(getBitPrice(likelyZero, 0)).toBeLessThan(getBitPrice(1500, 0));
	});

	test("bit tree prices sum the prices of their bits", () => {
		const p = probs(8);
		const bitPrices = [1, 0, 1].map((bit) => getBitPrice(PROB_INIT, bit));
		const sum = bitPrices.reduce((a, b) => a + b);
		expect(getBitTreePrice(p, 0, 3, 0b101)).toBe(sum);
		expect(getReverseBitTreePrice(p, 0, 3, 0b101)).toBe(sum);
	});
});
