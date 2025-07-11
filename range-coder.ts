import type {
	LenEncoder,
	LiteralDecoderEncoder2,
} from "./lzma.js";

/**
 * Range coder operations for LZMA compression pricing
 * These functions handle cost estimation for optimal encoding decisions
 */

/**
 * Gets the encoding price for a length encoder symbol
 * Used in LZMA compression for optimal match length selection
 */
export function lenEncoderGetPrice(
	encoder: LenEncoder,
	symbol: number,
	posState: number,
): number {
	return encoder.prices[posState * 0x110 + symbol];
}

/**
 * Calculates the encoding cost for a literal symbol with optional match context
 * Used in LZMA compression for optimal literal vs match decisions
 */
export function literalEncoderGetPrice(
	encoder: LiteralDecoderEncoder2,
	symbol: number,
	matchMode: boolean,
	matchByte: number,
	getPriceFn: (prob: number, symbol: number) => number,
): number {
	let bit, context = 1, i = 7, matchBit, price = 0;

	if (matchMode) {
		for (; i >= 0; --i) {
			matchBit = matchByte >> i & 1;
			bit = symbol >> i & 1;
			price += getPriceFn(
				encoder.decoders[(1 + matchBit << 0x08) + context],
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
		price += getPriceFn(encoder.decoders[context], bit);
		context = context << 1 | bit;
	}

	return price;
}

/**
 * Calculates the price for a single bit based on probability
 * Used throughout LZMA compression for cost estimation
 */
export function getBitPrice(probPrices: number[], prob: number, symbol: number): number {
	return probPrices[((prob - symbol ^ -symbol) & 0x7FF) >>> 2];
}
