import type { MatchFinder } from "./lzma.js";
import {
	initArray,
	LZMA_CONSTANTS,
} from "./utils.js";

/**
 * CRC32 lookup table for hash functions
 */
const CRC32_TABLE: number[] = (() => {
	const table: number[] = [];
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) {
			c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
		}
		table[i] = c;
	}
	return table;
})();

/**
 * Match finder operations for LZMA compression
 * These functions handle finding repeated patterns in the input data
 */

/**
 * Configures the match finder type and hash parameters
 */
export function setMatchFinderType(
	matchFinder: MatchFinder,
	numHashBytes: number,
): void {
	matchFinder.HASH_ARRAY = numHashBytes > 2;

	if (matchFinder.HASH_ARRAY) {
		matchFinder.kNumHashDirectBytes = 0;
		matchFinder.kMinMatchCheck = 4;
		matchFinder.kFixHashSize = 66560;
	} else {
		matchFinder.kNumHashDirectBytes = 2;
		matchFinder.kMinMatchCheck = 3;
		matchFinder.kFixHashSize = 0;
	}
}

/**
 * Creates match finder buffer and initializes hash tables
 */
export function createMatchFinderBuffer(
	matchFinder: MatchFinder,
	keepSizeBefore: number,
	keepSizeAfter: number,
	keepSizeReserv: number,
): void {
	const blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserv;
	matchFinder._keepSizeBefore = keepSizeBefore;
	matchFinder._keepSizeAfter = keepSizeAfter;

	if (!matchFinder._bufferBase || matchFinder._blockSize !== blockSize) {
		matchFinder._bufferBase = initArray(blockSize);
		matchFinder._blockSize = blockSize;
	}

	matchFinder._pointerToLastSafePosition = matchFinder._blockSize - keepSizeAfter;
}

/**
 * Moves data in the match finder buffer when it gets full
 */
export function moveMatchFinderBlock(matchFinder: MatchFinder): void {
	let offset = matchFinder._bufferOffset + matchFinder._pos - matchFinder._keepSizeBefore;

	if (offset > 0) {
		--offset;
	}
	const numBytes = matchFinder._bufferOffset + matchFinder._streamPos - offset;

	for (let i = 0; i < numBytes; ++i) {
		matchFinder._bufferBase[i] = matchFinder._bufferBase[offset + i];
	}
	matchFinder._bufferOffset -= offset;
}

/**
 * Advances match finder position and manages buffer
 */
export function moveMatchFinderPos(
	matchFinder: MatchFinder,
	moveBlockFn: () => void,
	readBlockFn: () => void,
): void {
	matchFinder._pos += 1;

	if (matchFinder._pos > matchFinder._posLimit) {
		const pointerToPosition = matchFinder._bufferOffset + matchFinder._pos;

		if (pointerToPosition > matchFinder._pointerToLastSafePosition) {
			moveBlockFn();
		}

		readBlockFn();
	}
}

/**
 * Advances cyclic buffer position and handles normalization
 */
export function moveCyclicPos(
	matchFinder: MatchFinder,
	normalizeHashFn: (numItems: number, subValue: number) => void,
	reduceOffsetsFn: (subValue: number) => void,
): void {
	if ((matchFinder._cyclicBufferPos += 1) >= matchFinder._cyclicBufferSize) {
		matchFinder._cyclicBufferPos = 0;
	}

	if (matchFinder._pos === LZMA_CONSTANTS.dictionarySizeThreshold) {
		const subValue = matchFinder._pos - matchFinder._cyclicBufferSize;

		normalizeHashFn(matchFinder._cyclicBufferSize * 2, subValue);
		normalizeHashFn(matchFinder._hashSizeSum, subValue);

		reduceOffsetsFn(subValue);
	}
}

/**
 * Reads new data into the match finder buffer
 */
