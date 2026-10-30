import {
	describe,
	expect,
	test,
} from "bun:test";

import { AloneEncoder } from "./alone-encoder.js";
import { HEADER_SIZE } from "./header.js";
import {
	compress,
	compressAsync,
	compressString,
	CRC32_TABLE,
	decompress,
	decompressAsync,
	decompressRawLzma1,
	decompressRawLzma1Async,
	decompressString,
	MemoryLimitError,
	OutputLimitError,
} from "./index.js";
import { LZMA } from "./lzma.js";
import {
	type CompressAsyncOptions,
	type CompressionMode,
	type CompressionOptions,
	type DecompressAsyncOptions,
	type DecompressionOptions,
	type ProgressEventArgs,
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

describe("default output is identical to v0.4.0", () => {
	let seed = 3;
	const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24;
	const golden: [string, Uint8Array, string][] = [
		["empty", new Uint8Array(0), "5d 00 10 00 00 00 00 00 00 00 00 00 00 00 83 ff fb ff ff c0 00 00 00"],
		["one byte", new Uint8Array([42]), "5d 00 10 00 00 01 00 00 00 00 00 00 00 00 15 41 fb ff ff ff e0 00 00 00"],
		[
			"text",
			new TextEncoder().encode("It was the best of times, it was the worst of times."),
			"5d 00 10 00 00 34 00 00 00 00 00 00 00 00 24 9d 00 07 73 43 85 19 c1 bc 61 9e 16 43 3f 49 a5 27 15 b4 f5 10 18 54 bf cd 91 38 3b 33 8b 52 7c 83 66 3c 94 be ff ff fe 04 b0 00",
		],
		[
			"random",
			Uint8Array.from({ length: 48 }, () => random()),
			"5d 00 10 00 00 30 00 00 00 00 00 00 00 00 62 86 c8 60 42 0b 5c 85 3e f9 3e 2d 70 ed ea 3a 57 aa e4 2a 8e 95 30 fd 30 df 6f 3f d4 75 1a 36 7f c7 ee 5c 1c 24 20 e7 68 b3 ed 52 8c 64 42 af 20 47 5b a7 4d fb 32 c3 ff ff 37 84 00 00",
		],
	];

	test.each(golden)("%s", (_, input, hex) => {
		const expected = fromHex(hex);

		const byDefault = compress(input);
		const withMarker = compress(input, { endMarker: true });

		expect(byDefault).toEqual(expected);
		expect(withMarker).toEqual(expected);
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

	test("level as a string, like v0.3.0", () => {
		expect(compress(input, "9" as never)).toEqual(compress(input, 9));
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
		{ level: "constructor" },
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
		{ endMarker: "no" },
		{ endMarker: 0 },
	])("rejects %o", (options) => {
		expect(() => compress(input, options as never)).toThrow(RangeError);
	});
});

describe("endMarker: false", () => {
	const input = new TextEncoder().encode("PAY by square: 1234.56 EUR to SK3112000000198742637541, variable symbol 123456. ".repeat(3));
	const text = new TextDecoder().decode(input);

	test("omits the end marker", () => {
		const withMarker = compress(input);

		const withoutMarker = compress(input, { endMarker: false });

		expect(withoutMarker.subarray(0, 13)).toEqual(withMarker.subarray(0, 13));
		expect(withoutMarker.length).toBeLessThan(withMarker.length);
		expect(decompress(withoutMarker)).toEqual(input);
	});

	test("empty input has size 0 in the header and decodes to nothing", () => {
		const compressed = compress(new Uint8Array(0), { endMarker: false });

		const output = decompress(compressed);

		expect(compressed.subarray(5, 13)).toEqual(new Uint8Array(8));
		expect(output).toEqual(new Uint8Array(0));
	});

	test("compressString and the LZMA class give the same output as compress", () => {
		const expected = compress(input, { endMarker: false });

		const fromString = compressString(text, { endMarker: false });
		const fromClass = new LZMA().compressString(text, { endMarker: false });

		expect(fromString).toEqual(expected);
		expect(new Uint8Array(fromClass.buffer, fromClass.byteOffset, fromClass.byteLength)).toEqual(expected);
		expect(decompressString(fromString)).toBe(text);
		expect(new LZMA().decompressString(fromClass)).toBe(text);
	});

	test("truncated data throws", () => {
		const compressed = compress(input, { endMarker: false });

		const truncated = compressed.subarray(0, compressed.length >> 1);

		expect(() => decompress(truncated)).toThrow("Truncated input");
	});

	test("AloneEncoder without a size rejects it", () => {
		const options = resolveOptions({ endMarker: false });

		const create = () => new AloneEncoder(options);

		expect(create).toThrow(RangeError);
		expect(create).toThrow("the end marker is required when the size is unknown");
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

describe("end of the stream", () => {
	// Distinct bytes at the end are literals, so a declared size one byte
	// short ends between two symbols.
	const text = new TextEncoder().encode("The range coder has to finish at the declared size. ".repeat(20));
	const input = new Uint8Array([...text, ...Array.from({ length: 16 }, (_, i) => 0xF0 + i)]);
	const withMarker = compress(input);
	const withoutMarker = compress(input, { endMarker: false });
	const forms = [["with", withMarker], ["without", withoutMarker]] as const;

	test.each(forms)("accepts a known size %s an end marker", (_, compressed) => {
		const output = decompress(compressed);

		expect(output).toEqual(input);
	});

	test.each(forms)("rejects a declared size smaller than the data %s an end marker", (_, compressed) => {
		const bad = compressed.slice();
		new DataView(bad.buffer).setUint32(5, input.length - 1, true);

		expect(() => decompress(bad)).toThrow("Corrupted input: data exceeds the declared size");
	});

	test("rejects an end marker cut short after the declared size", () => {
		const truncated = withMarker.subarray(0, withMarker.length - 1);

		expect(() => decompress(truncated)).toThrow("Truncated input");
	});

	test("rejects a corrupted last byte", () => {
		const bad = withoutMarker.slice();
		bad[bad.length - 1] ^= 0x01;

		expect(() => decompress(bad)).toThrow();
	});

	test("rejects a declared size of 0 without the range coder bytes", () => {
		const headerOnly = compress(new Uint8Array(0)).subarray(0, 13);

		expect(() => decompress(headerOnly)).toThrow("Truncated input");
	});

	test("rejects data after a declared size of 0", () => {
		const bad = withoutMarker.slice();
		new DataView(bad.buffer).setUint32(5, 0, true);

		expect(() => decompress(bad)).toThrow("Corrupted input: data exceeds the declared size");
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

	test("alternating endMarker on the same input matches new encoders", () => {
		const input = new TextEncoder().encode("pooled encoder, pooled encoder, pooled encoder");
		const fresh = (endMarker: boolean) => {
			const encoder = new AloneEncoder(resolveOptions({ endMarker }), input.length);
			encoder.write(input);
			return encoder.finish();
		};
		const [withMarker, withoutMarker] = [fresh(true), fresh(false)];
		const sequence = [true, false, true, false, false, true, true, false];

		const outputs = sequence.map((endMarker) => compress(input, { endMarker }));

		expect(outputs).toEqual(sequence.map((endMarker) => (endMarker ? withMarker : withoutMarker)));
		expect(withoutMarker.length).toBeLessThan(withMarker.length);
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

describe("strict", () => {
	const input = new TextEncoder().encode("An end marker before the declared size ends the data. ".repeat(10));
	const compressed = compress(input);
	const tooLarge = compressed.slice();
	new DataView(tooLarge.buffer).setUint32(5, input.length + 100, true);
	const unknownSize = compressed.slice();
	unknownSize.fill(0xFF, 5, 13);

	test("rejects an end marker before the declared size", () => {
		expect(() => decompress(tooLarge, { strict: true })).toThrow("Corrupted input: end marker before the declared size");
	});

	test("accepts that marker without strict", () => {
		const output = decompress(tooLarge);

		expect(output).toEqual(input);
	});

	test.each([
		["an end marker at the declared size", compressed],
		["a known size without an end marker", compress(input, { endMarker: false })],
		["an unknown size", unknownSize],
	])("accepts %s", (_, data) => {
		const output = decompress(data, { strict: true });

		expect(output).toEqual(input);
	});

	test("applies to decompressString", () => {
		expect(() => decompressString(tooLarge, { strict: true })).toThrow("end marker before the declared size");
	});

	test.each([1, "yes"])("rejects strict: %p", (strict) => {
		expect(() => decompress(compressed, { strict } as never)).toThrow(RangeError);
	});
});

describe("maxOutputLength", () => {
	const input = new TextEncoder().encode("A few bytes of compressed data can expand to gigabytes. ".repeat(20));
	const compressed = compress(input);
	const unknownSize = compressed.slice();
	unknownSize.fill(0xFF, 5, 13);

	// 16 MiB of zeros compress to a few KiB. The 4 GiB dictionary size keeps
	// the dictionary from stopping the decoder before the limit does.
	const knownSizeBomb = compress(new Uint8Array(16 << 20), 1);
	new DataView(knownSizeBomb.buffer).setUint32(1, 0xFFFFFFFF, true);
	const unknownSizeBomb = knownSizeBomb.slice().fill(0xFF, 5, 13);

	/** Calls `decode()` and returns the error that it threw, or `undefined` if it didn't throw. */
	const thrownBy = (decode: () => unknown) => {
		try {
			decode();
		} catch (error) {
			return error;
		}

		return undefined;
	};

	test.each([
		["a known size with an end marker", compressed],
		["a known size without an end marker", compress(input, { endMarker: false })],
		["an unknown size", unknownSize],
	])("accepts output of exactly the limit for %s", (_, data) => {
		const output = decompress(data, { maxOutputLength: input.length });

		expect(output).toEqual(input);
	});

	test.each([false, true])("rejects a declared size over the limit with strict: %p", (strict) => {
		const error = thrownBy(() => decompress(compressed, { strict, maxOutputLength: input.length - 1 }));

		expect(error).toBeInstanceOf(OutputLimitError);
		expect(error).toMatchObject({ name: "OutputLimitError", declaredSize: input.length, maxOutputLength: input.length - 1 });
		expect((error as Error).message).toBe(`${input.length} bytes of output declared; limit was ${input.length - 1} bytes`);
	});

	test("rejects an unknown size once the output exceeds the limit", () => {
		const error = thrownBy(() => decompress(unknownSize, { maxOutputLength: input.length - 1 }));

		expect(error).toBeInstanceOf(OutputLimitError);
		expect(error).toMatchObject({ declaredSize: undefined, maxOutputLength: input.length - 1 });
		expect((error as Error).message).toBe(`Output exceeds the limit of ${input.length - 1} bytes`);
	});

	test.each([
		["an unknown size", unknownSizeBomb],
		["a known size over the limit, without strict", knownSizeBomb],
	])("stops a small input that expands far past the limit, with %s", async (_, bomb) => {
		let calls = 0;

		const run = () => decompress(bomb, { maxOutputLength: 1 << 20 });
		const result = decompressAsync(bomb, {
			maxOutputLength: 1 << 20,
			onProgressAsync: () => {
				calls++;
			},
		});

		expect(bomb.length).toBeLessThan(5000);
		expect(run).toThrow(OutputLimitError);
		await expect(result).rejects.toBeInstanceOf(OutputLimitError);
		// The pauses don't flush the dictionary, so the count shows how far
		// decoding got before the error: 4 calls for 1 MiB of output, but
		// 64 for all 16 MiB if the dictionary weren't capped at the limit.
		expect(calls).toBeLessThan(16);
	});

	test("accepts a limit of 0 for empty output and rejects one byte", () => {
		const empty = decompress(compress(new Uint8Array(0)).fill(0xFF, 5, 13), { maxOutputLength: 0 });
		const oneByte = () => decompress(compress(new Uint8Array(1)).fill(0xFF, 5, 13), { maxOutputLength: 0 });

		expect(empty).toEqual(new Uint8Array(0));
		expect(oneByte).toThrow(OutputLimitError);
	});

	test("counts UTF-8 bytes in decompressString", () => {
		const text = "é".repeat(10);
		const packed = compressString(text);

		const atLimit = decompressString(packed, { maxOutputLength: 20 });
		const overLimit = () => decompressString(packed, { maxOutputLength: 19 });

		expect(atLimit).toBe(text);
		expect(overLimit).toThrow(OutputLimitError);
	});

	test("applies to decompressAsync", async () => {
		const options = { maxOutputLength: input.length - 1, onProgressAsync: yieldToTimer };

		const declared = await decompressAsync(compressed, options).catch((reason: unknown) => reason);
		const unknown = await decompressAsync(unknownSize, options).catch((reason: unknown) => reason);

		expect(declared).toMatchObject({ name: "OutputLimitError", declaredSize: input.length });
		expect(unknown).toMatchObject({ name: "OutputLimitError", declaredSize: undefined });
	});

	test("rejects a declared size after the first progress call with strict, like other errors in the header", async () => {
		const progress: number[] = [];

		const result = decompressAsync(compressed, {
			strict: true,
			maxOutputLength: input.length - 1,
			onProgressAsync: ({ progress: value }) => {
				progress.push(value);
			},
		});

		await expect(result).rejects.toBeInstanceOf(OutputLimitError);
		expect(progress).toEqual([0]);
	});

	test("leaves later calls unaffected", () => {
		const rejected = thrownBy(() => decompress(unknownSize, { maxOutputLength: 10 }));

		const output = decompress(unknownSize);

		expect(rejected).toBeInstanceOf(OutputLimitError);
		expect(output).toEqual(input);
	});

	test.each([-1, 1.5, NaN, Infinity, "100"])("rejects maxOutputLength: %p", (maxOutputLength) => {
		expect(() => decompress(compressed, { maxOutputLength } as never)).toThrow(RangeError);
	});

	describe("raw LZMA1", () => {
		const properties = { lc: 3, lp: 0, pb: 2, dictSize: 1 << 16 };
		const withMarker = compressed.subarray(13);

		test("rejects a given size over the limit before the first progress call, like the memory limit", async () => {
			const options = { ...properties, uncompressedSize: input.length, maxOutputLength: input.length - 1 };
			let calls = 0;

			const error = thrownBy(() => decompressRawLzma1(withMarker, options));
			const result = decompressRawLzma1Async(withMarker, {
				...options,
				onProgressAsync: () => {
					calls++;
				},
			});

			expect(error).toMatchObject({ declaredSize: input.length, maxOutputLength: input.length - 1 });
			await expect(result).rejects.toBeInstanceOf(OutputLimitError);
			expect(calls).toBe(0);
		});

		test("validates maxOutputLength before checking the memory limit", () => {
			const run = () => decompressRawLzma1(withMarker, { ...properties, dictSize: 0xFFFFFFFF, memoryLimitKb: 1, maxOutputLength: -1 });

			expect(run).toThrow(RangeError);
		});

		test("rejects an unknown size once the output exceeds the limit", () => {
			const atLimit = decompressRawLzma1(withMarker, { ...properties, maxOutputLength: input.length });
			const overLimit = () => decompressRawLzma1(withMarker, { ...properties, maxOutputLength: input.length - 1 });

			expect(atLimit).toEqual(input);
			expect(overLimit).toThrow("Output exceeds the limit");
		});
	});
});

describe("decompressRawLzma1", () => {
	const input = new TextEncoder().encode("raw LZMA1 data has no header; 7z keeps its properties. ".repeat(40));
	const properties = { lc: 3, lp: 0, pb: 2, dictSize: 1 << 16 };
	const withMarker = compress(input).subarray(13);
	const withoutMarker = compress(input, { endMarker: false }).subarray(13);

	test("decodes data with an end marker when the size is unknown", () => {
		const output = decompressRawLzma1(withMarker, properties);

		expect(output).toEqual(input);
	});

	test("decodes data without an end marker given its size", () => {
		const output = decompressRawLzma1(withoutMarker, { ...properties, uncompressedSize: input.length });

		expect(output).toEqual(input);
	});

	test("accepts an end marker after the given size", () => {
		const output = decompressRawLzma1(withMarker, { ...properties, uncompressedSize: input.length });

		expect(output).toEqual(input);
	});

	test("decodes like decompress with the properties of the header", () => {
		const lzma = compress(input, { lc: 1, lp: 3, pb: 4, dictSize: 4096 });
		const header = new DataView(lzma.buffer, lzma.byteOffset, 13);

		const output = decompressRawLzma1(lzma.subarray(13), { lc: 1, lp: 3, pb: 4, dictSize: header.getUint32(1, true) });

		expect(lzma[0]).toBe((4 * 5 + 3) * 9 + 1);
		expect(output).toEqual(decompress(lzma));
	});

	test("decodes lc + lp > 4, which 7-Zip writes", () => {
		const encoder = new AloneEncoder({ ...resolveOptions(5), lc: 8, lp: 4 }, input.length);
		encoder.write(input);
		const packed = encoder.finish().subarray(13);

		const output = decompressRawLzma1(packed, { ...properties, lc: 8, lp: 4 });

		expect(output).toEqual(input);
	});

	test("decodes a size of 0 from the range coder bytes", () => {
		const packed = compress(new Uint8Array(0), { endMarker: false }).subarray(13);

		const output = decompressRawLzma1(packed, { ...properties, uncompressedSize: 0 });

		expect(packed.length).toBe(5);
		expect(output).toEqual(new Uint8Array(0));
	});

	test("rejects a size of 0 without the range coder bytes", () => {
		const run = () => decompressRawLzma1(new Uint8Array(0), { ...properties, uncompressedSize: 0 });

		expect(run).toThrow("Truncated input");
	});

	test("rejects data without an end marker when the size is unknown", () => {
		const run = () => decompressRawLzma1(withoutMarker, properties);

		expect(run).toThrow("Truncated input");
	});

	test("rejects truncated data", () => {
		for (const cut of [0, 4, 5, 20, withMarker.length >> 1, withMarker.length - 1]) {
			expect(() => decompressRawLzma1(withMarker.subarray(0, cut), properties)).toThrow("Truncated input");
		}
	});

	test("rejects a size larger than the data without an end marker", () => {
		const run = () => decompressRawLzma1(withoutMarker, { ...properties, uncompressedSize: input.length + 1 });

		expect(run).toThrow("Truncated input");
	});

	test("rejects an end marker before the given size", () => {
		const run = () => decompressRawLzma1(withMarker, { ...properties, uncompressedSize: input.length + 1 });

		expect(run).toThrow("Corrupted input: end marker before the declared size");
	});

	test("rejects data after the given size", () => {
		const run = () => decompressRawLzma1(withoutMarker, { ...properties, uncompressedSize: input.length - 100 });

		expect(run).toThrow("Corrupted input: data exceeds the declared size");
	});

	test("rejects a dictionary over the memory limit", () => {
		let error: unknown;

		try {
			decompressRawLzma1(withMarker, { ...properties, dictSize: 1 << 30, memoryLimitKb: 1 << 20 });
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(MemoryLimitError);
		expect(error).toMatchObject({ name: "MemoryLimitError", memoryNeededKb: 10 + (1 << 20) + 12, memoryLimitKb: 1 << 20 });
	});

	test("counts the probabilities of lc and lp against the memory limit", () => {
		const run = () => decompressRawLzma1(withMarker, { ...properties, lc: 8, lp: 4, dictSize: 0, memoryLimitKb: 6000 });

		expect(run).toThrow("6158 KiB of memory would be needed; limit was 6000 KiB");
	});

	test("checks the memory limit against the given dictionary size, as XZ for Java does", () => {
		const options = { ...properties, dictSize: 1 << 30, uncompressedSize: input.length };

		const withinLimit = () => decompressRawLzma1(withMarker, { ...options, memoryLimitKb: 10 + (1 << 20) + 12 });
		const overLimit = () => decompressRawLzma1(withMarker, { ...options, memoryLimitKb: 10 + (1 << 20) + 11 });

		expect(withinLimit()).toEqual(input);
		expect(overLimit).toThrow(MemoryLimitError);
	});

	test("estimates the largest dictionary without overflow", () => {
		const run = () => decompressRawLzma1(withMarker, { ...properties, dictSize: 0xFFFFFFFF, memoryLimitKb: 0 });

		expect(run).toThrow(`${10 + 2 ** 22 + 12} KiB of memory would be needed`);
	});

	test.each([
		{ lc: 9 },
		{ lp: 5 },
		{ pb: 5 },
		{ lc: -1 },
		{ dictSize: -1 },
		{ dictSize: 2 ** 32 },
		{ dictSize: undefined },
		{ uncompressedSize: -1 },
		{ uncompressedSize: 1.5 },
		{ memoryLimitKb: -1 },
		{ memoryLimitKb: "1024" },
	])("rejects %o", (options) => {
		const run = () => decompressRawLzma1(withMarker, { ...properties, ...options } as never);

		expect(run).toThrow(RangeError);
	});
});

/** Compressible input with some incompressible stretches. */
const sample = (length: number) => Uint8Array.from({ length }, (_, i) => ((i >> 10) % 3 === 0 ? Math.imul(i, 0x9E3779B1) >>> 24 : i % 97));
const yieldToTimer = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("compressAsync", () => {
	test.each([
		...[0, 1, 16_383, 16_384, 16_385, 70_000].flatMap((length) => [1, 5].map((level) => [length, { level }])),
		// Larger than the encoder's buffer, so the window has to move.
		[300_000, { level: 1, dictSize: 4096 }],
		[300_000, { level: 5, dictSize: 4096 }],
	] as [number, CompressionOptions][])("output for %i bytes with %j equals compress", async (length, options) => {
		const data = sample(length);

		const compressed = await compressAsync(data, { ...options, onProgressAsync: yieldToTimer });

		expect(compressed).toEqual(compress(data, options));
	});

	test("without a callback, a bare level gives the output of compress", async () => {
		const data = sample(20_000);

		const compressed = await compressAsync(data, 1);

		expect(compressed).toEqual(compress(data, 1));
	});

	test("progress starts at 0, never decreases and reports 1 once, at the end", async () => {
		const progress: number[] = [];

		await compressAsync(sample(50_000), {
			onProgressAsync: (eventArgs) => {
				progress.push(eventArgs.progress);
			},
		});

		expect(progress[0]).toBe(0);
		expect([...progress].sort((a, b) => a - b)).toEqual(progress);
		expect(progress.indexOf(1)).toBe(progress.length - 1);
		expect(progress.length).toBeGreaterThan(2);
	});

	test("empty input reports progress 0, then 1", async () => {
		const progress: number[] = [];

		await compressAsync(new Uint8Array(0), {
			onProgressAsync: (eventArgs) => {
				progress.push(eventArgs.progress);
			},
		});

		expect(progress).toEqual([0, 1]);
	});

	test.each(
		[
			["first", (progress: number) => progress === 0],
			["middle", (progress: number) => progress > 0 && progress < 1],
			["last", (progress: number) => progress === 1],
		] as const,
	)("cancelling at the %s call rejects, and a later call is unaffected", async (_, isTarget) => {
		const data = sample(50_000);
		const expected = compress(data);
		const error = new Error("cancelled");
		const onProgressAsync = async ({ progress }: ProgressEventArgs) => {
			await yieldToTimer();
			if (isTarget(progress)) {
				throw error;
			}
		};

		const cancelled = await compressAsync(data, { onProgressAsync }).catch((reason: unknown) => reason);
		const again = await compressAsync(data, { onProgressAsync: yieldToTimer });

		expect(cancelled).toBe(error);
		expect(again).toEqual(expected);
	});

	test("interleaved calls with the same settings both produce the expected output", async () => {
		const first = sample(40_000);
		const second = sample(40_000).reverse();
		const expected = [compress(first), compress(second)];

		const outputs = await Promise.all([first, second].map((data) => compressAsync(data, { onProgressAsync: yieldToTimer })));

		expect(outputs).toEqual(expected);
	});

	test.each([
		["level", { level: 10 }],
		["niceLen", { niceLen: 4 }],
		["onProgressAsync string", { onProgressAsync: "not a function" }],
		["onProgressAsync symbol", { onProgressAsync: Symbol("not a function") }],
	])("invalid %s rejects instead of throwing", async (_, options) => {
		const result = compressAsync(new Uint8Array(10), options as unknown as CompressAsyncOptions);

		await expect(result).rejects.toBeInstanceOf(RangeError);
	});
});

describe("async decompression", () => {
	/** `compress` output with the size field set to unknown, which the end marker then terminates. */
	const withUnknownSize = (compressed: Uint8Array) => {
		const copy = compressed.slice();
		copy.fill(0xFF, HEADER_SIZE - 8, HEADER_SIZE);
		return copy;
	};

	test.each([
		["a small input", compress(sample(1000), 1), {}],
		["a known size with an end marker", compress(sample(600_000), 1), {}],
		["a known size without one, strict", compress(sample(600_000), { level: 1, endMarker: false }), { strict: true }],
		["an unknown size", withUnknownSize(compress(sample(600_000), 1)), {}],
		// A multiple of the 256 KiB pause, where the last pause is the end, and one byte more.
		["524,288 bytes", compress(sample(524_288), { level: 1, endMarker: false }), { strict: true }],
		["524,289 bytes", compress(sample(524_289), { level: 1, endMarker: false }), { strict: true }],
	] as [string, Uint8Array, DecompressionOptions][])("output for %s equals decompress", async (_, compressed, options) => {
		const decompressed = await decompressAsync(compressed, { ...options, onProgressAsync: yieldToTimer });

		expect(decompressed).toEqual(decompress(compressed, options));
	});

	test("decompressRawLzma1Async gives the output of decompressRawLzma1", async () => {
		const data = sample(600_000);
		const raw = compress(data, { level: 1, endMarker: false }).subarray(HEADER_SIZE);
		const options = { lc: 3, lp: 0, pb: 2, dictSize: data.length, uncompressedSize: data.length };

		const decompressed = await decompressRawLzma1Async(raw, { ...options, onProgressAsync: yieldToTimer });

		expect(decompressed).toEqual(decompressRawLzma1(raw, options));
	});

	test("progress starts at 0, never decreases and reports 1 once, at the end", async () => {
		const compressed = compress(sample(600_000), 1);
		const progress: number[] = [];

		await decompressAsync(compressed, {
			onProgressAsync: (eventArgs) => {
				progress.push(eventArgs.progress);
			},
		});

		expect(progress[0]).toBe(0);
		expect([...progress].sort((a, b) => a - b)).toEqual(progress);
		expect(progress.indexOf(1)).toBe(progress.length - 1);
		expect(progress.length).toBeGreaterThan(2);
	});

	test.each(
		[
			["first", (progress: number) => progress === 0],
			["middle", (progress: number) => progress > 0 && progress < 1],
			["last", (progress: number) => progress === 1],
		] as const,
	)("cancelling at the %s call rejects, and a later call is unaffected", async (_, isTarget) => {
		const compressed = compress(sample(600_000), 1);
		const expected = decompress(compressed);
		const error = new Error("cancelled");
		const onProgressAsync = async ({ progress }: ProgressEventArgs) => {
			await yieldToTimer();
			if (isTarget(progress)) {
				throw error;
			}
		};

		const cancelled = await decompressAsync(compressed, { onProgressAsync }).catch((reason: unknown) => reason);
		const again = await decompressAsync(compressed, { onProgressAsync: yieldToTimer });

		expect(cancelled).toBe(error);
		expect(again).toEqual(expected);
	});

	test("interleaved calls both produce the expected output", async () => {
		const first = compress(sample(600_000), 1);
		const second = compress(sample(600_000).reverse(), 1);
		const expected = [decompress(first), decompress(second)];

		const outputs = await Promise.all([first, second].map((compressed) => decompressAsync(compressed, { onProgressAsync: yieldToTimer })));

		expect(outputs).toEqual(expected);
	});

	test("truncated input rejects with the error of decompress", async () => {
		const compressed = compress(sample(600_000), 1);
		const truncated = compressed.subarray(0, compressed.length - 100);

		const rejection = await decompressAsync(truncated, { onProgressAsync: yieldToTimer }).catch((reason: unknown) => reason);

		expect(rejection).toBeInstanceOf(Error);
		expect(() => decompress(truncated)).toThrow((rejection as Error).message);
	});

	test("a non-function onProgressAsync rejects with a RangeError", async () => {
		const result = decompressAsync(compress(sample(10)), { onProgressAsync: "not a function" } as unknown as DecompressAsyncOptions);

		await expect(result).rejects.toBeInstanceOf(RangeError);
	});
});
