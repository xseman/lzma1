# Differential corpus fixtures

The files under `corpus/` are compressed outputs of **XZ for Java**
(<https://github.com/tukaani-project/xz-java>), generated at the commit recorded
in `manifest.json`. The manifest also records the Java version used, the decoder
memory limit, and the SHA-256 of every generated input and fixture.

Each corpus cell (defined in `corpus.ts`) pairs one seeded input with one
encoder configuration. The inputs come from `inputs.ts`, whose generator uses
pure integer arithmetic, so every platform reproduces them bit-identically and
only their hashes need committing (in `manifest.json`). Every cell has two
fixtures:

- `<id>.lzma`: the Java encoder's output with the known size in the header and
  no end marker.
- `<id>.marker.lzma`: the Java encoder's output with an end marker. XZ for Java
  only writes the marker together with an "unknown size" header, so this form
  differs from the library's known-size marker output in the 8 header bytes that
  hold the size, and nowhere else.

One streaming cell (`stream-n-bt4-64-dict64k`) has only the marker form: it is
compared against the library's chunked `Compress`, which also writes an
unknown-size header, with an input larger than the dictionary so the encoder's
window has to move.

`malformed.json` records, for a derived set of corrupted streams (truncations,
single-bit flips, bad header fields, declared-size patches on a marker stream;
derivation in `malformed.ts`), the outcome of the Java decoder
(`LZMAInputStream`) at generation time: success with output length and SHA-256,
or the name of the `IOException` it threw. The library's decoder must produce
the same outcome kind (and, on success, the same bytes), except in four classes
of corrupt input that it accepts where the Java decoder rejects them. Those
cases carry the class (`deviation`) and the library's own outcome (`port`):

- `end-marker-leniency`: an end marker before the declared size is accepted;
  some producers write a size that is too large, and the marker is the recovery
  mechanism. The output must equal the original input.
- `trailing-state-leniency`: decoding stops once the declared size is produced,
  without checking the range coder's final state, so corruption confined to the
  trailing bytes (or, for a declared size of zero, the entire body) goes
  undetected. The output must equal the original input.
- `dict-size-clamp`: a header dictionary size beyond the Java code's supported
  range is clamped to the declared size instead of rejected. The output must
  equal the original input.
- `accepted-corruption`: the same missing final-state check, where the
  corruption did change the output: the stream is accepted at the declared
  length with wrong bytes. Its members are listed one by one in `generate.ts`.

## How the fixtures are checked

`src/xz-java-identity_test.ts` runs the checks in `identity.ts` on Bun, as CI
does, and `node fixtures/verify.ts` runs the same checks on Node (V8): every
fixture's hash against `manifest.json`, `compress()` against every fixture byte
for byte (each compressed twice in a row, so encoders reused from the pool are
checked too), `decompress()` of every fixture against its input, and every
malformed case against its recorded outcome, with the expected count of each
class.

## CI

Besides running the checks above, CI regenerates the fixtures from XZ for Java
at the pinned commit and fails if the result differs from the committed files in
anything but `javaVersion`, which names the JDK build that ran the generator.

## Regenerating locally

Needed to audit the fixtures, to move the Java pin, and after any change that
alters what the generator produces, such as a corpus extension; CI's
regeneration job reports such a change as a difference. The fixture tooling is
TypeScript run directly by Node, so it needs **Node >= 22.18** (built-in type
stripping; only for this tooling, the package's supported runtimes are
unchanged). It also needs a JDK (`javac`; a JRE is not enough), `git` and `tar`.

```sh
git clone https://github.com/tukaani-project/xz-java.git
git -C xz-java checkout <commit from manifest.json>

bun install
node fixtures/generate.ts xz-java
```

The generator exports the checkout's committed `HEAD` with `git archive` and
compiles the Java code and the two drivers (`Enc.java`, `Dec.java`) from that
export into a fresh directory, so untracked or modified files in the checkout
cannot affect the result. It refuses a checkout whose `HEAD` is not the pinned
commit. To move the pin, check out the new commit and run with `--repin`, which
records it in `manifest.json`. The generator rebuilds `lib/` itself, because it
reads `fitDictSize`, `roundDictSize` and the library's decoder from there.

Regenerating at an unchanged pin must reproduce the committed files exactly; a
difference means the environment or the generator changed. A malformed-stream
case whose outcome differs from the Java decoder's in a way no class covers
stops generation instead of being recorded, and so does a new
`accepted-corruption` candidate. A `MemoryLimitException`, JVM error or runtime
exception in the Java decoder also stops it: only an `IOException` counts as the
Java decoder rejecting a stream.

## The `roundDictSize` constraint

`encodeHeader` rounds the dictionary size up to `2^n` or `2^n + 2^(n-1)`
(`roundDictSize`), while XZ for Java's `LZMAOutputStream` writes the configured
size raw. Every corpus cell's dictionary size after `fitDictSize` (or as
configured, for the streaming cell) must therefore be a fixed point of
`roundDictSize`, or the 13-byte headers would differ by design rather than by
encoder behavior. `generate.ts` asserts this for every cell.
