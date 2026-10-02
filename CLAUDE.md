# lzma1

LZMA for the `.lzma` format in TypeScript, ported from XZ for Java. No
dependencies, web standard APIs only. Read `README.md` for the API.

## Commands

```sh
bun run test            # bun test src/ with coverage
bun run typecheck       # tsc --noEmit
bun run fmt             # dprint fmt
bun run build           # tsc --build into lib/
bun run bench           # bench/, results in docs/benchmarks.md
bun test src/lzma_test.ts
```

CI (`.github/workflows/quality.yml`) runs typecheck, test and `fmt:check`.

## Rules

- The one-shot `compress` writes a known size and an end marker. Keep the
  marker on by default: bysquare relies on it to recover from a wrong length
  header. Omitting it is opt-in only (`endMarker: false`).
- Output stays interoperable with `xz --format=lzma`, 7-Zip and the LZMA SDK;
  `interop_test.ts` checks it.
- A logical change needs its tests added or adjusted, and `README.md` brought
  up to date (sections: Why, Features, Installation, Quick start, How it
  works, Related).
- Do not edit `CHANGELOG.md`: release-please writes it from the commit types.
  Commits and PR titles are lowercase conventional commits.

## Tests

- Use only `describe`, `test` and `expect` from `bun:test`
- Tests sit next to the code as `*_test.ts`
- New tests: `describe` names the unit or behaviour group; a test name is a
  lowercase present-tense sentence: "rejects truncated input"
- Use `test.each()` for uniform cases, a `for` loop with `test()` when a case
  needs its own logic
- New tests use the AAA shape (arrange, act, assert) with blank lines between
  the parts and no comments marking them

## Code style

Run `bun run fmt` and don't hand-format what dprint owns (quotes, semicolons,
commas, indentation, vertical imports).

Ported files (`bt4`, `hc4`, `hash234`, `lz-*`, `lzma-coder`, `lzma-decoder`,
`lzma-encoder*`, `range-*`, and `createEncoder` in `alone-encoder`) keep the XZ
for Java structure, names and parameter lists so they can be compared with
upstream; don't reshape them only to satisfy the rules below. The rules apply
to new code; existing code is not churned to match them.

### Imports and exports

- Two blocks separated by a blank line: external (`node:`, `bun:test`,
  packages), then local. Node builtins always carry the `node:` prefix.
- Named exports only, no `export default`. `index.ts` is the public API: the
  `@license` / `SPDX-License-Identifier` block, then the public functions and
  re-exports.

### Line breaking

`lineWidth` is 10000, so dprint never wraps: the author breaks lines. A
statement stays on one line until it stops reading as one thought.

- A trailing object, array or callback argument opens on the call's line:
  `new Uint8Array([`, `test("…", () => {`
- One argument per line only when no argument can hug; `)` on its own line,
  trailing comma after the last argument
- A broken signature goes one parameter per line
- Chains: the receiver and first call on one line, then one `.call()` per line
  with the dot leading
- Numbers: underscore separators (`1_000_000`, `0b0000_1111`), uppercase hex
  (`0xFF`)

### Blank lines: code reads in paragraphs

A paragraph is one step: the statements that produce a value plus the guard
that checks it. One blank line between paragraphs, never two, never at the
start or end of a block.

```ts
const decoder = new AloneDecoder(onChunk, PREALLOCATE_LIMIT, true);
decoder.write(data);
decoder.end();

if (decoder.contiguousOutput) {
	return new Uint8Array(last.buffer, 0, last.byteOffset + last.length);
}

return out.finish();
```

- Blank line before `return`, unless it is the first statement of its block.
  A comment explaining the `return` stays attached to it.
- A multiline `if`/`for`/`try`/`switch` has a blank line before and after.
  Only a `const`/`let` the block uses may sit directly above it.
- Exception, the guard cluster: consecutive guards whose body is a single
  `return`/`throw` stack without blank lines, together with the check calls
  they belong to. A long run splits into clusters by what they check
  (`resolveOptions`: integer checks, then the enum and boolean checks). A
  blank line follows each cluster.
- Guards use braces. Braceless `if (c) return x;` only inside tight loops.
- One-line class fields sit together; methods are separated by a blank line.
- Module-level functions, classes, interfaces and types are separated by a
  blank line.

### Control flow

- Guard clauses keep the main path flat: no `else` after `return`, `throw`,
  `continue` or `break`. Never nest ternaries.
- Loop with `for…of`. `map`/`filter`/`reduce` only build a value, without
  side effects. Never `.forEach`.
- Name a value that is used twice, or a call that would otherwise sit two
  calls deep inside another.

### Grouping

- A run of uniform statements gets a short label comment (`// Literal`,
  `// Rep`): blank line before it, none between it and its group.
- Exports come first, private helpers below them; a constant sits directly
  above its first user (`PREALLOCATE_LIMIT` in `lzma.ts`).
- Modules are named after what they provide; no `utils`.

### Names and values

- Top-level functions use `function`, not arrow consts (tests may use arrows
  for small helpers)
- Explicit return types on exported functions
- A public function with more than three parameters, or more than one
  optional one, takes an options object (`compress(data, mode | options)`)
- `interface` for object shapes, `type` for unions
- No TS `enum`: an `as const` object plus a type of the same name
- Module-level constants and tables are `UPPER_SNAKE_CASE`; module-level
  instances stay camelCase (`encoder` in `utf8.ts`)
- Acronyms follow camel/Pascal case (`decodeUtf8`, `toUint8Array`); the legacy
  `LZMA` class keeps its name
- Class privacy is the `private` modifier (plus `readonly` where it holds),
  never `#field` and no `_` prefix
- Full names; short ones only in a tight scope (loop variables, lambda
  parameters) or where they mirror XZ for Java (`lc`, `lp`, `pb`, `rep0`)

### Errors

- Throw the built-in `Error`, `RangeError` or `TypeError`. A subclass only
  when a caller must tell the error apart: `name` set to the class name, the
  original error as `cause`, data in fields.
- A `catch` that swallows an error says why in a comment; anything it doesn't
  handle is rethrown.

### Comments and docs

- The public API (what `index.ts` exports) gets a JSDoc: a one-sentence
  summary, `@param`/`@returns`, and `@throws` when it can throw. An options
  field states its meaning and its default in prose ("default 3"), or that it
  comes from the preset.
- A `//` comment records a decision: why, what breaks without it, how it was
  found. Label comments are the only kind that may restate the code.
- A ported file names its origin in the module doc comment (`Ported from XZ
  for Java (0BSD) by …`).
- Binary layouts get a table or ASCII box diagram in the doc comment
  (`header.ts`).
