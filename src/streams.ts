/**
 * Read-only input buffer wrapping a Uint8Array.
 */
export class InputBuffer {
	buf: Uint8Array;
	pos: number = 0;
	count: number;

	constructor(data: Uint8Array) {
		this.buf = data;
		this.count = data.length;
	}

	readByte(): number {
		if (this.pos >= this.count) return -1;
		return this.buf[this.pos++] & 0xFF;
	}

	readBytes(dest: number[], off: number, len: number): number {
		if (this.pos >= this.count) return -1;
		len = Math.min(len, this.count - this.pos);
		for (let i = 0; i < len; i++) {
			dest[off + i] = this.buf[this.pos++];
		}
		return len;
	}

	get remaining(): number {
		return this.count - this.pos;
	}
}

/**
 * Growable output buffer backed by a number array.
 */
export class OutputBuffer {
	buf: number[];
	count: number = 0;

	constructor(capacity: number = 32) {
		this.buf = new Array(capacity);
	}

	writeByte(b: number): void {
		if (this.count >= this.buf.length) {
			const newSize = Math.max(this.buf.length * 2, this.count + 1);
			const newBuf = new Array(newSize);
			for (let i = 0; i < this.count; i++) {
				newBuf[i] = this.buf[i];
			}
			this.buf = newBuf;
		}
		this.buf[this.count++] = b;
	}

	writeBytes(src: number[], off: number, len: number): void {
		const requiredSize = this.count + len;
		if (requiredSize > this.buf.length) {
			const newSize = Math.max(this.buf.length * 2, requiredSize);
			const newBuf = new Array(newSize);
			for (let i = 0; i < this.count; i++) {
				newBuf[i] = this.buf[i];
			}
			this.buf = newBuf;
		}
		for (let i = 0; i < len; i++) {
			this.buf[this.count + i] = src[off + i];
		}
		this.count += len;
	}

	write(buf: number[]): void {
		this.writeBytes(buf, 0, buf.length);
	}

	toArray(): number[] {
		return this.buf.slice(0, this.count);
	}
}
