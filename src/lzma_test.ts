import {
	describe,
	expect,
	test,
} from "bun:test";

import { AloneEncoder } from "./alone-encoder.js";
import {
	compress,
	compressString,
	CRC32_TABLE,
	decompress,
	decompressString,
} from "./index.js";
import { LZMA } from "./lzma.js";
import {
	type CompressionMode,
	resolveOptions,
} from "./options.js";

const LEVELS: CompressionMode[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Parses space-separated hex bytes, e.g. "5d 00 10". */
const fromHex = (hex: string) => Uint8Array.from(hex.split(" "), (byte) => parseInt(byte, 16));

test("CRC32_TABLE has unsigned entries", () => {
	expect(CRC32_TABLE[1]).toBe(0x77073096);
	expect(CRC32_TABLE[255]).toBe(0x2D02EF8D);
	expect(CRC32_TABLE[2]).toBe(0xEE0E612C);
});

describe("round trip", () => {
	test("output of this version is stable", () => {
		const compressed = fromHex("5d 00 10 00 00 0b 00 00 00 00 00 00 00 00 34 19 49 db 85 5c 63 ad 3e f9 63 75 8e ee b1 ff ff 2f 20 00 00");
		expect(compressString("hello world", 1)).toEqual(compressed);
		expect(decompressString(compressed)).toBe("hello world");
	});

	test.each(["a", "∑ √ ∆ ☆ € ≠ ±", "tab\tnewline\n", '{"id":1,"tags":["x","y"]}'])("string %j at every level", (input) => {
		for (const level of LEVELS) {
			expect(decompressString(compressString(input, level))).toBe(input);
		}
	});

	test("all byte values at every level", () => {
		const input = Uint8Array.from({ length: 1024 }, (_, i) => (i * 131) & 0xFF);
		for (const level of LEVELS) {
			expect(decompress(compress(input, level))).toEqual(input);
		}
	});

	test("mixed repetitive and random data", () => {
		let seed = 7;
		const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24;
		const input = new Uint8Array(200_000);
		for (let i = 0; i < input.length; i++) {
			input[i] = (i >> 12) % 3 === 0 ? random() : i % 97;
		}
		for (const level of [1, 5, 9] as const) {
			expect(decompress(compress(input, level))).toEqual(input);
		}
	});

	test.each([(1 << 16) - 1, 1 << 16, (1 << 16) + 1, 1 << 17])("%i identical bytes", (size) => {
		const input = new Uint8Array(size).fill(0x41);
		const compressed = compress(input);
		expect(compressed.length).toBeLessThan(size / 100);
		expect(decompress(compressed)).toEqual(input);
	});

	test("ArrayBuffer input", () => {
		const input = new TextEncoder().encode("Hello World");
		expect(decompress(compress(input.buffer as ArrayBuffer))).toEqual(input);
	});

	test("unknown size in the header", () => {
		const compressed = compressString("hello world", 1);
		compressed.fill(0xFF, 5, 13);
		expect(decompressString(compressed)).toBe("hello world");
	});
});

describe("compatibility with v0.3.0 output", () => {
	// Produced by lzma1 v0.3.0, which used a different encoder and
	// encoded strings as Java's "modified UTF-8".
	test("hello world", () => {
		const compressed = fromHex("5d 00 00 01 00 0b 00 00 00 00 00 00 00 00 34 19 49 ee 8d e9 17 89 3a 33 60 05 f7 cf 64 ff fb 78 20 00");
		expect(decompressString(compressed)).toBe("hello world");
	});

	test("lorem ipsum", () => {
		const compressed = fromHex("5d 00 00 01 00 bd 01 00 00 00 00 00 00 00 26 1b ca 46 67 5a f2 77 b8 7d 86 d8 41 db 05 35 cd 83 a5 7c 12 a5 05 db 90 bd 2f 14 d3 71 72 96 a8 8a 7d 84 56 71 8d 6a 22 98 ab 9e 3d c3 55 ef cc a5 c3 dd 5b 8e bf 03 81 21 40 d6 26 91 02 45 4f 92 a1 78 bb 8a 00 af 90 2a 26 92 02 23 e5 5c b3 2d e3 e8 5c 2c fb 32 25 99 5c bc 71 f3 58 5a d3 1b 39 b4 bf 6f c7 61 36 92 14 e8 55 d3 ef 77 e0 68 fb ee 08 72 16 7e 2c ed 0a 69 78 8e 0c 1c 31 67 d5 b1 74 88 38 f5 e7 74 80 6e 7e 1e af 6d f5 32 22 17 bc da 0f a5 2f 85 48 72 02 fc b0 14 c7 16 aa ae cf 79 2a 0d 15 7f 49 1a e1 14 d4 9b 51 94 fc 9e 5d c1 1a 73 30 5c bc 65 2d d8 28 f9 09 73 cb f7 ad 4f 05 72 03 a5 6c 08 5b 36 26 fa 04 96 20 f5 4e 13 76 5f ce 4b 71 53 a7 5d 91 1b 1e 77 56 40 7e 91 de 51 72 0c 10 61 74 4b f6 6f 6e 90 6a 13 1f 99 fb 42 df 6a a8 94 52 cf 3d 77 cf 2f 21 62 cb f3 6b 5a fe fe 62 05 22 6c e8 df 9f de 8a 60 f3 7e 42 a6 24 48 d0 f3 ff 66 d3 e1 ed 4d d8 db 85 71 a3 ab c7 1b cd 67 22 b7 6b bc f2 7c 01 f0 48 a5 0c 38 9d 70 b4 e1 05 ff d6 30 7f f8");
		expect(decompressString(compressed)).toStartWith("Lorem ipsum dolor sit amet");
	});

	test("string with NUL and characters outside the BMP", () => {
		const compressed = fromHex("5d 00 00 20 00 1a 00 00 00 00 00 00 00 00 34 30 d1 26 cc 55 f1 95 a0 c0 2f ed 00 5b 6e f3 33 0e 9a ed 25 09 6b f7 90 e3 22 fa 43 d8 fb ff ff b0 5a 80 00");
		expect(decompressString(compressed)).toBe("héllo\0 wörld 😀 ∆");
	});

	test("binary data at mode 9", () => {
		const compressed = fromHex("5d 00 00 00 02 2c 01 00 00 00 00 00 00 00 00 02 0f 57 02 68 c6 78 ce d8 0f 90 e6 eb b6 dd 1f 70 62 b0 21 27 14 f9 b1 95 8a 58 60 21 7a 2c ac e7 77 98 df 45 86 da ac 69 34 69 0d 38 64 55 e2 b7 18 16 aa 44 15 99 be a2 90 8b 09 d6 1f c9 47 ff ef de 9a c6 8d bf 33 d9 b5 d4 6a af 16 ed f4 83 bc 69 74 d1 23 e6 c7 84 1e 12 9b a6 75 90 56 90 89 72 1a 58 7f 5a 3e 80 06 4c 56 65 3f 78 eb ad d7 c6 55 3b 1f 67 e3 a8 37 8a 19 99 f2 4c e6 a5 cb 00 71 89 5b cf 16 23 81 92 f1 f7 07 bf 9b ee dc fa 16 13 0e 51 d0 10 69 88 3e de e4 bd c3 a6 e0 95 83 2b 4b a8 95 75 98 7a 1b 8a 02 74 78 a6 a1 fc 6a 60 f0 a5 ad 2a c8 55 c4 cf 2f 06 0f 62 1b 9d 85 b9 15 1c c8 9b 94 19 66 d4 06 20 86 26 a3 ad 7c 68 84 02 2f 7b 8f 2b 57 72 32 56 b3 d8 88 0f 4d 7f 03 56 3d c3 d5 98 37 c3 ea e0 f3 9f ab 97 f1 bb ff ff ce 40 3b e0");
		const expected = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) & 0xFF);
		expect(decompress(compressed)).toEqual(expected);
	});
});

