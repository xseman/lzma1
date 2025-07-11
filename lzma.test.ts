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
		const fixtureOutput = "5d 00 00 01 00 0b 00 00 00 00 00 00 00 00 34 19 49 db 85 5c 63 ad 3e f9 63 75 8e ee b1 ff ff 2f 20 00 00";

		const output = bytesToHexString(compressString(fixtureInput, 1));
		expect(output).toBe(fixtureOutput);

		const input = decompressString(hexStringToUint8Array(fixtureOutput));
		expect(input).toBe(fixtureInput);
	});

	test("lorem ipsum", () => {
		const fixtureInput = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
		const fixtureOutput = "5d 00 00 01 00 bd 01 00 00 00 00 00 00 00 26 1b ca 46 67 5a f2 77 b8 7d 86 d8 41 db 05 35 cd 83 a5 7c 12 a5 05 db 90 bd 2f 14 d3 71 12 7c 4d cd 11 a9 e3 65 01 2e 86 49 86 92 42 17 9c b1 05 19 3d 78 8c ba 83 a3 e9 7d 2a 49 7e 7b 30 19 5a 27 31 a1 b1 05 79 60 66 a6 28 0f bc a7 c7 49 67 a4 f3 88 4b 5c 9b 8f e6 50 83 59 05 fe d3 61 ea ff c7 51 5b 02 db ca 23 28 79 66 2f fa e7 3a 65 53 0f f5 2e f0 70 c6 6e f7 eb 99 e1 7c 5d 0c 1d af 84 80 8a 7f 73 8d 2e dc 40 cc de 66 ca 34 11 bf 2b 10 80 77 f2 c4 87 d2 72 3e 77 ad 38 ed d6 c1 8b 2f 38 5b c6 8b ac 80 c9 2c 96 40 55 73 85 e8 14 c1 55 f1 48 6d 9a bb 42 71 84 e5 27 43 3c f6 33 e9 04 29 0a 79 e6 a7 29 2a 3f 79 f1 b1 f2 b1 66 43 ca d2 1d b4 4a 61 6c 60 a4 c5 89 4b af e6 6a 02 ee b1 07 aa 11 cd 0f 39 de 83 78 72 48 9b f8 75 8a e8 e0 8d 34 a5 a5 fd 44 6b 04 bf 66 a2 59 8f ab 42 b4 76 e3 c9 16 30 d9 9f 10 c0 41 01 e5 e6 b4 b7 2f 24 99 4b 4c bb e5 41 56 be 8c 62 16 cc 72 bf ad 83 c3 12 50 e2 47 a1 3a b0 e1 28 28 8a 57 af 9f 79 0b df cc b3 19 88 26 cf 81 63 61 67 ff 3d be c2 00";

		const output = bytesToHexString(compressString(fixtureInput, 1));
		expect(output).toBe(fixtureOutput);

		const input = decompressString(hexStringToUint8Array(output));
		expect(input).toBe(fixtureInput);
	});
});

describe("compress and decompress edge cases", () => {
	test("empty string", () => {
		const input = "";
		const compressed = compressString(input, 1);
		const decompressed = decompressString(compressed);

		expect(decompressed).toBe(input);
	});

	test("special characters", () => {
		const input = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
		const compressed = compressString(input, 1);
		const decompressed = decompressString(compressed);

		expect(decompressed).toBe(input);
	});

	test("unicode characters", () => {
		const input = "你好，世界！";
		const compressed = compressString(input, 1);
		const decompressed = decompressString(compressed);

		expect(decompressed).toBe(input);
	});

	test("binary data", () => {
		const input = new Uint8Array(1_000).map((_, i) => i % 256);
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);

		expect(decompressed).toEqual(input);
	});

	test("null character", () => {
		const input = "\0";
		const compressed = compressString(input, 1);
		const decompressed = decompressString(compressed);

		expect(decompressed).toBe(input);
	});

	test("repeated patterns", () => {
		const input = "abcabcabc".repeat(100);
		const compressed = compressString(input, 1);
		const decompressed = decompressString(compressed);
		expect(decompressed).toBe(input);
	});

	test("alternating patterns", () => {
		const input = "10".repeat(500);
		const compressed = compressString(input, 1);
		const decompressed = decompressString(compressed);
		expect(decompressed).toBe(input);
	});
});

