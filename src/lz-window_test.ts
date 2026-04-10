import {
	describe,
	expect,
	test,
} from "bun:test";

import { LzOutWindow } from "./lz-window.js";
import { OutputBuffer } from "./streams.js";

describe("LzOutWindow", () => {
	test("constructor initializes with default values", () => {
		const win = new LzOutWindow(null, 1024);
		expect(win.windowSize).toBe(1024);
		expect(win.pos).toBe(0);
		expect(win.streamPos).toBe(0);
		expect(win.buffer).not.toBeNull();
		expect(win.buffer!.length).toBe(1024);
	});

	test("putByte writes a byte and increments pos", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 1024);

		win.putByte(0x42);
		expect(win.buffer![0]).toBe(0x42);
		expect(win.pos).toBe(1);
		expect(win.streamPos).toBe(1);
	});

	test("putByte auto-flushes when pos reaches windowSize", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 4);

		win.putByte(0x01);
		win.putByte(0x02);
		win.putByte(0x03);
		win.putByte(0x04); // Should trigger flush, pos resets to 0

		expect(win.pos).toBe(0);
		const result = out.toArray();
		expect(result.length).toBe(4);
		expect(result[0]).toBe(0x01);
		expect(result[3]).toBe(0x04);
	});

	test("getByte retrieves byte at relative position", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 1024);

		win.putByte(0x10);
		win.putByte(0x20);
		win.putByte(0x30);

		// getByte with negative offset relative to pos
		const byte = win.getByte(-3); // 3 positions back from pos=3
		expect(byte).toBe(0x10);
	});

	test("getByte wraps around with negative position", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 4);

		// Write at position 0
		win.buffer![3] = 0xAA;

		// getByte with negative offset that wraps
		const byte = win.getByte(-1 + 4); // should wrap to position 3
		expect(byte).toBe(0xAA);
	});

	test("getByte wraps around with position exceeding windowSize", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 4);

		win.buffer![0] = 0xBB;
		// Manually set pos to 3
		win.pos = 3;

		// relativePos = 1 → pos + relativePos = 4 >= windowSize → wraps to 0
		const byte = win.getByte(1);
		expect(byte).toBe(0xBB);
	});

	test("getByte returns 0 when buffer is null", () => {
		const win = new LzOutWindow(null, 4);
		win.buffer = null;
		const byte = win.getByte(0);
		expect(byte).toBe(0);
	});

	test("copyBlock copies from previous position", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 1024);

		// Write "ABC"
		win.putByte(0x41);
		win.putByte(0x42);
		win.putByte(0x43);

		// Copy 3 bytes from distance 2 (copies "ABC" starting from pos-3)
		win.copyBlock(2, 3);

		expect(win.buffer![3]).toBe(0x41);
		expect(win.buffer![4]).toBe(0x42);
		expect(win.buffer![5]).toBe(0x43);
	});

	test("copyBlock with wraparound", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 8);

		// Write bytes near the end of window
		win.buffer![6] = 0xAA;
		win.buffer![7] = 0xBB;
		win.pos = 1; // Position 1
		win.streamPos = 1;

		// distance=2 → sourcePos = 1 - 2 - 1 = -2 → wraps to 6
		win.copyBlock(2, 2);

		expect(win.buffer![1]).toBe(0xAA);
		expect(win.buffer![2]).toBe(0xBB);
	});

	test("copyBlock does nothing when buffer is null", () => {
		const win = new LzOutWindow(null, 4);
		win.buffer = null;
		// Should not throw
		win.copyBlock(0, 1);
	});

	test("putByte does nothing when buffer is null", () => {
		const win = new LzOutWindow(null, 4);
		win.buffer = null;
		// Should not throw
		win.putByte(0x42);
	});

	test("flush writes buffered data to writer", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 1024);

		win.putByte(0x01);
		win.putByte(0x02);
		win.flush();

		const result = out.toArray();
		expect(result.length).toBe(2);
		expect(result[0]).toBe(0x01);
		expect(result[1]).toBe(0x02);
		expect(win.pos).toBe(0); // pos reset after flush
	});

	test("flush with no data does nothing", () => {
		const out = new OutputBuffer(64);
		const win = new LzOutWindow(out, 1024);

		win.flush();
		expect(out.toArray().length).toBe(0);
	});

	test("flush without writer does not throw", () => {
		const win = new LzOutWindow(null, 1024);
		win.putByte(0x01);
		// Should not throw even without writer
		win.flush();
	});

	test("isEmpty returns true initially", () => {
		const win = new LzOutWindow(null, 1024);
		expect(win.isEmpty()).toBe(true);
	});

	test("isEmpty returns false after writing", () => {
		const win = new LzOutWindow(null, 1024);
		win.putByte(0x01);
		expect(win.isEmpty()).toBe(false);
	});

	test("reset clears pos, streamPos, and buffer", () => {
		const win = new LzOutWindow(null, 8);
		win.putByte(0x01);
		win.putByte(0x02);

		win.reset();

		expect(win.pos).toBe(0);
		expect(win.streamPos).toBe(0);
		expect(win.buffer![0]).toBe(0);
		expect(win.buffer![1]).toBe(0);
	});

	test("reset with null buffer does not throw", () => {
		const win = new LzOutWindow(null, 4);
		win.buffer = null;
		win.reset();
		expect(win.pos).toBe(0);
	});
});
