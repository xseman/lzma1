/**
 * String <-> bytes conversion.
 *
 * Strings are encoded and decoded as standard UTF-8. Decoding replaces each
 * invalid sequence with U+FFFD, like `TextDecoder` does by default.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

export function encodeUtf8(text: string): Uint8Array {
	return encoder.encode(text);
}

export function decodeUtf8(bytes: Uint8Array): string {
	return decoder.decode(bytes);
}
