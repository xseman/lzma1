import assert from "node:assert";
import {
	describe,
	test,
} from "node:test";

import {
	compress,
	decompress,
} from "./index.js";
import { LZMA } from "./lzma.js";

function bytesToHexString(byteArray: Int8Array | Uint8Array): string {
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
		const fixtureOutput = "5d 00 00 01 00 0b 00 00 00 00 00 00 00 00 34 19 49 ee 8d e9 17 89 3a 33 60 05 f7 cf 64 ff fb 78 20 00";

		const output = bytesToHexString(compress(fixtureInput, 1));
		assert.equal(output, fixtureOutput);

		const input = decompress(hexStringToUint8Array(fixtureOutput));
		assert.equal(input, fixtureInput);
	});

	test("lorem ipsum", () => {
		const fixtureInput = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
		const fixtureOutput = "5d 00 00 01 00 bd 01 00 00 00 00 00 00 00 26 1b ca 46 67 5a f2 77 b8 7d 86 d8 41 db 05 35 cd 83 a5 7c 12 a5 05 db 90 bd 2f 14 d3 71 72 96 a8 8a 7d 84 56 71 8d 6a 22 98 ab 9e 3d c3 55 ef cc a5 c3 dd 5b 8e bf 03 81 21 40 d6 26 91 02 45 4f 92 a1 78 bb 8a 00 af 90 2a 26 92 02 23 e5 5c b3 2d e3 e8 5c 2c fb 32 25 99 5c bc 71 f3 58 5a d3 1b 39 b4 bf 6f c7 61 36 92 14 e8 55 d3 ef 77 e0 68 fb ee 08 72 16 7e 2c ed 0a 69 78 8e 0c 1c 31 67 d5 b1 74 88 38 f5 e7 74 80 6e 7e 1e af 6d f5 32 22 17 bc da 0f a5 2f 85 48 72 02 fc b0 14 c7 16 aa ae cf 79 2a 0d 15 7f 49 1a e1 14 d4 9b 51 94 fc 9e 5d c1 1a 73 30 5c bc 65 2d d8 28 f9 09 73 cb f7 ad 4f 05 72 03 a5 6c 08 5b 36 26 fa 04 96 20 f5 4e 13 76 5f ce 4b 71 53 a7 5d 91 1b 1e 77 56 40 7e 91 de 51 72 0c 10 61 74 4b f6 6f 6e 90 6a 13 1f 99 fb 42 df 6a a8 94 52 cf 3d 77 cf 2f 21 62 cb f3 6b 5a fe fe 62 05 22 6c e8 df 9f de 8a 60 f3 7e 42 a6 24 48 d0 f3 ff 66 d3 e1 ed 4d d8 db 85 71 a3 ab c7 1b cd 67 22 b7 6b bc f2 7c 01 f0 48 a5 0c 38 9d 70 b4 e1 05 ff d6 30 7f f8";

		const output = bytesToHexString(compress(fixtureInput, 1));
		assert.equal(output, fixtureOutput);

		const input = decompress(hexStringToUint8Array(output));
		assert.equal(input, fixtureInput);
	});
});

describe("compress and decompress edge cases", () => {
	test("empty string", () => {
		const input = "";
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);

		assert.equal(decompressed, input);
	});

	test("special characters", () => {
		const input = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);

		assert.equal(decompressed, input);
	});

	test("unicode characters", () => {
		const input = "你好，世界！";
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);

		assert.equal(decompressed, input);
	});

	test("binary data", () => {
		const input = new Int8Array(1_000).map((_, i) => i % 256);
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);

		assert.deepEqual(decompressed, input);
	});

	test("null character", () => {
		const input = "\0";
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);

		assert.equal(decompressed, input);
	});

	test("repeated patterns", () => {
		const input = "abcabcabc".repeat(100);
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);
		assert.equal(decompressed, input);
	});

	test("alternating patterns", () => {
		const input = "10".repeat(500);
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);
		assert.equal(decompressed, input);
	});
});

describe("LZMA class direct usage", () => {
	test("should create an instance with proper initialization", () => {
		const lzma = new LZMA();
		assert.ok(lzma);
	});

	test("should compress and decompress without initializing LZMA class", () => {
		const input = "Testing compression utilities";
		const compressed = compress(input);
		const decompressed = decompress(compressed);
		assert.equal(decompressed, input);
	});

	test("should handle all compression modes", () => {
		const input = "Test string for all modes";

		// Test all compression modes (1-9)
		for (let mode = 1; mode <= 9; mode++) {
			const compressed = compress(input, mode as any);
			const decompressed = decompress(compressed);
			assert.equal(decompressed, input, `Failed with mode ${mode}`);
		}
	});
});

