import type {
	BaseStream,
	BufferWithCount,
} from "./lzma.js";
import { toSigned8bit } from "./lzma.js";

/**
 * Reads a single byte from an input stream
 */
export function read(inputStream: BaseStream): number {
	if (inputStream.pos >= inputStream.count) {
		return -1;
	}

	if (inputStream.buf instanceof ArrayBuffer) {
		return new Uint8Array(inputStream.buf)[inputStream.pos++] & 0xFF;
	}

	return inputStream.buf[inputStream.pos++] & 0xFF;
}

/**
 * Writes a single byte to a buffer
 */
export function write(buffer: BufferWithCount | null, b: number): void {
	if (!buffer) return;
	buffer.buf[buffer.count++] = toSigned8bit(b);
}

/**
 * Writes multiple bytes to a buffer using array copy
 */
export function write_0(
	buffer: BufferWithCount,
	buf: number[],
	off: number,
	len: number,
): void {
	arraycopy(
		buf,
		off,
		buffer.buf,
		buffer.count,
		len,
	);

	buffer.count += len;
}

/**
 * Extracts characters from a string into a destination array
 */
export function getChars(
	inputString: string,
	srcBegin: number,
	srcEnd: number,
	dst: number[],
	dstBegin: number,
): void {
	for (let srcIdx = srcBegin; srcIdx < srcEnd; ++srcIdx) {
		dst[dstBegin++] = inputString.charCodeAt(srcIdx);
	}
}

/**
 * Copies elements from source array to destination array
 */
export function arraycopy(
	src: number[],
	srcOfs: number,
	dest: number[],
	destOfs: number,
	len: number,
): void {
	for (let i = 0; i < len; ++i) {
		try {
			dest[destOfs + i] = src[srcOfs + i];
		} catch (error) {
			return;
		}
	}
}

/**
 * Converts buffer output to byte array
 */
export function toByteArray(output: { buf: number[]; count: number; }): number[] {
	const data = output.buf;
	data.length = output.count;
	return data;
}
