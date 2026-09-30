/**
 * Round-trip fuzzing and interoperability with the `xz` command line tool
 * (the reference LZMA implementation). The xz tests are skipped when `xz`
 * isn't installed.
 */

import {
	describe,
	expect,
	test,
} from "bun:test";
import { spawnSync } from "node:child_process";

import {
	compress,
	type CompressionOptions,
	decompress,
} from "./index.js";

const hasXz = spawnSync("xz", ["--version"]).status === 0;

function xz(args: string[], input: Uint8Array): Uint8Array {
	const result = spawnSync("xz", args, { input, maxBuffer: 1 << 28 });
	if (result.status !== 0) {
		throw new Error(`xz ${args.join(" ")} failed: ${result.stderr}`);
	}
	return new Uint8Array(result.stdout);
}

function createRandom(seed: number): () => number {
	return () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
}

/** Inputs covering the different kinds of symbols. */
function corpus(): [string, Uint8Array][] {
	const random = createRandom(5);
	const text = new TextEncoder().encode(
		"It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness. ",
	);

	const make = (size: number, fn: (i: number) => number) => Uint8Array.from({ length: size }, (_, i) => fn(i));

	return [
		["empty", new Uint8Array(0)],
		["one byte", new Uint8Array([42])],
		["text", make(100_000, (i) => text[i % text.length])],
		["random", make(50_000, () => Math.floor(random() * 256))],
		["zeros", new Uint8Array(200_000)],
		["sawtooth", make(70_000, (i) => i & 0xFF)],
		["mixed", make(120_000, (i) => (i % 3000 < 1500 ? text[i % text.length] : Math.floor(random() * 256)))],
		["random then text", make(300_000, (i) => (i < 150_000 ? Math.floor(random() * 256) : text[i % text.length]))],
	];
}

// A random block repeated, so matches reach back 20,000 bytes.
const farMatches = (() => {
	const random = createRandom(9);
	const block = Uint8Array.from({ length: 20_000 }, () => Math.floor(random() * 256));
	const data = new Uint8Array(200_000);
	for (let i = 0; i < data.length; i += block.length) data.set(block.subarray(0, data.length - i), i);
	return data;
})();

const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const optionSets: CompressionOptions[] = [
	{ level: 1 },
	{ level: 2 },
	{ level: 3 },
	{ level: 4 },
	{ level: 5 },
	{ level: 6 },
	{ level: 9 },
	{ lc: 0, lp: 4, pb: 0 },
	{ lc: 4, lp: 0, pb: 4 },
	{ mode: "fast", matchFinder: "bt4", niceLen: 8 },
	{ mode: "normal", matchFinder: "hc4", niceLen: 273 },
	{ dictSize: 4096 },
	// Written to the header rounded up to 6144, which xz requires.
	{ dictSize: 5000 },
];

describe("round trip", () => {
	for (const [name, input] of corpus()) {
		test(name, () => {
			for (const options of optionSets) {
				expect(decompress(compress(input, options))).toEqual(input);
			}
		});

		test(`${name} without end marker at every level`, () => {
			for (const level of levels) {
				const withMarker = compress(input, { level });

				const withoutMarker = compress(input, { level, endMarker: false });

				expect(decompress(withoutMarker)).toEqual(input);
				expect(withoutMarker.length).toBeLessThanOrEqual(withMarker.length);
			}
		});
	}

	test("repeats beyond the dictionary size", () => {
		expect(decompress(compress(farMatches, { dictSize: 16_384 }))).toEqual(farMatches);
		expect(decompress(compress(farMatches, { dictSize: 1 << 16 }))).toEqual(farMatches);
	});

	test("random inputs with random options", () => {
		const random = createRandom(123);

		for (let i = 0; i < 40; i++) {
			const size = Math.floor(random() ** 3 * 50_000);
			const alphabet = 1 + Math.floor(random() * 255);
			const input = Uint8Array.from({ length: size }, () => Math.floor(random() ** 2 * alphabet));
			const lc = Math.floor(random() * 5);
			const options: CompressionOptions = {
				level: (1 + Math.floor(random() * 9)) as 1,
				lc,
				lp: Math.floor(random() * (5 - lc)),
				pb: Math.floor(random() * 5),
			};

			expect(decompress(compress(input, options))).toEqual(input);
		}
	});
});

describe.skipIf(!hasXz)("xz interoperability", () => {
	for (const [name, input] of corpus()) {
		test(`xz decodes ${name}`, () => {
			for (const options of optionSets) {
				const compressed = compress(input, options);
				expect(xz(["--decompress", "--format=lzma", "--stdout"], compressed)).toEqual(input);
			}
		});

		test(`xz decodes ${name} without end marker`, () => {
			for (const options of optionSets) {
				const compressed = compress(input, { ...options, endMarker: false });

				const output = xz(["--decompress", "--format=lzma", "--stdout"], compressed);

				expect(output).toEqual(input);
			}
		});

		test(`decodes ${name} from xz`, () => {
			for (const preset of ["-0", "-3", "-6", "-9e"]) {
				const compressed = xz(["--compress", "--format=lzma", "--stdout", preset], input);
				expect(decompress(compressed)).toEqual(input);
			}
		});
	}

	test("decodes xz output with custom lc/lp/pb and a small dictionary", () => {
		for (const filter of ["dict=4KiB,lc=0,lp=4,pb=0", "dict=64KiB,lc=4,lp=0,pb=4", "dict=4KiB,mf=hc3,mode=fast"]) {
			const compressed = xz(["--compress", "--format=lzma", "--stdout", `--lzma1=${filter}`], farMatches);
			expect(decompress(compressed)).toEqual(farMatches);
		}
	});

	test("xz --format=raw, which doesn't know the size, needs the end marker", () => {
		const input = corpus()[2][1].subarray(0, 300);
		const rawData = (options: CompressionOptions) => compress(input, options).subarray(13);
		const args = ["--decompress", "--format=raw", "--stdout", "--lzma1=lc=3,lp=0,pb=2,dict=4KiB"];

		const withMarker = spawnSync("xz", args, { input: rawData({}) });
		const withoutMarker = spawnSync("xz", args, { input: rawData({ endMarker: false }) });

		expect(withMarker.status).toBe(0);
		expect(new Uint8Array(withMarker.stdout)).toEqual(input);
		expect(withoutMarker.status).not.toBe(0);
	});

	test("compression ratio is close to xz", () => {
		const [, text] = corpus()[2];
		const ours = compress(farMatches, 6).length + compress(text, 6).length;
		const theirs = xz(["--compress", "--format=lzma", "--stdout", "-6"], farMatches).length
			+ xz(["--compress", "--format=lzma", "--stdout", "-6"], text).length;
		expect(ours).toBeLessThan(theirs * 1.02);
	});
});
