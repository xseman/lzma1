import {
	describe,
	test,
} from "bun:test";

import {
	compress,
	decompress,
} from "./index.js";

// --- Data generators ---

function generateRepetitive(size: number): Uint8Array {
	const text = "The quick brown fox jumps over the lazy dog. ";
	const buf = new Uint8Array(size);
	const encoder = new TextEncoder();
	const pattern = encoder.encode(text);
	for (let i = 0; i < size; i++) {
		buf[i] = pattern[i % pattern.length];
	}
	return buf;
}

function generateRandom(size: number): Uint8Array {
	const buf = new Uint8Array(size);
	for (let i = 0; i < size; i++) {
		buf[i] = (Math.random() * 256) | 0;
	}
	return buf;
}

function generateLoremIpsum(size: number): Uint8Array {
	const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. ";
	const encoder = new TextEncoder();
	const pattern = encoder.encode(lorem);
	const buf = new Uint8Array(size);
	for (let i = 0; i < size; i++) {
		buf[i] = pattern[i % pattern.length];
	}
	return buf;
}

function generateMixed(size: number): Uint8Array {
	const buf = new Uint8Array(size);
	const quarter = (size / 4) | 0;
	// 1/4 repetitive text
	const rep = generateRepetitive(quarter);
	buf.set(rep, 0);
	// 1/4 random
	const rand = generateRandom(quarter);
	buf.set(rand, quarter);
	// 1/4 zeros
	buf.fill(0, quarter * 2, quarter * 3);
	// 1/4 ascending bytes
	for (let i = quarter * 3; i < size; i++) {
		buf[i] = i & 0xFF;
	}
	return buf;
}

// --- Benchmark helpers ---

type CompressionMode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface BenchResult {
	name: string;
	inputSize: number;
	compressedSize: number;
	ratio: number;
	compressTimeMs: number;
	decompressTimeMs: number;
	compressMBps: number;
	decompressMBps: number;
}

function bench(
	name: string,
	data: Uint8Array,
	mode: CompressionMode,
	warmup: number = 1,
	iterations: number = 3,
): BenchResult {
	// Warmup
	for (let i = 0; i < warmup; i++) {
		const c = compress(data, mode);
		decompress(c);
	}

	// Compress
	let compressed!: Uint8Array;
	const compressTimes: number[] = [];
	for (let i = 0; i < iterations; i++) {
		const start = performance.now();
		compressed = compress(data, mode);
		compressTimes.push(performance.now() - start);
	}

	// Decompress
	const decompressTimes: number[] = [];
	for (let i = 0; i < iterations; i++) {
		const start = performance.now();
		decompress(compressed);
		decompressTimes.push(performance.now() - start);
	}

	const medianCompress = median(compressTimes);
	const medianDecompress = median(decompressTimes);
	const sizeMB = data.length / (1024 * 1024);

	return {
		name,
		inputSize: data.length,
		compressedSize: compressed.length,
		ratio: compressed.length / data.length,
		compressTimeMs: medianCompress,
		decompressTimeMs: medianDecompress,
		compressMBps: sizeMB / (medianCompress / 1000),
		decompressMBps: sizeMB / (medianDecompress / 1000),
	};
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = (sorted.length / 2) | 0;
	return sorted.length % 2 !== 0
		? sorted[mid]
		: (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatResult(r: BenchResult): string {
	return [
		`  ${r.name}`,
		`    input: ${(r.inputSize / 1024).toFixed(1)} KB → ${(r.compressedSize / 1024).toFixed(1)} KB (ratio: ${(r.ratio * 100).toFixed(1)}%)`,
		`    compress:   ${r.compressTimeMs.toFixed(1)} ms  (${r.compressMBps.toFixed(3)} MB/s)`,
		`    decompress: ${r.decompressTimeMs.toFixed(1)} ms  (${r.decompressMBps.toFixed(3)} MB/s)`,
	].join("\n");
}

function printTable(results: BenchResult[]): void {
	console.log("\n┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
	console.log("│ Benchmark Results                                                                                     │");
	console.log("├──────────────────────────────────┬────────┬────────┬────────┬──────────┬───────────┬──────────┬────────┤");
	console.log("│ Name                             │  Input │ Output │  Ratio │ Comp ms  │ Comp MB/s │ Dec ms   │Dec MB/s│");
	console.log("├──────────────────────────────────┼────────┼────────┼────────┼──────────┼───────────┼──────────┼────────┤");
	for (const r of results) {
		const name = r.name.padEnd(32);
		const input = `${(r.inputSize / 1024).toFixed(0)}K`.padStart(6);
		const output = `${(r.compressedSize / 1024).toFixed(1)}K`.padStart(6);
		const ratio = `${(r.ratio * 100).toFixed(1)}%`.padStart(6);
		const compMs = r.compressTimeMs.toFixed(1).padStart(8);
		const compMBps = r.compressMBps.toFixed(3).padStart(9);
		const decMs = r.decompressTimeMs.toFixed(1).padStart(8);
		const decMBps = r.decompressMBps.toFixed(3).padStart(6);
		console.log(`│ ${name} │ ${input} │ ${output} │ ${ratio} │ ${compMs} │ ${compMBps} │ ${decMs} │ ${decMBps} │`);
	}
	console.log("└──────────────────────────────────┴────────┴────────┴────────┴──────────┴───────────┴──────────┴────────┘");
}

// --- Benchmark tests ---

const SIZES = [
	{ label: "1KB", size: 1024 },
	{ label: "10KB", size: 10 * 1024 },
	{ label: "100KB", size: 100 * 1024 },
];

const PATTERNS: { label: string; gen: (size: number) => Uint8Array; }[] = [
	{ label: "repetitive", gen: generateRepetitive },
	{ label: "random", gen: generateRandom },
	{ label: "lorem", gen: generateLoremIpsum },
	{ label: "mixed", gen: generateMixed },
];

const MODES: CompressionMode[] = [1, 5, 9];

describe("benchmarks", () => {
	const allResults: BenchResult[] = [];

	for (const mode of MODES) {
		describe(`mode ${mode}`, () => {
			for (const pattern of PATTERNS) {
				for (const { label: sizeLabel, size } of SIZES) {
					const name = `${pattern.label}/${sizeLabel}/mode${mode}`;
					test(name, () => {
						const data = pattern.gen(size);
						// Fewer iterations for slow combos
						const iters = size >= 100 * 1024 && mode >= 5 ? 1 : 3;
						const warmup = size >= 100 * 1024 && mode >= 5 ? 0 : 1;
						const result = bench(name, data, mode, warmup, iters);
						allResults.push(result);
						console.log(formatResult(result));
					}, { timeout: 120_000 });
				}
			}
		});
	}

	// Print summary table after all benchmarks
	test("summary", () => {
		printTable(allResults);

		// Memory usage snapshot
		if (typeof process !== "undefined" && process.memoryUsage) {
			const mem = process.memoryUsage();
			console.log("\nMemory Usage:");
			console.log(`  RSS:        ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
			console.log(`  Heap Used:  ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
			console.log(`  Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`);
			console.log(`  External:   ${(mem.external / 1024 / 1024).toFixed(1)} MB`);
		}
	}, { timeout: 5_000 });
});
