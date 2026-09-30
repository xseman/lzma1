/**
 * String <-> bytes conversion.
 *
 * Strings are encoded as standard UTF-8. Up to v0.3.0, this library used
 * Java's "modified UTF-8" (NUL as `C0 80`, characters outside the BMP as
 * two 3-byte surrogates), so decoding falls back to that format, and finally
 * to Latin-1 for data that isn't text.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export function encodeUtf8(text: string): Uint8Array {
	return encoder.encode(text);
}

export function decodeUtf8(bytes: Uint8Array): string {
	try {
		return decoder.decode(bytes);
	} catch {
		return decodeModifiedUtf8(bytes) ?? decodeLatin1(bytes);
	}
}

/**
 * Decodes 1-3 byte sequences without rejecting overlong forms or
 * surrogates, which is what modified UTF-8 needs. Returns `null` if the
 * bytes are not valid modified UTF-8.
 */
function decodeModifiedUtf8(bytes: Uint8Array): string | null {
	const codes = new Uint16Array(bytes.length);
	let n = 0;

	for (let i = 0; i < bytes.length; ++i) {
		const x = bytes[i];

		if (x < 0x80) {
			codes[n++] = x;
		} else if ((x & 0xE0) === 0xC0) {
			const y = bytes[++i];
			if (i >= bytes.length || (y & 0xC0) !== 0x80) return null;
			codes[n++] = ((x & 0x1F) << 6) | (y & 0x3F);
		} else if ((x & 0xF0) === 0xE0) {
			const y = bytes[++i];
			const z = bytes[++i];
			if (i >= bytes.length || (y & 0xC0) !== 0x80 || (z & 0xC0) !== 0x80) return null;
			codes[n++] = ((x & 0x0F) << 12) | ((y & 0x3F) << 6) | (z & 0x3F);
		} else {
			return null;
		}
	}

	return fromCharCodes(codes.subarray(0, n));
}

function decodeLatin1(bytes: Uint8Array): string {
	return fromCharCodes(bytes);
}

/** `String.fromCharCode` in chunks, to stay within argument count limits. */
function fromCharCodes(codes: Uint8Array | Uint16Array): string {
	const CHUNK = 0x2000;
	let result = "";

	for (let i = 0; i < codes.length; i += CHUNK) {
		result += String.fromCharCode.apply(null, codes.subarray(i, i + CHUNK) as unknown as number[]);
	}

	return result;
}
