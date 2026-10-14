/**
 * Round-trip fuzzing and interoperability with the `xz` command line tool
 * (the reference LZMA implementation) and with 7-Zip. The xz tests are
 * skipped when `xz` isn't installed, the 7-Zip tests when `7z` isn't.
 */

import {
	describe,
	expect,
	test,
} from "bun:test";
import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	compress,
	type CompressionOptions,
	decompress,
	decompressRawLzma1,
	decompressRawLzma2,
	type RawLzma1Options,
} from "./index.js";

const hasXz = spawnSync("xz", ["--version"]).status === 0;
const has7z = spawnSync("7z", ["i"]).status === 0;

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
function corpus(): [string, Uint8Array<ArrayBuffer>][] {
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

/** Bytes that xz can't compress, so it stores them in uncompressed LZMA2 chunks. */
function noise(size: number, seed: number): Uint8Array {
	let x = seed;
	return Uint8Array.from({ length: size }, () => {
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		return x & 0xFF;
	});
}

function concat(...parts: Uint8Array[]): Uint8Array {
	const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let pos = 0;
	for (const part of parts) {
		result.set(part, pos);
		pos += part.length;
	}
	return result;
}

/** The corpus plus inputs that make xz write every kind of LZMA2 chunk. */
function rawCorpus(): [string, Uint8Array][] {
	const [, text] = corpus()[2];
	const random = noise(200_000, 7);

	return [
		...corpus(),
		["noise", random.subarray(0, 50_000)],
		["noise then text", concat(random.subarray(0, 150_000), text)],
		["text, noise, text", concat(text, random.subarray(0, 100_000), text)],
		["text, more noise, text", concat(text, random, text)],
		["2.5 MB of text", concat(...Array.from({ length: 25 }, () => text))],
	];
}

/** Control bytes of the LZMA2 chunks in `data`, with the size bits of LZMA chunks cleared. */
function chunkKinds(data: Uint8Array): number[] {
	const kinds: number[] = [];
	let pos = 0;

	while (data[pos] !== 0x00) {
		const control = data[pos];
		if (control < 0x80) {
			kinds.push(control);
			pos += 3 + ((data[pos + 1] << 8) | data[pos + 2]) + 1;
		} else {
			kinds.push(control & 0xE0);
			pos += (control >= 0xC0 ? 6 : 5) + ((data[pos + 3] << 8) | data[pos + 4]) + 1;
		}
	}

	return kinds;
}

// Each preset with an explicit dictionary size, which raw data needs.
const lzma2Filters: [string, number][] = [
	["preset=0", 256 << 10],
	["preset=6", 8 << 20],
	["preset=9e", 64 << 20],
	["preset=1", 4096],
	["preset=6,lc=0,lp=4,pb=0", 1 << 16],
	["preset=6,lc=4,lp=0,pb=4", 1 << 16],
	["preset=3,mode=fast,mf=hc3", 1 << 20],
];

const lzma1Filters: [string, RawLzma1Options][] = [
	["preset=0", { lc: 3, lp: 0, pb: 2, dictSize: 256 << 10 }],
	["preset=6", { lc: 3, lp: 0, pb: 2, dictSize: 8 << 20 }],
	["preset=6", { lc: 0, lp: 4, pb: 0, dictSize: 1 << 16 }],
	["preset=9e", { lc: 4, lp: 0, pb: 4, dictSize: 4096 }],
	["preset=1,mode=fast,mf=hc3", { lc: 1, lp: 2, pb: 1, dictSize: 1 << 20 }],
];

const xzRawOutputs = new Map<string, Uint8Array>();

/** Output of `xz --format=raw` with `filter`, cached because several tests need it. */
function xzRaw(filter: string, input: Uint8Array, name: string): Uint8Array {
	const key = `${filter} ${name}`;
	const cached = xzRawOutputs.get(key);
	if (cached !== undefined) {
		return cached;
	}

	const output = xz(["--compress", "--format=raw", "--stdout", filter], input);
	xzRawOutputs.set(key, output);
	return output;
}

const lzma2Filter = (preset: string, dictSize: number) => `--lzma2=${preset},dict=${dictSize}`;
const lzma1Filter = (preset: string, { lc, lp, pb, dictSize }: RawLzma1Options) => `--lzma1=${preset},dict=${dictSize},lc=${lc},lp=${lp},pb=${pb}`;

describe.skipIf(!hasXz)("xz raw interoperability", () => {
	for (const [name, input] of rawCorpus()) {
		test(`decodes ${name} from xz --lzma2`, async () => {
			for (const [preset, dictSize] of lzma2Filters) {
				const compressed = xzRaw(lzma2Filter(preset, dictSize), input, name);

				const output = decompressRawLzma2(compressed, { dictSize });

				expect(output).toEqual(input);
			}
		});

		test(`decodes ${name} from xz --lzma1`, async () => {
			for (const [preset, options] of lzma1Filters) {
				const compressed = xzRaw(lzma1Filter(preset, options), input, name);

				const output = decompressRawLzma1(compressed, options);
				const withSize = decompressRawLzma1(compressed, { ...options, uncompressedSize: input.length });

				expect(output).toEqual(input);
				expect(withSize).toEqual(input);
			}
		});
	}

	test("xz output covers every kind of LZMA2 chunk", () => {
		const kinds = new Set<number>();

		for (const [name, input] of rawCorpus()) {
			for (const [preset, dictSize] of lzma2Filters) {
				for (const kind of chunkKinds(xzRaw(lzma2Filter(preset, dictSize), input, name))) kinds.add(kind);
			}
		}

		expect([...kinds].sort((x, y) => x - y)).toEqual([0x01, 0x02, 0x80, 0xA0, 0xC0, 0xE0]);
	});
});

/**
 * Compresses `input` into a 7z archive and returns the packed stream of
 * its one entry. Without header compression (`-mhc=off`), the packed
 * streams start after the 32-byte signature header and end at the next
 * header, whose offset is stored in bytes 12-19.
 */
function sevenZip(method: string, input: Uint8Array): Uint8Array {
	const dir = mkdtempSync(join(tmpdir(), "lzma1-"));

	try {
		const archive = join(dir, "data.7z");
		const result = spawnSync("7z", ["a", "-t7z", "-mhc=off", "-si", method, archive], { input });
		if (result.status !== 0) {
			throw new Error(`7z a ${method} failed: ${result.stdout}`);
		}

		const bytes = new Uint8Array(readFileSync(archive));
		const nextHeaderOffset = Number(new DataView(bytes.buffer, bytes.byteOffset).getBigUint64(12, true));
		return bytes.slice(32, 32 + nextHeaderOffset);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe.skipIf(!has7z)("7-Zip interoperability", () => {
	const [, input] = rawCorpus().find(([name]) => name === "text, more noise, text")!;

	test("decodes a 7z LZMA2 entry with a dictionary reset in every block", async () => {
		const packed = sevenZip("-m0=lzma2:d=64k:c=128k", input);

		const output = decompressRawLzma2(packed, { dictSize: 1 << 16 });

		expect(chunkKinds(packed).filter((kind) => kind === 0xE0).length).toBeGreaterThan(2);
		expect(output).toEqual(input);
	});

	test("decodes a 7z LZMA2 entry", () => {
		const packed = sevenZip("-m0=lzma2:d=1m", input);

		const output = decompressRawLzma2(packed, { dictSize: 1 << 20 });

		expect(output).toEqual(input);
	});

	test("decodes a 7z LZMA entry, which has no end marker, given its size", async () => {
		const options = { lc: 1, lp: 2, pb: 1, dictSize: 1 << 16, uncompressedSize: input.length };
		const packed = sevenZip("-m0=lzma:d=64k:lc=1:lp=2:pb=1", input);

		const output = decompressRawLzma1(packed, options);
		const withoutSize = () => decompressRawLzma1(packed, { ...options, uncompressedSize: undefined });

		expect(output).toEqual(input);
		expect(withoutSize).toThrow("Truncated input");
	});

	test("decodes a 7z LZMA entry with an end marker", () => {
		const packed = sevenZip("-m0=lzma:d=64k:eos", input);

		const output = decompressRawLzma1(packed, { lc: 3, lp: 0, pb: 2, dictSize: 1 << 16 });

		expect(output).toEqual(input);
	});
});
