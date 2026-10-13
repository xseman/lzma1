/**
 * Regenerates every committed fixture from the Java code (XZ for Java at
 * the pinned commit). CI runs it on every change and fails if its output
 * differs from the committed files. Run it locally to audit the fixtures,
 * to move the pin, or after changing what it produces.
 *
 * Usage:
 *   node fixtures/generate.ts <xz-java checkout> [--repin]
 *
 * The Java code is taken from the checkout's committed `HEAD` through
 * `git archive`, so untracked or modified files in the checkout cannot
 * leak into the build. A normal run refuses a checkout whose `HEAD`
 * differs from the commit pinned in `manifest.json`; `--repin` accepts it
 * and records the new pin (also needed when no manifest exists yet).
 *
 * Prerequisites (see fixtures/README.md): Node >= 22.18, a JDK (`javac`),
 * `git`, `tar`, and `bun install` (the generator rebuilds `lib/` itself and
 * reads `fitDictSize`, `roundDictSize` and the library's decoder from it).
 */

import {
	execFileSync,
	spawnSync,
} from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
	BAD_HEADER_CARRIER,
	CORPUS,
	type CorpusCell,
	DECLARED_SIZE_CARRIER,
	type EncoderConfig,
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
	type DeviationClass,
	type FixtureHashes,
	type MalformedRecord,
	type Manifest,
	type ManifestCell,
	parseManifest,
} from "./records.ts";

/** Memory limit (KiB) passed to the Java decoder for the malformed set. */
const DECODER_MEM_LIMIT_KIB = 512 * 1024;

/**
 * Malformed cases the library accepts at the declared length with output
 * that differs from the original input, where the Java decoder reports an
 * error: the decoder stops at the declared size without the Java code's
 * final range-coder check. Each member was reviewed individually; a
 * regeneration that finds a new one stops instead of extending the class.
 */
const ACCEPTED_CORRUPTION: string[] = [
	// A body bit flip that leaves enough valid symbols to fill the declared
	// 100 bytes; the Java code then hits the end of input while finishing
	// the range coder.
	"base-100-n-bt4-64@flip32.0",
];

const fixturesDir = import.meta.dirname;
const repoRoot = path.join(fixturesDir, "..");
const manifestPath = path.join(fixturesDir, "manifest.json");

const args = process.argv.slice(2);
const repin = args.includes("--repin");
const positional = args.filter((arg) => arg !== "--repin");
if (positional.length !== 1) {
	throw new Error("Usage: node fixtures/generate.ts <xz-java checkout> [--repin]");
}

const checkout = path.resolve(positional[0]);
const javaCommit = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
checkPin(javaCommit);

// `--force`: an up-to-date check against a leftover build-info file could
// skip the build and leave a `lib/` compiled from other sources.
execFileSync(path.join(repoRoot, "node_modules", ".bin", "tsc"), ["--build", "--force"], { cwd: repoRoot, stdio: "inherit" });
const options: typeof import("../src/options.ts") = await import(libUrl("options.js"));
const header: typeof import("../src/header.ts") = await import(libUrl("header.js"));
const library: typeof import("../src/index.ts") = await import(libUrl("index.js"));

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "lzma1-fixtures-"));
const classpath = compileJava(workDir);

const corpusDir = path.join(fixturesDir, "corpus");
fs.rmSync(corpusDir, { recursive: true, force: true });
fs.mkdirSync(corpusDir);

const manifestCells: ManifestCell[] = [];
const fixtures = new Map<string, Uint8Array>();
const inputs = new Map<string, Uint8Array>();
for (const cell of CORPUS) {
	manifestCells.push(generateCell(cell));
}

const malformedCases = deriveMalformedCases();
const javaOutcomes = decodeWithJava(malformedCases);
const malformedRecords = classifyMalformed(malformedCases, javaOutcomes);
fs.writeFileSync(path.join(fixturesDir, "malformed.json"), JSON.stringify({ memLimitKiB: DECODER_MEM_LIMIT_KIB, cases: malformedRecords }, null, "\t") + "\n");

