import assert from "node:assert";
import {
	describe,
	test,
} from "node:test";

import {
	compress,
	decompress,
} from "./lzma.js";

function bytesToHex(byteArray: Int8Array | Uint8Array): string {
	return Array
		.from(byteArray, (byte) => {
			return ("0" + (byte & 0xFF).toString(16)).slice(-2);
		})
		.join(" ");
}

describe("Levels", () => {
	test("compress and decompress", () => {
		const input = "Hello, World!";
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);

		assert.equal(decompressed, input);
	});

	test("compress long string", () => {
		const input = "a".repeat(1000);
		const compressed = compress(input, 1);
		const decompressed = decompress(compressed);

		assert.equal(decompressed, input);
	});

	test("Level 1.", () => {
		assert.equal(
			bytesToHex(compress("Level 1", 1)),
			"5d 00 00 01 00 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 76 60 4a ff ff ff 59 d8 00 00",
		);
	});

	test("Level 2.", () => {
		assert.equal(
			bytesToHex(compress("Level 2", 2)),
			"5d 00 00 10 00 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 79 0e 6a ff ff ff 59 d8 00 00",
		);
	});

	test("Level 3.", () => {
		assert.equal(
			bytesToHex(compress("Level 3", 3)),
			"5d 00 00 08 00 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 7b bc 8a ff ff ff 59 d8 00 00",
		);
	});

	test("Level 4.", () => {
		assert.equal(
			bytesToHex(compress("Level 4", 4)),
			"5d 00 00 10 00 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 7e 6a aa ff ff ff 59 d8 00 00",
		);
	});

	test("Level 5.", () => {
		assert.equal(
			bytesToHex(compress("Level 5", 5)),
			"5d 00 00 20 00 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 81 18 ca ff ff ff 59 d8 00 00",
		);
	});

	test("Level 6.", () => {
		assert.equal(
			bytesToHex(compress("Level 6", 6)),
			"5d 00 00 40 00 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 83 c6 ea ff ff ff 59 d8 00 00",
		);
	});

	test("Level 7.", () => {
		assert.equal(
			bytesToHex(compress("Level 7", 7)),
			"5d 00 00 80 00 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 86 75 0a ff ff ff 59 d8 00 00",
		);
	});

	test("Level 8.", () => {
		assert.equal(
			bytesToHex(compress("Level 8", 8)),
			"5d 00 00 00 01 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 89 23 2a ff ff ff 59 d8 00 00",
		);
	});

	test("Level 9.", () => {
		assert.equal(
			bytesToHex(compress("Level 9", 9)),
			"5d 00 00 00 02 07 00 00 00 00 00 00 00 00 26 19 4a c6 67 50 c7 8b d1 4a ff ff ff 59 d8 00 00",
		);
	});
});
