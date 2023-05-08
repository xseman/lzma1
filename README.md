# lzma1

This is a simplified [fork][fork-link] of [Nathan Rugg's][fork-author] package.

The goal of this fork is to simplify and extract the minimal implementation for
my second project, I'm also trying to add as many typings as possible.

## Install

**npm registry**

```sh
npm install lzma1
```

**GitHub**

```sh
# same as latest released npm registry version
npm install xseman/lzma1#master

# latest unreleased changes
npm install xseman/lzma1#develop

# specific tag version
npm install xseman/lzma1#0.0.1
```

## API

```ts
compress(data: string | Uint8Array, mode?: Mode): Int8Array
decompress(bytearray: Uint8Array): Int8Array
```

## Usage

Compress and decompress a string with compression level 1.

```js
import { compress, decompress } from "lzma1"

const data = "Hello World!"
const compressed = compress(data, 1)
const decompressed = decompress(result)

// data === decompressed
```

[fork-link]: https://github.com/LZMA-JS/LZMA-JS
[fork-author]: https://github.com/nmrugg
