import type {
	Encoder,
	Optimum,
} from "./lzma.js";

/**
 * Optimum parsing functions for LZMA compression
 * These functions handle finding the optimal encoding choices
 */

/**
 * Make an optimum entry represent a character
 */
export function makeAsChar(optimum: Optimum): void {
	optimum.backPrev = -1;
	optimum.prev1IsChar = 0;
}

/**
 * Make an optimum entry represent a match
 */
export function makeAsShortRep(optimum: Optimum): void {
	optimum.prev1IsChar = 0;
	optimum.prev2 = 0;
	optimum.posPrev2 = 0;
	optimum.backPrev2 = 0;
}

/**
 * Get the price for a pure repetition
 */
export function getPureRepPrice(
	encoder: Encoder,
	probPrices: number[],
	repIndex: number,
	state: number,
	posState: number,
): number {
	let price: number;

	if (!repIndex) {
		price = probPrices[encoder._isRepG0[state] >>> 2];
		price += probPrices[0x800 - encoder._isRep0Long[(state << 4) + posState] >>> 2];
	} else {
		price = probPrices[0x800 - encoder._isRepG0[state] >>> 2];
		if (repIndex === 1) {
			price += probPrices[encoder._isRepG1[state] >>> 2];
		} else {
			price += probPrices[0x800 - encoder._isRepG1[state] >>> 2];
			price += probPrices[encoder._isRepG2[state] >>> (repIndex - 2 << 1)];
		}
	}

	return price;
}

/**
 * Get the price for a rep0 with length 1
 */
export function getRepLen1Price(
	encoder: Encoder,
	probPrices: number[],
	posState: number,
): number {
	const repG0Price = probPrices[encoder._isRepG0[encoder._state] >>> 2];
	const rep0LongPrice = probPrices[encoder._isRep0Long[(encoder._state << 4) + posState] >>> 2];
	return repG0Price + rep0LongPrice;
}

/**
 * Perform backward optimal parsing
 */
export function backward(
	encoder: Encoder,
	cur: number,
	makeAsCharFn: (optimum: Optimum) => void,
): number {
	let backCur: number;
	let backMem: number;
	let posMem: number;
	let posPrev: number;

	encoder._optimumEndIndex = cur;
	posMem = encoder._optimum[cur].posPrev!;
	backMem = encoder._optimum[cur].backPrev!;

	do {
		if (encoder._optimum[cur].prev1IsChar) {
			makeAsCharFn(encoder._optimum[posMem!]);
			encoder._optimum[posMem!].posPrev = posMem! - 1;

			if (encoder._optimum[cur].prev2) {
				encoder._optimum[posMem! - 1].prev1IsChar = 0;
				encoder._optimum[posMem! - 1].posPrev = encoder._optimum[cur].posPrev2;
				encoder._optimum[posMem! - 1].backPrev = encoder._optimum[cur].backPrev2;
			}
		}

		posPrev = posMem;
		backCur = backMem;
		backMem = encoder._optimum[posPrev!].backPrev!;
		posMem = encoder._optimum[posPrev!].posPrev!;
		encoder._optimum[posPrev!].backPrev = backCur;
		encoder._optimum[posPrev!].posPrev = cur;
		cur = posPrev!;
	} while (cur > 0);

	encoder.backRes = encoder._optimum[0].backPrev!;
	encoder._optimumCurrentIndex = encoder._optimum[0].posPrev!;

	return encoder._optimumCurrentIndex;
}

/**
 * Get the optimal encoding choice for the current position
 */