export function readMatchFinderBlock(
	matchFinder: MatchFinder,
	readStreamFn: (offset: number, length: number) => number,
): void {
	if (matchFinder._streamEndWasReached) {
		return;
	}

	while (true) {
		const size = -matchFinder._bufferOffset + matchFinder._blockSize - matchFinder._streamPos;
		if (!size) {
			return;
		}

		const bytesRead = readStreamFn(
			matchFinder._bufferOffset + matchFinder._streamPos,
			size,
		);

		if (bytesRead === -1) {
			matchFinder._posLimit = matchFinder._streamPos;
			let pointerToPosition = matchFinder._bufferOffset + matchFinder._posLimit;

			if (pointerToPosition > matchFinder._pointerToLastSafePosition) {
				matchFinder._posLimit = matchFinder._pointerToLastSafePosition - matchFinder._bufferOffset;
			}

			matchFinder._streamEndWasReached = 1;
			return;
		}

		matchFinder._streamPos += bytesRead;
		if (matchFinder._streamPos >= matchFinder._pos + matchFinder._keepSizeAfter) {
			matchFinder._posLimit = matchFinder._streamPos - matchFinder._keepSizeAfter;
		}
	}
}

/**
 * Normalizes hash links to prevent integer overflow
 */
export function normalizeMatchFinderLinks(
	items: number[],
	numItems: number,
	subValue: number,
): void {
	for (let i = 0; i < numItems; ++i) {
		let value = items[i];
		if (value <= subValue) {
			value = 0;
		} else {
			value -= subValue;
		}
		items[i] = value;
	}
}

/**
 * Calculates hash values for the current position
 */
export function calculateHashValues(
	matchFinder: MatchFinder,
	cur: number,
): {
	hash2Value: number;
	hash3Value: number;
	hashValue: number;
} {
	let hash2Value = 0;
	let hash3Value = 0;
	let hashValue: number;

	if (matchFinder.HASH_ARRAY) {
		let temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 0xFF] ^ matchFinder._bufferBase[cur + 1] & 0xFF;
		hash2Value = temp & 0x3FF;
		temp ^= (matchFinder._bufferBase[cur + 2] & 0xFF) << 0x08;
		hash3Value = temp & 0xFFFF;
		hashValue = (temp ^ CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 0xFF] << 5) & matchFinder._hashMask;
	} else {
		hashValue = matchFinder._bufferBase[cur] & 0xFF ^ (matchFinder._bufferBase[cur + 1] & 0xFF) << 0x08;
	}

	return { hash2Value, hash3Value, hashValue };
}

/**
 * Updates hash tables with current position
 */
export function updateHashTables(
	matchFinder: MatchFinder,
	hash2Value: number,
	hash3Value: number,
	hashValue: number,
): { curMatch: number; curMatch2: number; curMatch3: number; } {
	const curMatch = matchFinder._hash[matchFinder.kFixHashSize + hashValue] || 0;
	let curMatch2 = 0;
	let curMatch3 = 0;

	if (matchFinder.HASH_ARRAY) {
		curMatch2 = matchFinder._hash[hash2Value] || 0;
		curMatch3 = matchFinder._hash[0x400 + hash3Value] || 0;
		matchFinder._hash[hash2Value] = matchFinder._pos;
		matchFinder._hash[0x400 + hash3Value] = matchFinder._pos;
	}

	matchFinder._hash[matchFinder.kFixHashSize + hashValue] = matchFinder._pos;

	return { curMatch, curMatch2, curMatch3 };
}

/**
 * Finds matches at the current position using binary tree search
 */
