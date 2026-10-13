/**
 * CRC-32 (IEEE 802.3) lookup table. The match finders hash with a copy of
 * it, so changing this array does not affect compression.
 */
export const CRC32_TABLE: number[] = createCrc32Table();

function createCrc32Table(): number[] {
	const table: number[] = [];

	for (let i = 0; i < 256; ++i) {
		let r = i;
		for (let j = 0; j < 8; ++j) {
			r = (r & 1) !== 0 ? (r >>> 1) ^ 0xEDB88320 : r >>> 1;
		}
		table.push(r >>> 0);
	}

	return table;
}
