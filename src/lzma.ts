import {
	DecoderChunker,
	EncoderChunker,
} from "./chunker.js";
import { Decoder } from "./decoder.js";
import {
	Encoder,
	type Optimum,
} from "./encoder.js";
import { BinTreeMatchFinder } from "./match-finder.js";
import {
	InputBuffer,
	OutputBuffer,
} from "./streams.js";
import {
	_MAX_UINT32,
	add64,
	type BitTree,
	compare64,
	createBitTree,
	fromInt64,
	G_FAST_POS,
	getBitPrice,
	getLenToPosState,
	INFINITY_PRICE,
	type LiteralDecoderEncoder2,
	lowBits64,
	N1_LONG_LIT,
	P0_LONG_LIT,
	P1_LONG_LIT,
	PROB_PRICES,
	shr64,
	stateUpdateChar,
	sub64,
} from "./utils.js";

interface Mode {
	searchDepth: number;
	filterStrength: number;
	modeIndex: number;
}

/**
 * Range coder interface
 */
interface RangeCoder {
	stream: InputBuffer | OutputBuffer | null;
}

/**
 * Range decoder
 */
export interface RangeDecoder extends RangeCoder {
	code: number;
	rrange: number;
	stream: InputBuffer | null;
	init?(): void;
	decodeBit?(probs: number[], index: number): 0 | 1;
}

/**
 * Literal coder interface
 */
export interface LiteralCoder {
	coders: LiteralDecoderEncoder2[];
	numPrevBits: number;
	numPosBits: number;
	posMask: number;
	init?(): void;
}

/**
 * Length coder
 */
export interface LenCoder {
	choice: number[];
	lowCoder: BitTree[];
	midCoder: BitTree[];
	highCoder: BitTree;
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
	length_0?: [number, number];
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
		const encoderChunker = new EncoderChunker(this);

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