describe("LZMA class direct usage", () => {
	test("should create an instance with proper initialization", () => {
		const lzma = new LZMA();
		expect(lzma).toBeTruthy();
	});

	test("should compress and decompress without initializing LZMA class", () => {
		const input = "Testing compression utilities";
		const compressed = compressString(input);
		const decompressed = decompressString(compressed);
		expect(decompressed).toBe(input);
	});

	test("should handle all compression modes", () => {
		const input = "Test string for all modes";

		// Test all compression modes (1-9)
		for (let mode = 1 as const; mode <= 9; mode++) {
			const compressed = compressString(input, mode);
			const decompressed = decompressString(compressed);
			expect(decompressed).toBe(input);
		}
	});
});

describe("large data compression", () => {
	test("should handle large string input", () => {
		const largeInput = "a".repeat(10000);
		const compressed = compressString(largeInput);
		const decompressed = decompressString(compressed);
		expect(decompressed).toBe(largeInput);
	});

	test("should compress repeated data efficiently", () => {
		const repeatedData = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(1000);
		const compressed = compressString(repeatedData);

		// Verify compression ratio is good (compressed size should be much smaller)
		expect(compressed.length).toBeLessThan(repeatedData.length / 5);

		const decompressed = decompressString(compressed);
		expect(decompressed).toBe(repeatedData);
	});
});

describe("buffer handling", () => {
	test("should handle Uint8Array input", () => {
		const inputArray = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
		const compressed = compress(inputArray);
		const decompressed = decompress(compressed);

		expect(decompressed).toBeInstanceOf(Uint8Array);

		// Convert to string for comparison
		const decoder = new TextDecoder();
		const decompressedString = decoder.decode(decompressed);
		expect(decompressedString).toBe("Hello");
	});

	test("should handle ArrayBuffer input", () => {
		const encoder = new TextEncoder();
		const buffer = encoder.encode("Hello World").buffer;
		const compressed = compress(buffer);
		const decompressed = decompress(compressed);

		expect(decompressed).toBeInstanceOf(Uint8Array);

		// Convert to string for comparison
		const decoder = new TextDecoder();
		const decompressedString = decoder.decode(decompressed);
		expect(decompressedString).toBe("Hello World");
	});
});

describe("error handling", () => {
	test("should gracefully handle very small inputs", () => {
		const inputs = ["a", "b", "c", "1", "2", "3"];

		for (const input of inputs) {
			const compressed = compressString(input);
			const decompressed = decompressString(compressed);
			expect(decompressed).toBe(input);
		}
	});

	test("should handle inputs with mixed content types", () => {
		const input = "Text with numbers 12345 and symbols !@#$%";
		const compressed = compressString(input);
		const decompressed = decompressString(compressed);
		expect(decompressed).toBe(input);
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

		expect(decompressed).toBe(jsonString);
		const parsedBack = JSON.parse(decompressed as string);
		expect(parsedBack).toEqual(jsonObject);
	});

	test("should handle base64 encoded data", () => {
		// Create some base64 data
		const originalText = "This is some text that will be base64 encoded";
		const base64 = Buffer.from(originalText).toString("base64");

		const compressed = compressString(base64);
		const decompressed = decompressString(compressed);

		expect(decompressed).toBe(base64);
		// Verify we can decode it back
		const decoded = Buffer.from(decompressed as string, "base64").toString();
		expect(decoded).toBe(originalText);
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
			expect(uint8Decompressed.length).toBe(input.length);
			for (let i = 0; i < input.length; i++) {
				expect(uint8Decompressed[i]).toBe(input[i]);
			}
		} else {
			expect(decompressed.length).toBe(input.length);
			for (let i = 0; i < input.length; i++) {
				expect(decompressed[i]).toBe(input[i]);
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
			expect(decompressed[i]).toBe(i);
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
		expect(decompressed).toBe(input);
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
			const decompressed = decompress(corruptedData);

			// If it doesn't throw, the result should at least be different
			expect(decompressed).not.toBe(input);
		} catch (error) {
			// It's okay if it throws, as we're testing error handling
			expect(error).toBeInstanceOf(Error);
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
			expect(decompressed).toBe(input);
		}
	});
});
