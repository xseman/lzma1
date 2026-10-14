/**
 * Memory limit for decoding untrusted input. Raw LZMA data gets its
 * dictionary size from the container, which can claim up to 4 GiB. Like
 * XZ for Java's `memoryLimit`, the limit lets a caller refuse such data
 * before anything is allocated.
 */

/**
 * Thrown when decoding would need more memory than `memoryLimitKb` allows.
 * Both amounts are in KiB.
 */
export class MemoryLimitError extends Error {
	/** Memory needed to decode, in KiB */
	readonly memoryNeededKb: number;
	/** The limit that was given, in KiB */
	readonly memoryLimitKb: number;

	constructor(memoryNeededKb: number, memoryLimitKb: number) {
		super(`${memoryNeededKb} KiB of memory would be needed; limit was ${memoryLimitKb} KiB`);
		this.name = "MemoryLimitError";
		this.memoryNeededKb = memoryNeededKb;
		this.memoryLimitKb = memoryLimitKb;
	}
}