export function findMatchesAtPosition(
	matchFinder: MatchFinder,
	cur: number,
	lenLimit: number,
	curMatch: number,
	matchMinPos: number,
	distances: number[],
	offset: number,
	maxLen: number,
): { offset: number; maxLen: number; } {
	const ptr0 = (matchFinder._cyclicBufferPos << 1) + 1;
	const ptr1 = matchFinder._cyclicBufferPos << 1;
	let len0 = matchFinder.kNumHashDirectBytes;
	let len1 = matchFinder.kNumHashDirectBytes;
	let count = matchFinder._cutValue;

	// Handle direct hash bytes match
	if (matchFinder.kNumHashDirectBytes !== 0 && curMatch > matchMinPos) {
		if (
			matchFinder._bufferBase[
				matchFinder._bufferOffset + curMatch + matchFinder.kNumHashDirectBytes
			] !== matchFinder._bufferBase[cur + matchFinder.kNumHashDirectBytes]
		) {
			distances[offset++] = maxLen = matchFinder.kNumHashDirectBytes;
			distances[offset++] = matchFinder._pos - curMatch - 1;
		}
	}

	// Binary tree search
	while (true) {
		if (curMatch <= matchMinPos || count === 0) {
			matchFinder._son[ptr0] = matchFinder._son[ptr1] = 0;
			break;
		}
		count--;

		const delta = matchFinder._pos - curMatch;
		const cyclicPos = (delta <= matchFinder._cyclicBufferPos
			? matchFinder._cyclicBufferPos - delta
			: matchFinder._cyclicBufferPos - delta + matchFinder._cyclicBufferSize) << 1;

		const pby1 = matchFinder._bufferOffset + curMatch;
		let len = len0 < len1 ? len0 : len1;

		if (matchFinder._bufferBase[pby1 + len] === matchFinder._bufferBase[cur + len]) {
			while (++len !== lenLimit) {
				if (matchFinder._bufferBase[pby1 + len] !== matchFinder._bufferBase[cur + len]) {
					break;
				}
			}

			if (maxLen < len) {
				distances[offset++] = maxLen = len;
				distances[offset++] = delta - 1;

				if (len === lenLimit) {
					matchFinder._son[ptr1] = matchFinder._son[cyclicPos];
					matchFinder._son[ptr0] = matchFinder._son[cyclicPos + 1];
					break;
				}
			}
		}

		if ((matchFinder._bufferBase[pby1 + len] & 0xFF) < (matchFinder._bufferBase[cur + len] & 0xFF)) {
			matchFinder._son[ptr1] = curMatch;
			curMatch = matchFinder._son[cyclicPos + 1];
			len1 = len;
		} else {
			matchFinder._son[ptr0] = curMatch;
			curMatch = matchFinder._son[cyclicPos];
			len0 = len;
		}
	}

	return { offset, maxLen };
}

/**
 * Skips bytes in the match finder (used during optimal parsing)
 */
export function skipMatchFinderBytes(
	matchFinder: MatchFinder,
	num: number,
	moveCyclicPosFn: () => void,
): void {
	let count = num;

	do {
		const lenLimit = matchFinder._pos + matchFinder._matchMaxLen <= matchFinder._streamPos
			? matchFinder._matchMaxLen
			: matchFinder._streamPos - matchFinder._pos;

		if (lenLimit < matchFinder.kMinMatchCheck) {
			moveCyclicPosFn();
			continue;
		}

		const matchMinPos = matchFinder._pos > matchFinder._cyclicBufferSize
			? matchFinder._pos - matchFinder._cyclicBufferSize
			: 0;

		const cur = matchFinder._bufferOffset + matchFinder._pos;
		const { hashValue } = calculateHashValues(matchFinder, cur);
		const { curMatch } = updateHashTables(matchFinder, 0, 0, hashValue);

		// Simplified binary tree traversal for skipping
		const ptr0 = (matchFinder._cyclicBufferPos << 1) + 1;
		const ptr1 = matchFinder._cyclicBufferPos << 1;
		let len0 = matchFinder.kNumHashDirectBytes;
		let len1 = matchFinder.kNumHashDirectBytes;
		let traverseCount = matchFinder._cutValue;
		let currentMatch = curMatch;

		while (true) {
			if (currentMatch <= matchMinPos || traverseCount === 0) {
				matchFinder._son[ptr0] = matchFinder._son[ptr1] = 0;
				break;
			}
			traverseCount--;

			const delta = matchFinder._pos - currentMatch;
			const cyclicPos = (delta <= matchFinder._cyclicBufferPos
				? matchFinder._cyclicBufferPos - delta
				: matchFinder._cyclicBufferPos - delta + matchFinder._cyclicBufferSize) << 1;

			const pby1 = matchFinder._bufferOffset + currentMatch;
			let len = len0 < len1 ? len0 : len1;

			if (matchFinder._bufferBase[pby1 + len] === matchFinder._bufferBase[cur + len]) {
				while (++len !== lenLimit) {
					if (matchFinder._bufferBase[pby1 + len] !== matchFinder._bufferBase[cur + len]) {
						break;
					}
				}

				if (len === lenLimit) {
					matchFinder._son[ptr1] = matchFinder._son[cyclicPos];
					matchFinder._son[ptr0] = matchFinder._son[cyclicPos + 1];
					break;
				}
			}

			if ((matchFinder._bufferBase[pby1 + len] & 0xFF) < (matchFinder._bufferBase[cur + len] & 0xFF)) {
				matchFinder._son[ptr1] = currentMatch;
				currentMatch = matchFinder._son[cyclicPos + 1];
				len1 = len;
			} else {
				matchFinder._son[ptr0] = currentMatch;
				currentMatch = matchFinder._son[cyclicPos];
				len0 = len;
			}
		}

		moveCyclicPosFn();
	} while (--count !== 0);
}

