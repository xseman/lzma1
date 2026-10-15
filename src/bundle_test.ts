import {
	describe,
	expect,
	test,
} from "bun:test";
import {
	mkdtemp,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const INDEX = fileURLToPath(new URL("index.ts", import.meta.url));

// Text only raw decoding contains. Minifiers keep strings and property names.
const RAW = ["KiB of memory would be needed", "memoryLimitKb"];
const LZMA2 = ["LZMA2", "getMemoryUsageKb"];

// The LZMA2-only dictionary and range decoder functions. A bundle shows their
// names only if they become methods of a class that decompress() uses too,
// such as `LzDecoder` or `RangeDecoder`.
const SHARED_METHODS = ["copyUncompressed", "resetDictionary", "prepareInputBuffer"];

/** Bundles an app that imports `names`, minified like a production build. */
async function bundle(names: string[]): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "lzma1-bundle-"));

	try {
		const entry = join(dir, "app.ts");
		await writeFile(entry, `import { ${names.join(", ")} } from ${JSON.stringify(INDEX)};\nglobalThis.app = [${names.join(", ")}];\n`);
		const result = await Bun.build({ entrypoints: [entry], minify: true, target: "browser" });

		return await result.outputs[0].text();
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

describe("tree shaking", () => {
	test.each([
		[["decompress"]],
		[["decompress", "decompressString", "Decompress"]],
		[["compress", "decompress"]],
	])("leaves raw decoding out of an app that imports %p", async (names) => {
		const code = await bundle(names);

		for (const text of [...RAW, ...LZMA2, ...SHARED_METHODS]) {
			expect(code).not.toContain(text);
		}
	});

	test("keeps raw LZMA1 decoding and leaves LZMA2 out of an app that imports decompressRawLzma1", async () => {
		const code = await bundle(["decompressRawLzma1"]);

		for (const text of RAW) {
			expect(code).toContain(text);
		}

		for (const text of LZMA2) {
			expect(code).not.toContain(text);
		}
	});

	test("keeps LZMA2 decoding in an app that imports decompressRawLzma2", async () => {
		const code = await bundle(["decompressRawLzma2"]);

		for (const text of [...RAW, ...LZMA2]) {
			expect(code).toContain(text);
		}
	});
});
