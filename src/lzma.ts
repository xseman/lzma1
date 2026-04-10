import {
	DecoderChunker,
	EncoderChunker,
} from "./chunker.js";
import { Decoder } from "./decoder.js";
import { Encoder } from "./encoder.js";
import {
	InputBuffer,
	OutputBuffer,
} from "./streams.js";
import {
	fromInt64,
} from "./utils.js";

interface Mode {
	searchDepth: number;
	filterStrength: number;
	modeIndex: number;
}

/**
 * Base context interface
 */
interface Context {
	chunker: EncoderChunker | DecoderChunker;
}

/**
 * Compression context
 */
interface CompressionContext extends Context {
	chunker: EncoderChunker;
	output: OutputBuffer;
}

/**
 * Decompression context
 */
interface DecompressionContext {
	chunker: DecoderChunker;
	output: OutputBuffer;
}

/**
 * LZMA compression mode levels (1-9)
 * Higher values provide better compression but are slower
 */
export type CompressionMode = keyof typeof MODES;

/**
 * Compression modes
 */
export const MODES = {
	1: { searchDepth: 0x10, filterStrength: 0x40, modeIndex: 0x00 },
	2: { searchDepth: 0x14, filterStrength: 0x40, modeIndex: 0x00 },
	3: { searchDepth: 0x13, filterStrength: 0x40, modeIndex: 0x01 },
	4: { searchDepth: 0x14, filterStrength: 0x40, modeIndex: 0x01 },
	5: { searchDepth: 0x15, filterStrength: 0x80, modeIndex: 0x01 },
	6: { searchDepth: 0x16, filterStrength: 0x80, modeIndex: 0x01 },
	7: { searchDepth: 0x17, filterStrength: 0x80, modeIndex: 0x01 },
	8: { searchDepth: 0x18, filterStrength: 0xFF, modeIndex: 0x01 },
	9: { searchDepth: 0x19, filterStrength: 0xFF, modeIndex: 0x01 },
} as const;

export class LZMA {
	#encoder: Encoder;
	#decoder: Decoder;

	#compressor: CompressionContext;
	#decompressor: DecompressionContext;

	constructor() {
		this.#encoder = new Encoder();
		this.#decoder = new Decoder();

		this.#compressor = this.#initCompressor();
		this.#decompressor = this.#initDecompressor();
	}

	#initCompressor(): CompressionContext {
		const encoderChunker = new EncoderChunker(this.#encoder);

		return {
			chunker: encoderChunker,
			output: new OutputBuffer(32),
		};
	}

	#initDecompressor(): DecompressionContext {
		const decoderChunker = new DecoderChunker(this.#decoder);

		return {
			chunker: decoderChunker,
			output: new OutputBuffer(0x20),
		};
	}

