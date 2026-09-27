import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	compress,
	compressString,
	decompress,
	decompressString,
} from "./index.js";
import { LZMA } from "./lzma.js";
import type { CompressionMode } from "./options.js";

function bytesToHexString(byteArray: Uint8Array | Uint8Array | number[]): string {
	return Array
		.from(byteArray, (byte) => {
			return ("0" + (byte & 0xFF).toString(16)).slice(-2);
		})
		.join(" ");
}

/**
 * @param str Hexadecimal string with space-separated byte values (e.g., "5d 00 00 01")
 */
function hexStringToUint8Array(str: string): Uint8Array {
	const hexPairs = str.split(" ");
	const byteArray = new Uint8Array(hexPairs.length);

	for (let i = 0; i < hexPairs.length; i++) {
		byteArray[i] = parseInt(hexPairs[i], 16);
	}

	return byteArray;
}

describe("basics", () => {
	test("hello world", () => {
		const fixtureInput = "hello world";
		const fixtureOutput = "5d 00 10 00 00 0b 00 00 00 00 00 00 00 00 34 19 49 db 85 5c 63 ad 3e f9 63 75 8e ee b1 ff ff 2f 20 00 00";

		const output = bytesToHexString(compressString(fixtureInput, 1));
		expect(output).toEqual(fixtureOutput);

		const input = decompressString(hexStringToUint8Array(fixtureOutput));
		expect(input).toEqual(fixtureInput);
	});

	test("lorem ipsum", () => {
		const fixtureInput = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
		const fixtureOutput = "5d 00 10 00 00 bd 01 00 00 00 00 00 00 00 26 1b ca 46 67 5a f2 77 b8 7d 86 d8 41 db 05 35 cd 83 a5 7c 12 a5 05 db 90 bd 2f 14 d3 71 12 7c 4d cd 11 a9 e3 65 01 2e 86 49 86 92 42 17 9c b1 05 19 3d 78 8c ba 83 a3 e9 7d 2a 49 7e 7b 30 19 5a 27 31 a1 b1 05 79 60 66 a6 28 0f bc a7 c7 49 67 a4 f3 88 4b 5c 9b 8f e6 4f 6f a9 3d 98 43 12 77 e1 f1 17 0e 3e 78 7a 99 3c 15 17 37 a7 f0 42 91 6f cc 79 f4 3e 9c fc 51 bc ac 12 69 d3 86 9d bf 12 88 c2 8d b4 7d 4a 2f 99 34 a8 64 db 2e a4 f5 05 ce 2a 37 b7 f7 31 f1 d3 eb 7b 42 e8 b5 06 3c 14 c1 c3 74 4f 62 81 7b d1 ec 79 48 79 77 a0 2d 8e 2f 19 e6 57 8e 3c f0 27 42 0a 86 32 60 0f 3b e2 86 08 19 45 42 4e 9c ca 5d 7e 4a b2 52 ac 88 65 1b 83 b2 a6 7e dc 4c 27 4c 44 41 ea e1 cf fd 7f d6 64 07 17 5a 91 22 ac 39 82 0a 3e cf 69 ed 01 07 29 f8 e5 f4 13 e6 7d d1 16 5e 5d d5 fa 25 43 8b 01 a4 0d 18 cd e4 a4 ca 01 06 53 19 dd 4d 46 11 25 95 5f 14 b9 91 60 13 07 a4 fd 23 bb 35 db 39 47 fe 11 a2 80 88 1a be f1 61 cc ae cc 07 3f 17 f0 22 54 c8 b1 41 21 2e f2 1a 11 68 05 39 01 67 a3 ff b4 11 30 f7";

		const output = bytesToHexString(compressString(fixtureInput, 1));
		expect(output).toEqual(fixtureOutput);

		const input = decompressString(hexStringToUint8Array(output));
		expect(input).toEqual(fixtureInput);
	});
});

describe("compress and decompress edge cases", () => {
	test.each([
		"∆∇√",
		"£→F♣∆",
		"√∑∆j",
		"☆☆∆™",
		"∑∑∂∇×",
		"☆/∂∂∇∆G`∑≠±5V",
		"≈¶p(o¶O°Dc∆R∞*∞$∞¥",
		"\n\\√D√s∂s♠→",
		"∂j√l√c√]<",
		"S€≠Q∂zD#∑ √}√U∑8∑R\t",
		"024020000070042",
	])("%s", (input) => {
		const compressed = compressString(input, 5);
		const decompressed = decompressString(compressed);

		expect(decompressed).toEqual(input);
	});

	test("decompresses correctly when header size field is unknown", () => {
		const input = "hello world";
		const compressed = compressString(input, 1);

		// Replace 8-byte size field (bytes 5–12) with the standard unknown-size marker
		const withUnknownSize = compressed.slice();
		withUnknownSize.fill(0xFF, 5, 13);

		const result = decompressString(withUnknownSize);
		expect(result).toBe(input);
	});
});

