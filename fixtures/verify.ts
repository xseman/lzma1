/**
 * Runs the identity checks of `src/xz-java-identity_test.ts` on Node (V8)
 * against the built library, without bun. CI runs the bun test
 * (JavaScriptCore); this covers the other engine.
 *
 * Usage: node fixtures/verify.ts   (Node >= 22.18, after `bun install`)
 *
 * It rebuilds `lib/` itself first, so the checks never run against a
 * build of other sources. Exits non-zero if any check fails.
 */

import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
	cellChecks,
	type IdentityCheck,
	type Library,
	loadMalformedRecords,
	loadManifest,
	malformedChecks,
	recordChecks,
} from "./identity.ts";

const repoRoot = path.join(import.meta.dirname, "..");

// `--force`: an up-to-date check against a leftover build-info file could
// skip the build and leave a `lib/` compiled from other sources.
execFileSync(path.join(repoRoot, "node_modules", ".bin", "tsc"), ["--build", "--force"], { cwd: repoRoot, stdio: "inherit" });
const library: Library = await import(pathToFileURL(path.join(repoRoot, "lib", "index.js")).href);

const manifest = loadManifest();
const records = loadMalformedRecords();
const groups: [string, IdentityCheck[]][] = [
	["fixture records", recordChecks(manifest, records)],
	["byte identity with XZ for Java", cellChecks(library, manifest)],
	["malformed streams match recorded decoder expectations", malformedChecks(library, manifest, records)],
];

let failures = 0;
for (const [group, checks] of groups) {
	let passed = 0;
	for (const check of checks) {
		const mismatch = await check.run();
		if (mismatch === undefined) {
			passed++;
			continue;
		}

		failures++;
		process.stdout.write(`FAIL ${group} > ${check.name}: ${mismatch}\n`);
	}

	process.stdout.write(`${group}: ${passed}/${checks.length} passed\n`);
}

process.stdout.write(`${failures === 0 ? "ALL CHECKS PASSED" : `${failures} FAILED`} on Node ${process.version}\n`);
process.exitCode = failures === 0 ? 0 : 1;