describe("strings", () => {
	test("are encoded as standard UTF-8", () => {
		const input = "héllo\0 wörld 😀 ∆";
		const decompressed = decompress(compressString(input));
		expect(decompressed).toEqual(new TextEncoder().encode(input));
	});

	test("decode data compressed from standard UTF-8", () => {
		const input = "emoji 😀🎉 and NUL \0 and BOM ﻿";
		expect(decompressString(compress(new TextEncoder().encode(input)))).toBe(input);
	});

	test("keep a leading byte order mark", () => {
		expect(decompressString(compressString("﻿abc"))).toBe("﻿abc");
	});

	test("non-text data decodes as Latin-1", () => {
		const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => 0x80 + (i % 0x80));
		const text = decompressString(compress(bytes, 1));
		expect(text.length).toBe(bytes.length);
		expect(text.charCodeAt(0)).toBe(0x80);
	});
});

describe("options", () => {
	const input = new TextEncoder().encode("options test ".repeat(500));

	test.each(
		[
			{ level: 1 },
			{ level: 9 },
			{ mode: "fast" },
			{ mode: "normal", matchFinder: "hc4" },
			{ mode: "fast", matchFinder: "bt4" },
			{ lc: 0, lp: 0, pb: 0 },
			{ lc: 0, lp: 4, pb: 4 },
			{ lc: 1, lp: 3, pb: 1 },
			{ dictSize: 4096 },
			{ niceLen: 8 },
			{ niceLen: 273 },
			{ depth: 1 },
		] as const,
	)("%o", (options) => {
		expect(decompress(compress(input, options))).toEqual(input);
	});

	test("decompresses lc + lp > 4, which 7-Zip writes", () => {
		for (const [lc, lp] of [[8, 4], [5, 0]]) {
			const encoder = new AloneEncoder({ ...resolveOptions(5), lc, lp }, input.length);
			encoder.write(input);
			expect(decompress(encoder.finish())).toEqual(input);
		}
	});

	test("writes lc/lp/pb and dictionary size to the header", () => {
		const header = compress(input, { lc: 1, lp: 2, pb: 3, dictSize: 1 << 16 }).subarray(0, 5);
		expect(header[0]).toBe((3 * 5 + 2) * 9 + 1);
		// The input fits into a smaller dictionary.
		expect(new DataView(header.buffer, header.byteOffset).getUint32(1, true)).toBe(8192);
	});

	test("dictionary size is not reduced below the input size", () => {
		const big = new Uint8Array(100_000);
		const header = compress(big, { dictSize: 1 << 20 }).subarray(0, 5);
		expect(new DataView(header.buffer, header.byteOffset).getUint32(1, true)).toBe(1 << 17);
	});

	test.each([
		{ level: 0 },
		{ level: 10 },
		{ lc: 5 },
		{ lc: 4, lp: 1 },
		{ lp: 5 },
		{ pb: -1 },
		{ dictSize: 100 },
		{ dictSize: 1.5 },
		{ niceLen: 7 },
		{ niceLen: 274 },
		{ mode: "slow" },
		{ matchFinder: "bt2" },
	])("rejects %o", (options) => {
		expect(() => compress(input, options as never)).toThrow(RangeError);
	});
});

