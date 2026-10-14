/**
 * Decoder for raw LZMA2 data, the chunked format inside `.xz` blocks and
 * 7z LZMA2 entries. LZMA2 has no header of its own. The container stores
 * the dictionary size.
 *
 * Each chunk starts with a control byte:
 *
 * | control   | chunk                                                  |
 * | --------- | ------------------------------------------------------ |
 * | 0x00      | end of the data                                        |
 * | 0x01      | uncompressed, dictionary reset                         |
 * | 0x02      | uncompressed, no reset                                 |
 * | 0x80-0x9F | LZMA, no reset                                         |
 * | 0xA0-0xBF | LZMA, state reset                                      |
 * | 0xC0-0xDF | LZMA, state reset and new properties                   |
 * | 0xE0-0xFF | LZMA, dictionary reset, state reset and new properties |
 *
 * The sizes follow as big-endian values minus one, then the data:
 *
 * | bytes | uncompressed chunk | LZMA chunk                                 |
 * | ----- | ------------------ | ------------------------------------------ |
 * | 1-2   | size               | uncompressed size, bits 0-15; bits 16-20   |
 * |       |                    | are the low 5 bits of the control byte     |
 * | 3-4   |                    | compressed size                            |
 * | 5     |                    | `(pb * 5 + lp) * 9 + lc`, 0xC0 and up      |
 *
 * The first chunk has to reset the dictionary, and after a dictionary reset
 * the next LZMA chunk has to set properties. Every LZMA chunk starts a new
 * range coder, and LZMA2 doesn't use the end marker of the LZMA layer.
 *
 * Input may arrive in pieces. The decoder copies uncompressed chunks as
 * they arrive and decodes an LZMA chunk once its compressed data, at most
 * 64 KiB, is complete.
 *
 * Ported from XZ for Java (0BSD), `src/org/tukaani/xz/LZMA2InputStream.java`,
 * with `rangecoder/RangeDecoderFromBuffer.java` and the LZMA2-only methods of
 * `lz/LZDecoder.java` as functions, by Lasse Collin and Igor Pavlov.
 */

import { INPUT_MARGIN } from "./alone-decoder.js";
import { LzDecoder } from "./lz-decoder.js";
import { LzmaDecoder } from "./lzma-decoder.js";
import {
	RANGE_DECODER_INIT_SIZE,
	RangeDecoder,
} from "./range-decoder.js";

const COMPRESSED_SIZE_MAX = 1 << 16;

/** Largest chunk header: control byte, two sizes and the properties. */
const CHUNK_HEADER_SIZE_MAX = 6;

export class Lzma2Decoder {
	private readonly lz: LzDecoder;
	private readonly rc = new RangeDecoder();
	private lzma: LzmaDecoder | null = null;

	private uncompressedSize = 0;
	private compressedSize = 0;
	private isLzmaChunk = false;

	private needDictReset = true;
	private needProps = true;
	private endReached = false;

	/**
	 * Bytes decoded since the last dictionary reset. LZMA's position bits
	 * come from it. XZ for Java reads it from the dictionary
	 * (`lz.getPos()`); `LzmaDecoder` counts it in `outPos`.
	 */
	private outPos = 0;
	/** Header of the next chunk, collected until it is complete. */
	private readonly header = new Uint8Array(CHUNK_HEADER_SIZE_MAX);
	private headerPos = 0;
	/**
	 * Compressed data of the current LZMA chunk, collected until it is
	 * complete. `INPUT_MARGIN` bytes after the data leave room for corrupt
	 * input, which can make the decoder read past it.
	 */
	private readonly inBuf = new Uint8Array(COMPRESSED_SIZE_MAX + INPUT_MARGIN);
	private inPos = 0;

	/**
	 * @param dictSize Dictionary size in bytes
	 * @param sink Receives decompressed data. The chunk is only valid during
	 *        the call.
	 */
	constructor(dictSize: number, sink: (chunk: Uint8Array) => void) {
		this.lz = new LzDecoder(dictSize, sink);
	}

