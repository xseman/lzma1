/**
 * The identity checks against the committed Java fixtures, shared by
 * `src/xz-java-identity_test.ts` (bun, JavaScriptCore) and `verify.ts`
 * (Node, V8), so both engines run exactly the same checks. Each check
 * returns `undefined` when it passes and a description of the first
 * mismatch otherwise.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
	BAD_HEADER_CARRIER,
	CORPUS,
	type CorpusCell,
	DECLARED_SIZE_CARRIER,
	fixtureFileName,
	type FixtureVariant,
	fixtureVariants,
	MALFORMED_SOURCES,
} from "./corpus.ts";
import { buildInput } from "./inputs.ts";
import {
	deriveBadHeaders,
	deriveMalformed,
	deriveMarkerSizePatches,
	type MalformedCase,
} from "./malformed.ts";
import {
	type DecodeOutcome,
	type MalformedRecord,
	type MalformedRecords,
	type Manifest,
	type ManifestCell,
	parseMalformedRecords,
	parseManifest,
} from "./records.ts";

/** The library under test: `src/index.ts` in bun, the built `lib/index.js` in Node. */
export type Library = typeof import("../src/index.ts");

export interface IdentityCheck {
	name: string;
	run(): Promise<string | undefined>;
}

/**
 * Reviewed outcome counts of the malformed set: cases matching the
 * Java code, then each deviation class. A regeneration that changes them
 * has to change this table deliberately.
 */
export const MALFORMED_OUTCOME_COUNTS = {
	"matches-java": 559,
	"trailing-state-leniency": 16,
	"end-marker-leniency": 2,
	"dict-size-clamp": 1,
	"accepted-corruption": 1,
};

const FIXTURES_DIR = import.meta.dirname;

/** Header bytes 5..12 hold the uncompressed size, little-endian. */
const SIZE_FIELD_START = 5;
const HEADER_SIZE = 13;

export function loadManifest(): Manifest {
	return parseManifest(JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "manifest.json"), "utf8")));
}

export function loadMalformedRecords(): MalformedRecords {
	return parseMalformedRecords(JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "malformed.json"), "utf8")));
}

/** One check per corpus cell: hashes, compression in every form, decoding. */
export function cellChecks(library: Library, manifest: Manifest): IdentityCheck[] {
	const recorded = new Map(manifest.cells.map((cell) => [cell.id, cell]));

	return CORPUS.map((cell) => ({
		name: cell.id,
		run: async () => {
			const record = recorded.get(cell.id);
			if (record === undefined) {
				return "not recorded in manifest.json";
			}

			return checkCell(library, cell, record);
		},
	}));
}