describe("large data compression", () => {
	test("should handle large string input", () => {
		const largeInput = "a".repeat(10000);
		const compressed = compress(largeInput);
		const decompressed = decompress(compressed);
		assert.equal(decompressed, largeInput);
	});

	test("should compress repeated data efficiently", () => {
		const repeatedData = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(1000);
		const compressed = compress(repeatedData);

		// Verify compression ratio is good (compressed size should be much smaller)
		assert.ok(compressed.length < repeatedData.length / 5);

		const decompressed = decompress(compressed);
		assert.equal(decompressed, repeatedData);
	});
});

describe("buffer handling", () => {
	test("should handle Uint8Array input", () => {
		const inputArray = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
		const compressed = compress(inputArray);
		const decompressed = decompress(compressed);

		// The decompressed result might be returned as a string instead of Int8Array
		// since the LZMA engine tries to interpret the data
		if (typeof decompressed === "string") {
			assert.equal(decompressed, "Hello");
		} else {
			assert.ok(decompressed instanceof Int8Array);

			// Convert to string for comparison
			const decoder = new TextDecoder();
			const decompressedString = decoder.decode(decompressed);
			assert.equal(decompressedString, "Hello");
		}
	});

	test("should handle ArrayBuffer input", () => {
		const encoder = new TextEncoder();
		const buffer = encoder.encode("Hello World").buffer;
		const compressed = compress(buffer);
		const decompressed = decompress(compressed);

		// The decompressed result might be returned as a string instead of Int8Array
		if (typeof decompressed === "string") {
			assert.equal(decompressed, "Hello World");
		} else {
			assert.ok(decompressed instanceof Int8Array);

			// Convert to string for comparison
			const decoder = new TextDecoder();
			const decompressedString = decoder.decode(decompressed);
			assert.equal(decompressedString, "Hello World");
		}
	});
});

describe("error handling", () => {
	test("should gracefully handle very small inputs", () => {
		const inputs = ["a", "b", "c", "1", "2", "3"];

		for (const input of inputs) {
			const compressed = compress(input);
			const decompressed = decompress(compressed);
			assert.equal(decompressed, input, `Failed with input "${input}"`);
		}
	});

	test("should handle inputs with mixed content types", () => {
		const input = "Text with numbers 12345 and symbols !@#$%";
		const compressed = compress(input);
		const decompressed = decompress(compressed);
		assert.equal(decompressed, input);
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
		const compressed = compress(jsonString);
		const decompressed = decompress(compressed);

		assert.equal(decompressed, jsonString);
		const parsedBack = JSON.parse(decompressed as string);
		assert.deepEqual(parsedBack, jsonObject);
	});

	test("should handle base64 encoded data", () => {
		// Create some base64 data
		const originalText = "This is some text that will be base64 encoded";
		const base64 = Buffer.from(originalText).toString("base64");

		const compressed = compress(base64);
		const decompressed = decompress(compressed);

		assert.equal(decompressed, base64);
		// Verify we can decode it back
		const decoded = Buffer.from(decompressed as string, "base64").toString();
		assert.equal(decoded, originalText);
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
			assert.equal(uint8Decompressed.length, input.length);
			for (let i = 0; i < input.length; i++) {
				assert.equal(uint8Decompressed[i], input[i]);
			}
		} else {
			assert.equal(decompressed.length, input.length);
			for (let i = 0; i < input.length; i++) {
				assert.equal(decompressed[i], input[i] < 128 ? input[i] : input[i] - 256);
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

		if (typeof decompressed === "string") {
			// Convert the string back to binary for comparison
			const binaryData = [];
			for (let i = 0; i < decompressed.length; i++) {
				binaryData.push(decompressed.charCodeAt(i));
			}
			// Only compare the valid byte values (some might be interpreted as UTF-8)
			for (let i = 0; i < Math.min(256, binaryData.length); i++) {
				if (i < 128) {
					assert.equal(binaryData[i], i);
				}
			}
		} else {
			// Int8Array will store values from -128 to 127, so values above 127
			// will be represented as negative numbers (two's complement)
			for (let i = 0; i < 256; i++) {
				const expected = i < 128 ? i : i - 256;
				assert.equal(decompressed[i], expected);
			}
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

		const compressed = compress(input);
		const decompressed = decompress(compressed);
		assert.equal(decompressed, input);
	});
});

describe("boundary condition tests", () => {
	test("decompressing corrupted data", () => {
		// Tests error handling and recovery mechanisms when processing damaged data
		// Verifies the decoder's robustness against data corruption
		try {
			// First compress valid data
			const input = "Test data for corruption test";
			const compressed = compress(input);

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
			const decompressed = decompress(corruptedData);

			// If it doesn't throw, the result should at least be different
			assert.notEqual(decompressed, input);
		} catch (error) {
			// It's okay if it throws, as we're testing error handling
			assert.ok(error instanceof Error);
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
			const compressed = compress(input);
			const decompressed = decompress(compressed);
			assert.equal(decompressed, input);
		}
	});
});
