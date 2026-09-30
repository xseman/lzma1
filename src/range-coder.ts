/**
 * Constants shared by the range encoder and decoder.
 *
 * LZMA's entropy coder is a binary range coder: every coded bit has an
 * adaptive probability (an 11-bit integer, the chance that the bit is 0)
 * that is updated after each use.
 */

/** When the range drops below this value, one byte is shifted in or out. */
export const TOP_VALUE = 1 << 24;

export const BIT_MODEL_TOTAL_BITS = 11;
export const BIT_MODEL_TOTAL = 1 << BIT_MODEL_TOTAL_BITS;

/** Initial probability: 0 and 1 are equally likely. */
export const PROB_INIT = BIT_MODEL_TOTAL / 2;

/** Adaptation speed of the probabilities. */
export const MOVE_BITS = 5;

/** Probability array. Each entry is an 11-bit probability of a 0 bit. */
export type Probs = Uint16Array;

export function initProbs(probs: Probs): void {
	probs.fill(PROB_INIT);
}