	/**
	 * Approximate memory needed to decode, in KiB, as XZ for Java's
	 * `LZMA2InputStream.getMemoryUsage` computes it.
	 */
	static getMemoryUsageKb(dictSize: number): number {
		// The base state is around 30-40 KiB (probabilities etc.), the range
		// decoder needs COMPRESSED_SIZE_MAX bytes for buffering, and the LZ
		// decoder needs a dictionary buffer.
		return 40 + COMPRESSED_SIZE_MAX / 1024 + Math.floor(getDictSize(dictSize) / 1024);
	}

	/** Decodes as much of `input` as possible. */
	write(input: Uint8Array): void {
		let pos = 0;

		while (pos < input.length && !this.endReached) {
			if (this.uncompressedSize === 0) {
				pos = this.readChunkHeader(input, pos);
				continue;
			}

			if (!this.isLzmaChunk) {
				const copySize = Math.min(this.uncompressedSize, input.length - pos);
				copyUncompressed(this.lz, input, pos, copySize);
				pos += copySize;
				this.outPos += copySize;
				this.uncompressedSize -= copySize;
			} else {
				const copySize = Math.min(this.compressedSize - this.inPos, input.length - pos);
				this.inBuf.set(input.subarray(pos, pos + copySize), this.inPos);
				pos += copySize;
				this.inPos += copySize;

				if (this.inPos === this.compressedSize) {
					this.decodeLzmaChunk();
				}
			}

			this.lz.flush();
		}
	}

	/** Throws if the data ended before its end marker. */
	end(): void {
		if (!this.endReached) {
			throw new Error("Truncated input");
		}
	}

	/** Collects the chunk header and decodes it once it is complete. */
	private readChunkHeader(input: Uint8Array, pos: number): number {
		const header = this.header;
		header[this.headerPos++] = input[pos++];

		const size = chunkHeaderSize(header[0]);
		const copySize = Math.min(size - this.headerPos, input.length - pos);
		header.set(input.subarray(pos, pos + copySize), this.headerPos);
		this.headerPos += copySize;

		if (this.headerPos === size) {
			this.headerPos = 0;
			this.decodeChunkHeader();
		}

		return pos + copySize;
	}

	private decodeChunkHeader(): void {
		const header = this.header;
		const control = header[0];

		if (control === 0x00) {
			this.endReached = true;
			return;
		}

		if (control >= 0xE0 || control === 0x01) {
			this.needProps = true;
			this.needDictReset = false;
			resetDictionary(this.lz);
			this.outPos = 0;
		} else if (this.needDictReset) {
			throw new Error("Corrupted input: the first LZMA2 chunk doesn't reset the dictionary");
		}

		if (control >= 0x80) {
			this.isLzmaChunk = true;

			this.uncompressedSize = (control & 0x1F) << 16;
			this.uncompressedSize += readUnsignedShort(header, 1) + 1;

			// XZ for Java reads the compressed data here; `write` collects
			// it instead.
			this.compressedSize = readUnsignedShort(header, 3) + 1;
			this.inPos = 0;

			if (control >= 0xC0) {
				this.needProps = false;
				this.decodeProps(header[5]);
			} else if (this.needProps) {
				throw new Error("Corrupted input: LZMA2 chunk without properties");
			} else if (control >= 0xA0) {
				this.lzma!.reset();
			}
		} else if (control > 0x02) {
			throw new Error("Corrupted input: invalid LZMA2 control byte");
		} else {
			this.isLzmaChunk = false;
			this.uncompressedSize = readUnsignedShort(header, 1) + 1;
		}
	}

	private decodeProps(props: number): void {
		if (props > (4 * 5 + 4) * 9 + 8) {
			throw new Error("Corrupted input: invalid LZMA2 properties");
		}

		const pb = (props / (9 * 5)) | 0;
		props -= pb * 9 * 5;
		const lp = (props / 9) | 0;
		const lc = props - lp * 9;

		if (lc + lp > 4) {
			throw new Error("Corrupted input: invalid LZMA2 properties");
		}

		this.lzma = new LzmaDecoder(this.lz, this.rc, lc, lp, pb);
	}

