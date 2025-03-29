# lzma1

This is a [fork][fork-link] of [Nathan Rugg's][fork-author] LZMA-JS package.

[fork-link]: https://github.com/LZMA-JS/LZMA-JS
[fork-author]: https://github.com/nmrugg

## Why

There are many LZMA implementations in JavaScript, but most are outdated,
unmaintained, lack type support, or rely on specific runtime APIs (e.g., Node.js
`Buffer`).

This version has been cleaned up, with TypeScript types added to make it easier
to read and maintain.

## Features

- Encode and decode LZMA streams
- Supports both string and Uint8Array data
- Supports both browser and Node.js environments
- Pure JavaScript implementation with TypeScript types
- No dependencies on runtime-specific APIs

## Installation

> [!NOTE]
> This package is native [ESM][mozzila-esm] and no longer provides a CommonJS
> export. If your project uses CommonJS, you will have to convert to ESM or use
> the dynamic [`import()`][mozzila-import] function.

[mozzila-esm]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
[mozzila-import]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import

### [npm](https://npmjs.com/lzma1)

```sh
npm install lzma1
```

### browser

```html
<script type="module">
	import { compress, decompress } from "https://esm.sh/lzma1@latest";
</script>
```

## Quick start

The library provides two main functions: `compress` and `decompress`:

```ts
compress(data: string | Uint8Array, mode?: Mode): Int8Array
decompress(data: Uint8Array | ArrayBuffer): string | Int8Array
```

### Compressing a string

```js
import {
	compress,
	decompress,
} from "lzma1";

const data = "Hello World!";
const compressed = compress(data, 1); // Using compression level 1 (fastest)
const decompressed = decompress(compressed);

// data === decompressed
```

### Working with binary data

```js
import {
	compress,
	decompress,
} from "lzma1";

// Compress binary data
const binaryData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
const compressed = compress(binaryData, 5); // Default compression level

// Decompress back to binary
const decompressed = decompress(compressed);
// decompressed will be an Int8Array
```

### HTML example

A simple browser example:

```html
<!DOCTYPE html>
<html>
<body>
    <textarea id="input">Hello World!</textarea><br>
    <button id="run">Compress & Decompress</button>>
    <div id="result"></div>

    <script type="module">
        import { compress, decompress } from "https://esm.sh/lzma1@latest";

        document.getElementById("run").onclick = () => {
            const text = document.getElementById("input").value;
            const compressed = compress(text);
            const decompressed = decompress(compressed);

            document.getElementById("result").innerHTML =
                `Original: ${text.length} bytes<br>` +
                `Compressed: ${compressed.length} bytes<br>` +
                `Result: ${decompressed}`;
        };
    </script>
</body>
</html>
```

### Advanced usage

You can control the compression level (1-9) to balance between speed and compression ratio:

```js
import { compress } from "lzma1";

// Fastest compression (level 1)
const fastCompressed = compress(data, 1);

// Balanced compression (level 5)
const balancedCompressed = compress(data, 5);

// Maximum compression (level 9)
const maxCompressed = compress(data, 9);
```

## How it works

LZMA (Lempel-Ziv-Markov chain Algorithm) is a compression algorithm that uses a
dictionary compression scheme. It's known for its high compression ratio and is
commonly used in the 7z archive format.

### LZMA header

The LZMA compressed data begins with a header that contains information needed for decompression:

![lzma](./docs/lzma.svg)

More [information][header_link] about the LZMA header structure.

[header_link]: https://docs.fileformat.com/compression/lzma/#lzma-header

## Related

- [7-Zip SDK](https://www.7-zip.org/sdk.html)
- [lzma-purejs](https://github.com/cscott/lzma-purejs)
- [lzmajs](https://github.com/glinscott/lzmajs)
- [lzma-purejs fork](https://github.com/mauron85/lzma-purejs/tree/master)
