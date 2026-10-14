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

	// Bytes 0-254 and a single 255 at 8191. No match or short rep can cover
	// that position, so a literal starts there, as one starts every stream
	// at 0. That literal fills the last slot of the dictionary buffer, which
	// holds 1 byte for size 0 and 4096 bytes for size 8191.
	const literalAt8191 = () => {
		let x = 7;
		const data = Uint8Array.from({ length: 9000 }, () => {
			x ^= x << 13;
			x ^= x >>> 17;
			x ^= x << 5;
			return (x >>> 0) % 255;
		});
		data[8191] = 255;
		return data;
	};

	test.each([0, 8191])("hands out no byte past a declared size of %i before the error", async (size) => {
		const bad = compress(literalAt8191(), { dictSize: 4096, endMarker: false });
		new DataView(bad.buffer).setUint32(5, size, true);
		const reader = chunked(bad, 7).pipeThrough(new Decompress()).getReader();
		let received = 0;
		const readAll = async () => {
			for (let result = await reader.read(); !result.done; result = await reader.read()) {
				received += result.value.length;
			}
		};

		const promise = readAll();

		await expect(promise).rejects.toThrow("Corrupted input: data exceeds the declared size");
		expect(received).toBe(size);
	});

	test.each([1, 7, 64])("rejects a declared size smaller than the data in chunks of %i bytes", async (chunkSize) => {
		// Distinct bytes at the end are literals, so the declared size ends
		// between two symbols.
		const literalEnd = new Uint8Array([...input, ...Array.from({ length: 16 }, (_, i) => 0xF0 + i)]);
		const bad = compress(literalEnd);
		new DataView(bad.buffer).setUint32(5, literalEnd.length - 1, true);

		const promise = collect(chunked(bad, chunkSize).pipeThrough(new Decompress()));

		await expect(promise).rejects.toThrow("Corrupted input: data exceeds the declared size");
	});

	test("rejects an end marker before the declared size with strict", async () => {
		const tooLarge = compressed.slice();
		new DataView(tooLarge.buffer).setUint32(5, input.length + 1, true);

		const promise = collect(chunked(tooLarge, 64).pipeThrough(new Decompress({ strict: true })));

		await expect(promise).rejects.toThrow("Corrupted input: end marker before the declared size");
	});

	test("rejects an invalid strict on construction", () => {
		expect(() => new Decompress({ strict: 1 } as never)).toThrow(RangeError);
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
