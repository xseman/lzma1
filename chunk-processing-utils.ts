import {
	compare,
	LZMA_CONSTANTS,
} from "./utils.js";

export interface ChunkProcessingContext {
	chunker: {
		alive: number;
		encoder: any;
		decoder: any;
		inBytesProcessed: [number, number];
	};
	output: {
		buf: number[];
		count: number;
	};
}

/**
 * Process a chunk during decompression
 */
export function processChunkDecode(
	decompressor: ChunkProcessingContext,
	codeOneChunk: () => 0 | 1 | -1,
	flushOutput: () => void,
	releaseOutputStream: () => void,
): number {
	if (!decompressor.chunker.alive) {
		throw new Error("Bad state");
	}

	if (decompressor.chunker.encoder) {
		throw new Error("No encoding");
	}

	const result = codeOneChunk();
	if (result === -1) {
		throw new Error("Corrupted input");
	}

	const decoder = decompressor.chunker.decoder;
	decompressor.chunker.inBytesProcessed = decoder.nowPos64;

	const isOutputComplete = (compare(decoder.outSize, LZMA_CONSTANTS.P0_LONG_LIT) >= 0)
		&& (compare(decoder.nowPos64, decoder.outSize) >= 0);

	if (result || isOutputComplete) {
		flushOutput();
		releaseOutputStream();
		decoder.rangeDecoder.stream = null;
		decompressor.chunker.alive = 0;
	}

	return decompressor.chunker.alive;
}

/**
 * Process a chunk during compression
 */
export function processChunkEncode(
	compressor: ChunkProcessingContext,
	codeOneBlock: () => void,
	releaseStreams: () => void,
): number {
	if (!compressor.chunker.alive) {
		throw new Error("bad state");
	}

	if (!compressor.chunker.encoder) {
		throw new Error("No decoding");
	}

	codeOneBlock();
	compressor.chunker.inBytesProcessed = compressor.chunker.encoder!.processedInSize[0];

	if (compressor.chunker.encoder!.finished[0]) {
		releaseStreams();
		compressor.chunker.alive = 0;
	}

	return compressor.chunker.alive;
}
