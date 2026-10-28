import { AloneDecoder } from "./alone-decoder.js";
import { AloneEncoder } from "./alone-encoder.js";
import {
	type LzmaHeader,
	UNKNOWN_SIZE,
} from "./header.js";
import { Lzma2Decoder } from "./lzma2-decoder.js";
import {
	type CompressAsyncOptions,
	type CompressionMode,
	type CompressionOptions,
	DEFAULT_LEVEL,
	type ResolvedOptions,
	resolveOnProgressAsync,
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
	return compressResolved(data, resolveOptions(options));
}

/**
 * Bytes of input compressed between calls to `onProgressAsync`. The value
 * isn't tuned. It just has to be large enough that awaiting the callback
 * costs little next to compressing a slice, on any machine, and small
 * enough that the callback still runs often.
 */
const COMPRESS_SLICE_SIZE = 16 << 10;

/**
 * Implements `compressAsync`: compresses `data` in slices, awaiting
 * `onProgressAsync` between them. The output is the same as
 * `compressData`'s.
 */
export async function compressDataAsync(data: Uint8Array, options: CompressionMode | CompressAsyncOptions = DEFAULT_LEVEL): Promise<Uint8Array> {
	const resolved = resolveOptions(options);
	const onProgressAsync = resolveOnProgressAsync(typeof options === "object" ? options : undefined);
	if (onProgressAsync === undefined) {
		return compressResolved(data, resolved);
	}

	await onProgressAsync({ progress: 0 });

	// Create the encoder after the first call, so that cancelling there
	// doesn't discard a pooled encoder.
	const encoder = new AloneEncoder(resolved, data.length, true);
	for (let start = 0; start < data.length; start += COMPRESS_SLICE_SIZE) {
		const end = Math.min(start + COMPRESS_SLICE_SIZE, data.length);
		encoder.write(data.subarray(start, end));

		if (end < data.length) {
			await onProgressAsync({ progress: end / data.length });
		}
	}

	const output = encoder.finish();
	await onProgressAsync({ progress: 1 });

	return output;
}

/** Largest declared output size that is allocated at once when decompressing. */
const PREALLOCATE_LIMIT = 64 << 20;

/**
 * Decompresses `.lzma` data, or raw LZMA1 data when `header` holds its
 * properties and size. `strict` rejects an end marker before the declared
 * size.
 */
export function decompressData(data: Uint8Array, strict = false, header?: LzmaHeader): Uint8Array {
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
		strict,
	);

	if (header) {
		decoder.start(header);
	}

	decoder.write(data);
	decoder.end();

	if (decoder.contiguousOutput) {
		// The output was decoded in place into one buffer.
		return last === undefined ? new Uint8Array(0) : new Uint8Array(last.buffer, 0, last.byteOffset + last.length);
	}

	return out?.finish() ?? new Uint8Array(0);
}

/** Decompresses raw LZMA2 data with the given dictionary size. */
export function decompressRawLzma2Data(data: Uint8Array, dictSize: number): Uint8Array {
	let out: OutputBuffer | undefined;

	// LZMA2 declares no size. The first output creates the buffer from a
	// guess, capped as for a declared size, so empty output allocates nothing.
	const decoder = new Lzma2Decoder(dictSize, (chunk) => {
		out ??= new OutputBuffer(Math.min(data.length * 4, 1 << 24));
		out.write(chunk);
	});
	decoder.write(data);
	decoder.end();

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

/** Compresses `data` with options already checked by `resolveOptions`. */
function compressResolved(data: Uint8Array, options: ResolvedOptions): Uint8Array {
	const encoder = new AloneEncoder(options, data.length, true);
	encoder.write(data);
	return encoder.finish();
}
