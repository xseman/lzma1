import { Decoder } from "./decoder.js";
import { Encoder } from "./encoder.js";
import {
	compare64,
	P0_LONG_LIT,
} from "./utils.js";

/**
 * Base chunker interface for both encoding and decoding operations
 */
interface BaseChunker {
	alive: number;
	inBytesProcessed: [number, number];
}

/**
 * Interface for LZMA instance needed by EncoderChunker
 */
interface LZMAInstance {
	codeOneBlock(): void;
	releaseStreams(): void;
}

/**
 * Encoder chunker for handling compression chunk processing
 */
export class EncoderChunker implements BaseChunker {
	encoder: Encoder | null = null;
	decoder: null = null;
	alive: number = 0;
	inBytesProcessed: [number, number] = [0, 0];

	private lzma: LZMAInstance;

	constructor(lzma: LZMAInstance) {
		this.lzma = lzma;
	}

	/**
	 * Process one chunk of encoding
	 */
	processChunk(): number {
		if (!this.alive) {
			throw new Error("bad state");
		}

		if (!this.encoder) {
			throw new Error("No decoding");
		}

		this.lzma.codeOneBlock();
		this.inBytesProcessed = this.encoder.processedInSize[0];

		if (this.encoder.finished[0]) {
			this.lzma.releaseStreams();
			this.alive = 0;
		}

		return this.alive;
	}
}

/**
 * Decoder chunker for handling decompression chunk processing
 */
export class DecoderChunker implements BaseChunker {
	encoder: null = null;
	decoder: Decoder;
	alive: number = 0;
	inBytesProcessed: [number, number] = [0, 0];

	constructor(decoder: Decoder) {
		this.decoder = decoder;
	}

	/**
	 * Process one chunk of decoding
	 */
	processChunk(): number {
		if (!this.alive) {
			throw new Error("Bad state");
		}

		if (this.encoder) {
			throw new Error("No encoding");
		}

		const result = this.decoder.codeOneChunk();
		if (result === -1) {
			throw new Error("Corrupted input");
		}

		this.inBytesProcessed = this.decoder.nowPos64;

		const isOutputComplete = (compare64(this.decoder.outSize, P0_LONG_LIT) >= 0)
			&& (compare64(this.decoder.nowPos64, this.decoder.outSize) >= 0);

		if (result || isOutputComplete) {
			this.decoder.flush();
			this.decoder.cleanup();
			this.alive = 0;
		}

		return this.alive;
	}
}
