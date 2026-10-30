/**
 * Streaming decompression of raw LZMA1 and LZMA2 data as `TransformStream`s,
 * like `Decompress` in `web-streams.ts`, whose transformer they share. They
 * live in their own module so that bundles which decode only `.lzma` streams
 * leave them out.
 */

import { AloneDecoder } from "./alone-decoder.js";
import type { BinaryInput } from "./lzma.js";
import { Lzma2Decoder } from "./lzma2-decoder.js";
import {
	type RawLzma1Options,
	type RawLzma2Options,
	resolveRawLzma1Options,
	resolveRawLzma2Options,
} from "./options.js";
import {
	createDecoderTransformer,
	TransformStreamBase,
} from "./web-streams.js";

/**
 * Decompresses a stream of raw LZMA1 data, which has no `.lzma` header. An
 * end marker before a known size is an error, as with `strict`. Invalid
 * options throw a `RangeError`, a dictionary over `memoryLimitKb` throws a
 * `MemoryLimitError`, and an `uncompressedSize` over `maxOutputLength` throws
 * `OutputLimitError`. All of these are thrown by the constructor. If the
 * output would exceed `maxOutputLength` while decoding, the stream fails with
 * `OutputLimitError`.
 *
 * @example
 * const output = packed.pipeThrough(new DecompressRawLzma1({ lc: 3, lp: 0, pb: 2, dictSize: 1 << 16 }));
 */
export class DecompressRawLzma1 extends TransformStreamBase<BinaryInput, Uint8Array> {
	constructor(options: RawLzma1Options) {
		const { header, maxOutputLength } = resolveRawLzma1Options(options);

		super(createDecoderTransformer((sink) => {
			const decoder = new AloneDecoder(sink, 0, false, true, maxOutputLength);
			decoder.start(header);

			return decoder;
		}));
	}
}

/**
 * Decompresses a stream of raw LZMA2 data, the format inside `.xz` blocks
 * and 7z LZMA2 entries. Invalid options throw a `RangeError`, and a
 * dictionary over `memoryLimitKb` throws a `MemoryLimitError`, both from the
 * constructor.
 *
 * @example
 * const output = packed.pipeThrough(new DecompressRawLzma2({ dictSize: 1 << 20 }));
 */
export class DecompressRawLzma2 extends TransformStreamBase<BinaryInput, Uint8Array> {
	constructor(options: RawLzma2Options) {
		const dictSize = resolveRawLzma2Options(options);

		super(createDecoderTransformer((sink) => new Lzma2Decoder(dictSize, sink)));
	}
}
