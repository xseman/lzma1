/**
 * Deterministic derivation of the raw LZMA1 and LZMA2 case sets from the
 * committed fixtures, like `malformed.ts` for `.lzma` data. The identity
 * test re-derives the exact bytes and options, so only the expected
 * outcomes (`raw-malformed.json`) need committing.
 */

/** How a raw case was derived from its source fixture. */
export type RawOp =
	| { kind: "truncate"; at: number; }
	| { kind: "flipbit"; at: number; bit: number; }
	| { kind: "size"; size: number | "unknown"; }
	| { kind: "chunk"; at: number; field: "control" | "props"; value: number; }
	| { kind: "chunk"; at: number; field: "uncompressedSize" | "compressedSize"; delta: number; }
	| { kind: "trailing"; };

export type RawFormat = "lzma1" | "lzma2";

/** Options of a raw LZMA1 case, as `decompressRawLzma1` takes them. */
export interface RawLzma1CaseOptions {
	lc: number;
	lp: number;
	pb: number;
	dictSize: number;
	uncompressedSize?: number;
}

/** Options of a raw LZMA2 case, as `decompressRawLzma2` takes them. */
export interface RawLzma2CaseOptions {
	dictSize: number;
}

export type RawCase =
	| { id: string; format: "lzma1"; source: string; op: RawOp; options: RawLzma1CaseOptions; bytes: Uint8Array<ArrayBuffer>; }
	| { id: string; format: "lzma2"; source: string; op: RawOp; options: RawLzma2CaseOptions; bytes: Uint8Array<ArrayBuffer>; };

const LZMA_HEADER_SIZE = 13;

/** Copies a byte range into a fresh buffer; see `copyBytes` in `malformed.ts`. */
function copyBytes(bytes: Uint8Array, start = 0, end = bytes.length): Uint8Array<ArrayBuffer> {
	const copy = new Uint8Array(end - start);
	copy.set(bytes.subarray(start, end));

	return copy;
}

/** Every prefix of short data; for longer data, the first 19, 48 strided ones and the last two. */
function truncationPoints(length: number): number[] {
	const points = new Set<number>();
	if (length <= 160) {
		for (let i = 0; i < length; i++) points.add(i);
	} else {
		for (let i = 0; i <= 18; i++) points.add(i);
		const stride = Math.max(1, Math.floor(length / 48));
		for (let i = 19; i < length; i += stride) points.add(i);
		points.add(length - 2);
		points.add(length - 1);
	}

	return [...points];
}

/** About 40 strided offsets and the last one; the flipped bit walks with the offset. */
function flipPoints(length: number): number[] {
	const points = new Set<number>();
	const stride = Math.max(1, Math.floor(length / 40));
	for (let i = 0; i < length; i += stride) points.add(i);
	if (length > 0) points.add(length - 1);

	return [...points];
}

/**
 * Raw LZMA1 cases from a `.lzma` fixture: its body with the header's
 * properties, truncated and with single bits flipped, and with the size
 * passed in changed. A plain fixture declares its size, which the cases
 * pass on; a marker fixture declares none, and `actualSize` is the size of
 * its data.
 */
export function deriveRawLzma1(source: string, fixture: Uint8Array, actualSize: number): RawCase[] {
	const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.length);
	let props = fixture[0];
	const pb = Math.floor(props / 45);
	props -= pb * 45;
	const lp = Math.floor(props / 9);
	const lc = props - lp * 9;
	const dictSize = view.getUint32(1, true);
	const knownSize = view.getUint32(9, true) === 0xFFFFFFFF ? undefined : view.getUint32(5, true);
	const options: RawLzma1CaseOptions = knownSize === undefined ? { lc, lp, pb, dictSize } : { lc, lp, pb, dictSize, uncompressedSize: knownSize };
	const body = copyBytes(fixture, LZMA_HEADER_SIZE);
	const cases: RawCase[] = [];

	for (const at of truncationPoints(body.length)) {
		cases.push({ id: `${source}@raw1-trunc${at}`, format: "lzma1", source, op: { kind: "truncate", at }, options, bytes: copyBytes(body, 0, at) });
	}

	for (const at of flipPoints(body.length)) {
		const bit = at % 8;
		const mutated = copyBytes(body);
		mutated[at] ^= 1 << bit;
		cases.push({ id: `${source}@raw1-flip${at}.${bit}`, format: "lzma1", source, op: { kind: "flipbit", at, bit }, options, bytes: mutated });
	}

	// The size passed in: the actual one, one off in both directions, 0 and
	// unknown. Data without a marker needs its size; data with one ends
	// there or fails before a larger size. The source's own size records
	// the Java decoder accepting the unchanged data.
	const sizes = new Set<number | "unknown">([actualSize, actualSize + 1, "unknown"]);
	if (actualSize > 0) {
		sizes.add(actualSize - 1);
		sizes.add(0);
	}

	for (const size of sizes) {
		const sized = size === "unknown" ? { lc, lp, pb, dictSize } : { lc, lp, pb, dictSize, uncompressedSize: size };
		cases.push({ id: `${source}@raw1-size-${size}`, format: "lzma1", source, op: { kind: "size", size }, options: sized, bytes: copyBytes(body) });
	}

	return cases;
}

