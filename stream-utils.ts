import { arraycopy } from "./io-utils.js";
import { initArray } from "./utils.js";

export interface StreamHandler {
	buf: any;
	pos: number;
	count: number;
}

/**
 * Read data from stream into buffer
 */
export function readFromStream(
	stream: StreamHandler,
	bufferBase: number[],
	off: number,
	len: number,
): number {
	if (stream.pos >= stream.count) {
		return -1;
	}

	let srcBuf: number[];
	if (stream.buf instanceof Uint8Array) {
		srcBuf = Array.from(stream.buf);
	} else if (stream.buf instanceof ArrayBuffer) {
		srcBuf = Array.from(new Uint8Array(stream.buf));
	} else {
		srcBuf = stream.buf;
	}

	len = Math.min(len, stream.count - stream.pos);
	arraycopy(srcBuf, stream.pos, bufferBase, off, len);
	stream.pos += len;
	return len;
}

/**
 * Configure match finder based on dictionary size
 */
export function configureMatchFinder(
	matchFinder: any,
	dictionarySize: number,
	blockSize: number,
): void {
	if (matchFinder._bufferBase == null || matchFinder._blockSize != blockSize) {
		matchFinder._bufferBase = initArray(blockSize);
		matchFinder._blockSize = blockSize;
	}

	matchFinder._pointerToLastSafePosition = matchFinder._blockSize - 0x112;
}

/**
 * Setup hash table for match finder
 */
export function setupHashTable(
	matchFinder: any,
	dictionarySize: number,
): void {
	let hs = 0x10000;
	if (matchFinder.HASH_ARRAY) {
		hs = dictionarySize - 1;
		hs |= hs >> 1;
		hs |= hs >> 2;
		hs |= hs >> 4;
		hs |= hs >> 0x08;
		hs >>= 1;
		hs |= 0xFFFF;

		if (hs > 0x1000000) {
			hs >>= 1;
		}

		matchFinder._hashMask = hs;
		hs += 1;
		hs += matchFinder.kFixHashSize;
	}

	if (hs != matchFinder._hashSizeSum) {
		matchFinder._hash = initArray(matchFinder._hashSizeSum = hs);
	}
}

/**
 * Configure match finder type based on number of hash bytes
 */
export function setMatchFinderType(
	binTree: any,
	numHashBytes: number,
): void {
	binTree.HASH_ARRAY = numHashBytes > 2;

	if (binTree.HASH_ARRAY) {
		binTree.kNumHashDirectBytes = 0;
		binTree.kMinMatchCheck = 4;
		binTree.kFixHashSize = 66560;
	} else {
		binTree.kNumHashDirectBytes = 2;
		binTree.kMinMatchCheck = 3;
		binTree.kFixHashSize = 0;
	}
}

/**
 * Move position in match finder with cyclic buffer management
 */
export function moveMatchFinderPosition(
	matchFinder: any,
	movePosCallback: () => void,
	normalizeLinksCallback: (numItems: number, subValue: number) => void,
	reduceOffsetsCallback: (subValue: number) => void,
	dictionarySizeThreshold: number,
): void {
	let subValue;

	if ((matchFinder._cyclicBufferPos += 1) >= matchFinder._cyclicBufferSize) {
		matchFinder._cyclicBufferPos = 0;
	}

	movePosCallback();

	if (matchFinder._pos == dictionarySizeThreshold) {
		subValue = matchFinder._pos - matchFinder._cyclicBufferSize;

		normalizeLinksCallback(matchFinder._cyclicBufferSize * 2, subValue);
		normalizeLinksCallback(matchFinder._hashSizeSum, subValue);

		reduceOffsetsCallback(subValue);
	}
}

/**
 * Flush encoder stream and write end marker
 */
export function flushEncoder(
	posStateMask: number,
	nowPos: number,
	releaseMFStream: () => void,
	writeEndMarker: (positionState: number) => void,
	shiftLow: () => void,
): void {
	releaseMFStream();
	writeEndMarker(nowPos & posStateMask);

	for (let i = 0; i < 5; ++i) {
		shiftLow();
	}
}