/**
 * Finds matches for the current position in the buffer
 * Returns the number of distance pairs found
 */
export function getMatches(
	matchFinder: MatchFinder,
	distances: number[],
	movePosFn: () => void,
): number {
	let count,
		cur,
		curMatch,
		curMatch2,
		curMatch3,
		cyclicPos,
		delta,
		hash2Value,
		hash3Value,
		hashValue,
		len,
		len0,
		len1,
		lenLimit,
		matchMinPos,
		maxLen,
		offset,
		pby1,
		ptr0,
		ptr1,
		temp;

	if (matchFinder._pos + matchFinder._matchMaxLen <= matchFinder._streamPos) {
		lenLimit = matchFinder._matchMaxLen;
	} else {
		lenLimit = matchFinder._streamPos - matchFinder._pos;
		if (lenLimit < matchFinder.kMinMatchCheck) {
			movePosFn();
			return 0;
		}
	}

	offset = 0;
	matchMinPos = matchFinder._pos > matchFinder._cyclicBufferSize
		? matchFinder._pos - matchFinder._cyclicBufferSize
		: 0;

	cur = matchFinder._bufferOffset + matchFinder._pos;
	maxLen = 1;
	hash2Value = 0;
	hash3Value = 0;

	if (matchFinder.HASH_ARRAY) {
		temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 0xFF] ^ matchFinder._bufferBase[cur + 1] & 0xFF;
		hash2Value = temp & 0x3FF;
		temp ^= (matchFinder._bufferBase[cur + 2] & 0xFF) << 0x08;
		hash3Value = temp & 0xFFFF;
		hashValue = (temp ^ CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 0xFF] << 5) & matchFinder._hashMask;
	} else {
		hashValue = matchFinder._bufferBase[cur] & 0xFF ^ (matchFinder._bufferBase[cur + 1] & 0xFF) << 0x08;
	}

	curMatch = matchFinder._hash[matchFinder.kFixHashSize + hashValue] || 0;
	if (matchFinder.HASH_ARRAY) {
		curMatch2 = matchFinder._hash[hash2Value] || 0;
		curMatch3 = matchFinder._hash[0x400 + hash3Value] || 0;
		matchFinder._hash[hash2Value] = matchFinder._pos;
		matchFinder._hash[0x400 + hash3Value] = matchFinder._pos;

		if (curMatch2 > matchMinPos) {
			if (
				matchFinder._bufferBase[matchFinder._bufferOffset + curMatch2] == matchFinder._bufferBase[cur]
			) {
				distances[offset++] = maxLen = 2;
				distances[offset++] = matchFinder._pos - curMatch2 - 1;
			}
		}

		if (curMatch3 > matchMinPos) {
			if (
				matchFinder._bufferBase[matchFinder._bufferOffset + curMatch3] == matchFinder._bufferBase[cur]
			) {
				if (curMatch3 == curMatch2) {
					offset -= 2;
				}
				distances[offset++] = maxLen = 3;
				distances[offset++] = matchFinder._pos - curMatch3 - 1;
				curMatch2 = curMatch3;
			}
		}

		if (offset != 0 && curMatch2 == curMatch) {
			offset -= 2;
			maxLen = 1;
		}
	}

	matchFinder._hash[matchFinder.kFixHashSize + hashValue] = matchFinder._pos;
	ptr0 = (matchFinder._cyclicBufferPos << 1) + 1;
	ptr1 = matchFinder._cyclicBufferPos << 1;
	len0 = len1 = matchFinder.kNumHashDirectBytes;

	if (matchFinder.kNumHashDirectBytes != 0) {
		if (curMatch > matchMinPos) {
			if (
				matchFinder._bufferBase[
					matchFinder._bufferOffset + curMatch + matchFinder.kNumHashDirectBytes
				] != matchFinder._bufferBase[cur + matchFinder.kNumHashDirectBytes]
			) {
				distances[offset++] = maxLen = matchFinder.kNumHashDirectBytes;
				distances[offset++] = matchFinder._pos - curMatch - 1;
			}
		}
	}
	count = matchFinder._cutValue;

	while (1) {
		if (curMatch <= matchMinPos || count == 0) {
			count -= 1;
			matchFinder._son[ptr0] = matchFinder._son[ptr1] = 0;
			break;
		}
		delta = matchFinder._pos - curMatch;

		cyclicPos = (delta <= matchFinder._cyclicBufferPos
			? matchFinder._cyclicBufferPos - delta
			: matchFinder._cyclicBufferPos - delta + matchFinder._cyclicBufferSize) << 1;

		pby1 = matchFinder._bufferOffset + curMatch;
		len = len0 < len1 ? len0 : len1;

		if (
			matchFinder._bufferBase[pby1 + len] == matchFinder._bufferBase[cur + len]
		) {
			while ((len += 1) != lenLimit) {
				if (
					matchFinder._bufferBase[pby1 + len] != matchFinder._bufferBase[cur + len]
				) {
					break;
				}
			}

			if (maxLen < len) {
				distances[offset++] = maxLen = len;
				distances[offset++] = delta - 1;
				if (len == lenLimit) {
					matchFinder._son[ptr1] = matchFinder._son[cyclicPos];
					matchFinder._son[ptr0] = matchFinder._son[cyclicPos + 1];
					break;
				}
			}
		}

		if (
			(matchFinder._bufferBase[pby1 + len] & 0xFF) < (matchFinder._bufferBase[cur + len] & 0xFF)
		) {
			matchFinder._son[ptr1] = curMatch;
			ptr1 = cyclicPos + 1;
			curMatch = matchFinder._son[ptr1];
			len1 = len;
		} else {
			matchFinder._son[ptr0] = curMatch;
			ptr0 = cyclicPos;
			curMatch = matchFinder._son[ptr0];
			len0 = len;
		}
	}

	movePosFn();
	return offset;
}

