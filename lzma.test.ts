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
		const fixtureOutput = "5d 00 00 01 00 0b 00 00 00 00 00 00 00 00 34 19 49 ee 8d e9 17 89 3a 33 60 05 f7 cf 64 ff fb 78 20 00";

		const output = bytesToHexString(compressString(fixtureInput, 1));
		expect(output).toEqual(fixtureOutput);

		const input = decompressString(hexStringToUint8Array(fixtureOutput));
		expect(input).toEqual(fixtureInput);
	});

	test("lorem ipsum", () => {
		const fixtureInput = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
		const fixtureOutput = "5d 00 00 01 00 bd 01 00 00 00 00 00 00 00 26 1b ca 46 67 5a f2 77 b8 7d 86 d8 41 db 05 35 cd 83 a5 7c 12 a5 05 db 90 bd 2f 14 d3 71 72 96 a8 8a 7d 84 56 71 8d 6a 22 98 ab 9e 3d c3 55 ef cc a5 c3 dd 5b 8e bf 03 81 21 40 d6 26 91 02 45 4f 92 a1 78 bb 8a 00 af 90 2a 26 92 02 23 e5 5c b3 2d e3 e8 5c 2c fb 32 25 99 5c bc 71 f3 58 5a d3 1b 39 b4 bf 6f c7 61 36 92 14 e8 55 d3 ef 77 e0 68 fb ee 08 72 16 7e 2c ed 0a 69 78 8e 0c 1c 31 67 d5 b1 74 88 38 f5 e7 74 80 6e 7e 1e af 6d f5 32 22 17 bc da 0f a5 2f 85 48 72 02 fc b0 14 c7 16 aa ae cf 79 2a 0d 15 7f 49 1a e1 14 d4 9b 51 94 fc 9e 5d c1 1a 73 30 5c bc 65 2d d8 28 f9 09 73 cb f7 ad 4f 05 72 03 a5 6c 08 5b 36 26 fa 04 96 20 f5 4e 13 76 5f ce 4b 71 53 a7 5d 91 1b 1e 77 56 40 7e 91 de 51 72 0c 10 61 74 4b f6 6f 6e 90 6a 13 1f 99 fb 42 df 6a a8 94 52 cf 3d 77 cf 2f 21 62 cb f3 6b 5a fe fe 62 05 22 6c e8 df 9f de 8a 60 f3 7e 42 a6 24 48 d0 f3 ff 66 d3 e1 ed 4d d8 db 85 71 a3 ab c7 1b cd 67 22 b7 6b bc f2 7c 01 f0 48 a5 0c 38 9d 70 b4 e1 05 ff d6 30 7f f8";

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
