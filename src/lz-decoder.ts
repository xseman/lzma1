/**
 * Decoder-side LZ window: a circular buffer holding the most recent output
 * (the dictionary), which matches copy from.
 *
 * The buffer starts small and doubles until it reaches the dictionary size,
 * so small outputs don't allocate the whole dictionary up front, unless
 * `preallocate` is set. Bytes are passed to `sink` before they get
 * overwritten.
 */
export class LzDecoder {
	private buf: Uint8Array;
	private readonly maxSize: number;
	private readonly sink: (chunk: Uint8Array) => void;
	/** Next write position. */
	private pos = 0;
	/** Start of the bytes not yet passed to the sink. */
	private start = 0;
	private wrapped = false;

	/**
	 * @param dictSize Largest distance a match may reach back
	 * @param sink Receives decoded data. The chunk is only valid during the call.
	 * @param preallocate Allocate the whole dictionary now instead of growing
	 */
	constructor(dictSize: number, sink: (chunk: Uint8Array) => void, preallocate = false) {
		this.maxSize = dictSize;
		this.buf = new Uint8Array(preallocate ? dictSize : Math.min(dictSize, 1 << 16));
		this.sink = sink;
	}

	/** Returns the byte `dist + 1` positions back. */
	getByte(dist: number): number {
		let offset = this.pos - dist - 1;
		if (offset < 0) {
			offset += this.buf.length;
		}
		return this.buf[offset];
	}

	putByte(byte: number): void {
		this.buf[this.pos++] = byte;

		if (this.pos === this.buf.length) {
			this.onBufferEnd();
		}
	}

	/** Copies `len` bytes starting `dist + 1` positions back. */
	repeat(dist: number, len: number): void {
		const history = this.wrapped ? this.buf.length : this.pos;
		if (dist < 0 || dist >= history) {
			throw new Error("Corrupted input: match distance is too large");
		}

		while (len > 0) {
			const buf = this.buf;
			let back = this.pos - dist - 1;
			if (back < 0) {
				back += buf.length;
			}

			const count = Math.min(len, buf.length - this.pos, buf.length - back);

			if (count <= dist && count >= 32) {
				// Source and destination don't overlap.
				buf.copyWithin(this.pos, back, back + count);
				this.pos += count;
			} else {
				// A forward byte copy repeats short distances correctly.
				for (let i = 0; i < count; ++i) {
					buf[this.pos++] = buf[back + i];
				}
			}

			len -= count;

			if (this.pos === buf.length) {
				this.onBufferEnd();
			}
		}
	}

	/** Passes all pending bytes to the sink. */
	flush(): void {
		if (this.pos > this.start) {
			this.sink(this.buf.subarray(this.start, this.pos));
		}
		this.start = this.pos;
	}

	private onBufferEnd(): void {
		if (!this.wrapped && this.buf.length < this.maxSize) {
			const grown = new Uint8Array(Math.min(this.buf.length * 2, this.maxSize));
			grown.set(this.buf);
			this.buf = grown;
			return;
		}

		this.flush();
		this.pos = 0;
		this.start = 0;
		this.wrapped = true;
	}
}
