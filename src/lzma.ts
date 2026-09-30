import { AloneDecoder } from "./alone-decoder.js";
import { AloneEncoder } from "./alone-encoder.js";
import { UNKNOWN_SIZE } from "./header.js";
import {
	type CompressionMode,
	type CompressionOptions,
	DEFAULT_LEVEL,
	resolveOptions,
} from "./options.js";
import { OutputBuffer } from "./output-buffer.js";
import {
	decodeUtf8,
	encodeUtf8,
} from "./utf8.js";

export type { CompressionMode } from "./options.js";

/** Binary input accepted by all functions: any ArrayBuffer or view of one. */
export type BinaryInput = ArrayBuffer | ArrayBufferView;

export function toUint8Array(data: BinaryInput): Uint8Array {
	if (data instanceof Uint8Array) {
		return data;
	}

	if (ArrayBuffer.isView(data)) {
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	}

	if (data instanceof ArrayBuffer) {
		return new Uint8Array(data);
	}

	throw new TypeError("Expected an ArrayBuffer or an ArrayBufferView");
}

/** Compresses `data` into the `.lzma` format. */
export function compressData(data: Uint8Array, options: CompressionMode | CompressionOptions = DEFAULT_LEVEL): Uint8Array {
	const encoder = new AloneEncoder(resolveOptions(options), data.length, true);
	encoder.write(data);
	return encoder.finish();
}

/** Largest declared output size that is allocated at once when decompressing. */
const PREALLOCATE_LIMIT = 64 << 20;

/** Decompresses `.lzma` data. */
export function decompressData(data: Uint8Array): Uint8Array {
	let out: OutputBuffer | undefined;
	let last: Uint8Array | undefined;

	const decoder = new AloneDecoder(
		(chunk) => {
			if (decoder.contiguousOutput) {
				last = chunk;
			} else {
				// Don't trust the declared size for the initial allocation.
				const size = decoder.uncompressedSize!;
				out ??= new OutputBuffer(size === UNKNOWN_SIZE ? data.length * 4 : Math.min(size, 1 << 24));
				out.write(chunk);
			}
		},
		PREALLOCATE_LIMIT,
		true,
	);

	decoder.write(data);
	decoder.end();

	if (decoder.contiguousOutput) {
		// The output was decoded in place into one buffer.
		return last === undefined ? new Uint8Array(0) : new Uint8Array(last.buffer, 0, last.byteOffset + last.length);
	}

	return out?.finish() ?? new Uint8Array(0);
}

/**
 * Class-based API of v0.2.0. Prefer the standalone functions.
 */
export class LZMA {
	public compress(data: BinaryInput, mode: CompressionMode | CompressionOptions = DEFAULT_LEVEL): Int8Array {
		const result = compressData(toUint8Array(data), mode);
		return new Int8Array(result.buffer, result.byteOffset, result.byteLength);
	}

	public compressString(data: string, mode: CompressionMode | CompressionOptions = DEFAULT_LEVEL): Int8Array {
		return this.compress(encodeUtf8(data), mode);
	}

	public decompress(data: BinaryInput): Uint8Array {
		return decompressData(toUint8Array(data));
	}

	public decompressString(data: BinaryInput): string {
		return decodeUtf8(this.decompress(data));
	}
}
