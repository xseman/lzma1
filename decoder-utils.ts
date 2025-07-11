/**
 * Decoder utility functions
 * These functions handle output window management and byte operations for decompression
 */

import { write_0 } from "./io-utils.js";
import type { Decoder } from "./lzma.js";
import { initArray } from "./utils.js";

/**
 * Create and initialize an output window for decompression
 */
export function outWindowCreate(decoder: Decoder, windowSize: number): void {
	const outWin = decoder.outWin;

	if (outWin._buffer == null || outWin._windowSize != windowSize) {
		outWin._buffer = initArray(windowSize);
	}

	outWin._windowSize = windowSize;
	outWin._pos = 0;
	outWin._streamPos = 0;
}

/**
 * Flush the output window buffer to the output stream
 */
export function flushOutputWindow(decoder: Decoder): void {
	let size = decoder.outWin._pos - decoder.outWin._streamPos;

	if (!size) {
		return;
	}

	write_0(
		decoder.outWin._stream!,
		decoder.outWin._buffer!,
		decoder.outWin._streamPos,
		size,
	);

	if (decoder.outWin._pos >= decoder.outWin._windowSize) {
		decoder.outWin._pos = 0;
	}

	decoder.outWin._streamPos = decoder.outWin._pos;
}

/**
 * Get a byte from the output window at the specified distance
 */
export function getByte(decoder: Decoder, distance: number): number {
	const outputWindow = decoder.outWin;

	let pos = outputWindow._pos - distance - 1;
	if (pos < 0) {
		pos += outputWindow._windowSize;
	}

	return outputWindow._buffer![pos];
}

/**
 * Put a byte into the output window
 */
export function putByte(decoder: Decoder, b: number, flushFn: () => void): void {
	decoder.outWin._buffer![decoder.outWin._pos] = b;
	decoder.outWin._pos += 1;

	if (decoder.outWin._pos >= decoder.outWin._windowSize) {
		flushFn();
	}
}

/**
 * Release the output window stream
 */
export function outWindowReleaseStream(decoder: Decoder, flushFn: () => void): void {
	flushFn();
	decoder.outWin._stream = null;
}

/**
 * Copy a block of bytes from the output window
 */
export function copyBlock(decoder: Decoder, len: number, flushFn: () => void): void {
	const outputWindow = decoder.outWin;
	const distance = decoder.rep0;

	let pos = outputWindow._pos - distance - 1;

	if (pos < 0) {
		pos += outputWindow._windowSize;
	}

	for (; len != 0; len -= 1) {
		if (pos >= outputWindow._windowSize) {
			pos = 0;
		}
		outputWindow._buffer![outputWindow._pos] = outputWindow._buffer![pos];
		outputWindow._pos += 1;
		pos += 1;

		if (outputWindow._pos >= outputWindow._windowSize) {
			flushFn();
		}
	}
}

/**
 * Update character state based on current state
 */
export function stateUpdateChar(index: number): number {
	if (index < 4) {
		return 0;
	}
	if (index < 10) {
		return index - 3;
	}

	return index - 6;
}

/**
 * Get length to position state mapping
 */
export function getLenToPosState(len: number): number {
	len -= 2;
	if (len < 4) {
		return len;
	}

	return 3;
}
