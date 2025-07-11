import { write_0 } from "./io-utils.js";
import type { BufferWithCount } from "./lzma.js";
import { initArray } from "./utils.js";

export interface OutputWindow {
	_buffer: number[] | null;
	_windowSize: number;
	_pos: number;
	_streamPos: number;
	_stream: BufferWithCount | null;
}

/**
 * Creates an output window with the specified size
 */
export function createOutputWindow(windowSize: number, outWin: OutputWindow): void {
	if (outWin._buffer == null || outWin._windowSize != windowSize) {
		outWin._buffer = initArray(windowSize);
	}

	outWin._windowSize = windowSize;
	outWin._pos = 0;
	outWin._streamPos = 0;
}

/**
 * Flushes the output window to the stream
 */
export function flushOutputWindow(outWin: OutputWindow): void {
	let size = outWin._pos - outWin._streamPos;

	if (!size) {
		return;
	}

	write_0(
		outWin._stream!,
		outWin._buffer!,
		outWin._streamPos,
		size,
	);

	if (outWin._pos >= outWin._windowSize) {
		outWin._pos = 0;
	}

	outWin._streamPos = outWin._pos;
}

/**
 * Gets a byte from the output window at the specified distance
 */
export function getByteFromOutputWindow(outWin: OutputWindow, distance: number): number {
	let pos = outWin._pos - distance - 1;
	if (pos < 0) {
		pos += outWin._windowSize;
	}

	return outWin._buffer![pos];
}

/**
 * Puts a byte into the output window
 */
export function putByteToOutputWindow(outWin: OutputWindow, b: number, flushFn: () => void): void {
	outWin._buffer![outWin._pos] = b;
	outWin._pos += 1;

	if (outWin._pos >= outWin._windowSize) {
		flushFn();
	}
}

/**
 * Releases the output window stream
 */
export function releaseOutputWindowStream(outWin: OutputWindow, flushFn: () => void): void {
	flushFn();
	outWin._stream = null;
}

/**
 * Copies a block of data in the output window
 */
export function copyBlockInOutputWindow(
	outWin: OutputWindow,
	distance: number,
	len: number,
	flushFn: () => void,
): void {
	let pos = outWin._pos - distance - 1;

	if (pos < 0) {
		pos += outWin._windowSize;
	}

	for (; len != 0; len -= 1) {
		if (pos >= outWin._windowSize) {
			pos = 0;
		}
		outWin._buffer![outWin._pos] = outWin._buffer![pos];
		outWin._pos += 1;
		pos += 1;

		if (outWin._pos >= outWin._windowSize) {
			flushFn();
		}
	}
}
