/**
 * Utility constants for LZMA operations
 */
export const LZMA_CONSTANTS = {
	MAX_UINT32: 0x100000000, // 2^32
	_MAX_UINT32: 0xFFFFFFFF, // 2^32 - 1
	MAX_INT32: 0x7FFFFFFF, // 2^31 - 1
	MIN_INT32: -0x80000000, // -2^31
	MAX_UINT64: 0x10000000000000000, // 2^64
	MAX_INT64: 0x7FFFFFFFFFFFFFFF, // 2^63
	MIN_INT64: -0x8000000000000000, // -2^63
	MAX_COMPRESSION_SIZE: 0x7FFFFFFFFFFFFFFF, // 2^63 - 1
	kIfinityPrice: 0xFFFFFFF, // 2^28 - 1
	dictionarySizeThreshold: 0x3FFFFFFF, // 2^30 - 1
	bitMaskForRange: -0x1000000,
	P0_LONG_LIT: [0, 0] as [number, number],
	P1_LONG_LIT: [1, 0] as [number, number],
} as const;

/**
 * Creates a new array of specified length using optimized method for V8.
 * This is MUCH faster than "new Array(len)" in newer versions of V8.
 */
export function initArray(len: number): number[] {
	const array = [];
	// This is MUCH faster than "new Array(len)" in newer versions of v8
	// (starting with Node.js 0.11.15, which uses v8 3.28.73).
	array[len - 1] = undefined;
	return array as unknown as number[];
}

/**
 * Initializes bit models array with probability values
 */
export function InitBitModels(probs: number[]): void {
	for (let i = 0; i < probs.length; ++i) {
		probs[i] = 0x400;
	}
}

/**
 * Adds two 64-bit numbers represented as [low, high] pairs
 */
export function add(a: [number, number], b: [number, number]): [number, number] {
	return create(a[0] + b[0], a[1] + b[1]);
}

/**
 * Performs bitwise AND operation on two 64-bit numbers
 */
export function and(a: [number, number], b: [number, number]): [number, number] {
	const { MAX_UINT32, MAX_INT32, MIN_INT32 } = LZMA_CONSTANTS;

	const highBits = ~~Math.max(
		Math.min(a[1] / MAX_UINT32, MAX_INT32),
		MIN_INT32,
	) & ~~Math.max(
		Math.min(b[1] / MAX_UINT32, MAX_INT32),
		MIN_INT32,
	);

	const lowBits = lowBits_0(a) & lowBits_0(b);

	let high = highBits * MAX_UINT32;
	let low = lowBits;
	if (lowBits < 0) {
		low += MAX_UINT32;
	}

	return [low, high];
}

/**
 * Compares two 64-bit numbers represented as [low, high] pairs
 */
export function compare(a: [number, number], b: [number, number]): 0 | 1 | -1 {
	if (a[0] == b[0] && a[1] == b[1]) {
		return 0;
	}
	const nega = a[1] < 0;
	const negb = b[1] < 0;

	if (nega && !negb) {
		return -1;
	}

	if (!nega && negb) {
		return 1;
	}

	if (sub(a, b)[1] < 0) {
		return -1;
	}

	return 1;
}

/**
 * Creates a 64-bit number from low and high components
 */
export function create(valueLow: number, valueHigh: number): [number, number] {
	const { MAX_UINT64, MAX_UINT32, MAX_INT64, MIN_INT64 } = LZMA_CONSTANTS;

	let diffHigh, diffLow;

	valueHigh %= MAX_UINT64;
	valueLow %= MAX_UINT64;
	diffHigh = valueHigh % MAX_UINT32;
	diffLow = Math.floor(valueLow / MAX_UINT32) * MAX_UINT32;
	valueHigh = valueHigh - diffHigh + diffLow;
	valueLow = valueLow - diffLow + diffHigh;

	while (valueLow < 0) {
		valueLow += MAX_UINT32;
		valueHigh -= MAX_UINT32;
	}

	while (valueLow > MAX_UINT32) {
		valueLow -= MAX_UINT32;
		valueHigh += MAX_UINT32;
	}
	valueHigh = valueHigh % MAX_UINT64;

	while (valueHigh > MAX_INT64) {
		valueHigh -= MAX_UINT64;
	}

	while (valueHigh < MIN_INT64) {
		valueHigh += MAX_UINT64;
	}

	return [valueLow, valueHigh];
}

/**
 * Checks equality of two 64-bit numbers
 */
export function eq(a: [number, number], b: [number, number]): boolean {
	return a[0] == b[0] && a[1] == b[1];
}

/**
 * Converts an integer to 64-bit representation
 */
export function fromInt(value: number): [number, number] {
	const { MAX_UINT32 } = LZMA_CONSTANTS;

	if (value >= 0) {
		return [value, 0];
	} else {
		return [value + MAX_UINT32, -MAX_UINT32];
	}
}

/**
 * Gets the low 32 bits of a 64-bit number as a signed integer
 */
export function lowBits_0(a: [number, number]): number {
	const { MAX_UINT32, MAX_INT32, MIN_INT32 } = LZMA_CONSTANTS;

	if (a[0] >= 0x80000000) {
		return ~~Math.max(
			Math.min(a[0] - MAX_UINT32, MAX_INT32),
			MIN_INT32,
		);
	}

	return ~~Math.max(
		Math.min(a[0], MAX_INT32),
		MIN_INT32,
	);
}

/**
 * Calculates power of 2 as double precision
 */
export function pwrAsDouble(n: number): number {
	if (n <= 0x1E) {
		return 1 << n;
	}
	return pwrAsDouble(0x1E) * pwrAsDouble(n - 0x1E);
}

/**
 * Left shift operation on 64-bit numbers
 */
export function shl(a: [number, number], n: number): [number, number] {
	const { MAX_UINT64, MAX_UINT32, MAX_COMPRESSION_SIZE, P0_LONG_LIT } = LZMA_CONSTANTS;
	const MIN_VALUE = [0, LZMA_CONSTANTS.MIN_INT64] as [number, number];

	let diff, newHigh, newLow, twoToN;
	n &= 0x3F;

	if (eq(a, MIN_VALUE)) {
		if (!n) {
			return a;
		}
		return P0_LONG_LIT;
	}

	if (a[1] < 0) {
		throw new Error("Neg");
	}
	twoToN = pwrAsDouble(n);
	newHigh = a[1] * twoToN % MAX_UINT64;
	newLow = a[0] * twoToN;
	diff = newLow - newLow % MAX_UINT32;
	newHigh += diff;
	newLow -= diff;

	if (newHigh >= MAX_COMPRESSION_SIZE) {
		newHigh -= MAX_UINT64;
	}

	return [newLow, newHigh];
}

/**
 * Arithmetic right shift operation on 64-bit numbers
 */
export function shr(a: [number, number], n: number): [number, number] {
	n &= 0x3F;
	let shiftFact = pwrAsDouble(n);
	return create(
		Math.floor(a[0] / shiftFact),
		a[1] / shiftFact,
	);
}

/**
 * Logical right shift operation on 64-bit numbers
 */
export function shru(a: [number, number], n: number): [number, number] {
	let sr = shr(a, n);
	n &= 0x3F;
	if (a[1] < 0) {
		sr = add(sr, shl([2, 0], 0x3F - n));
	}
	return sr;
}

/**
 * Subtracts two 64-bit numbers
 */
export function sub(a: [number, number], b: [number, number]): [number, number] {
	return create(a[0] - b[0], a[1] - b[1]);
}
