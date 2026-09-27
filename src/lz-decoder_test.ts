import {
	describe,
	expect,
	test,
} from "bun:test";

import { LzDecoder } from "./lz-decoder.js";

function create(dictSize: number) {
	const chunks: Uint8Array[] = [];
	const lz = new LzDecoder(dictSize, (chunk) => chunks.push(chunk.slice()));
	const output = () => {
		lz.flush();
		return Uint8Array.from(chunks.flatMap((c) => [...c]));
	};
	return { lz, output };
}

describe("LzDecoder", () => {
	test("putByte and getByte", () => {
		const { lz, output } = create(4096);
		for (const b of [1, 2, 3]) lz.putByte(b);
		expect(lz.getByte(0)).toBe(3);
		expect(lz.getByte(2)).toBe(1);
		expect(output()).toEqual(new Uint8Array([1, 2, 3]));
	});

	test("repeat with overlapping distance repeats the pattern", () => {
		const { lz, output } = create(4096);
		lz.putByte(1);
		lz.putByte(2);
		lz.repeat(1, 6);
		expect(output()).toEqual(new Uint8Array([1, 2, 1, 2, 1, 2, 1, 2]));
	});

	test("repeat with distance 0 is run-length", () => {
		const { lz, output } = create(4096);
		lz.putByte(9);
		lz.repeat(0, 300);
		expect(output()).toEqual(new Uint8Array(301).fill(9));
	});

	test("long non-overlapping repeat", () => {
		const { lz, output } = create(4096);
		const pattern = Uint8Array.from({ length: 100 }, (_, i) => i);
		for (const b of pattern) lz.putByte(b);
		lz.repeat(99, 100);
		expect(output()).toEqual(Uint8Array.from([...pattern, ...pattern]));
	});

	test("rejects distances beyond the history", () => {
		const { lz } = create(4096);
		lz.putByte(1);
		expect(() => lz.repeat(1, 2)).toThrow("Corrupted input");
		expect(() => lz.repeat(-5, 2)).toThrow("Corrupted input");
	});

	test("wraps around a full dictionary and keeps the output intact", () => {
		const { lz, output } = create(4096);
		const expected: number[] = [];

		for (let i = 0; i < 10_000; i++) {
			lz.putByte(i & 0xFF);
			expected.push(i & 0xFF);

			if (i % 1000 === 999 && i > 4000) {
				// Copy across the wrap point.
				lz.repeat(4000, 200);
				for (let j = 0; j < 200; j++) expected.push(expected[expected.length - 4001]);
			}
		}

		expect(output()).toEqual(Uint8Array.from(expected));
	});

	test("grows the buffer up to the dictionary size", () => {
		const dictSize = 200_000;
		const { lz, output } = create(dictSize);
		for (let i = 0; i < 150_000; i++) lz.putByte(i % 251);

		// Reach back further than the initial 64 KiB buffer.
		lz.repeat(149_999, 10);
		const result = output();
		expect(result.subarray(150_000)).toEqual(Uint8Array.from({ length: 10 }, (_, i) => i % 251));
	});
});
