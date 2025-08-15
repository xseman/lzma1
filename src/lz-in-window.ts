import { MatchFinder } from "./encoder.js";
import { arraycopy } from "./utils.js";

/**
 * LzInWindow - Input Window helper for LZMA encoding
 *
 * This class manages the input window operations for LZMA encoding,
 * including buffer management, position tracking, and input stream reading.
 */
export class LzInWindow {
	private matchFinder: MatchFinder;

	constructor(matchFinder: MatchFinder) {
		this.matchFinder = matchFinder;
	}

	/**
	 * Get a byte at the specified index relative to current position
	 */
	getIndexByte(index: number): number {
		const byte = this.matchFinder._bufferBase[
			this.matchFinder._bufferOffset + this.matchFinder._pos + index
		];

		return byte;
	}

	/**
	 * Calculate match length between current position and a previous position
	 */
	getMatchLen(index: number, distance: number, limit: number): number {
		if (this.matchFinder._streamEndWasReached) {
			if (
				this.matchFinder._pos + index + limit > this.matchFinder._streamPos
			) {
				limit = this.matchFinder._streamPos - (this.matchFinder._pos + index);
			}
		}

		++distance;
		let i;
		const pby = this.matchFinder._bufferOffset + this.matchFinder._pos + index;

		for (
			i = 0;
			i < limit
			&& this.matchFinder._bufferBase[pby + i]
				== this.matchFinder._bufferBase[pby + i - distance];
			++i
		);

		return i;
	}

	/**
	 * Get number of available bytes in the input window
	 */
	getNumAvailableBytes(): number {
		return this.matchFinder._streamPos - this.matchFinder._pos;
	}

	/**
	 * Move buffer block when reaching buffer boundaries
	 */
	moveBlock(): void {
		let offset = this.matchFinder._bufferOffset + this.matchFinder._pos - this.matchFinder._keepSizeBefore;

		if (offset > 0) {
			--offset;
		}

		const numBytes = this.matchFinder._bufferOffset + this.matchFinder._streamPos - offset;

		for (let i = 0; i < numBytes; ++i) {
			this.matchFinder._bufferBase[i] = this.matchFinder._bufferBase[offset + i];
		}

		this.matchFinder._bufferOffset -= offset;
	}

	/**
	 * Move position by one and handle buffer management
	 */
	movePos(): void {
		this.matchFinder._pos += 1;

		if (this.matchFinder._pos > this.matchFinder._posLimit) {
			const pointerToPosition = this.matchFinder._bufferOffset + this.matchFinder._pos;

			if (pointerToPosition > this.matchFinder._pointerToLastSafePosition) {
				this.moveBlock();
			}

			this.readBlock();
		}
	}

	/**
	 * Read a block of data from the input stream
	 */
	readBlock(): void {
		if (this.matchFinder._streamEndWasReached) {
			return;
		}

		while (true) {
			const size = -this.matchFinder._bufferOffset + this.matchFinder._blockSize - this.matchFinder._streamPos;
			if (!size) {
				return;
			}

			const bytesRead = this.readFromStream(
				this.matchFinder._bufferOffset + this.matchFinder._streamPos,
				size,
			);

			if (bytesRead == -1) {
				this.matchFinder._posLimit = this.matchFinder._streamPos;
				const pointerToPosition = this.matchFinder._bufferOffset + this.matchFinder._posLimit;

				if (pointerToPosition > this.matchFinder._pointerToLastSafePosition) {
					this.matchFinder._posLimit = this.matchFinder._pointerToLastSafePosition - this.matchFinder._bufferOffset;
				}

				this.matchFinder._streamEndWasReached = 1;
				return;
			}

			this.matchFinder._streamPos += bytesRead;
			if (this.matchFinder._streamPos >= this.matchFinder._pos + this.matchFinder._keepSizeAfter) {
				this.matchFinder._posLimit = this.matchFinder._streamPos - this.matchFinder._keepSizeAfter;
			}
		}
	}

	/**
	 * Reduce all position offsets by the specified value
	 */
	reduceOffsets(subValue: number): void {
		this.matchFinder._bufferOffset += subValue;
		this.matchFinder._posLimit -= subValue;
		this.matchFinder._pos -= subValue;
		this.matchFinder._streamPos -= subValue;
	}

	/**
	 * Read data from the input stream into the buffer
	 */
	private readFromStream(off: number, len: number): number {
		const stream = this.matchFinder._stream!;
		const buffer = this.matchFinder._bufferBase;

		if (stream.pos >= stream.count) {
			return -1;
		}

		let srcBuf: number[];
		if (stream.buf instanceof Uint8Array) {
			srcBuf = Array.from(stream.buf as Uint8Array);
		} else if (stream.buf instanceof ArrayBuffer) {
			srcBuf = Array.from(new Uint8Array(stream.buf as ArrayBuffer));
		} else {
			srcBuf = stream.buf as number[];
		}

		len = Math.min(len, stream.count - stream.pos);
		arraycopy(srcBuf, stream.pos, buffer, off, len);
		stream.pos += len;

		return len;
	}
}
