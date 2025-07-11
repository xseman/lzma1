/**
 * Advanced output window operations for LZMA decompression
 */

import { write_0 } from "./io-utils.js";
import type { OutputWindow } from "./output-window-utils.js";
import { initArray } from "./utils.js";

/**
 * Create output window with specified size
 */
export function createOutputWindow(outWin: OutputWindow, windowSize: number): void {
	if (outWin._buffer == null || outWin._windowSize != windowSize) {
		outWin._buffer = initArray(windowSize);
	}

	outWin._windowSize = windowSize;
	outWin._pos = 0;
	outWin._streamPos = 0;
}

/**
 * Flush output window contents to stream
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
 * Release output window stream
 */
export function releaseOutputWindowStream(outWin: OutputWindow): void {
	flushOutputWindow(outWin);
	outWin._stream = null;
}

/**
 * Copy block within output window
 */
export function copyBlockInOutputWindow(outWin: OutputWindow, distance: number, len: number): void {
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
			flushOutputWindow(outWin);
		}
	}
}

/**
 * Get byte from output window at distance
 */
export function getByteFromOutputWindow(outWin: OutputWindow, distance: number): number {
	let pos = outWin._pos - distance - 1;
	if (pos < 0) {
		pos += outWin._windowSize;
	}

	return outWin._buffer![pos];
}

/**
 * Put byte into output window
 */
export function putByteToOutputWindow(outWin: OutputWindow, b: number): void {
	outWin._buffer![outWin._pos] = b;
	outWin._pos += 1;

	if (outWin._pos >= outWin._windowSize) {
		flushOutputWindow(outWin);
	}
}
