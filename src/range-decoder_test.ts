import {
	describe,
	expect,
	test,
} from "bun:test";

import { RangeDecoder } from "./range-decoder.js";
import { InputBuffer } from "./streams.js";

describe("RangeDecoder", () => {
	test("currentCode getter returns code", () => {
		const rd = new RangeDecoder();
		rd.code = 12345;
		expect(rd.currentCode).toBe(12345);
	});

	test("currentRange getter returns rrange", () => {
		const rd = new RangeDecoder();
		rd.rrange = 99999;
		expect(rd.currentRange).toBe(99999);
	});

	test("readFromStream returns 0 when stream is null", () => {
		const rd = new RangeDecoder();
		rd.stream = null;

		// init() calls readFromStream internally
		// With null stream, it should use 0 for each byte
		rd.init();
		expect(rd.code).toBe(0);
	});

	test("setStream sets the stream", () => {
		const rd = new RangeDecoder();
		const input = new InputBuffer(new Uint8Array([0, 0, 0, 0, 0]));
		rd.setStream(input);
		expect(rd.stream).toBe(input);
	});

	test("setStream with null", () => {
		const rd = new RangeDecoder();
		rd.setStream(null);
		expect(rd.stream).toBeNull();
	});

	test("init reads 5 bytes from stream", () => {
		const data = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
		const input = new InputBuffer(data);
		const rd = new RangeDecoder();
		rd.setStream(input);
		rd.init();

		// After init, 5 bytes should be consumed
		expect(input.pos).toBe(5);
		expect(rd.rrange).toBe(-1);
	});

	test("decodeBit updates probability model", () => {
		const data = new Uint8Array(20).fill(0);
		const input = new InputBuffer(data);
		const rd = new RangeDecoder();
		rd.setStream(input);
		rd.init();

		const probs = [1024, 1024];
		const bit = rd.decodeBit(probs, 0);
		expect(bit === 0 || bit === 1).toBe(true);
		// Probability should have been updated
		expect(probs[0]).not.toBe(1024);
	});
});
