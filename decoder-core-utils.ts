import type {
	Decoder,
	LenDecoder,
} from "./lzma.js";
import { createBitTreeDecoder } from "./probability.js";
import { InitBitModels } from "./utils.js";

/**
 * Updates the state after decoding a character
 */
export function stateUpdateChar(index: number): number {
	if (index < 4) {
		return 0;
	}
	if (index < 10) {
		return index - 3;
	}

	return index - 6;
}

/**
 * Initializes decoder state
 */
export function initDecoder(decoder: Decoder): void {
	decoder.outWin._streamPos = 0;
	decoder.outWin._pos = 0;

	InitBitModels(decoder.matchDecoders);
	InitBitModels(decoder.rep0LongDecoders);
	InitBitModels(decoder.repDecoders);
	InitBitModels(decoder.repG0Decoders);
	InitBitModels(decoder.repG1Decoders);
	InitBitModels(decoder.repG2Decoders);
	InitBitModels(decoder.posDecoders);

	for (let i = 0; i < 4; ++i) {
		InitBitModels(decoder.posSlotDecoders[i].models);
	}

	InitBitModels(decoder.posAlignDecoder.models);
}

/**
 * Sets decoder properties from property array
 */
export function setDecoderProperties(properties: number[]): {
	lc: number;
	lp: number;
	pb: number;
	dictionarySize: number;
} | null {
	if (properties.length < 5) {
		return null;
	}

	const val = properties[0] & 0xFF;
	const lc = val % 9;
	const remainder = ~~(val / 9);
	const lp = remainder % 5;
	const pb = ~~(remainder / 5);

	let dictionarySize = 0;
	for (let i = 0; i < 4; ++i) {
		dictionarySize += (properties[1 + i] & 0xFF) << i * 0x08;
	}

	// NOTE: If the input is bad, it might call for an insanely large dictionary size, which would crash the script.
	if (dictionarySize > 0x5F5E0FF) {
		return null;
	}

	return { lc, lp, pb, dictionarySize };
}

/**
 * Sets decoder dictionary size
 */
export function setDecoderDictionarySize(decoder: Decoder, dictionarySize: number): boolean {
	if (dictionarySize < 0) {
		return false;
	}

	if (decoder.dictSize != dictionarySize) {
		decoder.dictSize = dictionarySize;
		decoder.dictSizeCheck = Math.max(decoder.dictSize, 1);
	}

	return true;
}

/**
 * Sets decoder LC and PB parameters
 */
export function setDecoderLcPb(lc: number, pb: number): boolean {
	if (lc > 0x08 || pb > 4) {
		return false;
	}

	return true;
}

/**
 * Sets decoder LC, LP, and PB parameters
 */
export function setDecoderLcLpPb(lc: number, lp: number, pb: number): boolean {
	if (lc > 0x08 || lp > 4 || pb > 4) {
		return false;
	}

	return true;
}

/**
 * Creates length decoder arrays
 */
export function createLenDecoder(decoder: LenDecoder, numPosStates: number): void {
	for (; decoder.numPosStates < numPosStates; decoder.numPosStates += 1) {
		decoder.lowCoder[decoder.numPosStates] = createBitTreeDecoder(3);
		decoder.midCoder[decoder.numPosStates] = createBitTreeDecoder(3);
	}
}

/**
 * Decodes a length using the length decoder
 */
export function decodeLenDecoder(
	decoder: LenDecoder,
	posState: number,
	decodeBitFn: (models: number[], index: number) => number,
	bitTreeDecoderFn: (models: number[]) => number,
): number {
	if (!decodeBitFn(decoder.choice, 0)) {
		return bitTreeDecoderFn(decoder.lowCoder[posState].models);
	}

	let symbol = 0x08;

	if (!decodeBitFn(decoder.choice, 1)) {
		symbol += bitTreeDecoderFn(decoder.midCoder[posState].models);
	} else {
		symbol += 0x08 + bitTreeDecoderFn(decoder.highCoder.models);
	}

	return symbol;
}
