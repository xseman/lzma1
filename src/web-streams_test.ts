import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	Compress,
	compress,
	Decompress,
	decompress,
} from "./index.js";

function createRandom(seed: number): () => number {
	return () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
}

function sampleData(size: number): Uint8Array {
	const random = createRandom(11);
	const text = new TextEncoder().encode("streams of bytes flow through transform streams; ");
	const data = new Uint8Array(size);
	for (let i = 0; i < size; i++) {
		data[i] = random() < 0.9 ? text[i % text.length] : Math.floor(random() * 256);
	}
	return data;
}

function chunked(data: Uint8Array, chunkSize: number): ReadableStream<Uint8Array> {
	let pos = 0;
	return new ReadableStream({
		pull(controller) {
			if (pos >= data.length) {
				controller.close();
				return;
			}
			controller.enqueue(data.slice(pos, pos + chunkSize));
			pos += chunkSize;
		},
	});
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("Decompress", () => {
	const input = sampleData(50_000);
	const compressed = compress(input);

	test.each([1, 7, 64, 4096, 1 << 20])("decodes input in chunks of %i bytes", async (chunkSize) => {
		const output = await collect(chunked(compressed, chunkSize).pipeThrough(new Decompress()));
		expect(output).toEqual(input);
	});

	test("decodes a dictionary smaller than the data", async () => {
		const data = sampleData(300_000);
		const small = compress(data, { dictSize: 4096 });
		const output = await collect(chunked(small, 1000).pipeThrough(new Decompress()));
		expect(output).toEqual(data);
	});

	test("rejects truncated input", async () => {
		const truncated = compressed.subarray(0, compressed.length >> 1);
		const promise = collect(chunked(truncated, 100).pipeThrough(new Decompress()));
		await expect(promise).rejects.toThrow("Truncated input");
	});

	test("rejects corrupted input", async () => {
		const bad = compressed.slice();
		bad[0] = 0xFF;
		const promise = collect(chunked(bad, 100).pipeThrough(new Decompress()));
		await expect(promise).rejects.toThrow("Corrupted input");
	});
});

describe("Compress", () => {
	test.each([1, 1000, 1 << 20])("encodes input in chunks of %i bytes", async (chunkSize) => {
		const input = sampleData(chunkSize === 1 ? 5000 : 100_000);
		const compressed = await collect(chunked(input, chunkSize).pipeThrough(new Compress()));

		// The size is unknown when streaming.
		expect(compressed.subarray(5, 13)).toEqual(new Uint8Array(8).fill(0xFF));
		expect(decompress(compressed)).toEqual(input);
	});

	test("accepts a level or options", async () => {
		const input = sampleData(20_000);
		for (const options of [1, 9, { dictSize: 4096, lc: 0 }, { endMarker: true }] as const) {
			const compressed = await collect(chunked(input, 3000).pipeThrough(new Compress(options)));
			expect(decompress(compressed)).toEqual(input);
		}
	});

	test("input larger than the window buffer", async () => {
		// With unknown size, the encoder window is about 270 KiB for a 4 KiB
		// dictionary, so this input makes it move several times.
		const input = sampleData(1_500_000);
		const compressed = await collect(chunked(input, 65536).pipeThrough(new Compress({ level: 4, dictSize: 4096 })));
		expect(decompress(compressed)).toEqual(input);
	});

	test("round-trips through both streams", async () => {
		const input = sampleData(200_000);
		const output = await collect(
			chunked(input, 9999)
				.pipeThrough(new Compress(2))
				.pipeThrough(new Decompress()),
		);
		expect(output).toEqual(input);
	});

	test("empty stream", async () => {
		const compressed = await collect(chunked(new Uint8Array(0), 1).pipeThrough(new Compress()));
		expect(decompress(compressed)).toEqual(new Uint8Array(0));
	});

	test("rejects invalid options on construction", () => {
		expect(() => new Compress({ lc: 20 })).toThrow(RangeError);
	});

	test("rejects endMarker: false, the size of a stream is unknown", () => {
		const create = () => new Compress({ endMarker: false });

		expect(create).toThrow(RangeError);
	});
});