	#configure(mode: Mode): void {
		this.#encoder.initialize();
		this.#encoder.configure(mode);
	}

	#initCompression(
		input: InputBuffer,
		len: [number, number],
		mode: Mode,
	): void {
		if (compare64(len, N1_LONG_LIT) < 0) {
			throw new Error("invalid length " + len);
		}

		this.#compressor.length_0 = len;
		this.#Encoder();

		this.#configure(mode);
		this.writeHeaderProperties();

		for (let i = 0; i < 64; i += 8) {
			this.#compressor.output.writeByte(
				(lowBits64(shr64(len, i)) & 0xFF) << 24 >> 24,
			);
		}

		this.#encoder._needReleaseMFStream = 0;
		this.#encoder._inStream = input;
		this.#encoder._finished = 0;

		this.#Create_2();
		this.#encoder._rangeEncoder.stream = this.#compressor.output;
		this.#encoder.init();

		this.#encoder.fillDistancesPrices();
		this.#encoder.fillAlignPrices();

		this.#encoder._lenEncoder!.setTableSize(this.#encoder._numFastBytes + 1 - 2);
		this.#encoder._lenEncoder!.updateTables(
			1 << this.#encoder._posStateBits,
		);

		this.#encoder._repMatchLenEncoder!.setTableSize(this.#encoder._numFastBytes + 1 - 2);
		this.#encoder._repMatchLenEncoder!.updateTables(
			1 << this.#encoder._posStateBits,
		);

		this.#encoder.nowPos64 = P0_LONG_LIT;

		this.#compressor.chunker.encoder = this.#encoder;
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

	#initDecompression(input: InputBuffer): void {
		let hex_length = "",
			properties = [],
			r: number | string,
			tmp_length: number;

		for (let i = 0; i < 5; ++i) {
			r = input.readByte();
			if (r == -1) {
				throw new Error("truncated input");
			}
			properties[i] = r << 24 >> 24;
		}

		const isDecoderInitialized = !this.#decoder.setDecoderProperties(properties)
			? 1
			: 0;

		if (isDecoderInitialized) {
			throw new Error("corrupted input");
		}

		for (let i = 0; i < 64; i += 8) {
			r = input.readByte();
			if (r == -1) {
				throw new Error("truncated input");
			}
			r = r.toString(0x10);
			if (r.length == 1) r = "0" + r;
			hex_length = r + "" + hex_length;
		}

		/**
		 * Was the length set in the header (if it was compressed from a stream, the
		 * length is all f"s).
		 */
		if (/^0+$|^f+$/i.test(hex_length)) {
			this.#compressor.length_0 = N1_LONG_LIT;
		} else {
			/**
			 * NOTE: If there is a problem with the decoder because of the length,
			 * you can always set the length to -1 (N1_longLit) which means unknown.
			 */
			tmp_length = parseInt(hex_length, 0x10);
			if (tmp_length > _MAX_UINT32) {
				this.#compressor.length_0 = N1_LONG_LIT;
			} else {
				this.#compressor.length_0 = fromInt64(tmp_length);
			}
		}

		this.#decompressor.chunker = this.#CodeInChunks(
			input,
			this.#compressor.length_0,
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

		this.#initDecompression(inputBuffer);
	}


	#CodeInChunks(inStream: InputBuffer, outSize: [number, number]): DecoderChunker {
		this.#decoder.rangeDecoder.stream = inStream;
		this.#decoder.flush();
		this.#decoder.outWindow.stream = null;
		this.#decoder.outWindow.stream = this.#decompressor.output;

		this.#Init_1();
		this.#decoder.state = 0;
		this.#decoder.rep0 = 0;
		this.#decoder.rep1 = 0;
		this.#decoder.rep2 = 0;
		this.#decoder.rep3 = 0;
		this.#decoder.outSize = outSize;
		this.#decoder.nowPos64 = P0_LONG_LIT;
		this.#decoder.prevByte = 0;

		// Create and return decoder chunker
		const decoderChunker = new DecoderChunker(this.#decoder);
		decoderChunker.alive = 1;

		return decoderChunker;
	}

	#Init_1(): void {
		this.#decoder.init();
	}

	#Backward(cur: number): number {
		const encoder = this.#compressor.chunker.encoder;
		let backCur, backMem, posMem, posPrev;

		encoder!._optimumEndIndex = cur;
		posMem = encoder!._optimum[cur].posPrev;
		backMem = encoder!._optimum[cur].backPrev;

		do {
			if (encoder!._optimum[cur].prev1IsChar) {
				this.#MakeAsChar(encoder!._optimum[posMem!]);
				encoder!._optimum[posMem!].posPrev = posMem! - 1;

				if (encoder!._optimum[cur].prev2) {
					encoder!._optimum[posMem! - 1].prev1IsChar = 0;
					encoder!._optimum[posMem! - 1].posPrev = encoder!._optimum[cur].posPrev2;
					encoder!._optimum[posMem! - 1].backPrev = encoder!._optimum[cur].backPrev2;
				}
			}

			posPrev = posMem;
			backCur = backMem;
			backMem = encoder!._optimum[posPrev!].backPrev;
			posMem = encoder!._optimum[posPrev!].posPrev;
			encoder!._optimum[posPrev!].backPrev = backCur;
			encoder!._optimum[posPrev!].posPrev = cur;
			cur = posPrev!;
		} while (cur > 0);

		encoder!.backRes = encoder!._optimum[0].backPrev!;
		encoder!._optimumCurrentIndex = encoder!._optimum[0].posPrev!;

		return encoder!._optimumCurrentIndex;
	}

	#CodeOneBlock(): void {
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
			progressPosValuePrev,
			subCoder;

		this.#compressor.chunker.encoder!.processedInSize[0] = P0_LONG_LIT;
		this.#compressor.chunker.encoder!.processedOutSize[0] = P0_LONG_LIT;
		this.#compressor.chunker.encoder!.finished[0] = 1;
		progressPosValuePrev = this.#compressor.chunker.encoder!.nowPos64;

		if (this.#compressor.chunker.encoder!._inStream) {
			this.#compressor.chunker.encoder!._matchFinder!._stream = this.#compressor.chunker.encoder!._inStream;
			this.#encoder._matchFinder!.init();
			this.#compressor.chunker.encoder!._needReleaseMFStream = 1;
			this.#compressor.chunker.encoder!._inStream = null;
		}

		if (this.#compressor.chunker.encoder!._finished) {
			return;
		}

		this.#compressor.chunker.encoder!._finished = 1;

		if (compare64(this.#compressor.chunker.encoder!.nowPos64, P0_LONG_LIT) === 0) {
			if (!this.#encoder._matchFinder!.getNumAvailableBytes()) {
				this.#Flush(lowBits64(this.#compressor.chunker.encoder!.nowPos64));
				return;
			}

			this.#ReadMatchDistances();
			posState = lowBits64(this.#compressor.chunker.encoder!.nowPos64) & this.#compressor.chunker.encoder!._posStateMask;

			this.#compressor.chunker.encoder!.encodeBit(
				this.#compressor.chunker.encoder!._isMatch,
				(this.#compressor.chunker.encoder!._state << 4) + posState,
				0,
			);

			this.#compressor.chunker.encoder!._state = stateUpdateChar(this.#compressor.chunker.encoder!._state);
			curByte = this.#encoder._matchFinder!.getIndexByte(
				-this.#compressor.chunker.encoder!._additionalOffset,
			);

			this.#compressor.chunker.encoder!.encodeLiteral(
				this.#LZMA_Encoder_GetSubCoder(
					lowBits64(this.#compressor.chunker.encoder!.nowPos64),
					this.#compressor.chunker.encoder!._previousByte,
				),
				curByte,
			);

			this.#compressor.chunker.encoder!._previousByte = curByte;
			this.#compressor.chunker.encoder!._additionalOffset -= 1;
			this.#compressor.chunker.encoder!.nowPos64 = add64(
				this.#compressor.chunker.encoder!.nowPos64,
				P1_LONG_LIT,
			);
		}

		if (!this.#encoder._matchFinder!.getNumAvailableBytes()) {
			this.#Flush(lowBits64(this.#compressor.chunker.encoder!.nowPos64));
			return;
		}

		while (1) {
			len = this.#GetOptimum(lowBits64(this.#compressor.chunker.encoder!.nowPos64));
			pos = this.#compressor.chunker.encoder!.backRes;
			posState = lowBits64(this.#compressor.chunker.encoder!.nowPos64) & this.#compressor.chunker.encoder!._posStateMask;
			complexState = (this.#compressor.chunker.encoder!._state << 4) + posState;

			if (len == 1 && pos == -1) {
				this.#compressor.chunker.encoder!.encodeBit(
					this.#compressor.chunker.encoder!._isMatch,
					complexState,
					0,
				);

				curByte = this.#encoder._matchFinder!.getIndexByte(
					-this.#compressor.chunker.encoder!._additionalOffset,
				);

				subCoder = this.#LZMA_Encoder_GetSubCoder(
					lowBits64(this.#compressor.chunker.encoder!.nowPos64),
					this.#compressor.chunker.encoder!._previousByte,
				);

				if (this.#compressor.chunker.encoder!._state < 7) {
					this.#compressor.chunker.encoder!.encodeLiteral(subCoder, curByte);
				} else {
					matchByte = this.#encoder._matchFinder!.getIndexByte(
						-this.#compressor.chunker.encoder!._repDistances[0]
							- 1
							- this.#compressor.chunker.encoder!._additionalOffset,
					);

					this.#compressor.chunker.encoder!.encodeMatched(
						subCoder,
						matchByte,
						curByte,
					);
				}
				this.#compressor.chunker.encoder!._previousByte = curByte;
				this.#compressor.chunker.encoder!._state = stateUpdateChar(this.#compressor.chunker.encoder!._state);
			} else {
				this.#compressor.chunker.encoder!.encodeBit(
					this.#compressor.chunker.encoder!._isMatch,
					complexState,
					1,
				);
				if (pos < 4) {
					this.#compressor.chunker.encoder!.encodeBit(
						this.#compressor.chunker.encoder!._isRep,
						this.#compressor.chunker.encoder!._state,
						1,
					);

					if (!pos) {
						this.#compressor.chunker.encoder!.encodeBit(
							this.#compressor.chunker.encoder!._isRepG0,
							this.#compressor.chunker.encoder!._state,
							0,
						);

						if (len == 1) {
							this.#compressor.chunker.encoder!.encodeBit(
								this.#compressor.chunker.encoder!._isRep0Long,
								complexState,
								0,
							);
						} else {
							this.#compressor.chunker.encoder!.encodeBit(
								this.#compressor.chunker.encoder!._isRep0Long,
								complexState,
								1,
							);
						}
					} else {
						this.#compressor.chunker.encoder!.encodeBit(
							this.#compressor.chunker.encoder!._isRepG0,
							this.#compressor.chunker.encoder!._state,
							1,
						);

						if (pos == 1) {
							this.#compressor.chunker.encoder!.encodeBit(
								this.#compressor.chunker.encoder!._isRepG1,
								this.#compressor.chunker.encoder!._state,
								0,
							);
						} else {
							this.#compressor.chunker.encoder!.encodeBit(
								this.#compressor.chunker.encoder!._isRepG1,
								this.#compressor.chunker.encoder!._state,
								1,
							);
							this.#compressor.chunker.encoder!.encodeBit(
								this.#compressor.chunker.encoder!._isRepG2,
								this.#compressor.chunker.encoder!._state,
								pos - 2,
							);
						}
					}

					if (len == 1) {
						this.#compressor.chunker.encoder!._state = this.#compressor.chunker.encoder!._state < 7 ? 9 : 11;
					} else {
						this.#compressor.chunker.encoder!.encodeLength(
							this.#compressor.chunker.encoder!._repMatchLenEncoder!,
							len - 2,
							posState,
						);
						this.#compressor.chunker.encoder!._state = this.#compressor.chunker.encoder!._state < 7
							? 0x08
							: 11;
					}
					distance = this.#compressor.chunker.encoder!._repDistances[pos];
					if (pos != 0) {
						const encoder = this.#compressor.chunker.encoder!;
						for (let i = pos; i >= 1; --i) {
							encoder._repDistances[i] = encoder._repDistances[i - 1];
						}
						encoder._repDistances[0] = distance;
					}
				} else {
					this.#compressor.chunker.encoder!.encodeBit(
						this.#compressor.chunker.encoder!._isRep,
						this.#compressor.chunker.encoder!._state,
						0,
					);

					this.#compressor.chunker.encoder!._state = this.#compressor.chunker.encoder!._state < 7 ? 7 : 10;
					this.#compressor.chunker.encoder!.encodeLength(
						this.#compressor.chunker.encoder!._lenEncoder!,
						len - 0x02,
						posState,
					);

					pos -= 0x04;
					posSlot = this.#compressor.chunker.encoder!.getPosSlot(pos);
					lenToPosState = getLenToPosState(len);
					this.#compressor.chunker.encoder!.encodeBitTree(
						this.#compressor.chunker.encoder!._posSlotEncoder[lenToPosState],
						posSlot,
					);

					if (posSlot >= 0x04) {
						footerBits = (posSlot >> 0x01) - 0x01;
						baseVal = (0x02 | (posSlot & 0x01)) << footerBits;
						posReduced = pos - baseVal;

						if (posSlot < 0x0E) {
							this.#compressor.chunker.encoder!.reverseEncodeRange(
								baseVal - posSlot - 0x01,
								footerBits,
								posReduced,
							);
						} else {
							this.#compressor.chunker.encoder!.encodeDirectBits(posReduced >> 0x04, footerBits - 4);
							this.#compressor.chunker.encoder!.reverseEncode(posReduced & 0x0F);
							this.#compressor.chunker.encoder!._alignPriceCount += 1;
						}
					}
					distance = pos;
					const encoder2 = this.#compressor.chunker.encoder!;
					for (let i = 3; i >= 1; --i) {
						encoder2._repDistances[i] = encoder2._repDistances[i - 1];
					}

					encoder2._repDistances[0] = distance;
					encoder2._matchPriceCount += 0x01;
				}

				this.#compressor.chunker.encoder!._previousByte = this.#encoder._matchFinder!.getIndexByte(
					len - 1 - this.#compressor.chunker.encoder!._additionalOffset,
				);
			}

			this.#compressor.chunker.encoder!._additionalOffset -= len;
			this.#compressor.chunker.encoder!.nowPos64 = add64(
				this.#compressor.chunker.encoder!.nowPos64,
				fromInt64(len),
			);

			if (!this.#compressor.chunker.encoder!._additionalOffset) {
				if (this.#compressor.chunker.encoder!._matchPriceCount >= 0x80) {
					this.#compressor.chunker.encoder!.fillDistancesPrices();
				}

				if (this.#compressor.chunker.encoder!._alignPriceCount >= 0x10) {
					this.#FillAlignPrices(this.#compressor.chunker.encoder!);
				}

				this.#compressor.chunker.encoder!.processedInSize[0] = this.#compressor.chunker.encoder!.nowPos64;
				this.#compressor.chunker.encoder!.processedOutSize[0] = this.#GetProcessedSizeAdd();

				if (!this.#encoder._matchFinder!.getNumAvailableBytes()) {
					this.#Flush(lowBits64(this.#compressor.chunker.encoder!.nowPos64));

					return;
				}

				if (
					compare64(
						sub64(this.#compressor.chunker.encoder!.nowPos64, progressPosValuePrev),
						[0x1000, 0],
					) >= 0
				) {
					this.#compressor.chunker.encoder!._finished = 0;
					this.#compressor.chunker.encoder!.finished[0] = 0;

					return;
				}
			}
		}
	}

	#Create_2(): void {
		if (!this.#encoder._matchFinder) {
			const binTree = new BinTreeMatchFinder();
			let numHashBytes = 4;

			if (!this.#encoder._matchFinderType) {
				numHashBytes = 2;
			}

			binTree.setType(numHashBytes);
			this.#encoder._matchFinder = binTree;
		}
		this.#encoder.createLiteralEncoder();

		if (
			this.#encoder._dictionarySize == this.#encoder._dictionarySizePrev
			&& this.#encoder._numFastBytesPrev == this.#encoder._numFastBytes
		) {
			return;
		}

		this.#encoder._matchFinder!.create(
			this.#encoder._dictionarySize,
			this.#encoder._numFastBytes,
			0x1000,
			0x0112,
		);

		this.#encoder._dictionarySizePrev = this.#encoder._dictionarySize;
		this.#encoder._numFastBytesPrev = this.#encoder._numFastBytes;
	}

	#Encoder(): void {
		for (let i = 0; i < 0x1000; ++i) {
			this.#encoder._optimum[i] = {};
		}

		for (let i = 0; i < 4; ++i) {
			this.#encoder._posSlotEncoder[i] = createBitTree(6);
		}
	}

	#FillAlignPrices(encoder: Encoder): void {
		for (let i = 0; i < 16; ++i) {
			encoder!._alignPrices[i] = this.#ReverseGetPrice(encoder!._posAlignEncoder!, i);
		}

		encoder!._alignPriceCount = 0;
	}

	#Flush(nowPos: number): void {
		this.#ReleaseMFStream();
		this.#compressor.chunker.encoder!.writeEndMarker(nowPos & this.#compressor.chunker.encoder!._posStateMask);

		for (let i = 0; i < 5; ++i) {
			this.#compressor.chunker.encoder!.shiftLow();
		}
	}

	#GetOptimum(position: number) {
		let cur,
			curAnd1Price,
			curAndLenCharPrice,
			curAndLenPrice,
			curBack,
			curPrice,
			currentByte,
			distance,
			len,
			lenEnd,
			lenMain,
			lenTest,
			lenTest2,
			lenTestTemp,
			matchByte,
			matchPrice,
			newLen,
			nextIsChar,
			nextMatchPrice,
			nextOptimum,
			nextRepMatchPrice,
			normalMatchPrice,
			numAvailableBytes,
			numAvailableBytesFull,
			numDistancePairs,
			offs,
			offset,
			opt,
			optimum,
			pos,
			posPrev,
			posState,
			posStateNext,
			price_4,
			repIndex,
			repLen,
			repMatchPrice,
			repMaxIndex,
			shortRepPrice,
			startLen,
			state,
			state2,
			t,
			price,
			price_0,
			price_1,
			price_2,
			price_3,
			lenRes;

		const encoder = this.#compressor.chunker.encoder!;

		if (encoder!._optimumEndIndex != encoder!._optimumCurrentIndex) {
			lenRes = encoder!._optimum[encoder!._optimumCurrentIndex].posPrev! - encoder!._optimumCurrentIndex;
			encoder!.backRes = encoder!._optimum[encoder!._optimumCurrentIndex].backPrev!;
			encoder!._optimumCurrentIndex = encoder!._optimum[encoder!._optimumCurrentIndex].posPrev!;

			return lenRes;
		}

		encoder!._optimumCurrentIndex = encoder!._optimumEndIndex = 0;
		if (encoder!._longestMatchWasFound) {
			lenMain = encoder!._longestMatchLength;
			encoder!._longestMatchWasFound = 0;
		} else {
			lenMain = this.#ReadMatchDistances();
		}

		numDistancePairs = encoder!._numDistancePairs;
		numAvailableBytes = this.#encoder._matchFinder!.getNumAvailableBytes() + 1;

		if (numAvailableBytes < 2) {
			encoder!.backRes = -1;
			return 1;
		}

		if (numAvailableBytes > 0x0111) {
			numAvailableBytes = 0x0111;
		}

		repMaxIndex = 0;
		for (let i = 0; i < 4; ++i) {
			encoder!.reps[i] = encoder!._repDistances[i];
			encoder!.repLens[i] = this.#encoder._matchFinder!.getMatchLen(-1, encoder!.reps[i], 0x0111);

			if (encoder!.repLens[i] > encoder!.repLens[repMaxIndex]) {
				repMaxIndex = i;
			}
		}

		if (encoder!.repLens[repMaxIndex] >= encoder!._numFastBytes) {
			encoder!.backRes = repMaxIndex;
			lenRes = encoder!.repLens[repMaxIndex];
			this.#MovePos(lenRes - 1);

			return lenRes;
		}

		if (lenMain >= encoder!._numFastBytes) {
			encoder!.backRes = this.#compressor.chunker.encoder!._matchDistances[numDistancePairs - 1] + 4;

			this.#MovePos(lenMain - 1);
			return lenMain;
		}

		currentByte = this.#encoder._matchFinder!.getIndexByte(-1);
		matchByte = this.#encoder._matchFinder!.getIndexByte(-encoder!._repDistances[0] - 1 - 1);

		if (lenMain < 2 && currentByte != matchByte && encoder!.repLens[repMaxIndex] < 2) {
			encoder!.backRes = -1;
			return 1;
		}

		encoder!._optimum[0].state = encoder!._state;
		posState = position & encoder!._posStateMask;
		encoder!._optimum[1].price = PROB_PRICES[
			(encoder!._isMatch[(encoder!._state << 4) + posState]) >>> 2
		] + this.#RangeCoder_Encoder_GetPrice_0(
			this.#LZMA_Encoder_GetSubCoder(
				position,
				encoder!._previousByte,
			),
			encoder!._state >= 7,
			matchByte,
			currentByte,
		);

		this.#MakeAsChar(encoder!._optimum[1]);
		matchPrice = PROB_PRICES[
			(2048 - encoder!._isMatch[(encoder!._state << 4) + posState])
			>>> 2
		];

		repMatchPrice = matchPrice + PROB_PRICES[
			(2048 - encoder!._isRep[encoder!._state]) >>> 2
		];

		if (matchByte == currentByte) {
			shortRepPrice = repMatchPrice + this.#GetRepLen1Price(posState);
			if (shortRepPrice < encoder!._optimum[1].price) {
				encoder!._optimum[1].price = shortRepPrice;
				this.#MakeAsShortRep(encoder!._optimum[1]);
			}
		}

		lenEnd = lenMain >= encoder!.repLens[repMaxIndex]
			? lenMain
			: encoder!.repLens[repMaxIndex];

		if (lenEnd < 2) {
			encoder!.backRes = encoder!._optimum[1].backPrev!;
			return 1;
		}

		encoder!._optimum[1].posPrev = 0;
		encoder!._optimum[0].backs0 = encoder!.reps[0];
		encoder!._optimum[0].backs1 = encoder!.reps[1];
		encoder!._optimum[0].backs2 = encoder!.reps[2];
		encoder!._optimum[0].backs3 = encoder!.reps[3];
		len = lenEnd;

		do {
			encoder!._optimum[len].price = INFINITY_PRICE;
			len -= 1;
		} while (len >= 2);

		for (let i = 0; i < 4; ++i) {
			repLen = encoder!.repLens[i];
			if (repLen < 2) {
				continue;
			}
			price_4 = repMatchPrice + this.#GetPureRepPrice(
				i,
				encoder!._state,
				posState,
			);

			do {
				curAndLenPrice = price_4 + encoder!._repMatchLenEncoder!.getPrice(
					repLen - 2,
					posState,
				);
				optimum = encoder!._optimum[repLen];
				if (curAndLenPrice < optimum.price!) {
					optimum.price = curAndLenPrice;
					optimum.posPrev = 0;
					optimum.backPrev = i;
					optimum.prev1IsChar = 0;
				}
			} while ((repLen -= 1) >= 2);
		}

		normalMatchPrice = matchPrice
			+ PROB_PRICES[(encoder!._isRep[encoder!._state]) >>> 2];

		len = encoder!.repLens[0] >= 2 ? encoder!.repLens[0] + 1 : 2;

		if (len <= lenMain) {
			offs = 0;
			while (len > encoder!._matchDistances[offs]) {
				offs += 2;
			}

			for (;; len += 1) {
				distance = encoder!._matchDistances[offs + 1];
				curAndLenPrice = normalMatchPrice + this.#LZMA_Encoder_GetPosLenPrice(distance, len, posState);
				optimum = encoder!._optimum[len];

				if (curAndLenPrice < optimum.price!) {
					optimum.price = curAndLenPrice;
					optimum.posPrev = 0;
					optimum.backPrev = distance + 4;
					optimum.prev1IsChar = 0;
				}

				if (len == encoder!._matchDistances[offs]) {
					offs += 2;
					if (offs == numDistancePairs) {
						break;
					}
				}
			}
		}
		cur = 0;

		while (1) {
			++cur;
			if (cur == lenEnd) {
				return this.#Backward(cur);
			}
			newLen = this.#ReadMatchDistances();
			numDistancePairs = encoder!._numDistancePairs;

			if (newLen >= encoder!._numFastBytes) {
				encoder!._longestMatchLength = newLen;
				encoder!._longestMatchWasFound = 0x01;

				return this.#Backward(cur);
			}
			position += 0x01;
			posPrev = encoder!._optimum[cur].posPrev;

			if (encoder!._optimum[cur].prev1IsChar) {
				posPrev! -= 0x01;
				if (encoder!._optimum[cur].prev2) {
					state = encoder!._optimum[encoder!._optimum[cur].posPrev2!].state;
					if (encoder!._optimum[cur].backPrev2! < 0x04) {
						state = (state! < 0x07) ? 0x08 : 0x0B;
					} else {
						state = (state! < 0x07) ? 0x07 : 0x0A;
					}
				} else {
					state = encoder!._optimum[posPrev!].state;
				}
				state = stateUpdateChar(state!);
			} else {
				state = encoder!._optimum[posPrev!].state;
			}

			if (posPrev! == cur - 1) {
				if (!encoder!._optimum[cur].backPrev) {
					state = state! < 7 ? 9 : 11;
				} else {
					state = stateUpdateChar(state!);
				}
			} else {
				if (
					encoder!._optimum[cur].prev1IsChar
					&& encoder!._optimum[cur].prev2
				) {
					posPrev = encoder!._optimum[cur].posPrev2;
					pos = encoder!._optimum[cur].backPrev2;
					state = state! < 0x07 ? 0x08 : 0x0B;
				} else {
					pos = encoder!._optimum[cur].backPrev;
					if (pos! < 4) {
						state = state! < 0x07 ? 0x08 : 0x0B;
					} else {
						state = state! < 0x07 ? 0x07 : 0x0A;
					}
				}
				opt = encoder._optimum[posPrev!];

				if (pos! < 4) {
					if (!pos) {
						encoder.reps[0] = opt.backs0!;
						encoder.reps[1] = opt.backs1!;
						encoder.reps[2] = opt.backs2!;
						encoder.reps[3] = opt.backs3!;
					} else if (pos == 1) {
						encoder.reps[0] = opt.backs1!;
						encoder.reps[1] = opt.backs0!;
						encoder.reps[2] = opt.backs2!;
						encoder.reps[3] = opt.backs3!;
					} else if (pos == 2) {
						encoder.reps[0] = opt.backs2!;
						encoder.reps[1] = opt.backs0!;
						encoder.reps[2] = opt.backs1!;
						encoder.reps[3] = opt.backs3!;
					} else {
						encoder.reps[0] = opt.backs3!;
						encoder.reps[1] = opt.backs0!;
						encoder.reps[2] = opt.backs1!;
						encoder.reps[3] = opt.backs2!;
					}
				} else {
					encoder.reps[0] = pos! - 4;
					encoder.reps[1] = opt.backs0!;
					encoder.reps[2] = opt.backs1!;
					encoder.reps[3] = opt.backs2!;
				}
			}

			encoder._optimum[cur].state = state;
			encoder._optimum[cur].backs0 = encoder.reps[0];
			encoder._optimum[cur].backs1 = encoder.reps[1];
			encoder._optimum[cur].backs2 = encoder.reps[2];
			encoder._optimum[cur].backs3 = encoder.reps[3];
			curPrice = encoder!._optimum[cur].price;

			currentByte = this.#encoder._matchFinder!.getIndexByte(-0x01);
			matchByte = this.#encoder._matchFinder!.getIndexByte(-encoder!.reps[0] - 1 - 1);

			posState = position & encoder!._posStateMask;
			curAnd1Price = curPrice!
				+ PROB_PRICES[(encoder!._isMatch[(state! << 0x04) + posState]) >>> 2]
				+ this.#RangeCoder_Encoder_GetPrice_0(
					this.#LZMA_Encoder_GetSubCoder(position, this.#encoder._matchFinder!.getIndexByte(-2)),
					state! >= 7,
					matchByte,
					currentByte,
				);

			nextOptimum = encoder!._optimum[cur + 1];
			nextIsChar = 0;

			if (curAnd1Price < nextOptimum.price!) {
				nextOptimum.price = curAnd1Price;
				nextOptimum.posPrev = cur;
				nextOptimum.backPrev = -0x01;
				nextOptimum.prev1IsChar = 0;
				nextIsChar = 1;
			}

			matchPrice = curPrice! + PROB_PRICES[
				(2048 - encoder!._isMatch[(state! << 4) + posState]) >>> 2
			];

			repMatchPrice = matchPrice + PROB_PRICES[(2048 - encoder!._isRep[state!]) >>> 2];

			if (matchByte == currentByte && !(nextOptimum.posPrev! < cur && !nextOptimum.backPrev)) {
				shortRepPrice = repMatchPrice
					+ (PROB_PRICES[(encoder!._isRepG0[state!]) >>> 0x02] + PROB_PRICES[(encoder!._isRep0Long[(state! << 0x04) + posState]) >>> 0x02]);

				if (shortRepPrice <= nextOptimum.price!) {
					nextOptimum.price = shortRepPrice;
					nextOptimum.posPrev = cur;
					nextOptimum.backPrev = 0;
					nextOptimum.prev1IsChar = 0;
					nextIsChar = 1;
				}
			}

			numAvailableBytesFull = this.#encoder._matchFinder!.getNumAvailableBytes() + 1;
			numAvailableBytesFull = 0xFFF - cur < numAvailableBytesFull
				? 0xFFF - cur
				: numAvailableBytesFull;

			numAvailableBytes = numAvailableBytesFull;

			if (numAvailableBytes < 2) {
				continue;
			}

			if (numAvailableBytes > encoder!._numFastBytes) {
				numAvailableBytes = encoder!._numFastBytes;
			}

			if (!nextIsChar && matchByte != currentByte) {
				t = Math.min(numAvailableBytesFull - 1, encoder!._numFastBytes);
				lenTest2 = this.#encoder._matchFinder!.getMatchLen(0, encoder!.reps[0], t);

				if (lenTest2 >= 2) {
					state2 = stateUpdateChar(state);
					posStateNext = position + 1 & encoder!._posStateMask;
					nextRepMatchPrice = curAnd1Price
						+ PROB_PRICES[(2048 - encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2]
						+ PROB_PRICES[(2048 - encoder!._isRep[state2]) >>> 2];

					offset = cur + 1 + lenTest2;

					while (lenEnd < offset) {
						encoder!._optimum[lenEnd += 1].price = INFINITY_PRICE;
					}

					curAndLenPrice = nextRepMatchPrice + (price = encoder!._repMatchLenEncoder!.getPrice(
						lenTest2 - 2,
						posStateNext,
					),
						price + this.#GetPureRepPrice(
							0,
							state2,
							posStateNext,
						));
					optimum = encoder!._optimum[offset];

					if (curAndLenPrice < optimum.price!) {
						optimum.price = curAndLenPrice;
						optimum.posPrev = cur + 1;
						optimum.backPrev = 0;
						optimum.prev1IsChar = 1;
						optimum.prev2 = 0;
					}
				}
			}
			startLen = 0x02;

			for (repIndex = 0; repIndex < 4; ++repIndex) {
				lenTest = this.#encoder._matchFinder!.getMatchLen(
					-0x01,
					encoder!.reps[repIndex],
					numAvailableBytes,
				);

				if (lenTest < 2) {
					continue;
				}
				lenTestTemp = lenTest;

				do {
					while (lenEnd < cur + lenTest) {
						encoder!._optimum[lenEnd += 1].price = INFINITY_PRICE;
					}

					curAndLenPrice = repMatchPrice + (price_0 = encoder!._repMatchLenEncoder!.getPrice(
						lenTest - 2,
						posState,
					),
						price_0 + this.#GetPureRepPrice(
							repIndex,
							state,
							posState,
						));

					optimum = encoder!._optimum[cur + lenTest];

					if (curAndLenPrice < optimum.price!) {
						optimum.price = curAndLenPrice;
						optimum.posPrev = cur;
						optimum.backPrev = repIndex;
						optimum.prev1IsChar = 0;
					}
				} while ((lenTest -= 1) >= 2);

				lenTest = lenTestTemp;

				if (!repIndex) {
					startLen = lenTest + 1;
				}

				if (lenTest < numAvailableBytesFull) {
					t = Math.min(
						numAvailableBytesFull - 1 - lenTest,
						encoder!._numFastBytes,
					);
					lenTest2 = this.#encoder._matchFinder!.getMatchLen(
						lenTest,
						encoder!.reps[repIndex],
						t,
					);

					if (lenTest2 >= 2) {
						state2 = state < 7 ? 0x08 : 11;
						posStateNext = position + lenTest & encoder!._posStateMask;
						curAndLenCharPrice = repMatchPrice
							+ (price_1 = encoder!._repMatchLenEncoder!.getPrice(lenTest - 2, posState), price_1 + this.#GetPureRepPrice(repIndex, state, posState))
							+ PROB_PRICES[(encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2]
							+ this.#RangeCoder_Encoder_GetPrice_0(
								this.#LZMA_Encoder_GetSubCoder(position + lenTest, this.#encoder._matchFinder!.getIndexByte(lenTest - 1 - 1)),
								true,
								this.#encoder._matchFinder!.getIndexByte(lenTest - 1 - (encoder!.reps[repIndex] + 1)),
								this.#encoder._matchFinder!.getIndexByte(lenTest - 1),
							);

						state2 = stateUpdateChar(state2);
						posStateNext = position + lenTest + 1 & encoder!._posStateMask;

						nextMatchPrice = curAndLenCharPrice + PROB_PRICES[
							(2048 - encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2
						];

						nextRepMatchPrice = nextMatchPrice + PROB_PRICES[
							(2048 - encoder!._isRep[state2]) >>> 2
						];

						offset = lenTest + 1 + lenTest2;

						while (lenEnd < cur + offset) {
							encoder!._optimum[lenEnd += 1].price = INFINITY_PRICE;
						}

						curAndLenPrice = nextRepMatchPrice + (price_2 = encoder!._repMatchLenEncoder!.getPrice(lenTest2 - 2, posStateNext), price_2 + this.#GetPureRepPrice(0, state2, posStateNext));
						optimum = encoder!._optimum[cur + offset];

						if (curAndLenPrice < optimum.price!) {
							optimum.price = curAndLenPrice;
							optimum.posPrev = cur + lenTest + 1;
							optimum.backPrev = 0;
							optimum.prev1IsChar = 1;
							optimum.prev2 = 1;
							optimum.posPrev2 = cur;
							optimum.backPrev2 = repIndex;
						}
					}
				}
			}

			if (newLen > numAvailableBytes) {
				newLen = numAvailableBytes;
				for (
					numDistancePairs = 0;
					newLen > encoder!._matchDistances[numDistancePairs];
					numDistancePairs += 2
				) {}
				encoder!._matchDistances[numDistancePairs] = newLen;
				numDistancePairs += 2;
			}

			if (newLen >= startLen) {
				normalMatchPrice = matchPrice + PROB_PRICES[(encoder!._isRep[state]) >>> 2];

				while (lenEnd < cur + newLen) {
					encoder!._optimum[lenEnd += 1].price = INFINITY_PRICE;
				}
				offs = 0;

				while (startLen > encoder!._matchDistances[offs]) {
					offs += 2;
				}
				for (lenTest = startLen;; lenTest += 1) {
					curBack = encoder!._matchDistances[offs + 1];
					curAndLenPrice = normalMatchPrice + this.#LZMA_Encoder_GetPosLenPrice(curBack, lenTest, posState);
					optimum = encoder!._optimum[cur + lenTest];

					if (curAndLenPrice < optimum.price!) {
						optimum.price = curAndLenPrice;
						optimum.posPrev = cur;
						optimum.backPrev = curBack + 4;
						optimum.prev1IsChar = 0;
					}

					if (lenTest == encoder!._matchDistances[offs]) {
						if (lenTest < numAvailableBytesFull) {
							t = Math.min(
								numAvailableBytesFull - 1 - lenTest,
								encoder!._numFastBytes,
							);
							lenTest2 = this.#encoder._matchFinder!.getMatchLen(
								lenTest,
								curBack,
								t,
							);

							if (lenTest2 >= 2) {
								state2 = state < 7 ? 7 : 10;
								posStateNext = position + lenTest & encoder!._posStateMask;

								curAndLenCharPrice = curAndLenPrice
									+ PROB_PRICES[(encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2]
									+ this.#RangeCoder_Encoder_GetPrice_0(
										this.#LZMA_Encoder_GetSubCoder(
											position + lenTest,
											this.#encoder._matchFinder!.getIndexByte(lenTest - 1 - 1),
										),
										true,
										this.#encoder._matchFinder!.getIndexByte(lenTest - (curBack + 1) - 1),
										this.#encoder._matchFinder!.getIndexByte(lenTest - 1),
									);

								state2 = stateUpdateChar(state2);
								posStateNext = position + lenTest + 1 & encoder!._posStateMask;

								nextMatchPrice = curAndLenCharPrice + PROB_PRICES[
									(2048 - encoder!._isMatch[(state2 << 4) + posStateNext]) >>> 2
								];

								nextRepMatchPrice = nextMatchPrice + PROB_PRICES[
									(2048 - encoder!._isRep[state2]) >>> 2
								];
								offset = lenTest + 1 + lenTest2;

								while (lenEnd < cur + offset) {
									encoder!._optimum[lenEnd += 1].price = INFINITY_PRICE;
								}

								curAndLenPrice = nextRepMatchPrice + (price_3 = encoder!._repMatchLenEncoder!.getPrice(lenTest2 - 2, posStateNext), price_3 + this.#GetPureRepPrice(0, state2, posStateNext));
								optimum = encoder!._optimum[cur + offset];

								if (curAndLenPrice < optimum.price!) {
									optimum.price = curAndLenPrice;
									optimum.posPrev = cur + lenTest + 1;
									optimum.backPrev = 0;
									optimum.prev1IsChar = 1;
									optimum.prev2 = 1;
									optimum.posPrev2 = cur;
									optimum.backPrev2 = curBack + 4;
								}
							}
						}
						offs += 2;

						if (offs == numDistancePairs) {
							break;
						}
					}
				}
			}
		}

		// Fallback return - should not be reached in normal execution
		return 1;
	}

	#LZMA_Encoder_GetPosLenPrice(
		pos: number,
		len: number,
		posState: number,
	): number {
		const encoder = this.#compressor.chunker.encoder;
		let price: number, lenToPosState = getLenToPosState(len);

		if (pos < 128) {
			price = encoder!._distancesPrices[lenToPosState * 128 + pos];
		} else {
			const position = (lenToPosState << 6) + this.GetPosSlot2(pos);
			price = encoder!._posSlotPrices[position] + encoder!._alignPrices[pos & 15];
		}

		return price + encoder!._lenEncoder!.getPrice(
			len - 2,
			posState,
		);
	}

	#GetPureRepPrice(
		repIndex: number,
		state: number,
		posState: number,
	): number {
		const encoder = this.#compressor.chunker.encoder;
		let price;

		if (!repIndex) {
			price = PROB_PRICES[(encoder!._isRepG0[state]) >>> 2];
			price += PROB_PRICES[
				0x800 - this.#compressor.chunker.encoder!._isRep0Long[(state << 4) + posState] >>> 2
			];
		} else {
			price = PROB_PRICES[(0x800 - this.#compressor.chunker.encoder!._isRepG0[state]) >>> 2];
			if (repIndex == 1) {
				price += PROB_PRICES[(this.#compressor.chunker.encoder!._isRepG1[state]) >>> 2];
			} else {
				price += PROB_PRICES[(0x800 - this.#compressor.chunker.encoder!._isRepG1[state]) >>> 2];
				price += getBitPrice(this.#compressor.chunker.encoder!._isRepG2[state], repIndex - 2);
			}
		}

		return price;
	}

	#GetRepLen1Price(posState: number): number {
		const encoder = this.#compressor.chunker.encoder;

		const repG0Price = PROB_PRICES[(encoder!._isRepG0[encoder!._state]) >>> 2];
		const rep0LongPrice = PROB_PRICES[encoder!._isRep0Long[(encoder!._state << 4) + posState] >>> 2];

		return repG0Price + rep0LongPrice;
	}

	#MovePos(num: number): void {
		if (num > 0) {
			this.#encoder._matchFinder!.skip(num);
			this.#compressor.chunker.encoder!._additionalOffset += num;
		}
	}

	#ReadMatchDistances(): number {
		let lenRes = 0;
		const encoder = this.#compressor.chunker.encoder!;
		encoder!._numDistancePairs = this.#encoder._matchFinder!.getMatches(this.#compressor.chunker.encoder!._matchDistances);

		if (encoder!._numDistancePairs > 0) {
			lenRes = encoder!._matchDistances[encoder!._numDistancePairs - 2];

			if (lenRes == encoder!._numFastBytes) {
				lenRes += this.#encoder._matchFinder!.getMatchLen(lenRes - 1, encoder!._matchDistances[encoder!._numDistancePairs - 1], 0x0111 - lenRes);
			}
		}

		encoder!._additionalOffset += 1;

		return lenRes;
	}

	#ReleaseMFStream(): void {
		const encoder = this.#compressor.chunker.encoder;

		if (encoder!._matchFinder && encoder!._needReleaseMFStream) {
			encoder!._matchFinder._stream = null;
			encoder!._needReleaseMFStream = 0;
		}
	}

	#ReleaseStreams(): void {
		this.#ReleaseMFStream();
		this.#compressor.chunker.encoder!._rangeEncoder.stream = null;
	}

	writeHeaderProperties(): void {
		const HEADER_SIZE = 0x5; // Total header size in bytes

		// First byte combines posStateBits, literalPosStateBits and literalContextBits
		// Format: (posStateBits * 5 + literalPosStateBits) * 9 + literalContextBits
		this.#encoder.properties[0] = (
			(this.#encoder._posStateBits * 5 + this.#encoder._numLiteralPosStateBits) * 9 + this.#encoder._numLiteralContextBits
		) & 0xFF; // Ensure byte-sized value

		// Next 4 bytes store dictionary size in little-endian format
		for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
			// Shift dictionary size right by appropriate number of bits and mask to byte
			this.#encoder.properties[1 + byteIndex] = (
				this.#encoder._dictionarySize >> (0x08 * byteIndex)
			) & 0xFF;
		}

		this.#compressor.output.writeBytes(
			this.#encoder.properties,
			0,
			HEADER_SIZE,
		);
	}

	GetPosSlot2(pos: number): number {
		if (pos < 0x20000) {
			return G_FAST_POS[pos >> 6] + 12;
		}

		if (pos < 0x8000000) {
			return G_FAST_POS[pos >> 16] + 32;
		}

		return G_FAST_POS[pos >> 26] + 52;
	}

	#LZMA_Encoder_GetSubCoder(pos: number, prevByte: number): LiteralDecoderEncoder2 {
		const subCoder = this.#compressor.chunker.encoder!._literalEncoder!.getSubCoder(pos, prevByte);
		return { decoders: subCoder.decoders } as LiteralDecoderEncoder2;
	}

	#RangeCoder_Encoder_GetPrice_0(
		encoder: LiteralDecoderEncoder2,
		matchMode: boolean,
		matchByte: number,
		symbol: number,
	): number {
		let bit, context = 1, i = 7, matchBit, price = 0;

		if (matchMode) {
			for (; i >= 0; --i) {
				matchBit = (matchByte >> i) & 1;
				bit = (symbol >> i) & 1;
				price += getBitPrice(
					encoder.decoders[((1 + matchBit) << 8) + context],
					bit,
				);
				context = context << 1 | bit;

				if (matchBit != bit) {
					--i;
					break;
				}
			}
		}

		for (; i >= 0; --i) {
			bit = symbol >> i & 1;
			price += getBitPrice(encoder.decoders[context], bit);
			context = context << 1 | bit;
		}

		return price;
	}

	#MakeAsChar(optimum: Optimum): void {
		optimum.backPrev = -1;
		optimum.prev1IsChar = 0;
	}

	#MakeAsShortRep(optimum: Optimum): void {
		optimum.backPrev = 0;
		optimum.prev1IsChar = 0;
	}

	ReverseEncode(
		startIndex: number,
		NumBitLevels: number,
		symbol: number,
	): void {
		let bit, m = 1;

		for (let i = 0; i < NumBitLevels; ++i) {
			bit = symbol & 1;
			this.#compressor.chunker.encoder!.encodeBit(this.#compressor.chunker.encoder!._posEncoders, startIndex + m, bit);
			m = m << 1 | bit;
			symbol >>= 1;
		}
	}

	#ReverseGetPrice(
		encoder: BitTree,
		symbol: number,
	): number {
		let bit, m = 1, price = 0;

		for (let i = encoder.numBitLevels; i != 0; i -= 1) {
			bit = symbol & 1;
			symbol >>>= 1;
			price += getBitPrice(encoder.models[m], bit);
			m = m << 1 | bit;
		}

		return price;
	}

	#GetProcessedSizeAdd(): [number, number] {
		const processedCacheSize = add64(
			fromInt64(this.#compressor.chunker.encoder!._rangeEncoder.cacheSize),
			this.#compressor.chunker.encoder!._rangeEncoder.position,
		);

		return add64(processedCacheSize, [4, 0]);
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

	// Public methods for chunker access
	codeOneBlock(): void {
		this.#CodeOneBlock();
	}

	releaseStreams(): void {
		this.#ReleaseStreams();
	}
}