describe("input types", () => {
	test("accepts any ArrayBufferView", () => {
		const bytes = new TextEncoder().encode("typed arrays");
		const compressed = compress(new DataView(bytes.buffer));
		expect(decompress(new Int8Array(compressed.buffer))).toEqual(bytes);
	});

	test("accepts a view into a larger buffer", () => {
		const backing = new Uint8Array(100).fill(7);
		const view = backing.subarray(10, 20);
		const compressed = compress(view);
		const padded = new Uint8Array(compressed.length + 8);
		padded.set(compressed, 4);
		expect(decompress(padded.subarray(4, 4 + compressed.length))).toEqual(view);
	});

	test("LZMA class output can be decompressed", () => {
		const lzma = new LZMA();
		const compressed = lzma.compressString("Hello World!", 5);
		expect(compressed).toBeInstanceOf(Int8Array);
		expect(lzma.decompressString(compressed)).toBe("Hello World!");
		expect(decompressString(compressed)).toBe("Hello World!");
	});

	test("rejects other values", () => {
		expect(() => compress("text" as never)).toThrow(TypeError);
		expect(() => decompress([1, 2, 3] as never)).toThrow(TypeError);
	});
});

describe("empty and tiny inputs", () => {
	test("empty input", () => {
		expect(decompress(compress(new Uint8Array(0)))).toEqual(new Uint8Array(0));
		expect(decompressString(compressString(""))).toBe("");
	});

	test.each([1, 2, 3, 4, 5, 6])("%i bytes at every level", (size) => {
		const input = Uint8Array.from({ length: size }, (_, i) => i * 37);
		for (let level = 1 as CompressionMode; level <= 9; level++) {
			expect(decompress(compress(input, level))).toEqual(input);
		}
	});
});

