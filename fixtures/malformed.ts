/**
 * Deterministic derivation of the malformed-stream set (the decoder
 * verification corpus) from the committed corpus fixtures. No randomness:
 * the identity test re-derives the exact bytes from the committed fixture,
 * so only the expected outcomes (`malformed.json`) need committing.
 */

/** How a malformed case was derived from its source fixture. */
export type MalformedOp =
	| { kind: "truncate"; at: number; }
	| { kind: "flipbit"; at: number; bit: number; }
	| { kind: "header"; field: "props" | "dictSize"; value: number; }
	| { kind: "header"; field: "size"; delta: number; }
	| { kind: "header"; field: "size"; value: "unknown" | "2^63-1"; }
	| { kind: "declaredSize"; size: number; };

export interface MalformedCase {
	id: string;
	source: string;
	op: MalformedOp;
	bytes: Uint8Array<ArrayBuffer>;
}

/**
 * Copies a byte range into a fresh buffer. Every derived case must own its
 * bytes: a fixture read with `fs.readFileSync` is a Node `Buffer`, whose
 * `slice` (like any `subarray`) returns a view of the same memory, so a
 * mutation through a view would leak into the source and into every case
 * derived after it. All copies go through here.
 */
function copyBytes(bytes: Uint8Array, start = 0, end = bytes.length): Uint8Array<ArrayBuffer> {
	const copy = new Uint8Array(end - start);
	copy.set(bytes.subarray(start, end));

	return copy;
}

/** Truncations and single-bit flips of one source fixture. */
export function deriveMalformed(source: string, fixture: Uint8Array): MalformedCase[] {
	const bytes = copyBytes(fixture);
	const cases: MalformedCase[] = [];
	const length = bytes.length;

	// Truncations: every prefix of small fixtures; for larger ones, every
	// header offset, strided body offsets, and the last two offsets.
	const truncationPoints = new Set<number>();
	if (length <= 160) {
		for (let i = 0; i < length; i++) truncationPoints.add(i);
	} else {
		for (let i = 0; i <= 18; i++) truncationPoints.add(i);
		const stride = Math.max(1, Math.floor(length / 48));
		for (let i = 19; i < length; i += stride) truncationPoints.add(i);
		truncationPoints.add(length - 2);
		truncationPoints.add(length - 1);
	}

	for (const at of truncationPoints) {
		cases.push({ id: `${source}@trunc${at}`, source, op: { kind: "truncate", at }, bytes: copyBytes(bytes, 0, at) });
	}

	// Single-bit flips: one per header byte, strided body offsets. The
	// flipped bit walks with the offset so different bit positions and
	// probability paths are hit.
	const flipPoints = new Set<number>();
	for (let i = 0; i < Math.min(13, length); i++) flipPoints.add(i);
	const stride = Math.max(1, Math.floor((length - 13) / 40));
	for (let i = 13; i < length; i += stride) flipPoints.add(i);
	if (length > 13) flipPoints.add(length - 1);
	for (const at of flipPoints) {
		const bit = at % 8;
		const mutated = copyBytes(bytes);
		mutated[at] ^= 1 << bit;
		cases.push({ id: `${source}@flip${at}.${bit}`, source, op: { kind: "flipbit", at, bit }, bytes: mutated });
	}

	return cases;
}

/** Synthetic bad-header cases built on one carrier fixture. */
export function deriveBadHeaders(source: string, fixture: Uint8Array): MalformedCase[] {
	const bytes = copyBytes(fixture);
	const cases: MalformedCase[] = [];
	const addCase = (caseName: string, op: MalformedOp, mutate: (mutated: Uint8Array, view: DataView) => void) => {
		const mutated = copyBytes(bytes);
		mutate(mutated, new DataView(mutated.buffer, mutated.byteOffset, mutated.length));
		cases.push({ id: `${source}@${caseName}`, source, op, bytes: mutated });
	};

	// Properties byte out of range (>= 9*5*5) and at the maximum.
	addCase("props225", { kind: "header", field: "props", value: 225 }, (mutated) => mutated[0] = 225);
	addCase("props255", { kind: "header", field: "props", value: 255 }, (mutated) => mutated[0] = 255);
	addCase("props224", { kind: "header", field: "props", value: 224 }, (mutated) => mutated[0] = 224);

	// Dictionary size corners.
	for (const dictSize of [0, 1, 4095, 0xFFFFFFFF]) {
		addCase(`dict${dictSize}`, { kind: "header", field: "dictSize", value: dictSize }, (_, view) => view.setUint32(1, dictSize, true));
	}

	// Declared size off by one in both directions, and "unknown" on a
	// stream that has no end marker.
	addCase("size+1", { kind: "header", field: "size", delta: 1 }, (_, view) => view.setUint32(5, view.getUint32(5, true) + 1, true));
	addCase("size-1", { kind: "header", field: "size", delta: -1 }, (_, view) => view.setUint32(5, view.getUint32(5, true) - 1, true));
	addCase("sizeUnknown", { kind: "header", field: "size", value: "unknown" }, (mutated) => mutated.fill(0xFF, 5, 13));

	// Size too large for a JS safe integer (2^63 - 1).
	addCase("sizeHuge", { kind: "header", field: "size", value: "2^63-1" }, (_, view) => {
		view.setUint32(5, 0xFFFFFFFF, true);
		view.setUint32(9, 0x7FFFFFFF, true);
	});

	return cases;
}

/**
 * Declared-size patches on a stream that carries an end marker: the cases
 * where the library's documented leniency (an end marker before the
 * declared size is accepted, for producers that write a size that is too
 * large) legitimately diverges from the Java code.
 */
export function deriveMarkerSizePatches(source: string, fixture: Uint8Array, actualSize: number): MalformedCase[] {
	const bytes = copyBytes(fixture);
	const cases: MalformedCase[] = [];
	const patches: [string, number][] = [["actual", actualSize], ["actual+5", actualSize + 5], ["actual+1", actualSize + 1], ["actual-1", actualSize - 1]];
	for (const [tag, size] of patches) {
		const patched = copyBytes(bytes);
		const view = new DataView(patched.buffer, patched.byteOffset, patched.length);
		view.setUint32(5, size, true);
		view.setUint32(9, 0, true);
		cases.push({ id: `${source}@declared-${tag}`, source, op: { kind: "declaredSize", size }, bytes: patched });
	}

	return cases;
}