/** One check per malformed case: the decoder's outcome against the record. */
export function malformedChecks(library: Library, manifest: Manifest, records: MalformedRecords): IdentityCheck[] {
	const cases = new Map(deriveCommittedMalformed(manifest).map((malformedCase) => [malformedCase.id, malformedCase]));

	return records.cases.map((record) => ({
		name: record.id,
		run: async () => {
			const malformedCase = cases.get(record.id);
			if (malformedCase === undefined) {
				return "recorded case is not derived from the committed fixtures";
			}

			const expected = record.deviation === undefined ? record.java : record.port;
			if (expected === undefined) {
				return "deviation record without a port outcome";
			}

			const actual = decodeOutcome(library, malformedCase.bytes);
			if (!sameOutcome(expected, actual, record.deviation !== undefined)) {
				return `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
			}

			return undefined;
		},
	}));
}

/** Checks of the records themselves, independent of the library. */
export function recordChecks(manifest: Manifest, records: MalformedRecords): IdentityCheck[] {
	return [
		{
			name: "manifest cells match the corpus definition",
			run: async () => checkCorpusDefinition(manifest),
		},
		{
			name: "corpus directory holds exactly the recorded fixtures",
			run: async () => checkCorpusFiles(manifest),
		},
		{
			name: "recorded malformed cases are exactly the derived ones",
			run: async () => checkMalformedIds(manifest, records),
		},
		{
			name: "malformed outcome counts match the reviewed table",
			run: async () => checkOutcomeCounts(records),
		},
		{
			name: "the readme verification section cites the pinned commit",
			run: async () => checkReadmePin(manifest),
		},
	];
}

async function checkCell(library: Library, cell: CorpusCell, record: ManifestCell): Promise<string | undefined> {
	const input = buildInput(cell.input);
	if (sha256(input) !== record.inputSha256) {
		return "input hash differs from manifest.json";
	}

	for (const variant of fixtureVariants(cell)) {
		const fixture = readFixture(cell.id, variant);
		if (sha256(fixture) !== record.fixtureSha256[variant]) {
			return `${fixtureFileName(cell.id, variant)}: hash differs from manifest.json`;
		}

		// Twice: the second call runs on the probability arrays and
		// encoders pooled by the first, which must not change the output.
		for (const attempt of ["first", "second"]) {
			const compressed = await compressCell(library, cell, input, variant);
			const mismatch = variant === "plain" || cell.stream !== undefined
				? describeDifference(compressed, fixture)
				: compareMarkerForms(compressed, fixture, input.length);
			if (mismatch !== undefined) {
				return `${fixtureFileName(cell.id, variant)}, ${attempt} compression: ${mismatch}`;
			}
		}

		const decoded = library.decompress(fixture);
		const decodeMismatch = describeDifference(decoded, input);
		if (decodeMismatch !== undefined) {
			return `${fixtureFileName(cell.id, variant)} decoded: ${decodeMismatch}`;
		}
	}

	return undefined;
}

function compressCell(library: Library, cell: CorpusCell, input: Uint8Array, variant: FixtureVariant): Promise<Uint8Array> {
	if (cell.stream !== undefined) {
		return compressStream(library, input, cell, cell.stream.chunkSize);
	}

	return Promise.resolve(library.compress(input, { ...cell.cfg, endMarker: variant === "marker" }));
}

/** Feeds the input to `Compress` in fixed-size chunks and collects the output. */
async function compressStream(library: Library, input: Uint8Array, cell: CorpusCell, chunkSize: number): Promise<Uint8Array> {
	const source = new ReadableStream<Uint8Array>({
		start(controller) {
			for (let at = 0; at < input.length; at += chunkSize) {
				controller.enqueue(input.slice(at, at + chunkSize));
			}

			controller.close();
		},
	});
	const reader = source.pipeThrough(new library.Compress(cell.cfg)).getReader();
	const chunks: Uint8Array[] = [];
	for (let result = await reader.read(); !result.done; result = await reader.read()) {
		chunks.push(result.value);
	}

	const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.length;
	}

	return output;
}

/**
 * The library writes the known size with its end marker; XZ for Java's
 * marker form always declares the size unknown. The forms must differ in
 * exactly that field and agree byte for byte everywhere else.
 */
function compareMarkerForms(port: Uint8Array, java: Uint8Array, inputLength: number): string | undefined {
	if (port.length !== java.length) {
		return `length ${port.length}, Java ${java.length}`;
	}

	const knownSize = new Uint8Array(8);
	new DataView(knownSize.buffer).setBigUint64(0, BigInt(inputLength), true);
	const unknownSize = new Uint8Array(8).fill(0xFF);
	if (describeDifference(port.subarray(SIZE_FIELD_START, HEADER_SIZE), knownSize) !== undefined) {
		return "size field is not the known input size";
	}

	if (describeDifference(java.subarray(SIZE_FIELD_START, HEADER_SIZE), unknownSize) !== undefined) {
		return "Java fixture size field is not the unknown-size marker";
	}

	const propertiesMismatch = describeDifference(port.subarray(0, SIZE_FIELD_START), java.subarray(0, SIZE_FIELD_START));
	if (propertiesMismatch !== undefined) {
		return `properties or dictionary size: ${propertiesMismatch}`;
	}

	const bodyMismatch = describeDifference(port.subarray(HEADER_SIZE), java.subarray(HEADER_SIZE));

	return bodyMismatch === undefined ? undefined : `body after the header: ${bodyMismatch}`;
}

function checkCorpusDefinition(manifest: Manifest): string | undefined {
	const defined = CORPUS.map((cell) => JSON.stringify({ id: cell.id, input: cell.input, cfg: cell.cfg, stream: cell.stream }));
	const recorded = manifest.cells.map((cell) => JSON.stringify({ id: cell.id, input: cell.input, cfg: cell.cfg, stream: cell.stream }));
	if (defined.length !== recorded.length) {
		return `corpus.ts defines ${defined.length} cells, manifest.json records ${recorded.length}`;
	}

	const index = defined.findIndex((cell, i) => cell !== recorded[i]);

	return index === -1 ? undefined : `cell ${index} differs: defined ${defined[index]}, recorded ${recorded[index]}`;
}

function checkCorpusFiles(manifest: Manifest): string | undefined {
	const expected = manifest.cells.flatMap((record) => {
		const cell = CORPUS.find((candidate) => candidate.id === record.id);

		return cell === undefined ? [] : fixtureVariants(cell).map((variant) => fixtureFileName(cell.id, variant));
	}).sort();
	const actual = fs.readdirSync(path.join(FIXTURES_DIR, "corpus")).sort();
	const extra = actual.filter((file) => !expected.includes(file));
	const missing = expected.filter((file) => !actual.includes(file));
	if (extra.length > 0 || missing.length > 0) {
		return `unrecorded files: ${extra.join(", ") || "none"}; missing files: ${missing.join(", ") || "none"}`;
	}

	return undefined;
}

function checkMalformedIds(manifest: Manifest, records: MalformedRecords): string | undefined {
	const derived = deriveCommittedMalformed(manifest).map((malformedCase) => malformedCase.id).sort();
	const recorded = records.cases.map((record) => record.id).sort();
	if (derived.length !== recorded.length || derived.some((id, i) => id !== recorded[i])) {
		return `derived ${derived.length} cases, recorded ${recorded.length}, or their ids differ`;
	}

	return undefined;
}

function checkOutcomeCounts(records: MalformedRecords): string | undefined {
	const counts: Record<string, number> = {};
	for (const record of records.cases) {
		const key = record.deviation ?? "matches-java";
		counts[key] = (counts[key] ?? 0) + 1;
	}

	const expected = JSON.stringify(MALFORMED_OUTCOME_COUNTS, Object.keys(MALFORMED_OUTCOME_COUNTS).sort());
	const actual = JSON.stringify(counts, Object.keys(counts).sort());

	return expected === actual ? undefined : `reviewed ${expected}, recorded ${actual}`;
}

/** Every full commit SHA in README.md's Verification section must be the pin. */
function checkReadmePin(manifest: Manifest): string | undefined {
	const readme = fs.readFileSync(path.join(FIXTURES_DIR, "..", "README.md"), "utf8");
	const section = readme.split(/^## /m).find((part) => part.startsWith("Verification\n"));
	if (section === undefined) {
		return "README.md has no Verification section";
	}

	const cited = section.match(/\b[0-9a-f]{40}\b/g) ?? [];
	if (cited.length === 0) {
		return "the Verification section cites no full commit SHA";
	}

	const wrong = cited.filter((sha) => sha !== manifest.java.commit);

	return wrong.length === 0 ? undefined : `cites ${wrong.join(", ")}, manifest pins ${manifest.java.commit}`;
}

/** Re-derives the malformed set from the committed fixtures, as `generate.ts` did. */
function deriveCommittedMalformed(manifest: Manifest): MalformedCase[] {
	const cases: MalformedCase[] = [];
	for (const source of MALFORMED_SOURCES) {
		cases.push(...deriveMalformed(source, readFixtureBySource(source)));
	}

	cases.push(...deriveBadHeaders(BAD_HEADER_CARRIER, readFixtureBySource(BAD_HEADER_CARRIER)));
	const carrier = manifest.cells.find((cell) => cell.id === DECLARED_SIZE_CARRIER.cellId);
	if (carrier !== undefined) {
		cases.push(...deriveMarkerSizePatches(DECLARED_SIZE_CARRIER.source, readFixtureBySource(DECLARED_SIZE_CARRIER.source), carrier.input.size));
	}

	return cases;
}

/** A malformed source names a fixture by its file stem (`<id>` or `<id>.marker`). */
function readFixtureBySource(source: string): Uint8Array<ArrayBuffer> {
	return source.endsWith(".marker") ? readFixture(source.slice(0, -".marker".length), "marker") : readFixture(source, "plain");
}

function readFixture(id: string, variant: FixtureVariant): Uint8Array<ArrayBuffer> {
	// Copied out of the Buffer `readFileSync` returns, so no fixture shares
	// memory with Node's buffer pool.
	return new Uint8Array(fs.readFileSync(path.join(FIXTURES_DIR, "corpus", fixtureFileName(id, variant))));
}

function decodeOutcome(library: Library, bytes: Uint8Array): DecodeOutcome {
	try {
		const output = library.decompress(bytes);

		return { status: "ok", length: output.length, sha256: sha256(output) };
	} catch (error) {
		// Recorded, not swallowed: a decoder error is an outcome to compare.
		return { status: "error", error: error instanceof Error ? error.constructor.name : typeof error };
	}
}

/**
 * Against the Java decoder, an error matches any error (the two decoders'
 * exception types are unrelated); a recorded port outcome is the
 * library's own, so its error type must match too.
 */
function sameOutcome(expected: DecodeOutcome, actual: DecodeOutcome, exactError: boolean): boolean {
	if (expected.status === "ok" && actual.status === "ok") {
		return expected.length === actual.length && expected.sha256 === actual.sha256;
	}

	if (expected.status === "error" && actual.status === "error") {
		return !exactError || expected.error === actual.error;
	}

	return false;
}

function describeDifference(actual: Uint8Array, expected: Uint8Array): string | undefined {
	const shared = Math.min(actual.length, expected.length);
	for (let i = 0; i < shared; i++) {
		if (actual[i] !== expected[i]) {
			return `first difference at byte ${i} (lengths ${actual.length} and ${expected.length})`;
		}
	}

	return actual.length === expected.length ? undefined : `lengths ${actual.length} and ${expected.length}`;
}

function sha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}
