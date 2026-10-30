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
	DecompressRawLzma1,
	DecompressRawLzma2,
	MemoryLimitError,
	OutputLimitError,
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

	test.each([1, 7, 4096])("hands out the output within maxOutputLength, then errors, in chunks of %i bytes", async (chunkSize) => {
		const unknownSize = compressed.slice().fill(0xFF, 5, 13);
		const maxOutputLength = input.length - 1000;
		const reader = chunked(unknownSize, chunkSize).pipeThrough(new Decompress({ maxOutputLength })).getReader();
		let received = 0;
		const readAll = async () => {
			for (let result = await reader.read(); !result.done; result = await reader.read()) {
				received += result.value.length;
			}
		};

		const promise = readAll();

		await expect(promise).rejects.toBeInstanceOf(OutputLimitError);
		expect(received).toBeLessThanOrEqual(maxOutputLength);
	});

	test("accepts output of exactly maxOutputLength", async () => {
		const output = await collect(chunked(compressed, 64).pipeThrough(new Decompress({ maxOutputLength: input.length })));

		expect(output).toEqual(input);
	});

	test("rejects an invalid maxOutputLength on construction", () => {
		expect(() => new Decompress({ maxOutputLength: -1 })).toThrow(RangeError);
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

/**
 * An LZMA2 chunk with new properties (0xC0 or 0xE0) holding `data`,
 * compressed by this library. Without a dictionary reset, the data before
 * it has to end at a multiple of 16 with a 0x00 byte.
 */
function lzmaChunk(control: 0xC0 | 0xE0, data: Uint8Array): Uint8Array {
	const lzma = compress(data, { endMarker: false });
	const packed = lzma.subarray(13);
	const header = [control, (data.length - 1) >> 8, (data.length - 1) & 0xFF, (packed.length - 1) >> 8, (packed.length - 1) & 0xFF, lzma[0]];
	return Uint8Array.from([...header, ...packed]);
}

describe("DecompressRawLzma2", () => {
	// Uncompressed chunks of 1000 and 600 bytes, then LZMA chunks with all
	// resets and with new properties
	const parts = [sampleData(1000), sampleData(600), sampleData(20_000), sampleData(30_000)];
	parts[1][599] = 0x00;
	const input = Uint8Array.from(parts.flatMap((part) => [...part]));
	const packed = Uint8Array.from([
		...[0x01, 0x03, 0xE7, ...parts[0]],
		...[0x02, 0x02, 0x57, ...parts[1]],
		...lzmaChunk(0xC0, parts[2]),
		...lzmaChunk(0xE0, parts[3]),
		0x00,
	]);

	test.each([1, 7, 4093, 65_537, 1 << 20])("decodes input in chunks of %i bytes", async (chunkSize) => {
		const output = await collect(chunked(packed, chunkSize).pipeThrough(new DecompressRawLzma2({ dictSize: 1 << 16 })));

		expect(output).toEqual(input);
	});

	test("rejects truncated input", async () => {
		const truncated = packed.subarray(0, packed.length - 1);

		const promise = collect(chunked(truncated, 100).pipeThrough(new DecompressRawLzma2({ dictSize: 1 << 16 })));

		await expect(promise).rejects.toThrow("Truncated input");
	});

	test("rejects corrupted input", async () => {
		const bad = packed.slice();
		bad[0] = 0x03;

		const promise = collect(chunked(bad, 100).pipeThrough(new DecompressRawLzma2({ dictSize: 1 << 16 })));

		await expect(promise).rejects.toThrow("Corrupted input");
	});

	test("rejects invalid options on construction", () => {
		const create = () => new DecompressRawLzma2({ dictSize: 100 });

		expect(create).toThrow(RangeError);
	});

	test("rejects a dictionary over the memory limit on construction", () => {
		const create = () => new DecompressRawLzma2({ dictSize: 1 << 30, memoryLimitKb: 1024 });

		expect(create).toThrow(MemoryLimitError);
	});
});

describe("DecompressRawLzma1", () => {
	const input = sampleData(50_000);
	const properties = { lc: 3, lp: 0, pb: 2, dictSize: 1 << 16 };
	const withMarker = compress(input).subarray(13);
	const withoutMarker = compress(input, { endMarker: false }).subarray(13);

	test.each([1, 7, 4093, 65_537])("decodes input in chunks of %i bytes", async (chunkSize) => {
		const output = await collect(chunked(withMarker, chunkSize).pipeThrough(new DecompressRawLzma1(properties)));

		expect(output).toEqual(input);
	});

	test.each([1, 7, 4093])("decodes input without an end marker in chunks of %i bytes given its size", async (chunkSize) => {
		const options = { ...properties, uncompressedSize: input.length };

		const output = await collect(chunked(withoutMarker, chunkSize).pipeThrough(new DecompressRawLzma1(options)));

		expect(output).toEqual(input);
	});

	test("rejects truncated input", async () => {
		const truncated = withMarker.subarray(0, withMarker.length >> 1);

		const promise = collect(chunked(truncated, 100).pipeThrough(new DecompressRawLzma1(properties)));

		await expect(promise).rejects.toThrow("Truncated input");
	});

	test("rejects an end marker before the given size", async () => {
		const options = { ...properties, uncompressedSize: input.length + 1 };

		const promise = collect(chunked(withMarker, 1).pipeThrough(new DecompressRawLzma1(options)));

		await expect(promise).rejects.toThrow("Corrupted input: end marker before the declared size");
	});

	test("rejects invalid options on construction", () => {
		const create = () => new DecompressRawLzma1({ ...properties, lc: 9 });

		expect(create).toThrow(RangeError);
	});

	test("rejects a dictionary over the memory limit on construction", () => {
		const create = () => new DecompressRawLzma1({ ...properties, dictSize: 1 << 30, memoryLimitKb: 1024 });

		expect(create).toThrow(MemoryLimitError);
	});

	test("rejects a given size over the output limit on construction", () => {
		const create = () => new DecompressRawLzma1({ ...properties, uncompressedSize: input.length, maxOutputLength: input.length - 1 });

		expect(create).toThrow(OutputLimitError);
	});

	test("rejects an unknown size once the output exceeds the output limit", async () => {
		const promise = collect(chunked(withMarker, 100).pipeThrough(new DecompressRawLzma1({ ...properties, maxOutputLength: input.length - 1 })));

		await expect(promise).rejects.toBeInstanceOf(OutputLimitError);
	});
});