/**
 * Move position in the match finder with proper buffer management
 */
export function moveMatchFinderPosition(
	matchFinder: MatchFinder,
	moveBlockFn: () => void,
	readBlockFn: () => void,
	moveCyclicFn: () => void,
): void {
	matchFinder._pos += 1;

	if (matchFinder._pos > matchFinder._posLimit) {
		const pointerToPosition = matchFinder._bufferOffset + matchFinder._pos;

		if (pointerToPosition > matchFinder._pointerToLastSafePosition) {
			moveBlockFn();
		}

		readBlockFn();
	}

	moveCyclicFn();
}

/**
 * Initialize match finder for encoding
 */
export function initializeMatchFinder(
	matchFinder: MatchFinder,
	readBlockFn: () => void,
	reduceOffsetsFn: (offset: number) => void,
): void {
	matchFinder._bufferOffset = 0;
	matchFinder._pos = 0;
	matchFinder._streamPos = 0;
	matchFinder._streamEndWasReached = 0;
	readBlockFn();

	matchFinder._cyclicBufferPos = 0;
	reduceOffsetsFn(-1);
}

/**
 * Pattern matching logic that finds repeated patterns in the input data
 * This is the core algorithm that searches for the best matches
 */
export function getMatchesWithEncoder(
	matchFinder: MatchFinder,
	distances: number[],
	movePosFn: () => void,
): number {
	let count,
		cur,
		curMatch,
		curMatch2,
		curMatch3,
		cyclicPos,
		delta,
		hash2Value,
		hash3Value,
		hashValue,
		len,
		len0,
		len1,
		lenLimit,
		matchMinPos,
		maxLen,
		offset,
		pby1,
		ptr0,
		ptr1,
		temp;

	if (matchFinder._pos + matchFinder._matchMaxLen <= matchFinder._streamPos) {
		lenLimit = matchFinder._matchMaxLen;
	} else {
		lenLimit = matchFinder._streamPos - matchFinder._pos;
		if (lenLimit < matchFinder.kMinMatchCheck) {
			movePosFn();
			return 0;
		}
	}

	offset = 0;
	matchMinPos = matchFinder._pos > matchFinder._cyclicBufferSize
		? matchFinder._pos - matchFinder._cyclicBufferSize
		: 0;

	cur = matchFinder._bufferOffset + matchFinder._pos;
	maxLen = 1;
	hash2Value = 0;
	hash3Value = 0;

	if (matchFinder.HASH_ARRAY) {
		temp = CRC32_TABLE[matchFinder._bufferBase[cur] & 0xFF] ^ matchFinder._bufferBase[cur + 1] & 0xFF;
		hash2Value = temp & 0x3FF;
		temp ^= (matchFinder._bufferBase[cur + 2] & 0xFF) << 0x08;
		hash3Value = temp & 0xFFFF;
		hashValue = (temp ^ CRC32_TABLE[matchFinder._bufferBase[cur + 3] & 0xFF] << 5) & matchFinder._hashMask;
	} else {
		hashValue = matchFinder._bufferBase[cur] & 0xFF ^ (matchFinder._bufferBase[cur + 1] & 0xFF) << 0x08;
	}

	curMatch = matchFinder._hash[matchFinder.kFixHashSize + hashValue] || 0;
	if (matchFinder.HASH_ARRAY) {
		curMatch2 = matchFinder._hash[hash2Value] || 0;
		curMatch3 = matchFinder._hash[0x400 + hash3Value] || 0;
		matchFinder._hash[hash2Value] = matchFinder._pos;
		matchFinder._hash[0x400 + hash3Value] = matchFinder._pos;

		if (curMatch2 > matchMinPos) {
			if (
				matchFinder._bufferBase[matchFinder._bufferOffset + curMatch2] == matchFinder._bufferBase[cur]
			) {
				distances[offset++] = maxLen = 2;
				distances[offset++] = matchFinder._pos - curMatch2 - 1;
			}
		}

		if (curMatch3 > matchMinPos) {
			if (
				matchFinder._bufferBase[matchFinder._bufferOffset + curMatch3] == matchFinder._bufferBase[cur]
			) {
				if (curMatch3 == curMatch2) {
					offset -= 2;
				}
				distances[offset++] = maxLen = 3;
				distances[offset++] = matchFinder._pos - curMatch3 - 1;
				curMatch2 = curMatch3;
			}
		}

		if (offset != 0 && curMatch2 == curMatch) {
			offset -= 2;
			maxLen = 1;
		}
	}

	matchFinder._hash[matchFinder.kFixHashSize + hashValue] = matchFinder._pos;
	ptr0 = (matchFinder._cyclicBufferPos << 1) + 1;
	ptr1 = matchFinder._cyclicBufferPos << 1;
	len0 = len1 = matchFinder.kNumHashDirectBytes;

	if (matchFinder.kNumHashDirectBytes != 0) {
		if (curMatch > matchMinPos) {
			if (
				matchFinder._bufferBase[
					matchFinder._bufferOffset + curMatch + matchFinder.kNumHashDirectBytes
				] != matchFinder._bufferBase[cur + matchFinder.kNumHashDirectBytes]
			) {
				distances[offset++] = maxLen = matchFinder.kNumHashDirectBytes;
				distances[offset++] = matchFinder._pos - curMatch - 1;
			}
		}
	}
	count = matchFinder._cutValue;

	while (1) {
		if (curMatch <= matchMinPos || count == 0) {
			count -= 1;
			matchFinder._son[ptr0] = matchFinder._son[ptr1] = 0;
			break;
		}
		delta = matchFinder._pos - curMatch;

		cyclicPos = (delta <= matchFinder._cyclicBufferPos
			? matchFinder._cyclicBufferPos - delta
			: matchFinder._cyclicBufferPos - delta + matchFinder._cyclicBufferSize) << 1;

		pby1 = matchFinder._bufferOffset + curMatch;
		len = len0 < len1 ? len0 : len1;

		if (
			matchFinder._bufferBase[pby1 + len] == matchFinder._bufferBase[cur + len]
		) {
			while ((len += 1) != lenLimit) {
				if (
					matchFinder._bufferBase[pby1 + len] != matchFinder._bufferBase[cur + len]
				) {
					break;
				}
			}

			if (maxLen < len) {
				distances[offset++] = maxLen = len;
				distances[offset++] = delta - 1;
				if (len == lenLimit) {
					matchFinder._son[ptr1] = matchFinder._son[cyclicPos];
					matchFinder._son[ptr0] = matchFinder._son[cyclicPos + 1];
					break;
				}
			}
		}

		if (
			(matchFinder._bufferBase[pby1 + len] & 0xFF) < (matchFinder._bufferBase[cur + len] & 0xFF)
		) {
			matchFinder._son[ptr1] = curMatch;
			ptr1 = cyclicPos + 1;
			curMatch = matchFinder._son[ptr1];
			len1 = len;
		} else {
			matchFinder._son[ptr0] = curMatch;
			ptr0 = cyclicPos;
			curMatch = matchFinder._son[ptr0];
			len0 = len;
		}
	}

	movePosFn();
	return offset;
}
