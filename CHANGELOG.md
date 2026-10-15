# Changelog

## [0.6.1](https://github.com/xseman/lzma1/compare/v0.6.0...v0.6.1) (2026-10-15)


### Features

* add raw lzma1 and lzma2 decoding ([e1805f0](https://github.com/xseman/lzma1/commit/e1805f0fb81d59ff87ee9770cf680022b26dabb9))
* add strict decoding that rejects an early end marker ([f4c7efb](https://github.com/xseman/lzma1/commit/f4c7efb5c1def9dc0dba63ba9a287738c057bed5))
* add web streams for raw lzma1 and lzma2 ([7fb82f5](https://github.com/xseman/lzma1/commit/7fb82f5acc8fcb0e9e6f2cb9f1edd5ec18d65f07))
* decode raw lzma2 streams ([c0502b2](https://github.com/xseman/lzma1/commit/c0502b25dae2e4e9b870f94ac9357b76908fe85b))


### Bug Fixes

* check the range coder's final state at the declared size ([21c9fc0](https://github.com/xseman/lzma1/commit/21c9fc0b2a7984e32e26f346ecf6887c6082acfc))


### Testing

* check the decoders against the xz-utils test files ([83221f5](https://github.com/xseman/lzma1/commit/83221f546a659335b70d64a2a81212020fdde6ed))
* record XZ for Java's outcomes for raw lzma1 and lzma2 ([b938542](https://github.com/xseman/lzma1/commit/b93854263bb77ad87e0eadd92a063be039b17137))

## [0.6.0](https://github.com/xseman/lzma1/compare/v0.4.0...v0.6.0) (2026-10-13)


### Features

* add endMarker option to omit the end marker when the size is known ([#37](https://github.com/xseman/lzma1/issues/37)) ([8dbe324](https://github.com/xseman/lzma1/commit/8dbe3245c37f63a8a53dc5e7254af5f7362e1cbe))


### Bug Fixes

* make normal-mode output byte-identical to XZ for Java and check it in CI ([3e49d05](https://github.com/xseman/lzma1/commit/3e49d05fc5d051f1e3892f28b3dbd39831ad58cb))
* retranslate the core coders from XZ for Java to match its output ([d63e901](https://github.com/xseman/lzma1/commit/d63e9015f4da0499e96a97540ebe62ea2838e80c))


### Performance Improvements

* speed up compression while keeping output identical to XZ for Java ([a933264](https://github.com/xseman/lzma1/commit/a9332642afc4ce505f102ea0a0899ea6fda78557))


### Documentation

* add CLAUDE.md with repo rules and code style ([9d50446](https://github.com/xseman/lzma1/commit/9d50446e07864dcaf550ffc21034b8298d6d3d3e))
* add the XZ for Java verification rules to CLAUDE.md ([4f6a03c](https://github.com/xseman/lzma1/commit/4f6a03c254f5cfbe66992a860076c56a3061f575))


### Maintenance

* compute the encoder's price tables in module functions ([0b5b901](https://github.com/xseman/lzma1/commit/0b5b901f8ba1f3391c27fd5d90f1a70b3062456c))
* copy the optimum search's reps with element assignments ([0b5efac](https://github.com/xseman/lzma1/commit/0b5efacfeb059747254f220ca02366e1fa38f67c))
* hash with an int32 copy of the CRC table ([f06a45a](https://github.com/xseman/lzma1/commit/f06a45a7cf53289562f01e70fdbde032300b7a32))
* hoist loop invariants out of calcLongRepPrices ([8324066](https://github.com/xseman/lzma1/commit/8324066d0adaf9bcbbe294e300e8f8e99f6afc69))
* keep the optimum search's states as numbers ([e5fa4fa](https://github.com/xseman/lzma1/commit/e5fa4fa6f63fddc7bda916ff0ae4933c6abe9d2e))
* price bits from one table indexed by bit and probability ([2ac3d88](https://github.com/xseman/lzma1/commit/2ac3d883091099dab771e6ca9fe9a7670d93e686))
* regenerate the fixtures and compare them with the committed ones ([c4f0445](https://github.com/xseman/lzma1/commit/c4f0445619a4255bebfc0ee4ff8f476de6be6765))
* release 0.6.0 ([1743fde](https://github.com/xseman/lzma1/commit/1743fde447cb25456bb332b34e971e606ab788c8))
* reset each coder's probability array with one fill ([5e88117](https://github.com/xseman/lzma1/commit/5e88117dec28ff9936b70996d3c5f0469681dc13))
* reuse distance prices for matches of length 5+ ([201ad8b](https://github.com/xseman/lzma1/commit/201ad8beedc464380277a9a3c844497b861fa2d5))
* reuse probability arrays between one-shot decoders ([6ea425b](https://github.com/xseman/lzma1/commit/6ea425b7f613c920cea3d8138fb34ab65c09e179))
* run quality checks when fixtures or the test tsconfig change ([4880b41](https://github.com/xseman/lzma1/commit/4880b41f818634e4a4e9ac1a1881f3fe4ec93a72))
* share the initial price tables between encoders ([879fefa](https://github.com/xseman/lzma1/commit/879fefacd3528186b57672f31c5893f7383ee897))
* store each coder's probabilities in one flat array ([05b9711](https://github.com/xseman/lzma1/commit/05b97116cd3961238d0d22d9a5b74584df1c5a30))
* store the optimum search's positions as struct-of-arrays ([e5f7a84](https://github.com/xseman/lzma1/commit/e5f7a848eb634c2e88eb076f9f24ec76102ea329))


### Testing

* add XZ for Java differential corpus fixtures and their generator ([d2e5c00](https://github.com/xseman/lzma1/commit/d2e5c00872f8b0cae0e10e08d215635d62ddd3c0))
* declare the interop corpus with its concrete buffer type ([9534708](https://github.com/xseman/lzma1/commit/9534708af395306aecad1baa799a2cb3c0f383ef))

## [0.4.0](https://github.com/xseman/lzma1/compare/v0.3.0...v0.4.0) (2026-09-30)


### ⚠ BREAKING CHANGES

* rewrite LZMA as a port of XZ for Java ([#36](https://github.com/xseman/lzma1/issues/36))

### Features

* rewrite LZMA as a port of XZ for Java ([#36](https://github.com/xseman/lzma1/issues/36)) ([41c1793](https://github.com/xseman/lzma1/commit/41c179342f09da3a3b550c78924391679ab5e27a))


### Maintenance

* publish to npm via trusted publisher (OIDC) ([dac528b](https://github.com/xseman/lzma1/commit/dac528b96a3cf50b39ecf2bb1587cc61b829725a))
* skip coverage report on release PRs ([fb04094](https://github.com/xseman/lzma1/commit/fb0409440b0a79471f22dfff9d53671c94cd1320))


### Testing

* add edge case for unknown header size in decompression ([fd08956](https://github.com/xseman/lzma1/commit/fd089568c490d5251500b46e68ff42d851e3fc0b))

## [0.3.0](https://github.com/xseman/lzma1/compare/v0.2.0...v0.3.0) (2026-04-10)


### ⚠ BREAKING CHANGES

* break up god class, extract components, modernize internals ([#32](https://github.com/xseman/lzma1/issues/32))

### Performance Improvements

* convert hot arrays to typed arrays, remove dead ops ([#33](https://github.com/xseman/lzma1/issues/33)) ([a2fcde3](https://github.com/xseman/lzma1/commit/a2fcde3ea7fada4b5654530b92e32c7dd9e73058))


### Documentation

* add packet diagram via mermaid ([dcb1a33](https://github.com/xseman/lzma1/commit/dcb1a33003fabe00c7b9f38c23f06b70bac57233))


### Maintenance

* break up god class, extract components, modernize internals ([#32](https://github.com/xseman/lzma1/issues/32)) ([ee768bf](https://github.com/xseman/lzma1/commit/ee768bfe8f01f3749fd728afb17e7570416e322e))
* migrate to `bun.lock`, update dependencies & configs ([#30](https://github.com/xseman/lzma1/issues/30)) ([a304def](https://github.com/xseman/lzma1/commit/a304def1fac2f3878d81a10407b72a4e625347ed))

## [0.2.0](https://github.com/xseman/lzma1/compare/v0.1.2...v0.2.0) (2025-08-15)


### Features

* Add LZMA range encoding and decoding implementation ([#29](https://github.com/xseman/lzma1/issues/29)) ([399705f](https://github.com/xseman/lzma1/commit/399705f77359472a4b2f6cf5935cb63b34f287f5))


### Maintenance

* update node version to 24 ([bd087b3](https://github.com/xseman/lzma1/commit/bd087b33cf22da1c6167d3a6750dba3fcc30ab86))

## [0.1.2](https://github.com/xseman/lzma1/compare/v0.1.1...v0.1.2) (2025-07-24)


### Bug Fixes

* regression-since-v0.0.4 ([#27](https://github.com/xseman/lzma1/issues/27)) ([b628b2e](https://github.com/xseman/lzma1/commit/b628b2e70875138b0b3f4212cf82a42f6929308b))


### Maintenance

* remove [@ts-nocheck](https://github.com/ts-nocheck), fix type errors other improvements ([#22](https://github.com/xseman/lzma1/issues/22)) ([8c15430](https://github.com/xseman/lzma1/commit/8c15430878b65a41531c74f1f592f7212aa210a1))
* remove [@ts-nocheck](https://github.com/ts-nocheck), fix type errors other improvements ([#24](https://github.com/xseman/lzma1/issues/24)) ([df13347](https://github.com/xseman/lzma1/commit/df133470620978ee794f3df1fc0afa664d225182))

## [0.1.1](https://github.com/xseman/lzma1/compare/v0.1.0...v0.1.1) (2025-06-27)


### Documentation

* update README ([f0b09bd](https://github.com/xseman/lzma1/commit/f0b09bdaf2675831d51e181c3952c9ce68b3e3da))


### Maintenance

* license change Apache-2.0 to MIT ([7f3719b](https://github.com/xseman/lzma1/commit/7f3719b768d8a11343b06736ebf27349481b4c11))

## [0.1.0](https://github.com/xseman/lzma1/compare/v0.0.7...v0.1.0) (2025-06-27)


### ⚠ BREAKING CHANGES

* Improve API design to be more conventional/performant ([#17](https://github.com/xseman/lzma1/issues/17))

### Maintenance

* Improve API design to be more conventional/performant ([#17](https://github.com/xseman/lzma1/issues/17)) ([2c78ee8](https://github.com/xseman/lzma1/commit/2c78ee84834d0b8418210246dec6c3d4a60cfc75))
* release cleanup ([#20](https://github.com/xseman/lzma1/issues/20)) ([8e1dab1](https://github.com/xseman/lzma1/commit/8e1dab14ee84eec7b975f621caf26b6a7b47d9e7))

## [0.0.7](https://github.com/xseman/lzma1/compare/v0.0.6...v0.0.7) (2025-06-08)


### Bug Fixes

* interpret an 8-bit and 16-bit value as signed & types improvements ([#16](https://github.com/xseman/lzma1/issues/16)) ([c053e8b](https://github.com/xseman/lzma1/commit/c053e8b541e9d07bc82542750ee236d04394e3ef))


### Maintenance

* speedup tests using Bun with Node compatible tests & other improvements ([592489a](https://github.com/xseman/lzma1/commit/592489aab23007d517aed20ce6ce4385abe03901))
* update copyright year and owner ([296ee0b](https://github.com/xseman/lzma1/commit/296ee0bbf991feac453d4e108b2a9f8b90ea7179))

## [0.0.6](https://github.com/xseman/lzma1/compare/v0.0.5...v0.0.6) (2025-03-29)


### Maintenance

* types, consistency, docs & tests ([#14](https://github.com/xseman/lzma1/issues/14)) ([2d354c1](https://github.com/xseman/lzma1/commit/2d354c1f85f29637258b801845678b4f3264fded))
* update deps & configs ([#12](https://github.com/xseman/lzma1/issues/12)) ([d55f8ef](https://github.com/xseman/lzma1/commit/d55f8ef47dbe5f4656a7dde6300fb32b151938e2))

## [0.0.5](https://github.com/xseman/lzma1/compare/v0.0.4...v0.0.5) (2024-12-10)


### Documentation

* update README & header diagram ([b92d4a6](https://github.com/xseman/lzma1/commit/b92d4a61dbe218cb2b850dafb6cba0beb3d4777f))


### Maintenance

* add pre-release workflow ([e6b2cba](https://github.com/xseman/lzma1/commit/e6b2cba3318134beebd3f68b8312f50bce083ce2))
* clean scripts ([267321a](https://github.com/xseman/lzma1/commit/267321a4148f7f6f57a26a8b45efcaa89861da3d))
* fix release config ([64dbfc8](https://github.com/xseman/lzma1/commit/64dbfc8e103594d9cd17b3f7c163e0ce405388bd))
* improve types & constants ([9f861f8](https://github.com/xseman/lzma1/commit/9f861f85ba88ba709207c98626271456d185da7c))
* improve types & formatting ([40e1755](https://github.com/xseman/lzma1/commit/40e1755ad77fbeb4cf23dc2e4c8db860c632a6ea))
* **release:** fix semantic version ([e38d229](https://github.com/xseman/lzma1/commit/e38d229e6a83a126a9cc1ed25df66e0bf6673bd5))
* update config ([455806d](https://github.com/xseman/lzma1/commit/455806df3fc19756adc23201b8fe31fe39df14c9))
* update workflows & configs ([d5ca705](https://github.com/xseman/lzma1/commit/d5ca705948d51091c130b203df7bb9a8382305ec))

## [0.0.4](https://github.com/xseman/lzma1/compare/v0.0.3...v0.0.4) (2024-11-27)


### Bug Fixes

* **ci:** release manifest file ([c08996a](https://github.com/xseman/lzma1/commit/c08996add442d4d33cc8c40d59f39d9c78ebbdb2))


### Documentation

* add test badge ([0acc7a2](https://github.com/xseman/lzma1/commit/0acc7a22ab2f47828c070178dd31383126796754))
* update README ([bb980ec](https://github.com/xseman/lzma1/commit/bb980ec475ad3bc816fa9b060eb93328942825d2))


### Continuous Integration

* add release workflow ([69b635b](https://github.com/xseman/lzma1/commit/69b635bb3f3889cd7cb9bdbf53af4db514679a7e))


### Maintenance

* **ci:** update inactive issues ([b1a1d74](https://github.com/xseman/lzma1/commit/b1a1d748800a5f7fa9673d0272fb1d899ce7fd75))
* improve types & restructure implementation ([#2](https://github.com/xseman/lzma1/issues/2)) ([0e7b7ff](https://github.com/xseman/lzma1/commit/0e7b7ff90b29d2e5fc1d490998058f6a920560a1))
* remove package-lock ([7f3a714](https://github.com/xseman/lzma1/commit/7f3a714bbc5c533423b3b0eb8da12231eacbf09a))
* run fmt ([2cea103](https://github.com/xseman/lzma1/commit/2cea103d6f4fd8b27b6c37be5fda208cd092f701))
* update configs ([e24f4ae](https://github.com/xseman/lzma1/commit/e24f4ae216d571472dc2321a86cb039319384d09))


### Testing

* add edge cases ([25dfc42](https://github.com/xseman/lzma1/commit/25dfc422676f50c45b09dde47a796064f1123cf6))