	private decodeLzmaChunk(): void {
		const lzma = this.lzma!;
		const outLimit = this.outPos + this.uncompressedSize;

		prepareInputBuffer(this.rc, this.inBuf, this.compressedSize);
		lzma.outPos = this.outPos;
		lzma.decode(outLimit, this.compressedSize);

		// Decoding stops before the chunk's size when it reads past the
		// chunk's data or decodes an end marker. XZ for Java throws in both
		// cases. A match that would cross the chunk's end throws in
		// `decode`, which XZ for Java detects with `lz.hasPending()`.
		if (lzma.outPos !== outLimit || !isChunkFinished(this.rc, this.compressedSize)) {
			throw new Error("Corrupted input: LZMA2 chunk doesn't match its sizes");
		}

		this.outPos = outLimit;
		this.uncompressedSize = 0;
	}
}

/**
 * Copies `len` bytes of uncompressed data from `input` at `inPos` into the
 * dictionary: `LZDecoder.copyUncompressed`. XZ for Java copies up to the end
 * of the buffer and leaves the rest to its caller; this copy continues past
 * the end like `repeat`.
 */
export function copyUncompressed(lz: LzDecoder, input: Uint8Array, inPos: number, len: number): void {
	while (len > 0) {
		const copySize = Math.min(lz.buf.length - lz.pos, len);
		lz.buf.set(input.subarray(inPos, inPos + copySize), lz.pos);
		lz.pos += copySize;
		inPos += copySize;
		len -= copySize;

		if (lz.pos === lz.buf.length) {
			lz.onBufferEnd();
		}
	}
}

/**
 * Empties the dictionary, so matches can't reach back before this point:
 * `LZDecoder.reset`.
 */
export function resetDictionary(lz: LzDecoder): void {
	// In XZ for Java the caller flushes first. Here the sink has to get the
	// pending bytes before the positions restart, or they are lost.
	lz.flush();
	lz.start = 0;
	lz.pos = 0;
	lz.wrapped = false;
	// getByte(0) has to return 0x00 when nothing has been decoded.
	lz.buf[lz.buf.length - 1] = 0x00;
}

/**
 * Starts decoding the `len` bytes of chunk data at the start of `input`:
 * `RangeDecoderFromBuffer.prepareInputBuffer`. Every LZMA chunk starts a new
 * range coder.
 */
function prepareInputBuffer(rc: RangeDecoder, input: Uint8Array, len: number): void {
	if (len < RANGE_DECODER_INIT_SIZE) {
		throw new Error("Corrupted input: LZMA2 chunk is too short");
	}

	rc.init(input, 0);
}

/**
 * True when the chunk's `len` bytes have been consumed exactly and the range
 * coder is finished: `RangeDecoderFromBuffer.isFinished`.
 */
function isChunkFinished(rc: RangeDecoder, len: number): boolean {
	return rc.pos === len && rc.code === 0;
}

/** Size of the chunk header that starts with `control`. */
function chunkHeaderSize(control: number): number {
	if (control >= 0xC0) {
		return 6;
	}
	if (control >= 0x80) {
		return 5;
	}
	if (control === 0x01 || control === 0x02) {
		return 3;
	}

	// The end marker, or an invalid control byte, which throws
	return 1;
}

function readUnsignedShort(bytes: Uint8Array, pos: number): number {
	return (bytes[pos] << 8) | bytes[pos + 1];
}

/**
 * Dictionary size rounded up to a multiple of 16, as XZ for Java allocates
 * it, so the memory needed matches its numbers.
 */
function getDictSize(dictSize: number): number {
	// Not `(dictSize + 15) & ~15`, which turns sizes of 2 GiB and up negative.
	return Math.ceil(dictSize / 16) * 16;
}
