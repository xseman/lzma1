/**
 * Shapes of the committed records (`manifest.json`, `malformed.json`) and
 * their parsers. Parsed JSON is validated field by field at the boundary,
 * so a hand-edited or truncated record fails with a message naming the
 * field instead of flowing on as an untyped value.
 */

import type {
	EncoderConfig,
	StreamSpec,
} from "./corpus.ts";
import {
	type InputSpec,
	isBuilderName,
} from "./inputs.ts";
import type { MalformedOp } from "./malformed.ts";

export interface JavaPin {
	project: string;
	repository: string;
	commit: string;
}

/** SHA-256 of each committed fixture of a cell; streaming cells have no plain form. */
export interface FixtureHashes {
	plain?: string;
	marker: string;
}

export interface ManifestCell {
	id: string;
	input: InputSpec;
	cfg: EncoderConfig;
	stream?: StreamSpec;
	fittedDictSize: number;
	inputSha256: string;
	fixtureSha256: FixtureHashes;
}

export interface Manifest {
	java: JavaPin;
	javaVersion: string;
	decoderMemLimitKiB: number;
	cells: ManifestCell[];
}

export type DecodeOutcome =
	| { status: "ok"; length: number; sha256: string; }
	| { status: "error"; error: string; };

/**
 * Reviewed classes of corrupt input on which the library's decoder is
 * more lenient than the Java code's (see fixtures/README.md).
 */
export const DEVIATION_CLASSES = ["end-marker-leniency", "trailing-state-leniency", "dict-size-clamp", "accepted-corruption"] as const;

export type DeviationClass = typeof DEVIATION_CLASSES[number];

export interface MalformedRecord {
	id: string;
	source: string;
	op: MalformedOp;
	java: DecodeOutcome;
	deviation?: DeviationClass;
	port?: DecodeOutcome;
}

export interface MalformedRecords {
	memLimitKiB: number;
	cases: MalformedRecord[];
}

export function parseManifest(json: unknown): Manifest {
	const root = expectRecord(json, "manifest");
	const java = expectRecord(root.java, "manifest.java");

	return {
		java: {
			project: expectString(java.project, "manifest.java.project"),
			repository: expectString(java.repository, "manifest.java.repository"),
			commit: expectSha1(java.commit, "manifest.java.commit"),
		},
		javaVersion: expectString(root.javaVersion, "manifest.javaVersion"),
		decoderMemLimitKiB: expectInteger(root.decoderMemLimitKiB, "manifest.decoderMemLimitKiB"),
		cells: expectArray(root.cells, "manifest.cells").map((cell, i) => parseManifestCell(cell, `manifest.cells[${i}]`)),
	};
}

export function parseMalformedRecords(json: unknown): MalformedRecords {
	const root = expectRecord(json, "malformed");

	return {
		memLimitKiB: expectInteger(root.memLimitKiB, "malformed.memLimitKiB"),
		cases: expectArray(root.cases, "malformed.cases").map((record, i) => parseMalformedRecord(record, `malformed.cases[${i}]`)),
	};
}

function parseManifestCell(json: unknown, where: string): ManifestCell {
	const cell = expectRecord(json, where);
	const hashes = expectRecord(cell.fixtureSha256, `${where}.fixtureSha256`);
	const parsed: ManifestCell = {
		id: expectString(cell.id, `${where}.id`),
		input: parseInputSpec(cell.input, `${where}.input`),
		cfg: parseEncoderConfig(cell.cfg, `${where}.cfg`),
		fittedDictSize: expectInteger(cell.fittedDictSize, `${where}.fittedDictSize`),
		inputSha256: expectSha256(cell.inputSha256, `${where}.inputSha256`),
		fixtureSha256: { marker: expectSha256(hashes.marker, `${where}.fixtureSha256.marker`) },
	};
	if (cell.stream !== undefined) {
		const stream = expectRecord(cell.stream, `${where}.stream`);
		parsed.stream = { chunkSize: expectInteger(stream.chunkSize, `${where}.stream.chunkSize`) };
	}

	if (hashes.plain !== undefined) {
		parsed.fixtureSha256.plain = expectSha256(hashes.plain, `${where}.fixtureSha256.plain`);
	}

	if ((parsed.stream === undefined) !== (parsed.fixtureSha256.plain !== undefined)) {
		throw new TypeError(`${where}: a plain fixture hash is required exactly when the cell is not streaming`);
	}

	return parsed;
}

function parseInputSpec(json: unknown, where: string): InputSpec {
	const spec = expectRecord(json, where);
	const builder = expectString(spec.builder, `${where}.builder`);
	if (!isBuilderName(builder)) {
		throw new TypeError(`${where}.builder: unknown input builder ${JSON.stringify(builder)}`);
	}

	return { builder, size: expectInteger(spec.size, `${where}.size`), seed: expectInteger(spec.seed, `${where}.seed`) };
}