/** Offsets and control bytes of the chunk headers in LZMA2 data, up to its end byte. */
function chunkHeaders(data: Uint8Array): [number, number][] {
	const headers: [number, number][] = [];
	let pos = 0;
	while (pos < data.length && data[pos] !== 0x00) {
		const control = data[pos];
		headers.push([pos, control]);
		if (control >= 0x80) {
			pos += (control >= 0xC0 ? 6 : 5) + ((data[pos + 3] << 8) | data[pos + 4]) + 1;
		} else {
			pos += 3 + ((data[pos + 1] << 8) | data[pos + 2]) + 1;
		}
	}

	return headers;
}

/**
 * `control` with another reset: one level less for an LZMA chunk that
 * resets anything, a state reset for one that resets nothing, and the
 * other kind for an uncompressed chunk.
 */
function otherReset(control: number): number {
	if (control < 0x80) {
		return control === 0x01 ? 0x02 : 0x01;
	}

	const sizeBits = control & 0x1F;
	const level = (control >> 5) & 0x03;

	return 0x80 | ((level === 0 ? 1 : level - 1) << 5) | sizeBits;
}

/**
 * Raw LZMA2 cases from a `.lzma2` fixture: truncations, single-bit flips,
 * changes to each chunk header (an early end, an invalid control byte,
 * another reset, invalid properties, sizes off by one), and bytes after
 * the end.
 */
export function deriveRawLzma2(source: string, fixture: Uint8Array, dictSize: number): RawCase[] {
	const data = copyBytes(fixture);
	const options: RawLzma2CaseOptions = { dictSize };
	const cases: RawCase[] = [];
	const addCase = (name: string, op: RawOp, bytes: Uint8Array<ArrayBuffer>) => {
		cases.push({ id: `${source}.lzma2@${name}`, format: "lzma2", source, op, options, bytes });
	};

	for (const at of truncationPoints(data.length)) {
		addCase(`trunc${at}`, { kind: "truncate", at }, copyBytes(data, 0, at));
	}

	for (const at of flipPoints(data.length)) {
		const bit = at % 8;
		const mutated = copyBytes(data);
		mutated[at] ^= 1 << bit;
		addCase(`flip${at}.${bit}`, { kind: "flipbit", at, bit }, mutated);
	}

	for (const [at, control] of chunkHeaders(data)) {
		const setByte = (field: "control" | "props", offset: number, value: number) => {
			const mutated = copyBytes(data);
			mutated[at + offset] = value;
			addCase(`chunk${at}-${field}${value}`, { kind: "chunk", at, field, value }, mutated);
		};
		const addToSize = (field: "uncompressedSize" | "compressedSize", offset: number, delta: number) => {
			const mutated = copyBytes(data);
			const view = new DataView(mutated.buffer);
			view.setUint16(at + offset, (view.getUint16(at + offset) + delta) & 0xFFFF);
			addCase(`chunk${at}-${field}${delta > 0 ? "+" : ""}${delta}`, { kind: "chunk", at, field, delta }, mutated);
		};

		setByte("control", 0, 0x00);
		setByte("control", 0, 0x03);
		setByte("control", 0, otherReset(control));
		addToSize("uncompressedSize", 1, 1);
		addToSize("uncompressedSize", 1, -1);

		if (control >= 0x80) {
			addToSize("compressedSize", 3, 1);
			addToSize("compressedSize", 3, -1);
		}

		if (control >= 0xC0) {
			setByte("props", 5, 225);
			setByte("props", 5, (0 * 5 + 1) * 9 + 4);
		}
	}

	const trailing = new Uint8Array(data.length + 3);
	trailing.set(data);
	trailing.set([0x01, 0x02, 0x03], data.length);
	addCase("trailing", { kind: "trailing" }, trailing);

	return cases;
}