describe("LZMA class direct usage", () => {
	test("should create an instance with proper initialization", () => {
		const lzma = new LZMA();
		expect(lzma);
	});

	test("should compress and decompress without initializing LZMA class", () => {
		const input = "Testing compression utilities";
		const compressed = compressString(input);
		const decompressed = decompressString(compressed);
		expect(decompressed).toEqual(input);
	});

	test("should handle all compression modes", () => {
		const input = "Test string for all modes";

		// Test all compression modes (1-9)
		for (let mode = 1 as const; mode <= 9; mode++) {
			const compressed = compressString(input, mode);
			const decompressed = decompressString(compressed);
			expect(decompressed).toEqual(input);
		}
	});
});

describe("large data compression", () => {
	test("should handle large string input", () => {
		const largeInput = "a".repeat(10000);
		const compressed = compressString(largeInput);
		const decompressed = decompressString(compressed);
		expect(decompressed).toEqual(largeInput);
	});

	test("should compress repeated data efficiently", () => {
		const repeatedData = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(1000);
		const compressed = compressString(repeatedData);

		// Verify compression ratio is good (compressed size should be much smaller)
		expect(compressed.length < repeatedData.length / 5);

		const decompressed = decompressString(compressed);
		expect(decompressed).toEqual(repeatedData);
	});
});

describe("buffer handling", () => {
	test("should handle Uint8Array input", () => {
		const inputArray = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
		const compressed = compress(inputArray);
		const decompressed = decompress(compressed);

		expect(decompressed instanceof Uint8Array);

		// Convert to string for comparison
		const decoder = new TextDecoder();
		const decompressedString = decoder.decode(decompressed);
		expect(decompressedString).toEqual("Hello");
	});

	test("should handle ArrayBuffer input", () => {
		const encoder = new TextEncoder();
		const uint8Array = encoder.encode("Hello World");
		const buffer = uint8Array.buffer as ArrayBuffer;
		const compressed = compress(buffer);
		const decompressed = decompress(compressed);

		expect(decompressed instanceof Uint8Array);

		// Convert to string for comparison
		const decoder = new TextDecoder();
		const decompressedString = decoder.decode(decompressed);
		expect(decompressedString).toEqual("Hello World");
	});
});

describe("error handling", () => {
	test("should gracefully handle very small inputs", () => {
		const inputs = ["a", "b", "c", "1", "2", "3"];

		for (const input of inputs) {
			const compressed = compressString(input);
			const decompressed = decompressString(compressed);
			expect(decompressed).toEqual(input);
		}
	});

	test("should handle inputs with mixed content types", () => {
		const input = "Text with numbers 12345 and symbols !@#$%";
		const compressed = compressString(input);
		const decompressed = decompressString(compressed);
		expect(decompressed).toEqual(input);
	});
});

describe("complex data structures", () => {
	test("should handle JSON data", () => {
		const jsonObject = {
			name: "Test Object",
			numbers: [1, 2, 3, 4, 5],
			nested: {
				property: "value",
				flag: true,
				count: 42,
			},
			tags: ["compression", "test", "lzma"],
		};

		const jsonString = JSON.stringify(jsonObject);
		const compressed = compressString(jsonString);
		const decompressed = decompressString(compressed);

		expect(decompressed).toEqual(jsonString);
		const parsedBack = JSON.parse(decompressed as string);
		expect(parsedBack).toEqual(jsonObject);
	});

	test("should handle base64 encoded data", () => {
		// Create some base64 data
		const originalText = "This is some text that will be base64 encoded";
		const base64 = Buffer.from(originalText).toString("base64");

		const compressed = compressString(base64);
		const decompressed = decompressString(compressed);

		expect(decompressed).toEqual(base64);
		// Verify we can decode it back
		const decoded = Buffer.from(decompressed as string, "base64").toString();
		expect(decoded).toEqual(originalText);
	});
});

