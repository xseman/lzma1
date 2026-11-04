/**
 * Output limit for decoding untrusted input, where a few bytes can declare or
 * expand to gigabytes. The limit lets a caller refuse such data: up front when
 * the decoder knows the size and holds the data to it (unless
 * `tolerateEarlyEndMarker` is set), otherwise once the output passes the limit.
 */

import { UNKNOWN_SIZE } from "./header.js";

/**
 * Thrown when decompressing would produce more than `maxOutputLength` bytes
 * of output.
 */
export class OutputLimitError extends Error {
	/**
	 * If the header (or the `uncompressedSize` option) declared a size larger
	 * than the limit, this is that size. It is `undefined` if the size was
	 * unknown and the output reached the limit during decoding.
	 */
	readonly declaredSize: number | undefined;
	/** The limit that was specified, in bytes */
	readonly maxOutputLength: number;

	constructor(declaredSize: number | undefined, maxOutputLength: number) {
		super(
			declaredSize === undefined
				? `Output exceeds the limit of ${maxOutputLength} bytes`
				: `${declaredSize} bytes of output declared; limit was ${maxOutputLength} bytes`,
		);
		this.name = "OutputLimitError";
		this.declaredSize = declaredSize;
		this.maxOutputLength = maxOutputLength;
	}
}

/** Throws `OutputLimitError` if the declared size is known and exceeds `maxOutputLength`. */
export function checkDeclaredSize(declaredSize: number, maxOutputLength: number): void {
	if (declaredSize !== UNKNOWN_SIZE && declaredSize > maxOutputLength) {
		throw new OutputLimitError(declaredSize, maxOutputLength);
	}
}

/**
 * Wraps `sink` to count the output and throw `OutputLimitError` instead of
 * passing on a chunk that would bring it over `maxOutputLength` bytes. Used
 * for raw LZMA2, which doesn't declare its size.
 */
export function limitSink(sink: (chunk: Uint8Array) => void, maxOutputLength: number): (chunk: Uint8Array) => void {
	let outputLength = 0;

	return (chunk) => {
		outputLength += chunk.length;
		if (outputLength > maxOutputLength) {
			throw new OutputLimitError(undefined, maxOutputLength);
		}

		sink(chunk);
	};
}