	#toByteArray(output: OutputBuffer): number[] {
		return output.toArray();
	}

	#getChars(
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

	#initCompression(
		input: InputBuffer,
		len: [number, number],
		mode: Mode,
	): void {
		this.#encoder.initCompression(input, this.#compressor.output, len, mode);
		this.#compressor.chunker.alive = 1;
	}

	#byteArrayCompressor(data: number[] | Uint8Array | ArrayBuffer, mode: Mode): void {
		const inputData = data instanceof ArrayBuffer
			? new Uint8Array(data)
			: data instanceof Uint8Array
				? data
				: new Uint8Array(data);
		const inputSize = inputData.length;
		const estimatedOutputSize = Math.max(32, Math.ceil(inputSize * 1.2));

		this.#compressor.output = new OutputBuffer(estimatedOutputSize);

		const inputBuffer = new InputBuffer(inputData);

		this.#initCompression(
			inputBuffer,
			fromInt64(inputSize),
			mode,
		);
	}

	#byteArrayDecompressor(data: Uint8Array | ArrayBuffer): void {
		const inputData = data instanceof ArrayBuffer
			? new Uint8Array(data)
			: data;
		const inputDataSize = inputData.length;
		const minBufferSize = 0x20; // 32 bytes minimum
		const estimatedOutputSize = inputDataSize * 2; // Estimate 2x expansion for decompression
		const initialBufferSize = Math.max(minBufferSize, estimatedOutputSize);

		this.#decompressor.output = new OutputBuffer(initialBufferSize);

		const inputBuffer = new InputBuffer(inputData);

		this.#decompressor.chunker = this.#decoder.initDecompression(
			inputBuffer,
			this.#decompressor.output,
		);
	}

	#decodeString(utf: number[]): string | number[] {
		let j = 0, x, y, z, l = utf.length, buf = [], charCodes = [];

		for (let i = 0; i < l; ++i, ++j) {
			x = utf[i] & 0xFF;
			if (!(x & 0x80)) {
				if (!x) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				charCodes[j] = x;
			} else if ((x & 0xE0) == 0xC0) {
				if (i + 1 >= l) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return String.fromCharCode(...utf);
				}
				y = utf[++i] & 0xFF;
				if ((y & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return String.fromCharCode(...utf);
				}
				charCodes[j] = ((x & 0x1F) << 6) | (y & 0x3F);
			} else if ((x & 0xF0) == 0xE0) {
				if (i + 2 >= l) {
					// It appears that this is binary data, so it cannot be
					// converted to a string, so just send it back.
					return utf;
				}
				y = utf[++i] & 0xFF;
				if ((y & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be converted to
					// a string, so just send it back.
					return utf;
				}
				z = utf[++i] & 0xFF;
				if ((z & 0xC0) != 0x80) {
					// It appears that this is binary data, so it cannot be converted to
					// a string, so just send it back.
					return utf;
				}
				charCodes[j] = ((x & 0x0F) << 0x0C) | ((y & 0x3F) << 6) | (z & 0x3F);
			} else {
				// It appears that this is binary data, so it cannot be converted to
				// a string, so just send it back.
				return utf;
			}
			if (j == 0x3FFF) {
				buf.push(String.fromCharCode.apply(String, charCodes));
				j = -1;
			}
		}

		if (j > 0) {
			charCodes.length = j;
			buf.push(String.fromCharCode.apply(String, charCodes));
		}

		return buf.join("");
	}

	encodeString(inputString: string): number[] {
		let ch, chars: number[] = [], elen = 0, l = inputString.length;

		this.#getChars(inputString, 0, l, chars, 0);

		// Add extra spaces in the array to break up the unicode symbols.
		for (let i = 0; i < l; ++i) {
			ch = chars[i];
			if (ch >= 1 && ch <= 127) {
				++elen;
			} else if (!ch || ch >= 128 && ch <= 2047) {
				elen += 2;
			} else {
				elen += 3;
			}
		}

		const data = [];
		elen = 0;
		for (let i = 0; i < l; ++i) {
			ch = chars[i];
			if (ch >= 1 && ch <= 0x7F) { // 127
				data[elen++] = ch << 24 >> 24;
			} else if (!ch || ch >= 0x80 && ch <= 0x7FF) {
				data[elen++] = (0xC0 | ch >> 6 & 0x1F) << 24 >> 24;
				data[elen++] = (0x80 | ch & 0x3F) << 24 >> 24;
			} else {
				data[elen++] = (0xE0 | ch >> 12 & 0x0F) << 24 >> 24;
				data[elen++] = (0x80 | ch >> 6 & 0x3F) << 24 >> 24;
				data[elen++] = (0x80 | ch & 0x3F) << 24 >> 24;
			}
		}

		return data;
	}

	public compress(
		data: Uint8Array | ArrayBuffer,
		mode: CompressionMode = 5,
	): Int8Array {
		const compressionMode = MODES[mode];
		this.#byteArrayCompressor(data, compressionMode);

		while (this.#compressor.chunker.processChunk());

		const result = this.#toByteArray(this.#compressor.output);
		return new Int8Array(result);
	}

	public compressString(
		data: string,
		mode: CompressionMode = 5,
	): Int8Array {
		const encodedData = this.encodeString(data);
		return this.compress(new Uint8Array(encodedData), mode);
	}

	public decompress(bytearray: Uint8Array | ArrayBuffer): number[] {
		this.#byteArrayDecompressor(bytearray);

		while (this.#decompressor.chunker.processChunk());

		return this.#toByteArray(this.#decompressor.output);
	}

	public decompressString(bytearray: Uint8Array | ArrayBuffer): string {
		this.#byteArrayDecompressor(bytearray);

		while (this.#decompressor.chunker.processChunk());

		const decodedByteArray = this.#toByteArray(this.#decompressor.output);
		const result = this.#decodeString(decodedByteArray);

		if (typeof result === "string") {
			return result;
		} else {
			// If decoding failed and returned binary data, convert to string anyway
			return String.fromCharCode(...result);
		}
	}
}