const manifest: Manifest = {
	java: {
		project: "XZ for Java",
		repository: "https://github.com/tukaani-project/xz-java",
		commit: javaCommit,
	},
	javaVersion: javaVersion(),
	decoderMemLimitKiB: DECODER_MEM_LIMIT_KIB,
	cells: manifestCells,
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
process.stdout.write(`manifest: ${manifestCells.length} cells, XZ for Java ${javaCommit}\n`);
fs.rmSync(workDir, { recursive: true, force: true });

/** Refuses a checkout that is not at the pinned commit, unless repinning. */
function checkPin(commit: string): void {
	if (repin) {
		return;
	}

	if (!fs.existsSync(manifestPath)) {
		throw new Error("No manifest.json to read the pin from: run with --repin to establish one");
	}

	const pinned = parseManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8"))).java.commit;
	if (commit !== pinned) {
		throw new Error(`Checkout HEAD ${commit} is not the pinned XZ for Java commit ${pinned}; check out the pin, or pass --repin to move it`);
	}
}

function libUrl(file: string): string {
	return pathToFileURL(path.join(repoRoot, "lib", file)).href;
}

/**
 * Exports the checkout's committed sources and compiles them together with
 * the two drivers into a fresh class directory, so no class file from
 * elsewhere can shadow them. Returns the classpath.
 */
function compileJava(dir: string): string {
	const sourceDir = path.join(dir, "java");
	const classDir = path.join(dir, "classes");
	fs.mkdirSync(sourceDir);
	fs.mkdirSync(classDir);

	const archive = execFileSync("git", ["-C", checkout, "archive", "--format=tar", "HEAD", "src"], { maxBuffer: 1 << 28 });
	execFileSync("tar", ["-x", "-C", sourceDir], { input: archive });

	const javaSources = fs.readdirSync(path.join(sourceDir, "src", "org"), { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".java"))
		.map((file) => path.join(sourceDir, "src", "org", file));
	const drivers = [path.join(fixturesDir, "Enc.java"), path.join(fixturesDir, "Dec.java")];
	execFileSync("javac", ["-nowarn", "-d", classDir, ...javaSources, ...drivers], { stdio: ["ignore", "ignore", "inherit"] });

	return classDir;
}

/** Writes one cell's Java fixtures and returns its manifest record. */
function generateCell(cell: CorpusCell): ManifestCell {
	const input = buildInput(cell.input);

	// A streaming encoder does not know the size, so nothing is fitted.
	const dictSize = cell.stream === undefined ? options.fitDictSize(cell.cfg.dictSize, input.length) : cell.cfg.dictSize;
	if (header.roundDictSize(dictSize) !== dictSize) {
		throw new Error(`${cell.id}: dictionary size ${dictSize} is not a roundDictSize fixed point`);
	}

	const hashes = new Map<FixtureVariant, string>();
	for (const variant of fixtureVariants(cell)) {
		const fixture = encodeWithJava(input, cell.cfg, dictSize, variant);
		fs.writeFileSync(path.join(corpusDir, fixtureFileName(cell.id, variant)), fixture);
		fixtures.set(variant === "plain" ? cell.id : `${cell.id}.marker`, fixture);
		hashes.set(variant, sha256(fixture));
		process.stdout.write(`${fixtureFileName(cell.id, variant)}: ${input.length} B -> ${fixture.length} B\n`);
	}

	const marker = hashes.get("marker");
	if (marker === undefined) {
		throw new Error(`${cell.id}: every cell needs a marker fixture`);
	}

	const fixtureSha256: FixtureHashes = { marker };
	const plain = hashes.get("plain");
	if (plain !== undefined) {
		fixtureSha256.plain = plain;
	}

	inputs.set(cell.id, input);
	const record: ManifestCell = {
		id: cell.id,
		input: cell.input,
		cfg: cell.cfg,
		fittedDictSize: dictSize,
		inputSha256: sha256(input),
		fixtureSha256,
	};
	if (cell.stream !== undefined) {
		record.stream = cell.stream;
	}

	return record;
}

function encodeWithJava(input: Uint8Array, config: EncoderConfig, dictSize: number, variant: FixtureVariant): Uint8Array {
	const inFile = path.join(workDir, "in.bin");
	const outFile = path.join(workDir, "out.lzma");
	fs.writeFileSync(inFile, input);
	const driverArgs = [
		inFile,
		outFile,
		String(dictSize),
		String(config.lc),
		String(config.lp),
		String(config.pb),
		config.mode,
		config.matchFinder,
		String(config.niceLen),
		String(config.depth),
	];
	if (variant === "marker") {
		driverArgs.push("marker");
	}

	execFileSync("java", ["-cp", classpath, "Enc", ...driverArgs]);

	return new Uint8Array(fs.readFileSync(outFile));
}

function deriveMalformedCases(): MalformedCase[] {
	const cases: MalformedCase[] = [];
	for (const source of MALFORMED_SOURCES) {
		cases.push(...deriveMalformed(source, requireFixture(source)));
	}

	cases.push(...deriveBadHeaders(BAD_HEADER_CARRIER, requireFixture(BAD_HEADER_CARRIER)));
	const carrierInput = inputs.get(DECLARED_SIZE_CARRIER.cellId);
	if (carrierInput === undefined) {
		throw new Error(`declared-size carrier ${DECLARED_SIZE_CARRIER.cellId} is not a corpus cell`);
	}

	cases.push(...deriveMarkerSizePatches(DECLARED_SIZE_CARRIER.source, requireFixture(DECLARED_SIZE_CARRIER.source), carrierInput.length));

	return cases;
}

function requireFixture(source: string): Uint8Array {
	const fixture = fixtures.get(source);
	if (fixture === undefined) {
		throw new Error(`malformed source ${source} is not a corpus fixture`);
	}

	return fixture;
}

/** Records the Java decoder's outcome for every case in one JVM run. */
function decodeWithJava(cases: MalformedCase[]): DecodeOutcome[] {
	const caseDir = path.join(workDir, "malformed");
	fs.mkdirSync(caseDir);
	const files = cases.map((malformedCase, i) => {
		const file = path.join(caseDir, `${i}.lzma`);
		fs.writeFileSync(file, malformedCase.bytes);

		return file;
	});

	const output = execFileSync("java", ["-cp", classpath, "Dec", String(DECODER_MEM_LIMIT_KIB)], {
		input: files.join("\n"),
		maxBuffer: 1 << 26,
		encoding: "utf8",
	});
	const lines = output.trim().split("\n");
	if (lines.length !== cases.length) {
		throw new Error(`Dec reported ${lines.length} outcomes for ${cases.length} cases`);
	}

	return lines.map((line, i) => {
		const [file, status, first, second] = line.split("\t");
		if (file !== files[i]) {
			throw new Error(`Dec output line ${i} names ${file}, expected ${files[i]}`);
		}

		if (status === "ok") {
			return { status, length: Number(first), sha256: second };
		}

		if (status === "error") {
			return { status, error: first };
		}

		throw new Error(`Dec output line ${i} has unknown status ${status}`);
	});
}

function decodeWithPort(bytes: Uint8Array): DecodeOutcome {
	try {
		const output = library.decompress(bytes);

		return { status: "ok", length: output.length, sha256: sha256(output) };
	} catch (error) {
		// Recorded, not swallowed: a decoder error is an outcome to compare.
		return { status: "error", error: error instanceof Error ? error.constructor.name : typeof error };
	}
}

/**
 * Pairs every case with its Java outcome and, where the library's
 * outcome differs, with a reviewed deviation class. A difference that no
 * class covers stops generation after listing every such case.
 */
function classifyMalformed(cases: MalformedCase[], outcomes: DecodeOutcome[]): MalformedRecord[] {
	const records: MalformedRecord[] = [];
	const unclassified: string[] = [];
	const perClass = new Map<string, number>();
	for (let i = 0; i < cases.length; i++) {
		const malformedCase = cases[i];
		const java = outcomes[i];
		const port = decodeWithPort(malformedCase.bytes);
		if (sameOutcome(java, port)) {
			records.push({ id: malformedCase.id, source: malformedCase.source, op: malformedCase.op, java });
			continue;
		}

		const deviation = classifyDeviation(malformedCase, java, port);
		if (deviation === undefined) {
			unclassified.push(`${malformedCase.id}: java ${JSON.stringify(java)}, port ${JSON.stringify(port)}`);
			continue;
		}

		perClass.set(deviation, (perClass.get(deviation) ?? 0) + 1);
		records.push({ id: malformedCase.id, source: malformedCase.source, op: malformedCase.op, java, deviation, port });
	}

	if (unclassified.length > 0) {
		throw new Error(`${unclassified.length} unclassified deviations:\n${unclassified.join("\n")}`);
	}

	const missing = ACCEPTED_CORRUPTION.filter((id) => !records.some((record) => record.id === id && record.deviation === "accepted-corruption"));
	if (missing.length > 0) {
		throw new Error(`listed accepted-corruption cases no longer deviate that way: ${missing.join(", ")}`);
	}

	process.stdout.write(`malformed: ${cases.length} cases, ${cases.length - records.filter((record) => record.deviation).length} matching the Java outcome, deviations ${JSON.stringify(Object.fromEntries(perClass))}\n`);

	return records;
}

function sameOutcome(java: DecodeOutcome, port: DecodeOutcome): boolean {
	if (java.status === "ok" && port.status === "ok") {
		return java.length === port.length && java.sha256 === port.sha256;
	}

	return java.status === port.status;
}

/**
 * The reviewed deviation classes. Every class but `accepted-corruption`
 * requires the library's output to equal the original input byte for
 * byte; `accepted-corruption` admits only its listed members.
 */
function classifyDeviation(malformedCase: MalformedCase, java: DecodeOutcome, port: DecodeOutcome): DeviationClass | undefined {
	if (java.status !== "error" || port.status !== "ok") {
		return undefined;
	}

	const cellId = malformedCase.source.replace(/\.marker$/, "");
	const input = inputs.get(cellId);
	const fixture = fixtures.get(malformedCase.source);
	if (input === undefined || fixture === undefined) {
		throw new Error(`malformed source ${malformedCase.source} has no recorded input or fixture`);
	}

	const restoresInput = port.length === input.length && port.sha256 === sha256(input);
	const op = malformedCase.op;

	// An end marker before the declared size is accepted (alone-decoder.ts:
	// recovery for producers that write a size that is too large).
	if (op.kind === "declaredSize" && restoresInput) {
		return "end-marker-leniency";
	}

	// Decoding stops once the declared size is produced, without the
	// Java code's check of the range coder's final state; corruption
	// confined to the trailing bytes, or to the whole body when the
	// declared size is 0, leaves the output intact.
	const trailing = (op.kind === "flipbit" || op.kind === "truncate") && op.at >= Math.max(13, fixture.length - 8);
	if (trailing && restoresInput) {
		return "trailing-state-leniency";
	}

	// A header dictionary size beyond the Java code's supported range is
	// clamped to the declared size instead of rejected.
	if (op.kind === "header" && op.field === "dictSize" && restoresInput) {
		return "dict-size-clamp";
	}

	// The same missing final check, where the corruption changed the
	// output: accepted at the declared length with wrong bytes.
	if (ACCEPTED_CORRUPTION.includes(malformedCase.id) && port.length === input.length && !restoresInput) {
		return "accepted-corruption";
	}

	return undefined;
}

function javaVersion(): string {
	const firstLine = spawnSync("java", ["-version"], { encoding: "utf8" }).stderr.trim().split("\n")[0];
	if (!firstLine) {
		throw new Error("could not read the Java version");
	}

	return firstLine;
}

function sha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}
