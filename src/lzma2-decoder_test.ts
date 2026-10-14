import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	compress,
	type CompressionOptions,
	decompressRawLzma2,
	MemoryLimitError,
} from "./index.js";
import { LzDecoder } from "./lz-decoder.js";
import {
	IS_MATCH,
	LITERAL,
	probsSize,
	stateAfterLiteral,
} from "./lzma-coder.js";
import {
	copyUncompressed,
	resetDictionary,
} from "./lzma2-decoder.js";
import { initProbs } from "./range-coder.js";
import { RangeEncoder } from "./range-encoder.js";

const TEXT = new TextEncoder().encode("Every LZMA2 chunk starts with a control byte, then its sizes. ");

function createRandom(seed: number): () => number {
	return () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
}

/** Text with some noise. The last byte is 0x00, see `lzmaChunk`. */
function sample(size: number, seed: number): Uint8Array {
	const random = createRandom(seed);
	const data = Uint8Array.from({ length: size }, (_, i) => (random() < 0.9 ? TEXT[i % TEXT.length] : Math.floor(random() * 256)));
	data[size - 1] = 0x00;
	return data;
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

/** A size as LZMA2 headers store it: minus one, big-endian, low 16 bits. */
const sizeBytes = (size: number) => [((size - 1) >> 8) & 0xFF, (size - 1) & 0xFF];

function uncompressedChunk(control: 0x01 | 0x02, data: Uint8Array): Uint8Array {
	return concat(Uint8Array.from([control, ...sizeBytes(data.length)]), data);
}

/**
 * An LZMA chunk of `data` compressed by this library: its `.lzma` output
 * without the header and the end marker. The encoder starts at position 0
 * after a 0x00 byte, so a chunk without a dictionary reset is valid only
 * where the decoder's position is a multiple of 16 and the previous byte is
 * 0x00.
 */
function lzmaChunk(control: number, data: Uint8Array, options: CompressionOptions = {}): Uint8Array {
	const lzma = compress(data, { ...options, endMarker: false });
	return chunkWithHeader(control, data.length, lzma.subarray(13), lzma[0]);
}

function chunkWithHeader(control: number, uncompressedSize: number, packed: Uint8Array, props: number): Uint8Array {
	const header = [control | ((uncompressedSize - 1) >>> 16), ...sizeBytes(uncompressedSize), ...sizeBytes(packed.length)];
	if (control >= 0xC0) header.push(props);
	return concat(Uint8Array.from(header), packed);
}

/** Probabilities and state of an encoder that writes only literals. */
interface LiteralModel {
	lc: number;
	lp: number;
	pb: number;
	probs: Uint16Array;
	state: number;
}

function createLiteralModel(lc: number, lp: number, pb: number): LiteralModel {
	const probs = new Uint16Array(probsSize(lc, lp));
	initProbs(probs);

	return { lc, lp, pb, probs, state: 0 };
}

/**
 * Encodes `data` at `pos` as literals only, with the probabilities of
 * `model` carried over from earlier chunks. xz and 7-Zip reset the state
 * after an uncompressed chunk; this encoder doesn't, so an LZMA chunk
 * without reset can follow one, which the format allows. Only literals
 * keep the state a literal state, so each is a plain 8-bit tree.
 */
function literalChunk(control: number, model: LiteralModel, history: Uint8Array, data: Uint8Array): Uint8Array {
	const rc = new RangeEncoder(data.length);
	const posMask = (1 << model.pb) - 1;
	const literalPosMask = (1 << model.lp) - 1;
	let pos = history.length;
	let prevByte = history.at(-1) ?? 0;

	for (const byte of data) {
		rc.encodeBit(model.probs, IS_MATCH + (model.state << 4) + (pos & posMask), 0);
		const subcoder = (prevByte >> (8 - model.lc)) + ((pos & literalPosMask) << model.lc);
		rc.encodeBitTree(model.probs, LITERAL + 0x300 * subcoder, 8, byte);
		model.state = stateAfterLiteral(model.state);
		prevByte = byte;
		++pos;
	}

	const props = (model.pb * 5 + model.lp) * 9 + model.lc;

	return chunkWithHeader(control, data.length, rc.finish(), props);
}

const END = Uint8Array.from([0x00]);

// Positions after each piece: 4805, 6416 (16 * 401), 9616 (16 * 601),
// 11623, then a dictionary reset, 1008 (16 * 63). B is 1611 bytes, so C
// decodes correctly only if the decoder counts uncompressed bytes. D leaves
// the position at 11623, not a multiple of 16, so F decodes correctly only
// if the position restarts at E's dictionary reset.
const pieces = [4805, 1611, 3200, 2007, 1008, 4000, 500].map((size, i) => sample(size, i + 1));
const [a, b, c, d, e, f, g] = pieces;
const expected = concat(...pieces);
const stream = concat(
	lzmaChunk(0xE0, a),
	uncompressedChunk(0x02, b),
	lzmaChunk(0xA0, c),
	lzmaChunk(0xC0, d, { lc: 0, lp: 2, pb: 1 }),
	uncompressedChunk(0x01, e),
	lzmaChunk(0xC0, f, { lc: 4, lp: 0, pb: 4 }),
	lzmaChunk(0xE0, g),
	END,
);

const decode = (data: Uint8Array) => decompressRawLzma2(data, { dictSize: 1 << 16 });

describe("LZMA2 chunks", () => {
	test("decodes every kind of reset and uncompressed chunk", () => {
		const output = decode(stream);

		expect(output).toEqual(expected);
	});

	test("carries the position across chunks without reset", () => {
		const model = createLiteralModel(1, 2, 2);
		const [p1, p2, p3, p4] = [1001, 501, 333, 777].map((size, i) => sample(size, i + 10));

		const data = concat(
			literalChunk(0xE0, model, new Uint8Array(0), p1),
			literalChunk(0x80, model, p1, p2),
			uncompressedChunk(0x02, p3),
			literalChunk(0x80, model, concat(p1, p2, p3), p4),
			END,
		);

		const output = decode(data);

		expect(output).toEqual(concat(p1, p2, p3, p4));
	});

	test("decodes an empty stream", () => {
		const output = decode(END);

		expect(output).toEqual(new Uint8Array(0));
	});

	test("decodes a dictionary smaller than the data", () => {
		const data = concat(uncompressedChunk(0x01, a), uncompressedChunk(0x02, b), lzmaChunk(0xC0, c), END);

		const output = decompressRawLzma2(data, { dictSize: 4096 });

		expect(output).toEqual(concat(a, b, c));
	});

	test("decodes with the largest dictionary size", () => {
		const output = decompressRawLzma2(stream, { dictSize: 0xFFFFFFFF });

		expect(output).toEqual(expected);
	});

	test("ignores data after the end marker", () => {
		const output = decode(concat(stream, Uint8Array.from([1, 2, 3])));

		expect(output).toEqual(expected);
	});
});

describe("LZMA2 errors", () => {
	test("rejects truncated input", () => {
		for (let cut = 0; cut < stream.length; cut += 97) {
			expect(() => decode(stream.subarray(0, cut))).toThrow("Truncated input");
		}
		expect(() => decode(stream.subarray(0, -1))).toThrow("Truncated input");
	});

	test.each([
		["an uncompressed chunk", uncompressedChunk(0x02, a)],
		["an LZMA chunk without reset", lzmaChunk(0x80, a)],
		["an LZMA chunk with a state reset", lzmaChunk(0xA0, a)],
		["an LZMA chunk with new properties", lzmaChunk(0xC0, a)],
	])("rejects %s as the first chunk", (_, chunk) => {
		const data = concat(chunk, END);

		const run = () => decode(data);

		expect(run).toThrow("Corrupted input: the first LZMA2 chunk doesn't reset the dictionary");
	});

	test.each([0x80, 0xA0])("rejects an LZMA chunk 0x%s without properties after a dictionary reset", (control) => {
		const data = concat(uncompressedChunk(0x01, a), lzmaChunk(control, b), END);

		const run = () => decode(data);

		expect(run).toThrow("Corrupted input: LZMA2 chunk without properties");
	});

	test.each([0x03, 0x10, 0x7F])("rejects the control byte %i", (control) => {
		const data = concat(uncompressedChunk(0x01, a), Uint8Array.from([control, 0, 0, 0, 0, 0]), END);

		const run = () => decode(data);

		expect(run).toThrow("Corrupted input: invalid LZMA2 control byte");
	});

	test.each([
		["lc + lp > 4", (0 * 5 + 1) * 9 + 4],
		["a byte above 224", 225],
	])("rejects properties with %s", (_, props) => {
		const data = concat(lzmaChunk(0xE0, a), END);
		data[5] = props;

		const run = () => decode(data);

		expect(run).toThrow("Corrupted input: invalid LZMA2 properties");
	});

	test("rejects an LZMA chunk shorter than the range coder needs", () => {
		const data = Uint8Array.from([0xE0, 0x00, 0x00, 0x00, 0x03, 0x5D, 0x00, 0x00, 0x00, 0x00, 0x00]);

		const run = () => decode(data);

		expect(run).toThrow("Corrupted input: LZMA2 chunk is too short");
	});

	test.each([
		["a larger uncompressed size", 1, 0],
		["a smaller uncompressed size", -1, 0],
		["a larger compressed size", 0, 1],
		["a smaller compressed size", 0, -1],
	])("rejects %s than the chunk holds", (_, uncompressedDelta, compressedDelta) => {
		const chunk = lzmaChunk(0xE0, a);
		const view = new DataView(chunk.buffer);
		view.setUint16(1, view.getUint16(1) + uncompressedDelta);
		view.setUint16(3, view.getUint16(3) + compressedDelta);
		const data = concat(chunk, END, new Uint8Array(100));

		const run = () => decode(data);

		expect(run).toThrow("Corrupted input");
	});

	test("rejects an end marker in an LZMA chunk", () => {
		const packed = compress(a).subarray(13);
		const data = concat(Uint8Array.from([0xE0, ...sizeBytes(a.length + 1), ...sizeBytes(packed.length), 0x5D]), packed, END);

		const run = () => decode(data);

		expect(run).toThrow("Corrupted input: LZMA2 chunk doesn't match its sizes");
	});

	test("rejects a dictionary over the memory limit", () => {
		let error: unknown;

		try {
			decompressRawLzma2(stream, { dictSize: 1 << 30, memoryLimitKb: 1 << 20 });
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(MemoryLimitError);
		expect(error).toMatchObject({
			name: "MemoryLimitError",
			memoryNeededKb: 40 + 64 + (1 << 20),
			memoryLimitKb: 1 << 20,
			message: "1048680 KiB of memory would be needed; limit was 1048576 KiB",
		});
	});

	test("accepts a dictionary within the memory limit", () => {
		const output = decompressRawLzma2(stream, { dictSize: 1 << 16, memoryLimitKb: 40 + 64 + 64 });

		expect(output).toEqual(expected);
	});

	test.each([
		{ dictSize: 4095 },
		{ dictSize: 2 ** 32 },
		{ dictSize: 1.5 * 4096 + 0.5 },
		{ dictSize: undefined },
		{ dictSize: 4096, memoryLimitKb: -1 },
		{ dictSize: 4096, memoryLimitKb: Infinity },
	])("rejects %o", (options) => {
		const run = () => decompressRawLzma2(stream, options as never);

		expect(run).toThrow(RangeError);
	});
});

describe("LZ dictionary for LZMA2", () => {
	function create(dictSize: number) {
		const chunks: Uint8Array[] = [];
		const lz = new LzDecoder(dictSize, (chunk) => chunks.push(chunk.slice()));
		const output = () => {
			lz.flush();
			return Uint8Array.from(chunks.flatMap((c) => [...c]));
		};
		return { lz, output };
	}

	test("copyUncompressed copies across buffer growth and wrap-around", () => {
		const { lz, output } = create(100_000);
		const input = Uint8Array.from({ length: 160_000 }, (_, i) => i % 251);

		copyUncompressed(lz, input, 3, 150_000);
		lz.repeat(99_999, 5);

		expect(output()).toEqual(Uint8Array.from([...input.subarray(3, 150_003), ...input.subarray(50_003, 50_008)]));
	});

	test("resetDictionary passes pending bytes to the sink and forgets the history", () => {
		const { lz, output } = create(4096);
		for (const b of [1, 2, 3]) lz.putByte(b);

		resetDictionary(lz);
		lz.putByte(4);

		expect(lz.getByte(1)).toBe(0);
		expect(() => lz.repeat(1, 1)).toThrow("Corrupted input");
		expect(output()).toEqual(new Uint8Array([1, 2, 3, 4]));
	});

	test("resetDictionary after a wrap-around reads a 0x00 before the first byte", () => {
		const { lz, output } = create(4096);
		for (let i = 0; i < 5000; i++) lz.putByte(0xAA);

		resetDictionary(lz);

		expect(lz.getByte(0)).toBe(0);
		expect(output()).toEqual(new Uint8Array(5000).fill(0xAA));
	});
});
