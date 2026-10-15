/**
 * Streaming compression as `TransformStream`s, used with
 * `ReadableStream.pipeThrough()` like the built-in `CompressionStream`.
 */

import { AloneDecoder } from "./alone-decoder.js";
import { AloneEncoder } from "./alone-encoder.js";
import {
	type BinaryInput,
	toUint8Array,
} from "./lzma.js";
import {
	type CompressionMode,
	type CompressionOptions,
	type DecompressionOptions,
	resolveOptions,
	resolveStrict,
} from "./options.js";

// Resolved at construction time, so importing this module doesn't fail in
// runtimes without Web Streams.
export const TransformStreamBase: typeof TransformStream = globalThis.TransformStream
	?? (class {
		constructor() {
			throw new Error("TransformStream is not available in this runtime");
		}
	} as unknown as typeof TransformStream);

/**
 * Compresses a stream of bytes into the `.lzma` format. The uncompressed
 * size is not known in advance, so the header marks it as unknown and the
 * data ends with an end marker. `endMarker: false` throws a `RangeError`.
 *
 * @example
 * const compressed = file.stream().pipeThrough(new Compress(5));
 */
export class Compress extends TransformStreamBase<BinaryInput, Uint8Array> {
	constructor(options?: CompressionMode | CompressionOptions) {
		const encoder = new AloneEncoder(resolveOptions(options));

		super({
			transform(chunk, controller) {
				encoder.write(toUint8Array(chunk));
				const output = encoder.take();
				if (output.length > 0) {
					controller.enqueue(output);
				}
			},
			flush(controller) {
				controller.enqueue(encoder.finish());
			},
		});
	}
}

/**
 * Decompresses a stream of `.lzma` data. `{ strict: true }` rejects an end
 * marker before the declared size; an invalid option throws a `RangeError`.
 *
 * @example
 * const response = await fetch("data.lzma");
 * const text = await new Response(response.body!.pipeThrough(new Decompress())).text();
 */
export class Decompress extends TransformStreamBase<BinaryInput, Uint8Array> {
	constructor(options?: DecompressionOptions) {
		super(createDecoderTransformer((sink) => new AloneDecoder(sink, 0, false, resolveStrict(options))));
	}
}

/** Decoder that takes its input in pieces, then checks that it is complete. */
export interface StreamDecoder {
	write(chunk: Uint8Array): void;
	end(): void;
}

export function createDecoderTransformer(
	create: (sink: (chunk: Uint8Array) => void) => StreamDecoder,
): Transformer<BinaryInput, Uint8Array> {
	let enqueue: (chunk: Uint8Array) => void;
	const decoder = create((chunk) => enqueue(chunk.slice()));

	return {
		start(controller) {
			enqueue = (chunk) => controller.enqueue(chunk);
		},
		transform(chunk) {
			decoder.write(toUint8Array(chunk));
		},
		flush() {
			decoder.end();
		},
	};
}
