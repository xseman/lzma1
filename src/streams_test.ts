import {
	describe,
	expect,
	test,
} from "bun:test";

import {
	InputBuffer,
	OutputBuffer,
} from "./streams.js";

describe("InputBuffer", () => {
	test("readBytes returns -1 when pos >= count", () => {
		const buf = new InputBuffer(new Uint8Array([1, 2, 3]));
		buf.pos = 3; // exhaust buffer

		const dest = new Uint8Array(5);
		const result = buf.readBytes(dest, 0, 5);
		expect(result).toBe(-1);
	});

	test("readBytes reads available bytes", () => {
		const buf = new InputBuffer(new Uint8Array([10, 20, 30, 40, 50]));
		const dest = new Uint8Array(5);

		const read = buf.readBytes(dest, 0, 3);
		expect(read).toBe(3);
		expect(dest[0]).toBe(10);
		expect(dest[1]).toBe(20);
		expect(dest[2]).toBe(30);
	});

	test("readBytes clamps to remaining bytes", () => {
		const buf = new InputBuffer(new Uint8Array([10, 20]));
		const dest = new Uint8Array(5);

		const read = buf.readBytes(dest, 0, 5);
		expect(read).toBe(2);
		expect(dest[0]).toBe(10);
		expect(dest[1]).toBe(20);
	});

	test("readBytes with offset", () => {
		const buf = new InputBuffer(new Uint8Array([10, 20, 30]));
		const dest = new Uint8Array(5);

		const read = buf.readBytes(dest, 2, 2);
		expect(read).toBe(2);
		expect(dest[2]).toBe(10);
		expect(dest[3]).toBe(20);
	});

	test("remaining getter returns correct value", () => {
		const buf = new InputBuffer(new Uint8Array([1, 2, 3, 4, 5]));
		expect(buf.remaining).toBe(5);

		buf.readByte();
		expect(buf.remaining).toBe(4);

		buf.readByte();
		buf.readByte();
		expect(buf.remaining).toBe(2);
	});

	test("readByte returns -1 at end of stream", () => {
		const buf = new InputBuffer(new Uint8Array([0xFF]));
		expect(buf.readByte()).toBe(0xFF);
		expect(buf.readByte()).toBe(-1);
	});
});

describe("OutputBuffer", () => {
	test("grows when capacity exceeded", () => {
		const out = new OutputBuffer(2);
		out.writeByte(1);
		out.writeByte(2);
		out.writeByte(3); // triggers grow

		const result = out.toArray();
		expect(result.length).toBe(3);
		expect(result[0]).toBe(1);
		expect(result[1]).toBe(2);
		expect(result[2]).toBe(3);
	});

	test("writeBytes writes bulk data", () => {
		const out = new OutputBuffer(16);
		const src = new Uint8Array([10, 20, 30, 40, 50]);
		out.writeBytes(src, 1, 3);

		const result = out.toArray();
		expect(result.length).toBe(3);
		expect(result[0]).toBe(20);
		expect(result[1]).toBe(30);
		expect(result[2]).toBe(40);
	});

	test("write writes entire buffer", () => {
		const out = new OutputBuffer(16);
		const data = new Uint8Array([1, 2, 3]);
		out.write(data);

		const result = out.toArray();
		expect(result.length).toBe(3);
		expect(result[0]).toBe(1);
	});

	test("toArray returns copy of written data", () => {
		const out = new OutputBuffer(16);
		out.writeByte(0xAA);
		out.writeByte(0xBB);

		const arr = out.toArray();
		expect(arr.length).toBe(2);
		expect(arr[0]).toBe(0xAA);
		expect(arr[1]).toBe(0xBB);
	});
});
