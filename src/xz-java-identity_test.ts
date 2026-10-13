/**
 * Byte identity against XZ for Java at the pinned commit, on the
 * differential corpus in `fixtures/` (see fixtures/README.md):
 *
 * - `compress()` reproduces every committed Java fixture byte for
 *   byte, in both the known-size and the end-marker form, twice in a row;
 *   the streaming cell does the same through `Compress`;
 * - `decompress()` of every fixture reproduces the seeded input;
 * - on the malformed-stream set, the decoder's outcome matches the
 *   Java decoder's recorded outcome, except for the reviewed
 *   deviation classes, which carry the library's own recorded outcome.
 *
 * The checks live in `fixtures/identity.ts`, shared with
 * `fixtures/verify.ts`, which runs them on Node.
 */

import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	cellChecks,
	loadMalformedRecords,
	loadManifest,
	malformedChecks,
	recordChecks,
} from "../fixtures/identity.ts";
import * as library from "./index.js";

const manifest = loadManifest();
const records = loadMalformedRecords();

describe("fixture records", () => {
	test.each(recordChecks(manifest, records).map((check) => [check.name, check] as const))("%s", async (_, check) => {
		const mismatch = await check.run();

		expect(mismatch).toBeUndefined();
	});
});

// The largest cell compresses 2 MB four times and decodes it twice; under
// coverage instrumentation that takes longer than bun's 5-second default.
const CELL_TIMEOUT_MS = 60_000;

describe("byte identity with XZ for Java", () => {
	test.each(cellChecks(library, manifest).map((check) => [check.name, check] as const))("%s", async (_, check) => {
		const mismatch = await check.run();

		expect(mismatch).toBeUndefined();
	}, CELL_TIMEOUT_MS);
});

describe("malformed streams match recorded decoder expectations", () => {
	test.each(malformedChecks(library, manifest, records).map((check) => [check.name, check] as const))("%s", async (_, check) => {
		const mismatch = await check.run();

		expect(mismatch).toBeUndefined();
	});
});
