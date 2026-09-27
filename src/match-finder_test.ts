import {
	describe,
	expect,
	test,
} from "bun:test";

import { BT4 } from "./bt4.js";
import { HC4 } from "./hc4.js";
import type {
	LzEncoder,
	LzEncoderConfig,
} from "./lz-encoder.js";
import { MATCH_LEN_MAX } from "./lzma-coder.js";

function createRandom(seed: number): () => number {
	return () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
}

/** Text-like data: random words from a small vocabulary. */
function sampleData(size: number): Uint8Array {
	const random = createRandom(3);
	const words = ["alpha ", "beta ", "gamma ", "delta ", "epsilon ", "\n", "0123456789", "zeta "];
	const bytes = new Uint8Array(size);
	for (let i = 0; i < size;) {
		for (const c of words[Math.floor(random() * words.length)]) {
			if (i < size) bytes[i++] = c.charCodeAt(0);
		}
	}
	return bytes;
}

function longestMatch(data: Uint8Array, pos: number, dictSize: number, limit: number): number {
	let best = 0;
	for (let dist = 1; dist <= Math.min(pos, dictSize); dist++) {
		let len = 0;
		while (len < limit && pos + len < data.length && data[pos + len] === data[pos + len - dist]) len++;
		best = Math.max(best, len);
	}
	return best;
}

const config: LzEncoderConfig = {
	dictSize: 4096,
	extraSizeBefore: 1,
	extraSizeAfter: MATCH_LEN_MAX,
	niceLen: 64,
	matchLenMax: MATCH_LEN_MAX,
	depthLimit: 1000,
};

describe.each(
	[
		["BT4", (c: LzEncoderConfig) => new BT4(c)],
		["HC4", (c: LzEncoderConfig) => new HC4(c)],
	] as const,
)("%s", (_, create: (c: LzEncoderConfig) => LzEncoder) => {
	test("reports valid matches with increasing lengths", () => {
		const data = sampleData(20_000);
		const mf = create(config);
		mf.fillWindow(data, 0, data.length);
		mf.setFinishing();

		for (let pos = 0; pos < data.length; pos++) {
			const matches = mf.getMatches();

			for (let i = 0; i < matches.count; i++) {
				const len = matches.len[i];
				const dist = matches.dist[i];

				expect(dist).toBeLessThan(config.dictSize);
				expect(mf.getMatchLen(0, dist, len)).toBe(len);
				if (i > 0) expect(len).toBeGreaterThan(matches.len[i - 1]);
			}
		}
	});

	test("finds the longest match (up to niceLen) with unlimited depth", () => {
		const data = sampleData(3000);
		const mf = create(config);
		mf.fillWindow(data, 0, data.length);
		mf.setFinishing();

		for (let pos = 0; pos < data.length; pos++) {
			const matches = mf.getMatches();
			const found = matches.count > 0 ? matches.len[matches.count - 1] : 0;
			const expected = longestMatch(data, pos, config.dictSize, config.niceLen);

			if (expected >= 4) {
				expect(Math.min(found, config.niceLen)).toBe(Math.min(expected, config.niceLen));
			}
		}
	});

	test("skip() keeps later matches valid", () => {
		const data = sampleData(10_000);
		const mf = create(config);
		mf.fillWindow(data, 0, data.length);
		mf.setFinishing();

		for (let pos = 0; pos < data.length - 10; pos += 11) {
			mf.skip(10);
			const matches = mf.getMatches();
			for (let i = 0; i < matches.count; i++) {
				expect(mf.getMatchLen(0, matches.dist[i], matches.len[i])).toBe(matches.len[i]);
			}
		}
	});

	test("waits for lookahead until finishing", () => {
		const data = sampleData(100);
		const mf = create(config);
		mf.fillWindow(data, 0, data.length);

		// Less than keepSizeAfter bytes are buffered, so nothing can be encoded yet.
		expect(mf.hasEnoughData(0)).toBe(false);
		mf.setFinishing();
		expect(mf.hasEnoughData(0)).toBe(true);
	});
});
