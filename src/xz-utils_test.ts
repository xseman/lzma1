/**
 * Decodes the test files of XZ Utils, whose README in testdata/xz-utils
 * says how a decoder has to react to each one. The .lzma files test
 * `decompress`. The .xz files that test LZMA2 itself test
 * `decompressRawLzma2` on the data of their one Block. The expected output
 * of a good file comes from `xz -dc`, so those tests are skipped when `xz`
 * isn't installed.
 *
 * Source: https://github.com/tukaani-project/xz, tests/files at commit
 * 3b1efb04d17c3a9ef7f473d73af13f1531428ffe. XZ Utils licenses its test
 * files under the BSD Zero Clause License (0BSD); testdata/xz-utils/LICENSE
 * has the text.
 */

import {
	describe,
	expect,
	test,
} from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	decompress,
	decompressRawLzma2,
} from "./index.js";

const hasXz = spawnSync("xz", ["--version"]).status === 0;

const STREAM_HEADER_SIZE = 12;
const LZMA2_FILTER_ID = 0x21;

function read(name: string): Uint8Array {
	return new Uint8Array(readFileSync(join(import.meta.dir, "testdata", "xz-utils", name)));
}

function xzDecompress(file: Uint8Array): Uint8Array {
	const result = spawnSync("xz", ["--decompress", "--stdout"], { input: file });
	if (result.status !== 0) {
		throw new Error(`xz --decompress failed: ${result.stderr}`);
	}
	return new Uint8Array(result.stdout);
}

/**
 * Returns the LZMA2 data of the one Block of a .xz file and its dictionary
 * size. It skips the Stream Header and the Block Header, whose size is
 * (first byte + 1) * 4. When the Block Header holds the Compressed Size,
 * the data ends there. Otherwise the rest of the file follows, and the
 * decoder stops at the LZMA2 end marker.
 */
function readLzma2Block(file: Uint8Array): { data: Uint8Array; dictSize: number; } {
	const headerSize = (file[STREAM_HEADER_SIZE] + 1) * 4;
	const flags = file[STREAM_HEADER_SIZE + 1];
	let pos = STREAM_HEADER_SIZE + 2;
	let compressedSize: number | undefined;

	if (flags & 0x40) {
		[compressedSize, pos] = readVli(file, pos);
	}

	if (flags & 0x80) {
		[, pos] = readVli(file, pos);
	}

	const [filterId, propsSizeEnd] = readVli(file, pos);
	if ((flags & 0x03) !== 0 || filterId !== LZMA2_FILTER_ID) {
		throw new Error("Expected a Block whose only filter is LZMA2");
	}

	const [, propsPos] = readVli(file, propsSizeEnd);
	const start = STREAM_HEADER_SIZE + headerSize;
	const end = compressedSize === undefined ? file.length : start + compressedSize;

	return { data: file.subarray(start, end), dictSize: decodeDictSize(file[propsPos]) };
}

/** Reads a variable-length integer of the .xz format. Returns it and the position after it. */
function readVli(bytes: Uint8Array, pos: number): [number, number] {
	let value = 0;
	for (let i = 0;; ++i) {
		const byte = bytes[pos + i];
		value += (byte & 0x7F) * 2 ** (7 * i);
		if ((byte & 0x80) === 0) return [value, pos + i + 1];
	}
}

/** Dictionary size from the LZMA2 properties byte, as the .xz specification defines it. */
function decodeDictSize(props: number): number {
	const bits = props & 0x3F;
	if (bits > 40) {
		throw new Error("Dictionary size is larger than 4 GiB");
	}
	if (bits === 40) {
		return 0xFFFFFFFF;
	}

	// A multiplication instead of `<<`, which turns 2 GiB and up negative
	return (2 | (bits & 1)) * 2 ** ((bits >> 1) + 11);
}

describe.skipIf(!hasXz)("good files", () => {
	test.each([
		"good-unknown_size-with_eopm.lzma",
		"good-known_size-without_eopm.lzma",
		"good-known_size-with_eopm.lzma",
	])("decodes %s like xz", (name) => {
		const file = read(name);

		const output = decompress(file);

		expect(output).toEqual(xzDecompress(file));
	});

	test.each([
		"good-1-lzma2-1.xz",
		"good-1-lzma2-2.xz",
		"good-1-lzma2-3.xz",
		"good-1-lzma2-4.xz",
		"good-1-lzma2-5.xz",
	])("decodes the LZMA2 data of %s like xz", (name) => {
		const file = read(name);
		const { data, dictSize } = readLzma2Block(file);

		const output = decompressRawLzma2(data, { dictSize });

		expect(output).toEqual(xzDecompress(file));
	});
});

describe("bad files", () => {
	test.each([
		["bad-unknown_size-without_eopm.lzma", "Truncated input"],
		["bad-too_small_size-without_eopm-1.lzma", "Corrupted input: data exceeds the declared size"],
		["bad-too_small_size-without_eopm-2.lzma", "Corrupted input: data exceeds the declared size"],
		["bad-too_small_size-without_eopm-3.lzma", "Corrupted input: data exceeds the declared size"],
	])("rejects %s", (name, message) => {
		const file = read(name);

		const decode = () => decompress(file);

		expect(decode).toThrow(message);
	});

	test("rejects bad-too_big_size-with_eopm.lzma with strict", () => {
		const file = read("bad-too_big_size-with_eopm.lzma");

		const decode = () => decompress(file, { strict: true });

		expect(decode).toThrow("Corrupted input: end marker before the declared size");
	});

	// Without strict, an end marker before the declared size ends the data,
	// for producers that write a size that is too large.
	test("decodes bad-too_big_size-with_eopm.lzma to its data without strict", () => {
		const file = read("bad-too_big_size-with_eopm.lzma");

		const output = decompress(file);

		expect(output).toEqual(decompress(read("good-known_size-with_eopm.lzma")));
	});

	test.each([
		["bad-1-lzma2-1.xz", "the first LZMA2 chunk doesn't reset the dictionary"],
		["bad-1-lzma2-2.xz", "match distance is too large"],
		["bad-1-lzma2-3.xz", "invalid LZMA2 properties"],
		["bad-1-lzma2-4.xz", "LZMA2 chunk without properties"],
		["bad-1-lzma2-5.xz", "LZMA2 chunk without properties"],
		["bad-1-lzma2-6.xz", "invalid LZMA2 control byte"],
		["bad-1-lzma2-7.xz", "LZMA2 chunk doesn't match its sizes"],
		["bad-1-lzma2-8.xz", "LZMA2 chunk without properties"],
		["bad-1-lzma2-9.xz", "Truncated input"],
		["bad-1-lzma2-10.xz", "Truncated input"],
		["bad-1-lzma2-11.xz", "Truncated input"],
	])("rejects the LZMA2 data of %s", (name, message) => {
		const { data, dictSize } = readLzma2Block(read(name));

		const decode = () => decompressRawLzma2(data, { dictSize });

		expect(decode).toThrow(message);
	});
});
