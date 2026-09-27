/**
 * The 13-byte header of the `.lzma` ("LZMA_Alone") format:
 *
 * | bytes | field                                        |
 * | ----- | -------------------------------------------- |
 * | 0     | properties: `(pb * 5 + lp) * 9 + lc`         |
 * | 1-4   | dictionary size, uint32 little-endian        |
 * | 5-12  | uncompressed size, uint64 little-endian,     |
 * |       | or all 0xFF when unknown (end marker is used)|
 */

export const HEADER_SIZE = 13;

/** Uncompressed size value meaning "unknown, ends with an end marker". */
export const UNKNOWN_SIZE = -1;

export interface LzmaHeader {
	/** Literal context bits (0-8) */
	lc: number;
	/** Literal position bits (0-4) */
	lp: number;
	/** Position bits (0-4) */
	pb: number;
	dictSize: number;
	/** Uncompressed size in bytes, or `UNKNOWN_SIZE` */
	uncompressedSize: number;
}

export function encodeHeader(header: LzmaHeader): Uint8Array {
	const bytes = new Uint8Array(HEADER_SIZE);
	const view = new DataView(bytes.buffer);

	bytes[0] = (header.pb * 5 + header.lp) * 9 + header.lc;
	view.setUint32(1, header.dictSize, true);

	if (header.uncompressedSize === UNKNOWN_SIZE) {
		bytes.fill(0xFF, 5);
	} else {
		view.setUint32(5, header.uncompressedSize % 0x100000000, true);
		view.setUint32(9, Math.floor(header.uncompressedSize / 0x100000000), true);
	}

	return bytes;
}

export function decodeHeader(bytes: Uint8Array): LzmaHeader {
	if (bytes.length < HEADER_SIZE) {
		throw new Error("Truncated input");
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE);

	let props = bytes[0];
	if (props >= 9 * 5 * 5) {
		throw new Error("Corrupted input: invalid LZMA properties");
	}

	const lc = props % 9;
	props = (props / 9) | 0;
	const lp = props % 5;
	const pb = (props / 5) | 0;

	const dictSize = view.getUint32(1, true);
	const sizeLow = view.getUint32(5, true);
	const sizeHigh = view.getUint32(9, true);

	let uncompressedSize = UNKNOWN_SIZE;
	if (sizeLow !== 0xFFFFFFFF || sizeHigh !== 0xFFFFFFFF) {
		uncompressedSize = sizeHigh * 0x100000000 + sizeLow;

		if (!Number.isSafeInteger(uncompressedSize)) {
			throw new Error("Unsupported input: uncompressed size is too large");
		}
	}

	return { lc, lp, pb, dictSize, uncompressedSize };
}
