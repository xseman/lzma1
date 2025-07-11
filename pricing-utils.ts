/**
 * Pricing utilities for LZMA encoder
 */

export interface PricingContext {
	_alignPrices: number[];
	_alignPriceCount: number;
	_posAlignEncoder: any;
	_distancesPrices: number[];
	_posSlotPrices: number[];
	_matchPriceCount: number;
	_distTableSize: number;
	_posSlotEncoder: any[];
	_posEncoders: any;
	tempPrices: number[];
}

/**
 * Fill alignment prices for encoder
 */
export function fillAlignPrices(
	encoder: PricingContext,
	reverseGetPrice: (encoder: any, symbol: number) => number,
): void {
	for (let i = 0; i < 0x10; ++i) {
		encoder._alignPrices[i] = reverseGetPrice(encoder._posAlignEncoder, i);
	}

	encoder._alignPriceCount = 0;
}

/**
 * Fill distance prices for encoder
 */
export function fillDistancesPrices(
	encoder: PricingContext,
	getPosSlot: (pos: number) => number,
	reverseGetPrice: (encoders: any, baseVal: number, footerBits: number, symbol: number) => number,
	getBitTreePrice: (bitTreeEncoder: any, symbol: number) => number,
): void {
	let baseVal, bitTreeEncoder: any, footerBits, posSlot, st, st2;

	for (let i = 0x04; i < 0x80; ++i) {
		posSlot = getPosSlot(i);
		footerBits = (posSlot >> 1) - 1;
		baseVal = (2 | posSlot & 1) << footerBits;

		encoder.tempPrices[i] = reverseGetPrice(
			encoder._posEncoders,
			baseVal - posSlot - 1,
			footerBits,
			i - baseVal,
		);
	}

	for (let lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
		bitTreeEncoder = encoder._posSlotEncoder[lenToPosState];
		st = lenToPosState << 6;

		for (posSlot = 0; posSlot < encoder._distTableSize; posSlot += 1) {
			encoder._posSlotPrices[st + posSlot] = getBitTreePrice(bitTreeEncoder, posSlot);
		}

		for (posSlot = 14; posSlot < encoder._distTableSize; posSlot += 1) {
			encoder._posSlotPrices[st + posSlot] += (posSlot >> 1) - 1 - 4 << 6;
		}

		st2 = lenToPosState * 0x80;
		for (let i = 0; i < 4; ++i) {
			encoder._distancesPrices[st2 + i] = encoder._posSlotPrices[st + i];
		}

		for (let i = 4; i < 0x80; ++i) {
			encoder._distancesPrices[st2 + i] = encoder._posSlotPrices[st + getPosSlot(i)] + encoder.tempPrices[i];
		}
	}

	encoder._matchPriceCount = 0;
}