function parseEncoderConfig(json: unknown, where: string): EncoderConfig {
	const config = expectRecord(json, where);

	return {
		dictSize: expectInteger(config.dictSize, `${where}.dictSize`),
		mode: expectOneOf(config.mode, ["normal", "fast"] as const, `${where}.mode`),
		matchFinder: expectOneOf(config.matchFinder, ["bt4", "hc4"] as const, `${where}.matchFinder`),
		niceLen: expectInteger(config.niceLen, `${where}.niceLen`),
		depth: expectInteger(config.depth, `${where}.depth`),
		lc: expectInteger(config.lc, `${where}.lc`),
		lp: expectInteger(config.lp, `${where}.lp`),
		pb: expectInteger(config.pb, `${where}.pb`),
	};
}

function parseMalformedRecord(json: unknown, where: string): MalformedRecord {
	const record = expectRecord(json, where);
	const parsed: MalformedRecord = {
		id: expectString(record.id, `${where}.id`),
		source: expectString(record.source, `${where}.source`),
		op: parseMalformedOp(record.op, `${where}.op`),
		java: parseDecodeOutcome(record.java, `${where}.java`),
	};
	if (record.deviation !== undefined) {
		parsed.deviation = expectOneOf(record.deviation, DEVIATION_CLASSES, `${where}.deviation`);
		parsed.port = parseDecodeOutcome(record.port, `${where}.port`);
	} else if (record.port !== undefined) {
		throw new TypeError(`${where}.port: only a deviation records a port outcome`);
	}

	return parsed;
}

function parseMalformedOp(json: unknown, where: string): MalformedOp {
	const op = expectRecord(json, where);
	const kind = expectOneOf(op.kind, ["truncate", "flipbit", "header", "declaredSize"] as const, `${where}.kind`);
	switch (kind) {
		case "truncate":
			return { kind, at: expectInteger(op.at, `${where}.at`) };
		case "flipbit":
			return { kind, at: expectInteger(op.at, `${where}.at`), bit: expectInteger(op.bit, `${where}.bit`) };
		case "declaredSize":
			return { kind, size: expectInteger(op.size, `${where}.size`) };
		case "header":
			break;
	}

	const field = expectOneOf(op.field, ["props", "dictSize", "size"] as const, `${where}.field`);
	if (field !== "size") {
		return { kind, field, value: expectInteger(op.value, `${where}.value`) };
	}

	if (op.delta !== undefined) {
		return { kind, field, delta: expectInteger(op.delta, `${where}.delta`) };
	}

	return { kind, field, value: expectOneOf(op.value, ["unknown", "2^63-1"] as const, `${where}.value`) };
}

function parseDecodeOutcome(json: unknown, where: string): DecodeOutcome {
	const outcome = expectRecord(json, where);
	const status = expectOneOf(outcome.status, ["ok", "error"] as const, `${where}.status`);
	if (status === "ok") {
		return { status, length: expectInteger(outcome.length, `${where}.length`), sha256: expectSha256(outcome.sha256, `${where}.sha256`) };
	}

	return { status, error: expectString(outcome.error, `${where}.error`) };
}

function expectRecord(value: unknown, where: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError(`${where}: expected an object`);
	}

	return Object.fromEntries(Object.entries(value));
}

function expectArray(value: unknown, where: string): unknown[] {
	if (!Array.isArray(value)) {
		throw new TypeError(`${where}: expected an array`);
	}

	return value;
}

function expectString(value: unknown, where: string): string {
	if (typeof value !== "string") {
		throw new TypeError(`${where}: expected a string`);
	}

	return value;
}

function expectInteger(value: unknown, where: string): number {
	if (!Number.isSafeInteger(value) || typeof value !== "number") {
		throw new TypeError(`${where}: expected an integer`);
	}

	return value;
}

function expectOneOf<const T extends string>(value: unknown, allowed: readonly T[], where: string): T {
	const match = allowed.find((candidate) => candidate === value);
	if (match === undefined) {
		throw new TypeError(`${where}: expected one of ${allowed.join(", ")}`);
	}

	return match;
}

function expectSha256(value: unknown, where: string): string {
	const text = expectString(value, where);
	if (!/^[0-9a-f]{64}$/.test(text)) {
		throw new TypeError(`${where}: expected a lowercase hex SHA-256`);
	}

	return text;
}

function expectSha1(value: unknown, where: string): string {
	const text = expectString(value, where);
	if (!/^[0-9a-f]{40}$/.test(text)) {
		throw new TypeError(`${where}: expected a full 40-digit commit SHA`);
	}

	return text;
}
