import {
	describe,
	expect,
	test,
} from "bun:test";

import { Decoder } from "./decoder.js";
import { OutputBuffer } from "./streams.js";

describe("Decoder", () => {
	test("literalCoder getter returns literalDecoder", () => {
		const decoder = new Decoder();
		expect(decoder.literalCoder).toBe(decoder.literalDecoder);
	});

	test("outWindowReleaseStream flushes and nulls stream", () => {
		const decoder = new Decoder();
		const output = new OutputBuffer(64);

		// Set up the outWindow with a stream
		decoder.outWindow.stream = output;
		decoder.outWindow.pos = 0;
		decoder.outWindow.streamPos = 0;

		decoder.outWindowReleaseStream();
		expect(decoder.outWindow.stream).toBeNull();
	});

	test("writeToOutput writes data to buffer", () => {
		const decoder = new Decoder();
		const buffer = new OutputBuffer(64);
		const data = new Uint8Array([1, 2, 3, 4, 5]);

		decoder.writeToOutput(buffer, data, 1, 3);
		const result = buffer.toArray();
		expect(result.length).toBe(3);
		expect(result[0]).toBe(2);
		expect(result[1]).toBe(3);
		expect(result[2]).toBe(4);
	});

	test("constructor initializes all fields", () => {
		const decoder = new Decoder();

		expect(decoder.state).toBe(0);
		expect(decoder.rep0).toBe(0);
		expect(decoder.rep1).toBe(0);
		expect(decoder.rep2).toBe(0);
		expect(decoder.rep3).toBe(0);
		expect(decoder.matchDecoders.length).toBe(0xC0);
		expect(decoder.posSlotDecoders.length).toBe(4);
	});

	test("setDecoderProperties returns false for short properties", () => {
		const decoder = new Decoder();
		const result = decoder.setDecoderProperties([1, 2, 3]); // less than 5
		expect(result).toBe(false);
	});

	test("setDecoderProperties returns false for invalid pb", () => {
		const decoder = new Decoder();
		// properties[0] = 45+45 = 225 → lc=225%9=0, remainder=25, lp=25%5=0, pb=5 (>4)
		const result = decoder.setDecoderProperties([225, 0, 0, 1, 0]);
		expect(result).toBe(false);
	});

	test("getByte handles negative position wraparound", () => {
		const decoder = new Decoder();
		decoder.outWindow.windowSize = 100;
		decoder.outWindow.buffer = new Uint8Array(100);
		decoder.outWindow.buffer[99] = 0xAB;
		decoder.outWindow.pos = 0;

		// distance = 0 → pos - 0 - 1 = -1 → wraps to 99
		const byte = decoder.getByte(0);
		expect(byte).toBe(0xAB);
	});
});
