/**
 * Hash tables of the last positions of 2-, 3- and 4-byte sequences.
 *
 * Ported from XZ for Java (0BSD) by Lasse Collin and Igor Pavlov.
 */

import { CRC32_TABLE } from "./crc32.js";
import { normalizePositions } from "./lz-encoder.js";

const HASH_2_SIZE = 1 << 10;
const HASH_2_MASK = HASH_2_SIZE - 1;
const HASH_3_SIZE = 1 << 16;
const HASH_3_MASK = HASH_3_SIZE - 1;

function getHash4Size(dictSize: number): number {
	let h = dictSize - 1;
	h |= h >>> 1;
	h |= h >>> 2;
	h |= h >>> 4;
	h |= h >>> 8;
	h >>>= 1;
	h |= 0xFFFF;

	if (h > 1 << 24) {
		h >>>= 1;
	}

	return h + 1;
}

export class Hash234 {
	private readonly hash4Mask: number;
	private readonly hash2Table = new Int32Array(HASH_2_SIZE);
	private readonly hash3Table = new Int32Array(HASH_3_SIZE);
	private readonly hash4Table: Int32Array;

	private hash2Value = 0;
	private hash3Value = 0;
	private hash4Value = 0;

	constructor(dictSize: number) {
		const hash4Size = getHash4Size(dictSize);
		this.hash4Table = new Int32Array(hash4Size);
		this.hash4Mask = hash4Size - 1;
	}

	calcHashes(buf: Uint8Array, off: number): void {
		let temp = CRC32_TABLE[buf[off]] ^ buf[off + 1];
		this.hash2Value = temp & HASH_2_MASK;

		temp ^= buf[off + 2] << 8;
		this.hash3Value = temp & HASH_3_MASK;

		temp ^= CRC32_TABLE[buf[off + 3]] << 5;
		this.hash4Value = temp & this.hash4Mask;
	}

	getHash2Pos(): number {
		return this.hash2Table[this.hash2Value];
	}

	getHash3Pos(): number {
		return this.hash3Table[this.hash3Value];
	}

	getHash4Pos(): number {
		return this.hash4Table[this.hash4Value];
	}

	updateTables(pos: number): void {
		this.hash2Table[this.hash2Value] = pos;
		this.hash3Table[this.hash3Value] = pos;
		this.hash4Table[this.hash4Value] = pos;
	}

	clear(): void {
		this.hash2Table.fill(0);
		this.hash3Table.fill(0);
		this.hash4Table.fill(0);
	}

	normalize(offset: number): void {
		normalizePositions(this.hash2Table, offset);
		normalizePositions(this.hash3Table, offset);
		normalizePositions(this.hash4Table, offset);
	}
}
