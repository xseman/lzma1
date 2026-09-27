import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	decodeHeader,
	encodeHeader,
	UNKNOWN_SIZE,
} from "./header.js";
import {
	fitDictSize,
	resolveOptions,
} from "./options.js";

describe("header", () => {
	test.each([
		{ lc: 3, lp: 0, pb: 2, dictSize: 1 << 16, uncompressedSize: 11 },
		{ lc: 0, lp: 0, pb: 0, dictSize: 4096, uncompressedSize: 0 },
		{ lc: 8, lp: 4, pb: 4, dictSize: 0xFFFFFFFF, uncompressedSize: UNKNOWN_SIZE },
		{ lc: 1, lp: 2, pb: 3, dictSize: 12345, uncompressedSize: 2 ** 40 + 7 },
	])("round-trips %o", (header) => {
		expect(decodeHeader(encodeHeader(header))).toEqual(header);
	});

	test("default properties byte is 0x5D", () => {
		expect(encodeHeader({ lc: 3, lp: 0, pb: 2, dictSize: 4096, uncompressedSize: 0 })[0]).toBe(0x5D);
	});

	test("rejects sizes that don't fit in a safe integer", () => {
		const bytes = encodeHeader({ lc: 3, lp: 0, pb: 2, dictSize: 4096, uncompressedSize: 0 });
		bytes.fill(0xFF, 5, 12);
		expect(() => decodeHeader(bytes)).toThrow("too large");
	});
});

describe("options", () => {
	test("defaults to level 5", () => {
		expect(resolveOptions()).toEqual(resolveOptions(5));
		expect(resolveOptions()).toMatchObject({ lc: 3, lp: 0, pb: 2, mode: "normal", matchFinder: "bt4" });
	});

	test("levels 1-3 use the fast encoder", () => {
		expect(resolveOptions(1)).toMatchObject({ mode: "fast", matchFinder: "hc4" });
		expect(resolveOptions(3)).toMatchObject({ mode: "fast", matchFinder: "hc4" });
		expect(resolveOptions(4)).toMatchObject({ mode: "normal", matchFinder: "bt4" });
	});

	test("options override the preset", () => {
		expect(resolveOptions({ level: 1, mode: "normal", dictSize: 8192 })).toMatchObject({ mode: "normal", matchFinder: "hc4", dictSize: 8192 });
	});

	test("fitDictSize rounds up to 2^n or 2^n + 2^(n-1)", () => {
		expect(fitDictSize(1 << 20, 0)).toBe(4096);
		expect(fitDictSize(1 << 20, 4097)).toBe(6144);
		expect(fitDictSize(1 << 20, 6145)).toBe(8192);
		expect(fitDictSize(1 << 20, 700_000)).toBe(786_432);
		expect(fitDictSize(1 << 20, 900_000)).toBe(1 << 20);
		expect(fitDictSize(5000, 4500)).toBe(5000);
	});
});
