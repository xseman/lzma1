// lzma1 (the build in ../lib) compared with a baseline: the release in
// package.json, or the lzma1 entry point in LZMA1_BASELINE (named by
// LZMA1_BASELINE_NAME). BENCHMARK_RUNNER=1 prints JSON.

import {
	bench,
	group,
	run,
	summary,
} from "mitata";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const env = process.env;
const lzma1 = await import("../lib/index.js");
const baseline = await import(env.LZMA1_BASELINE ? pathToFileURL(resolve(env.LZMA1_BASELINE)).href : "lzma1-release");
const baselineName = env.LZMA1_BASELINE
	? env.LZMA1_BASELINE_NAME ?? "baseline"
	: `lzma1@${JSON.parse(readFileSync(new URL("node_modules/lzma1-release/package.json", import.meta.url))).version}`;

// Inputs, the same on every run.
const SIZE = 128 * 1024;
let seed = 1;
const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;

const words = "the of and to in is it for that with as on this be are from at by not or have an they which one all were when we there can more".split(" ");
let prose = "";
while (prose.length < SIZE) prose += words[Math.floor(random() ** 2 * words.length)] + (random() < 0.1 ? ".\n" : " ");

const records = [];
while (JSON.stringify(records).length < SIZE) {
	const id = records.length;
	records.push({ id, name: `user${id}`, email: `user${id}@example.com`, active: random() < 0.3, score: Math.round(random() * 1e5) / 1e3 });
}

// Integer tables, floats, zero padding and incompressible blocks.
const binary = new Uint8Array(SIZE);
const view = new DataView(binary.buffer);
for (let pos = 0; pos < SIZE - 4096;) {
	const kind = Math.floor(random() * 4);
	const len = 256 + Math.floor(random() * 3840);
	for (let i = 0; i + 8 <= len; i += 8) {
		if (kind === 0) view.setUint32(pos + i, pos + i * 3, true);
		if (kind === 1) view.setFloat64(pos + i, random() * 1000, true);
		if (kind === 3) { for (let j = 0; j < 8; j++) binary[pos + i + j] = random() * 256; }
	}
	pos += len;
}

const encode = (text) => new TextEncoder().encode(text.slice(0, SIZE));
const small = encode(JSON.stringify(records.slice(0, 1)));
const inputs = {
	"text 128 KiB": encode(prose),
	"json 128 KiB": encode(JSON.stringify(records)),
	"binary 128 KiB": binary,
	[`small ${small.length} B`]: small,
};

function compare(name, fn) {
	group(name, () =>
		summary(() => {
			bench("lzma1", () => fn(lzma1));
			bench(baselineName, () => fn(baseline)).baseline(true);
		}));
}

for (const [name, data] of Object.entries(inputs)) {
	for (const level of name.startsWith("small") ? [5] : [1, 5, 9]) {
		compare(`compress ${name}, level ${level}`, (lib) => lib.compress(data, level));
	}
}

for (const [name, data] of Object.entries(inputs)) {
	const compressed = lzma1.compress(data);
	compare(`decompress ${name}`, (lib) => lib.decompress(compressed));
}

await run(env.BENCHMARK_RUNNER ? { format: "json" } : {});