export function getOptimum(
	encoder: Encoder,
	probPrices: number[],
	position: number,
	getIndexByteFn: (index: number) => number,
	getMatchLenFn: (index: number, distance: number, limit: number) => number,
	getNumAvailableBytesFn: () => number,
	readMatchDistancesFn: () => number,
	movePosFn: (num: number) => void,
	getSubCoderFn: (position: number, prevByte: number) => any,
	getLiteralEncoderGetPriceFn: (encoder: any, matchMode: boolean, matchByte: number, symbol: number) => number,
	getLenEncoderGetPriceFn: (encoder: any, len: number, posState: number) => number,
	getPosLenPriceFn: (pos: number, len: number, posState: number) => number,
	stateUpdateCharFn: (state: number) => number,
	kIfinityPrice: number,
): number {
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

	if (encoder._optimumEndIndex != encoder._optimumCurrentIndex) {
		lenRes = encoder._optimum[encoder._optimumCurrentIndex].posPrev! - encoder._optimumCurrentIndex;
		encoder.backRes = encoder._optimum[encoder._optimumCurrentIndex].backPrev!;
		encoder._optimumCurrentIndex = encoder._optimum[encoder._optimumCurrentIndex].posPrev!;

		return lenRes;
	}

	encoder._optimumCurrentIndex = encoder._optimumEndIndex = 0;
	if (encoder._longestMatchWasFound) {
		lenMain = encoder._longestMatchLength;
		encoder._longestMatchWasFound = 0;
	} else {
		lenMain = readMatchDistancesFn();
	}

	numDistancePairs = encoder._numDistancePairs;
	numAvailableBytes = getNumAvailableBytesFn() + 1;

	if (numAvailableBytes < 2) {
		encoder.backRes = -1;
		return 1;
	}

	if (numAvailableBytes > 0x0111) {
		numAvailableBytes = 0x0111;
	}

	repMaxIndex = 0;
	for (let i = 0; i < 4; ++i) {
		encoder.reps[i] = encoder._repDistances[i];
		encoder.repLens[i] = getMatchLenFn(-1, encoder.reps[i], 0x0111);

		if (encoder.repLens[i] > encoder.repLens[repMaxIndex]) {
			repMaxIndex = i;
		}
	}

	if (encoder.repLens[repMaxIndex] >= encoder._numFastBytes) {
		encoder.backRes = repMaxIndex;
		lenRes = encoder.repLens[repMaxIndex];
		movePosFn(lenRes - 1);

		return lenRes;
	}

	if (lenMain >= encoder._numFastBytes) {
		encoder.backRes = encoder._matchDistances[numDistancePairs - 1] + 4;

		movePosFn(lenMain - 1);
		return lenMain;
	}

	currentByte = getIndexByteFn(-1);
	matchByte = getIndexByteFn(-encoder._repDistances[0] - 1 - 1);

	if (lenMain < 2 && currentByte != matchByte && encoder.repLens[repMaxIndex] < 2) {
		encoder.backRes = -1;
		return 1;
	}

	encoder._optimum[0].state = encoder._state;
	posState = position & encoder._posStateMask;
	encoder._optimum[1].price = probPrices[
		encoder._isMatch[(encoder._state << 4) + posState] >>> 2
	] + getLiteralEncoderGetPriceFn(
		getSubCoderFn(position, encoder._previousByte),
		encoder._state >= 7,
		matchByte,
		currentByte,
	);

	makeAsChar(encoder._optimum[1]);
	matchPrice = probPrices[
		0x800 - encoder._isMatch[(encoder._state << 4) + posState]
		>>> 0x02
	];

	repMatchPrice = matchPrice + probPrices[
		0x800 - encoder._isRep[encoder._state] >>> 2
	];

	if (matchByte == currentByte) {
		shortRepPrice = repMatchPrice + getRepLen1Price(encoder, probPrices, posState);
		if (shortRepPrice < encoder._optimum[1].price!) {
			encoder._optimum[1].price = shortRepPrice;
			makeAsShortRep(encoder._optimum[1]);
		}
	}

	lenEnd = lenMain >= encoder.repLens[repMaxIndex]
		? lenMain
		: encoder.repLens[repMaxIndex];

	if (lenEnd < 2) {
		encoder.backRes = encoder._optimum[1].backPrev!;
		return 1;
	}

	encoder._optimum[1].posPrev = 0;
	encoder._optimum[0].backs0 = encoder.reps[0];
	encoder._optimum[0].backs1 = encoder.reps[1];
	encoder._optimum[0].backs2 = encoder.reps[2];
	encoder._optimum[0].backs3 = encoder.reps[3];
	len = lenEnd;

	do {
		encoder._optimum[len].price = kIfinityPrice;
		len -= 1;
	} while (len >= 2);

	for (let i = 0; i < 4; ++i) {
		repLen = encoder.repLens[i];
		if (repLen < 2) {
			continue;
		}
		price_4 = repMatchPrice + getPureRepPrice(
			encoder,
			probPrices,
			i,
			encoder._state,
			posState,
		);

		do {
			curAndLenPrice = price_4 + getLenEncoderGetPriceFn(
				encoder._repMatchLenEncoder,
				repLen - 2,
				posState,
			);
			optimum = encoder._optimum[repLen];
			if (curAndLenPrice < optimum.price!) {
				optimum.price = curAndLenPrice;
				optimum.posPrev = 0;
				optimum.backPrev = i;
				optimum.prev1IsChar = 0;
			}
		} while ((repLen -= 1) >= 2);
	}

	normalMatchPrice = matchPrice
		+ probPrices[encoder._isRep[encoder._state] >>> 2];

	len = encoder.repLens[0] >= 2 ? encoder.repLens[0] + 1 : 2;

	if (len <= lenMain) {
		offs = 0;
		while (len > encoder._matchDistances[offs]) {
			offs += 2;
		}

		for (;; len += 1) {
			distance = encoder._matchDistances[offs + 1];
			curAndLenPrice = normalMatchPrice + getPosLenPriceFn(distance, len, posState);
			optimum = encoder._optimum[len];

			if (curAndLenPrice < optimum.price!) {
				optimum.price = curAndLenPrice;
				optimum.posPrev = 0;
				optimum.backPrev = distance + 4;
				optimum.prev1IsChar = 0;
			}

			if (len == encoder._matchDistances[offs]) {
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
			return backward(encoder, cur, makeAsChar);
		}
		newLen = readMatchDistancesFn();
		numDistancePairs = encoder._numDistancePairs;

		if (newLen >= encoder._numFastBytes) {
			encoder._longestMatchLength = newLen;
			encoder._longestMatchWasFound = 0x01;

			return backward(encoder, cur, makeAsChar);
		}
		position += 0x01;
		posPrev = encoder._optimum[cur].posPrev;

		if (encoder._optimum[cur].prev1IsChar) {
			posPrev! -= 0x01;
			if (encoder._optimum[cur].prev2) {
				state = encoder._optimum[encoder._optimum[cur].posPrev2!].state;
				if (encoder._optimum[cur].backPrev2! < 0x04) {
					state = (state! < 0x07) ? 0x08 : 0x0B;
				} else {
					state = (state! < 0x07) ? 0x07 : 0x0A;
				}
			} else {
				state = encoder._optimum[posPrev!].state;
			}
			state = stateUpdateCharFn(state!);
		} else {
			state = encoder._optimum[posPrev!].state;
		}

		if (posPrev! == cur - 1) {
			if (!encoder._optimum[cur].backPrev) {
				state = state! < 7 ? 9 : 11;
			} else {
				state = stateUpdateCharFn(state!);
			}
		} else {
			if (
				encoder._optimum[cur].prev1IsChar
				&& encoder._optimum[cur].prev2
			) {
				posPrev = encoder._optimum[cur].posPrev2;
				pos = encoder._optimum[cur].backPrev2;
				state = state! < 0x07 ? 0x08 : 0x0B;
			} else {
				pos = encoder._optimum[cur].backPrev;
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
		curPrice = encoder._optimum[cur].price;

		currentByte = getIndexByteFn(-0x01);
		matchByte = getIndexByteFn(-encoder.reps[0] - 1 - 1);

		posState = position & encoder._posStateMask;
		curAnd1Price = curPrice!
			+ probPrices[encoder._isMatch[(state! << 0x04) + posState] >>> 2]
			+ getLiteralEncoderGetPriceFn(
				getSubCoderFn(position, getIndexByteFn(-2)),
				state! >= 7,
				matchByte,
				currentByte,
			);

		nextOptimum = encoder._optimum[cur + 1];
		nextIsChar = 0;

		if (curAnd1Price < nextOptimum.price!) {
			nextOptimum.price = curAnd1Price;
			nextOptimum.posPrev = cur;
			nextOptimum.backPrev = -0x01;
			nextOptimum.prev1IsChar = 0x00;
			nextIsChar = 1;
		}

		matchPrice = curPrice! + probPrices[
			0x800 - encoder._isMatch[(state! << 0x04) + posState] >>> 0x02
		];

		repMatchPrice = matchPrice + probPrices[0x800 - encoder._isRep[state!] >>> 0x02];

		if (matchByte == currentByte && !(nextOptimum.posPrev! < cur && !nextOptimum.backPrev)) {
			shortRepPrice = repMatchPrice
				+ (probPrices[encoder._isRepG0[state!] >>> 0x02] + probPrices[encoder._isRep0Long[(state! << 0x04) + posState] >>> 0x02]);

			if (shortRepPrice <= nextOptimum.price!) {
				nextOptimum.price = shortRepPrice;
				nextOptimum.posPrev = cur;
				nextOptimum.backPrev = 0x00;
				nextOptimum.prev1IsChar = 0x00;
				nextIsChar = 0x01;
			}
		}

		numAvailableBytesFull = getNumAvailableBytesFn() + 1;
		numAvailableBytesFull = 0xFFF - cur < numAvailableBytesFull
			? 0xFFF - cur
			: numAvailableBytesFull;

		numAvailableBytes = numAvailableBytesFull;

		if (numAvailableBytes < 0x02) {
			continue;
		}

		if (numAvailableBytes > encoder._numFastBytes) {
			numAvailableBytes = encoder._numFastBytes;
		}

		if (!nextIsChar && matchByte != currentByte) {
			t = Math.min(numAvailableBytesFull - 1, encoder._numFastBytes);
			lenTest2 = getMatchLenFn(0x00, encoder.reps[0], t);

			if (lenTest2 >= 0x02) {
				state2 = stateUpdateCharFn(state!);
				posStateNext = position + 1 & encoder._posStateMask;
				nextRepMatchPrice = curAnd1Price
					+ probPrices[0x800 - encoder._isMatch[(state2 << 4) + posStateNext] >>> 2]
					+ probPrices[0x800 - encoder._isRep[state2] >>> 2];

				offset = cur + 1 + lenTest2;

				while (lenEnd < offset) {
					encoder._optimum[lenEnd += 1].price = kIfinityPrice;
				}

				curAndLenPrice = nextRepMatchPrice + (price = getLenEncoderGetPriceFn(
					encoder._repMatchLenEncoder,
					lenTest2 - 0x02,
					posStateNext,
				),
					price + getPureRepPrice(
						encoder,
						probPrices,
						0x00,
						state2,
						posStateNext,
					));
				optimum = encoder._optimum[offset];

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
			lenTest = getMatchLenFn(
				-0x01,
				encoder.reps[repIndex],
				numAvailableBytes,
			);

			if (lenTest < 2) {
				continue;
			}
			lenTestTemp = lenTest;
			do {
				while (lenEnd < cur + lenTest) {
					encoder._optimum[lenEnd += 1].price = kIfinityPrice;
				}

				curAndLenPrice = repMatchPrice + (price_0 = getLenEncoderGetPriceFn(
					encoder._repMatchLenEncoder,
					lenTest - 2,
					posState,
				),
					price_0 + getPureRepPrice(
						encoder,
						probPrices,
						repIndex,
						state!,
						posState,
					));

				optimum = encoder._optimum[cur + lenTest];

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
					encoder._numFastBytes,
				);
				lenTest2 = getMatchLenFn(
					lenTest,
					encoder.reps[repIndex],
					t,
				);

				if (lenTest2 >= 2) {
					state2 = state! < 7 ? 0x08 : 11;
					posStateNext = position + lenTest & encoder._posStateMask;
					curAndLenCharPrice = repMatchPrice
						+ (price_1 = getLenEncoderGetPriceFn(encoder._repMatchLenEncoder, lenTest - 2, posState), price_1 + getPureRepPrice(encoder, probPrices, repIndex, state!, posState))
						+ probPrices[encoder._isMatch[(state2 << 4) + posStateNext] >>> 2]
						+ getLiteralEncoderGetPriceFn(
							getSubCoderFn(position + lenTest, getIndexByteFn(lenTest - 1 - 1)),
							true,
							getIndexByteFn(lenTest - 1 - (encoder.reps[repIndex] + 1)),
							getIndexByteFn(lenTest - 1),
						);

					state2 = stateUpdateCharFn(state2);
					posStateNext = position + lenTest + 1 & encoder._posStateMask;

					nextMatchPrice = curAndLenCharPrice + probPrices[
						0x800 - encoder._isMatch[(state2 << 4) + posStateNext] >>> 2
					];

					nextRepMatchPrice = nextMatchPrice + probPrices[
						0x800 - encoder._isRep[state2] >>> 2
					];

					offset = cur + 1 + lenTest + lenTest2;

					while (lenEnd < cur + offset) {
						encoder._optimum[lenEnd += 1].price = kIfinityPrice;
					}

					curAndLenPrice = nextRepMatchPrice + (price_2 = getLenEncoderGetPriceFn(encoder._repMatchLenEncoder, lenTest2 - 2, posStateNext), price_2 + getPureRepPrice(encoder, probPrices, 0, state2, posStateNext));
					optimum = encoder._optimum[cur + offset];

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
				newLen > encoder._matchDistances[numDistancePairs];
				numDistancePairs += 2
			) {}
			encoder._matchDistances[numDistancePairs] = newLen;
			numDistancePairs += 2;
		}

		if (newLen >= startLen) {
			normalMatchPrice = matchPrice + probPrices[encoder._isRep[state!] >>> 2];
			while (lenEnd < cur + newLen) {
				encoder._optimum[lenEnd += 1].price = kIfinityPrice;
			}
			offs = 0;

			while (startLen > encoder._matchDistances[offs]) {
				offs += 2;
			}

			for (lenTest = startLen;; lenTest += 1) {
				curBack = encoder._matchDistances[offs + 1];
				curAndLenPrice = normalMatchPrice + getPosLenPriceFn(curBack, lenTest, posState);
				optimum = encoder._optimum[cur + lenTest];

				if (curAndLenPrice < optimum.price!) {
					optimum.price = curAndLenPrice;
					optimum.posPrev = cur;
					optimum.backPrev = curBack + 4;
					optimum.prev1IsChar = 0;
				}

				if (lenTest == encoder._matchDistances[offs]) {
					if (lenTest < numAvailableBytesFull) {
						t = Math.min(
							numAvailableBytesFull - 1 - lenTest,
							encoder._numFastBytes,
						);
						lenTest2 = getMatchLenFn(
							lenTest,
							curBack,
							t,
						);

						if (lenTest2 >= 2) {
							state2 = state! < 7 ? 7 : 10;
							posStateNext = position + lenTest & encoder._posStateMask;

							curAndLenCharPrice = curAndLenPrice + probPrices[encoder._isMatch[(state2 << 4) + posStateNext] >>> 2]
								+ getLiteralEncoderGetPriceFn(
									getSubCoderFn(position + lenTest, getIndexByteFn(lenTest - 1 - 1)),
									true,
									getIndexByteFn(lenTest - (curBack + 1) - 1),
									getIndexByteFn(lenTest - 1),
								);

							state2 = stateUpdateCharFn(state2);
							posStateNext = position + lenTest + 1 & encoder._posStateMask;

							nextMatchPrice = curAndLenCharPrice + probPrices[
								0x800 - encoder._isMatch[(state2 << 4) + posStateNext]
								>>> 2
							];

							nextRepMatchPrice = nextMatchPrice + probPrices[
								0x800 - encoder._isRep[state2] >>> 2
							];

							offset = lenTest + 1 + lenTest2;

							while (lenEnd < cur + offset) {
								encoder._optimum[lenEnd += 1].price = kIfinityPrice;
							}

							curAndLenPrice = nextRepMatchPrice + (price_3 = getLenEncoderGetPriceFn(encoder._repMatchLenEncoder, lenTest2 - 2, posStateNext), price_3 + getPureRepPrice(encoder, probPrices, 0, state2, posStateNext));
							optimum = encoder._optimum[cur + offset];

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