describe("decompression errors", () => {
	const input = new TextEncoder().encode("The quick brown fox jumps over the lazy dog. ".repeat(20));
	const compressed = compress(input);

	test("header is too short", () => {
		expect(() => decompress(compressed.subarray(0, 12))).toThrow("Truncated input");
	});

	test("truncated data", () => {
		for (const cut of [13, 14, 20, compressed.length >> 1]) {
			expect(() => decompress(compressed.subarray(0, cut))).toThrow("Truncated input");
		}
	});

	test("truncated data with unknown size", () => {
		const unknownSize = compressed.slice(0, -1);
		unknownSize.fill(0xFF, 5, 13);
		expect(() => decompress(unknownSize)).toThrow("Truncated input");
	});

	test("end marker is optional when the size is known", () => {
		// The last bytes only complete the end marker.
		expect(decompress(compressed.subarray(0, compressed.length - 1))).toEqual(input);
	});

	test("invalid properties byte", () => {
		const bad = compressed.slice();
		bad[0] = 225;
		expect(() => decompress(bad)).toThrow("invalid LZMA properties");
	});

	test("invalid range coder header", () => {
		const bad = compressed.slice();
		bad[13] = 1;
		expect(() => decompress(bad)).toThrow("Corrupted input");
	});

	test("declared size smaller than the data", () => {
		const bad = compressed.slice();
		bad[5] = input.length - 10;
		bad[6] = 0;
		expect(() => decompress(bad)).toThrow("Corrupted input");
	});

	test("declared size larger than the data ends at the end marker", () => {
		const tooLarge = compressed.slice();
		new DataView(tooLarge.buffer).setUint32(5, 0xFFFF, true);

		expect(decompress(tooLarge)).toEqual(input);
	});

	test("declared size larger than the data, decoded in place", () => {
		// A dictionary larger than the declared size: the output buffer is
		// allocated at once and returned without copying.
		const tooLarge = compressed.slice();
		const view = new DataView(tooLarge.buffer);
		view.setUint32(1, 1 << 20, true);
		view.setUint32(5, 0xFFFF, true);

		const output = decompress(tooLarge);

		expect(output).toEqual(input);
		expect(output.byteLength).toBe(input.length);
	});

	test("declared size larger than the data without an end marker", () => {
		const tooLarge = compressed.subarray(0, compressed.length - 1).slice();
		new DataView(tooLarge.buffer).setUint32(5, 0xFFFF, true);

		expect(() => decompress(tooLarge)).toThrow("Truncated input");
	});

	test("corrupted data throws or yields different output, never hangs", () => {
		let seed = 1;
		const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;

		for (let i = 0; i < 300; i++) {
			const bad = compressed.slice();
			const pos = 14 + Math.floor(random() * (bad.length - 14));
			bad[pos] ^= 1 << Math.floor(random() * 8);

			try {
				expect(decompress(bad)).not.toEqual(input);
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
		}
	});

	test("trailing data after the stream is ignored", () => {
		const padded = new Uint8Array(compressed.length + 10);
		padded.set(compressed);
		expect(decompress(padded)).toEqual(input);
	});
});

describe("encoder reuse", () => {
	// Encoders for small inputs are pooled and reused by later calls.
	test("reused encoders produce the same output as new ones", () => {
		const a = new TextEncoder().encode("first input, first input, first input");
		const b = new TextEncoder().encode("a different second input with other matches: 0123456789 0123456789");

		const first = compress(a);
		const other = compress(b);
		const again = compress(a);

		expect(again).toEqual(first);
		expect(decompress(other)).toEqual(b);
	});

	test("interleaved levels and sizes", () => {
		const inputs = [30, 300, 3000, 30].map((n) => Uint8Array.from({ length: n }, (_, i) => (i * 7) % 13));
		const levels = [1, 5, 9] as const;
		const expected = levels.map((level) => inputs.map((input) => compress(input, level)));

		for (let round = 0; round < 3; round++) {
			levels.forEach((level, l) => {
				inputs.forEach((input, i) => {
					expect(compress(input, level)).toEqual(expected[l][i]);
				});
			});
		}
	});
});

describe("decoder reuse", () => {
	// Probability arrays of finished decoders are reused by later calls.
	test("interleaved properties and a failed decode in between", () => {
		const input = new TextEncoder().encode("decoder reuse ".repeat(50));
		const variants = [{ lc: 3, lp: 0 }, { lc: 0, lp: 2 }, { lc: 4, lp: 0 }].map((o) => compress(input, o));
		const corrupted = variants[0].slice();
		corrupted[20] ^= 0xFF;

		for (let round = 0; round < 3; round++) {
			for (const compressed of variants) {
				expect(decompress(compressed)).toEqual(input);
			}
			try {
				decompress(corrupted);
			} catch {
				// Expected to fail; the next calls must not be affected.
			}
		}
	});
});
