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

/** Text only raw decoding contains. Minifiers keep strings and property names. */
const RAW_ONLY = ["KiB of memory would be needed", "memoryLimitKb"];

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

		for (const text of RAW_ONLY) {
			expect(code).not.toContain(text);
		}
	});

	test("keeps raw decoding in an app that imports it", async () => {
		const code = await bundle(["decompressRawLzma1"]);

		for (const text of RAW_ONLY) {
			expect(code).toContain(text);
		}
	});
});