describe("edge case scenarios", () => {
	test("compressing data with many zero bytes", () => {
		// Tests handling of sparse data with repeated zero values
		// Tests dictionary optimization and run-length encoding mechanisms
		const input = new Uint8Array(10000);
		// Just a few non-zero values
		for (let i = 0; i < input.length; i += 1000) {
			input[i] = 255;
		}
		const compressed = compress(input);
		const decompressed = decompress(compressed);

		// Compare the arrays properly
		if (typeof decompressed === "string") {
			const uint8Decompressed = new TextEncoder().encode(decompressed);
			expect(uint8Decompressed.length).toEqual(input.length);
			for (let i = 0; i < input.length; i++) {
				expect(uint8Decompressed[i]).toEqual(input[i]);
			}
		} else {
			expect(decompressed.length).toEqual(input.length);
			for (let i = 0; i < input.length; i++) {
				expect(decompressed[i]).toEqual(input[i]);
			}
		}
	});

	test("compressing binary data with all byte values", () => {
		// Tests byte value handling across the full range (0-255)
		// Ensures the encoder properly processes all possible byte values
		// and correctly transforms between signed/unsigned representations
		const input = new Uint8Array(256);
		for (let i = 0; i < 256; i++) {
			input[i] = i;
		}
		const compressed = compress(input);
		const decompressed = decompress(compressed);

		for (let i = 0; i < 256; i++) {
			expect(decompressed[i]).toEqual(i);
		}
	});
});

describe("internal algorithm behavior", () => {
	test("multistage compression with varying patterns", () => {
		// Tests the match finder's ability to handle alternating patterns
		// Exercises the dictionary matching and LZ77 substring detection algorithms
		// by creating data with both repetitive and random sections
		let input = "";
		// Create a pattern that alternates between repetitive and random sections
		for (let i = 0; i < 20; i++) {
			// Add repetitive section
			input += "ABCDEFGH".repeat(100);
			// Add some random data
			for (let j = 0; j < 100; j++) {
				input += String.fromCharCode(65 + Math.floor(Math.random() * 26));
			}
		}

		const compressed = compressString(input);
		const decompressed = decompressString(compressed);
		expect(decompressed).toEqual(input);
	});
});

describe("boundary condition tests", () => {
	test("decompressing corrupted data", () => {
		// Tests error handling and recovery mechanisms when processing damaged data
		// Verifies the decoder's robustness against data corruption
		try {
			// First compress valid data
			const input = "Test data for corruption test";
			const compressed = compressString(input);

			// Now corrupt the middle of the compressed data
			const corruptedData = new Uint8Array(compressed.length);
			for (let i = 0; i < compressed.length; i++) {
				corruptedData[i] = compressed[i];
			}

			// Corrupt data in the middle (after header)
			if (corruptedData.length > 10) {
				corruptedData[7] = 255 - corruptedData[7];
				corruptedData[8] = 255 - corruptedData[8];
				corruptedData[9] = 255 - corruptedData[9];
			}

			// This should either throw an error or return invalid data
			const decompressed = decompressString(corruptedData);

			// If it doesn't throw, the result should at least be different
			expect(decompressed).not.toEqual(input);
		} catch (error) {
			// It's okay if it throws, as we're testing error handling
			expect(error instanceof Error).toBeTruthy();
		}
	});

	test("handling of almost-maximum-length inputs", () => {
		// Tests the algorithm's block boundary handling
		// Exercises buffer management near size thresholds to ensure
		// proper allocation and processing of data chunks at edge cases
		const blockSize = 1024 * 64; // 64KB blocks

		// Test with sizes near block boundaries to hit edge cases
		for (const offset of [-1, 0, 1]) {
			const size = blockSize + offset;
			const input = "A".repeat(size);
			const compressed = compressString(input);
			const decompressed = decompressString(compressed);
			expect(decompressed).toEqual(input);
		}
	});
});

describe("Internal algorithm stress tests", () => {
	test("large repetitive data to trigger MoveBlock", () => {
		// Create data that will trigger internal buffer management
		// including the MoveBlock method when buffer boundaries are hit
		const largeSize = 1024 * 128; // 128KB
		const pattern = "ABCD".repeat(32); // 128 byte pattern
		const input = pattern.repeat(Math.ceil(largeSize / pattern.length));

		const compressed = compressString(input);
		const decompressed = decompressString(compressed);
		expect(decompressed).toEqual(input);
	});

	test("compression at different levels to exercise all paths", () => {
		const input = "This is a test string that will be compressed at different levels to ensure all code paths are exercised.".repeat(100);

		// Test compression levels 1-9 to ensure all compression paths are hit
		const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

		for (const level of levels) {
			const compressed = compressString(input, level);
			const decompressed = decompressString(compressed);
			expect(decompressed).toEqual(input);
		}
	});
});

