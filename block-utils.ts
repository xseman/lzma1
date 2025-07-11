/**
 * Block operations utility functions
 */

export interface BlockOperationContext {
	_pos: number;
	_windowSize: number;
	_buffer?: number[];
}

/**
 * Copy block of data for decompression
 */
export function copyBlockData(
	outputWindow: BlockOperationContext,
	distance: number,
	length: number,
	flushFn: () => void,
): void {
	let pos = outputWindow._pos - distance - 1;

	if (pos < 0) {
		pos += outputWindow._windowSize;
	}

	for (let len = length; len != 0; len -= 1) {
		if (pos >= outputWindow._windowSize) {
			pos = 0;
		}
		outputWindow._buffer![outputWindow._pos] = outputWindow._buffer![pos];
		outputWindow._pos += 1;
		pos += 1;

		if (outputWindow._pos >= outputWindow._windowSize) {
			flushFn();
		}
	}
}

/**
 * State update function for character processing
 */
export function updateStateForChar(index: number): number {
	if (index < 4) {
		return 0;
	}
	if (index < 10) {
		return index - 3;
	}
	return index - 6;
}
