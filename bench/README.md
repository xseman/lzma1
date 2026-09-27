# Benchmarks

[mitata](https://github.com/evanwashere/mitata) benchmarks in Node.js that
compare lzma1 from this repository (the build in `../lib`) with a baseline:
the release in `lzma1-release` of `package.json`.

`bench.mjs` measures `compress()` at levels 1, 5 and 9 and `decompress()` on
generated text, JSON, binary data (128 KiB each) and a small JSON object.

```sh
bun install          # bench/ has its own package.json and bun.lock
bun run bench        # builds ../lib, runs bench.mjs
bun run report       # writes ../docs/benchmarks.md and .json
```

| Environment variable  | Effect                                                      |
| --------------------- | ----------------------------------------------------------- |
| `LZMA1_BASELINE`      | lzma1 entry point to compare with, e.g. `../x/lib/index.js` |
| `LZMA1_BASELINE_NAME` | name of that baseline in the output                         |
| `BENCHMARK_RUNNER=1`  | JSON output                                                 |

- **Release:** run `bun run report` before a release, then update
  `lzma1-release` to the new version.
- **Pull requests:** the [Benchmark](../.github/workflows/bench.yml) workflow
  compares a pull request with its base branch and posts the report as a
  comment.
