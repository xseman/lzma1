import { readMatchFinderBlock } from "./match-finder.js";
import { InitBitModels } from "./utils.js";

export interface InitializationContext {
	encoder?: any;
	decoder?: any;
	outWin?: any;
	literalDecoder?: any;
	matchDecoders?: any;
	rep0LongDecoders?: any;
	repDecoders?: any;
	repG0Decoders?: any;
	repG1Decoders?: any;
	repG2Decoders?: any;
	posDecoders?: any;
	posSlotDecoders?: any[];
	posAlignDecoder?: any;
	lenDecoder?: any;
	repLenDecoder?: any;
}

/**
 * Initialize match finder for encoding
 */
export function initMatchFinder(
	encoder: any,
	readFn: (offset: number, length: number) => number,
	reduceOffsetsFn: (subValue: number) => void,
): void {
	encoder._matchFinder!._bufferOffset = 0;
	encoder._matchFinder!._pos = 0;
	encoder._matchFinder!._streamPos = 0;
	encoder._matchFinder!._streamEndWasReached = 0;

	readMatchFinderBlock(encoder._matchFinder!, readFn);

	encoder._matchFinder!._cyclicBufferPos = 0;
	reduceOffsetsFn(-1);
}

/**
 * Initialize decoder state
 */
export function initDecoderState(
	decoder: InitializationContext,
	initLiteralDecoder: (literalDecoder: any) => void,
): void {
	decoder.outWin!._streamPos = 0;
	decoder.outWin!._pos = 0;

	InitBitModels(decoder.matchDecoders);
	InitBitModels(decoder.rep0LongDecoders);
	InitBitModels(decoder.repDecoders);
	InitBitModels(decoder.repG0Decoders);
	InitBitModels(decoder.repG1Decoders);
	InitBitModels(decoder.repG2Decoders);
	InitBitModels(decoder.posDecoders);

	initLiteralDecoder(decoder.literalDecoder);

	for (let i = 0; i < 4; ++i) {
		InitBitModels(decoder.posSlotDecoders![i].models);
	}

	InitBitModels(decoder.posAlignDecoder!.models);
	InitBitModels(decoder.lenDecoder!.choice);
	InitBitModels(decoder.lenDecoder!.choice2);
	InitBitModels(decoder.lenDecoder!.lowCoder);
	InitBitModels(decoder.lenDecoder!.midCoder);
	InitBitModels(decoder.lenDecoder!.highCoder);
	InitBitModels(decoder.repLenDecoder!.choice);
	InitBitModels(decoder.repLenDecoder!.choice2);
	InitBitModels(decoder.repLenDecoder!.lowCoder);
	InitBitModels(decoder.repLenDecoder!.midCoder);
	InitBitModels(decoder.repLenDecoder!.highCoder);
}

/**
 * Initialize encoder state
 */
export function initEncoderState(encoder: any): void {
	encoder._state = 0;
	encoder._previousByte = 0;

	for (let i = 0; i < 4; ++i) {
		encoder._repDistances[i] = 0;
	}
}
