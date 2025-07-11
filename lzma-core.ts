import type {
	BitTree,
	Decoder,
	Encoder,
	LiteralDecoderEncoder2,
} from "./lzma.js";
import {
	add,
	compare,
	eq,
	fromInt,
	lowBits_0,
	LZMA_CONSTANTS,
	sub,
} from "./utils.js";

/**
 * Core encoding and decoding loops for LZMA compression
 * These functions handle the main compression/decompression logic
 */

/**
 * Encodes one block of data using LZMA algorithm
 */
export function codeOneBlock(
	encoder: Encoder,
	probPrices: number[],
	getIndexByteFn: (index: number) => number,
	getMatchLenFn: (index: number, distance: number, limit: number) => number,
	getNumAvailableBytesFn: () => number,
	getOptimumFn: (position: number) => number,
	readMatchDistancesFn: () => number,
	flushFn: (nowPos: number) => void,
	encodeFn: (models: number[], index: number, bit: number) => void,
	encode0Fn: (encoder: any, len: number, posState: number) => void,
	encode1Fn: (encoder: any, curByte: number) => void,
	encode2Fn: (encoder: any, symbol: number) => void,
	encodeDirectBitsFn: (value: number, bits: number) => void,
	encodeMatchedFn: (encoder: any, matchByte: number, curByte: number) => void,
	reverseEncodeFn: (symbol: number) => void,
	reverseEncodeWithModelsFn: (startIndex: number, bits: number, symbol: number) => void,
	getSubCoderFn: (pos: number, prevByte: number) => any,
	stateUpdateCharFn: (state: number) => number,
	getLenToPosStateFn: (len: number) => number,
	getPosSlotFn: (pos: number) => number,
	fillDistancesPricesFn: (encoder: Encoder) => void,
	fillAlignPricesFn: (encoder: Encoder) => void,
	getProcessedSizeAddFn: () => [number, number],
	init5Fn: () => void,
): void {
	let baseVal,
		complexState,
		curByte,
		distance,
		footerBits,
		len,
		lenToPosState,
		matchByte,
		pos,
		posReduced,
		posSlot,
		posState,
		subCoder;

	encoder.processedInSize[0] = LZMA_CONSTANTS.P0_LONG_LIT;
	encoder.processedOutSize[0] = LZMA_CONSTANTS.P0_LONG_LIT;
	encoder.finished[0] = 1;

	if (encoder._inStream) {
		encoder._matchFinder!._stream = encoder._inStream;
		init5Fn();
		encoder._needReleaseMFStream = 1;
		encoder._inStream = null;
	}

	if (encoder._finished) {
		return;
	}

	encoder._finished = 1;

	if (eq(encoder.nowPos64, LZMA_CONSTANTS.P0_LONG_LIT)) {
		if (!getNumAvailableBytesFn()) {
			flushFn(lowBits_0(encoder.nowPos64));
			return;
		}

		readMatchDistancesFn();
		posState = lowBits_0(encoder.nowPos64) & encoder._posStateMask;

		encodeFn(
			encoder._isMatch,
			(encoder._state << 4) + posState,
			0,
		);

		encoder._state = stateUpdateCharFn(encoder._state);
		curByte = getIndexByteFn(
			-encoder._additionalOffset,
		);

		encode1Fn(
			getSubCoderFn(
				lowBits_0(encoder.nowPos64),
				encoder._previousByte,
			),
			curByte,
		);

		encoder._previousByte = curByte;
		encoder._additionalOffset -= 1;
		encoder.nowPos64 = add(
			encoder.nowPos64,
			LZMA_CONSTANTS.P1_LONG_LIT,
		);
	}

	if (!getNumAvailableBytesFn()) {
		flushFn(lowBits_0(encoder.nowPos64));
		return;
	}

	while (1) {
		len = getOptimumFn(lowBits_0(encoder.nowPos64));
		pos = encoder.backRes;
		posState = lowBits_0(encoder.nowPos64) & encoder._posStateMask;
		complexState = (encoder._state << 4) + posState;

		if (len == 1 && pos == -1) {
			encodeFn(
				encoder._isMatch,
				complexState,
				0,
			);

			curByte = getIndexByteFn(
				-encoder._additionalOffset,
			);

			subCoder = getSubCoderFn(
				lowBits_0(encoder.nowPos64),
				encoder._previousByte,
			);

			if (encoder._state < 7) {
				encode1Fn(subCoder, curByte);
			} else {
				matchByte = getIndexByteFn(
					-encoder._repDistances[0]
						- 1
						- encoder._additionalOffset,
				);

				encodeMatchedFn(
					subCoder,
					matchByte,
					curByte,
				);
			}
			encoder._previousByte = curByte;
			encoder._state = stateUpdateCharFn(encoder._state);
		} else {
			encodeFn(
				encoder._isMatch,
				complexState,
				1,
			);
			if (pos < 4) {
				encodeFn(
					encoder._isRep,
					encoder._state,
					1,
				);

				if (!pos) {
					encodeFn(
						encoder._isRepG0,
						encoder._state,
						0,
					);

					if (len == 1) {
						encodeFn(
							encoder._isRep0Long,
							complexState,
							0,
						);
					} else {
						encodeFn(
							encoder._isRep0Long,
							complexState,
							1,
						);
					}
				} else {
					encodeFn(
						encoder._isRepG0,
						encoder._state,
						1,
					);

					if (pos == 1) {
						encodeFn(
							encoder._isRepG1,
							encoder._state,
							0,
						);
					} else {
						encodeFn(
							encoder._isRepG1,
							encoder._state,
							1,
						);
						encodeFn(
							encoder._isRepG2,
							encoder._state,
							pos - 2,
						);
					}
				}

				if (len == 1) {
					encoder._state = encoder._state < 7 ? 9 : 11;
				} else {
					encode0Fn(
						encoder._repMatchLenEncoder,
						len - 2,
						posState,
					);
					encoder._state = encoder._state < 7
						? 0x08
						: 11;
				}
				distance = encoder._repDistances[pos];
				if (pos != 0) {
					for (let i = pos; i >= 1; --i) {
						encoder._repDistances[i] = encoder._repDistances[i - 1];
					}
					encoder._repDistances[0] = distance;
				}
			} else {
				encodeFn(
					encoder._isRep,
					encoder._state,
					0x00,
				);

				encoder._state = encoder._state < 7 ? 7 : 10;
				encode0Fn(
					encoder._lenEncoder,
					len - 0x02,
					posState,
				);

				pos -= 0x04;
				posSlot = getPosSlotFn(pos);
				lenToPosState = getLenToPosStateFn(len);

				encode2Fn(
					encoder._posSlotEncoder[lenToPosState],
					posSlot,
				);

				if (posSlot >= 0x04) {
					footerBits = (posSlot >> 0x01) - 0x01;
					baseVal = (0x02 | posSlot & 0x01) << footerBits;
					posReduced = pos - baseVal;

					if (posSlot < 0x0E) {
						reverseEncodeWithModelsFn(
							baseVal - posSlot - 0x01,
							footerBits,
							posReduced,
						);
					} else {
						encodeDirectBitsFn(posReduced >> 0x04, footerBits - 4);
						reverseEncodeFn(posReduced & 0x0F);
						encoder._alignPriceCount += 0x01;
					}
				}
				distance = pos;
				for (let i = 3; i >= 1; --i) {
					encoder._repDistances[i] = encoder._repDistances[i - 1];
				}

				encoder._repDistances[0] = distance;
				encoder._matchPriceCount += 0x01;
			}

			encoder._previousByte = getIndexByteFn(
				len - 1 - encoder._additionalOffset,
			);
		}

		encoder._additionalOffset -= len;
		encoder.nowPos64 = add(
			encoder.nowPos64,
			fromInt(len),
		);

		if (!encoder._additionalOffset) {
			if (encoder._matchPriceCount >= 0x80) {
				fillDistancesPricesFn(encoder);
			}

			if (encoder._alignPriceCount >= 0x10) {
				fillAlignPricesFn(encoder);
			}

			encoder.processedInSize[0] = encoder.nowPos64;
			encoder.processedOutSize[0] = getProcessedSizeAddFn();

			if (!getNumAvailableBytesFn()) {
				flushFn(lowBits_0(encoder.nowPos64));

				return;
			}

			if (
				compare(
					sub(encoder.nowPos64, [0x1000, 0]),
					[0x1000, 0],
				) >= 0
			) {
				encoder._finished = 0;
				encoder.finished[0] = 0;

				return;
			}
		}
	}
}

