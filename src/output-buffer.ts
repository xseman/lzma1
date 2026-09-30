/**
 * Growable byte buffer used as the sink for compressed and decompressed data.
 */
export class OutputBuffer {
	private buf: Uint8Array;
	private size = 0;

	constructor(initialCapacity = 256) {
		this.buf = new Uint8Array(Math.max(16, initialCapacity));
	}

	write(bytes: Uint8Array): void {
		const end = this.size + bytes.length;
		if (end > this.buf.length) {
			this.grow(end);
		}
		this.buf.set(bytes, this.size);
		this.size = end;
	}

	/** Returns the written bytes. The buffer must not be used afterwards. */
	finish(): Uint8Array {
		return this.size === this.buf.length
			? this.buf
			: this.buf.slice(0, this.size);
	}

	private grow(minCapacity: number): void {
		const next = new Uint8Array(Math.max(minCapacity, this.buf.length * 2));
		next.set(this.buf.subarray(0, this.size));
		this.buf = next;
	}
}