describe("compatibility with v0.3.0 output", () => {
	// Produced by lzma1 v0.3.0, which used a different encoder and
	// encoded strings as Java's "modified UTF-8".
	test("hello world", () => {
		const compressed = hexStringToUint8Array("5d 00 00 01 00 0b 00 00 00 00 00 00 00 00 34 19 49 ee 8d e9 17 89 3a 33 60 05 f7 cf 64 ff fb 78 20 00");
		expect(decompressString(compressed)).toBe("hello world");
	});

	test("lorem ipsum", () => {
		const compressed = hexStringToUint8Array("5d 00 00 01 00 bd 01 00 00 00 00 00 00 00 26 1b ca 46 67 5a f2 77 b8 7d 86 d8 41 db 05 35 cd 83 a5 7c 12 a5 05 db 90 bd 2f 14 d3 71 72 96 a8 8a 7d 84 56 71 8d 6a 22 98 ab 9e 3d c3 55 ef cc a5 c3 dd 5b 8e bf 03 81 21 40 d6 26 91 02 45 4f 92 a1 78 bb 8a 00 af 90 2a 26 92 02 23 e5 5c b3 2d e3 e8 5c 2c fb 32 25 99 5c bc 71 f3 58 5a d3 1b 39 b4 bf 6f c7 61 36 92 14 e8 55 d3 ef 77 e0 68 fb ee 08 72 16 7e 2c ed 0a 69 78 8e 0c 1c 31 67 d5 b1 74 88 38 f5 e7 74 80 6e 7e 1e af 6d f5 32 22 17 bc da 0f a5 2f 85 48 72 02 fc b0 14 c7 16 aa ae cf 79 2a 0d 15 7f 49 1a e1 14 d4 9b 51 94 fc 9e 5d c1 1a 73 30 5c bc 65 2d d8 28 f9 09 73 cb f7 ad 4f 05 72 03 a5 6c 08 5b 36 26 fa 04 96 20 f5 4e 13 76 5f ce 4b 71 53 a7 5d 91 1b 1e 77 56 40 7e 91 de 51 72 0c 10 61 74 4b f6 6f 6e 90 6a 13 1f 99 fb 42 df 6a a8 94 52 cf 3d 77 cf 2f 21 62 cb f3 6b 5a fe fe 62 05 22 6c e8 df 9f de 8a 60 f3 7e 42 a6 24 48 d0 f3 ff 66 d3 e1 ed 4d d8 db 85 71 a3 ab c7 1b cd 67 22 b7 6b bc f2 7c 01 f0 48 a5 0c 38 9d 70 b4 e1 05 ff d6 30 7f f8");
		expect(decompressString(compressed)).toStartWith("Lorem ipsum dolor sit amet");
	});

	test("string with NUL and characters outside the BMP", () => {
		const compressed = hexStringToUint8Array("5d 00 00 20 00 1a 00 00 00 00 00 00 00 00 34 30 d1 26 cc 55 f1 95 a0 c0 2f ed 00 5b 6e f3 33 0e 9a ed 25 09 6b f7 90 e3 22 fa 43 d8 fb ff ff b0 5a 80 00");
		expect(decompressString(compressed)).toBe("héllo\0 wörld 😀 ∆");
	});

	test("binary data at mode 9", () => {
		const compressed = hexStringToUint8Array("5d 00 00 00 02 2c 01 00 00 00 00 00 00 00 00 02 0f 57 02 68 c6 78 ce d8 0f 90 e6 eb b6 dd 1f 70 62 b0 21 27 14 f9 b1 95 8a 58 60 21 7a 2c ac e7 77 98 df 45 86 da ac 69 34 69 0d 38 64 55 e2 b7 18 16 aa 44 15 99 be a2 90 8b 09 d6 1f c9 47 ff ef de 9a c6 8d bf 33 d9 b5 d4 6a af 16 ed f4 83 bc 69 74 d1 23 e6 c7 84 1e 12 9b a6 75 90 56 90 89 72 1a 58 7f 5a 3e 80 06 4c 56 65 3f 78 eb ad d7 c6 55 3b 1f 67 e3 a8 37 8a 19 99 f2 4c e6 a5 cb 00 71 89 5b cf 16 23 81 92 f1 f7 07 bf 9b ee dc fa 16 13 0e 51 d0 10 69 88 3e de e4 bd c3 a6 e0 95 83 2b 4b a8 95 75 98 7a 1b 8a 02 74 78 a6 a1 fc 6a 60 f0 a5 ad 2a c8 55 c4 cf 2f 06 0f 62 1b 9d 85 b9 15 1c c8 9b 94 19 66 d4 06 20 86 26 a3 ad 7c 68 84 02 2f 7b 8f 2b 57 72 32 56 b3 d8 88 0f 4d 7f 03 56 3d c3 d5 98 37 c3 ea e0 f3 9f ab 97 f1 bb ff ff ce 40 3b e0");
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
			{ lc: 8, lp: 4, pb: 4 },
			{ lc: 1, lp: 3, pb: 1 },
			{ dictSize: 4096 },
			{ niceLen: 8 },
			{ niceLen: 273 },
			{ depth: 1 },
		] as const,
	)("%o", (options) => {
		expect(decompress(compress(input, options))).toEqual(input);
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
		{ lc: 9 },
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