/**
 * Decodes one chunk of LZMA compressed data
 */
export function codeOneChunk(
	decoder: Decoder,
	decodeBitFn: (models: number[], index: number) => boolean,
	getDecoderFn: (pos: number, prevByte: number) => LiteralDecoderEncoder2,
	decodeNormalFn: (decoder2: LiteralDecoderEncoder2) => number,
	decodeWithMatchByteFn: (decoder2: LiteralDecoderEncoder2, matchByte: number) => number,
	getByteFn: (distance: number) => number,
	putByteFn: (byte: number) => void,
	decodeFn: (decoder: any, posState: number) => number,
	stateUpdateCharFn: (state: number) => number,
	bitTreeDecoderFn: (bitTree: BitTree) => number,
	reversDecodeFn: (models: number[], startIndex: number, numDirectBits: number) => number,
	decodeDirectBitsFn: (numDirectBits: number) => number,
	reverseDecodeFn: () => number,
	copyBlockFn: (len: number) => void,
	getLenToPosStateFn: (len: number) => number,
): 0 | 1 | -1 {
	let decoder2: LiteralDecoderEncoder2;
	let distance: number;
	let len: number;
	let numDirectBits: number;
	let positionSlot: number;

	const posState = lowBits_0(decoder.nowPos64) & decoder.posStateMask;

	if (!decodeBitFn(decoder.matchDecoders, (decoder.state << 4) + posState)) {
		decoder2 = getDecoderFn(
			lowBits_0(decoder.nowPos64),
			decoder.prevByte,
		);

		if (decoder.state < 7) {
			decoder.prevByte = decodeNormalFn(decoder2);
		} else {
			decoder.prevByte = decodeWithMatchByteFn(
				decoder2,
				getByteFn(decoder.rep0),
			);
		}

		putByteFn(decoder.prevByte);
		decoder.state = stateUpdateCharFn(decoder.state);
		decoder.nowPos64 = add(
			decoder.nowPos64,
			LZMA_CONSTANTS.P1_LONG_LIT,
		);
	} else {
		if (decodeBitFn(decoder.repDecoders, decoder.state)) {
			len = 0;
			if (!decodeBitFn(decoder.repG0Decoders, decoder.state)) {
				if (!decodeBitFn(decoder.rep0LongDecoders, (decoder.state << 4) + posState)) {
					decoder.state = decoder.state < 7 ? 9 : 11;
					len = 1;
				}
			} else {
				if (!decodeBitFn(decoder.repG1Decoders, decoder.state)) {
					distance = decoder.rep1;
				} else {
					if (!decodeBitFn(decoder.repG2Decoders, decoder.state)) {
						distance = decoder.rep2;
					} else {
						distance = decoder.rep3;
						decoder.rep3 = decoder.rep2;
					}
					decoder.rep2 = decoder.rep1;
				}

				decoder.rep1 = decoder.rep0;
				decoder.rep0 = distance;
			}

			if (!len) {
				len = decodeFn(decoder.repLenDecoder, posState) + 2;
				decoder.state = decoder.state < 7 ? 0x08 : 11;
			}
		} else {
			decoder.rep3 = decoder.rep2;
			decoder.rep2 = decoder.rep1;
			decoder.rep1 = decoder.rep0;

			len = 2 + decodeFn(decoder.lenDecoder, posState);

			decoder.state = decoder.state < 7 ? 7 : 10;

			positionSlot = bitTreeDecoderFn(
				decoder.posSlotDecoders[getLenToPosStateFn(len)],
			);

			if (positionSlot >= 4) {
				numDirectBits = (positionSlot >> 1) - 1;
				decoder.rep0 = (2 | positionSlot & 1) << numDirectBits;

				if (positionSlot < 14) {
					decoder.rep0 += reversDecodeFn(
						decoder.posDecoders,
						decoder.rep0 - positionSlot - 1,
						numDirectBits,
					);
				} else {
					decoder.rep0 += decodeDirectBitsFn(numDirectBits - 4) << 4;
					decoder.rep0 += reverseDecodeFn();

					if (decoder.rep0 < 0) {
						if (decoder.rep0 == -1) {
							return 1;
						}

						return -1;
					}
				}
			} else {
				decoder.rep0 = positionSlot;
			}
		}

		if (
			compare(fromInt(decoder.rep0), decoder.nowPos64) >= 0
			|| decoder.rep0 >= decoder.dictSizeCheck
		) {
			return -1;
		}

		copyBlockFn(len);

		decoder.nowPos64 = add(decoder.nowPos64, fromInt(len));
		decoder.prevByte = getByteFn(0);
	}

	return 0;
}
