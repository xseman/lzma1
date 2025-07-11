import { getChars } from "./io-utils.js";
import { toSigned8bit } from "./literal-utils.js";

/**
 * Decodes a UTF-8 encoded byte array into a string
 */
export function decodeString(utf: number[]): string {
	let j = 0, x, y, z, l = utf.length, buf = [], charCodes = [];

	for (let i = 0; i < l; ++i, ++j) {
		x = utf[i] & 0xFF;
		if (!(x & 0x80)) {
			if (!x) {
				// It appears that this is binary data, so it cannot be
				// converted to a string, so just send it back.
				return String.fromCharCode(...utf);
			}
			charCodes[j] = x;
		} else if ((x & 0xE0) == 0xC0) {
			if (i + 1 >= l) {
				// It appears that this is binary data, so it cannot be
				// converted to a string, so just send it back.
				return String.fromCharCode(...utf);
			}
			y = utf[++i] & 0xFF;
			if ((y & 0xC0) != 0x80) {
				// It appears that this is binary data, so it cannot be
				// converted to a string, so just send it back.
				return String.fromCharCode(...utf);
			}
			charCodes[j] = ((x & 0x1F) << 6) | (y & 0x3F);
		} else if ((x & 0xF0) == 0xE0) {
			if (i + 2 >= l) {
				// It appears that this is binary data, so it cannot be
				// converted to a string, so just send it back.
				return String.fromCharCode(...utf);
			}
			y = utf[++i] & 0xFF;
			if ((y & 0xC0) != 0x80) {
				// It appears that this is binary data, so it cannot be converted to
				// a string, so just send it back.
				return String.fromCharCode(...utf);
			}
			z = utf[++i] & 0xFF;
			if ((z & 0xC0) != 0x80) {
				// It appears that this is binary data, so it cannot be converted to
				// a string, so just send it back.
				return String.fromCharCode(...utf);
			}
			charCodes[j] = ((x & 0x0F) << 0x0C) | ((y & 0x3F) << 6) | (z & 0x3F);
		} else {
			// It appears that this is binary data, so it cannot be converted to
			// a string, so just send it back.
			return String.fromCharCode(...utf);
		}
		if (j == 0x3FFF) {
			buf.push(String.fromCharCode.apply(String, charCodes));
			j = -1;
		}
	}

	if (j > 0) {
		charCodes.length = j;
		buf.push(String.fromCharCode.apply(String, charCodes));
	}

	return buf.join("");
}

/**
 * Encodes a string into a UTF-8 byte array
 */
export function encodeString(inputString: string): number[] {
	let ch, chars: number[] = [], elen = 0, l = inputString.length;

	getChars(inputString, 0, l, chars, 0);

	// Add extra spaces in the array to break up the unicode symbols.
	for (let i = 0; i < l; ++i) {
		ch = chars[i];
		if (ch >= 1 && ch <= 0x7F) {
			++elen;
		} else if (!ch || ch >= 0x80 && ch <= 0x7FF) {
			elen += 2;
		} else {
			elen += 3;
		}
	}

	const data = [];
	elen = 0;
	for (let i = 0; i < l; ++i) {
		ch = chars[i];
		if (ch >= 1 && ch <= 0x7F) {
			data[elen++] = toSigned8bit(ch);
		} else if (!ch || (ch >= 0x80 && ch <= 0x7FF)) {
			data[elen++] = toSigned8bit(0xC0 | (ch >> 6 & 0x1F));
			data[elen++] = toSigned8bit(0x80 | (ch & 0x3F));
		} else {
			data[elen++] = toSigned8bit(0xE0 | (ch >> 0x0C) & 0x0F);
			data[elen++] = toSigned8bit(0x80 | ((ch >> 6) & 0x3F));
			data[elen++] = toSigned8bit(0x80 | (ch & 0x3F));
		}
	}

	return data;
}
