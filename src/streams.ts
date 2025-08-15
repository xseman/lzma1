/**
 * RelativeIndexable is a generic interface for array-like structures
 * that can be indexed with a number
 */
export type RelativeIndexable<T> = {
	[key: number]: T;
	length: number;
};

/**
 * Base stream interface for input/output operations
 */
export interface BaseStream {
	buf: RelativeIndexable<number> | Uint8Array | ArrayBuffer | number[];
	pos: number;
	count: number;
}

/**
 * Represents a buffer with a count of used elements
 */
export interface BufferWithCount {
	buf: number[];
	count: number;
	write(buf: number[]): void;
}

/**
 * Writer interface for output operations
 */
export interface Writer {
	buf?: number[];
	count?: number;
	write(buf: number[]): void;
}
