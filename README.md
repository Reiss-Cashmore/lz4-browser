# lz4-browser

Fast, modern, browser-ready LZ4 compression primitives with full parity to the
original `node-lz4` API. This rebuild ships a pure TypeScript core, ships ESM by
default, and targets both synchronous usage and streaming TransformStreams so
you can move buffers between Node.js, Service Workers, and modern browsers
without extra shims.

## Highlights

- ⚡️ **Native-quality performance in pure TypeScript** – block encoder/decoder
  logic mirrors the reference implementation and includes the improved `js-xxhash`
  streaming checksum pipeline.
- 🌐 **Browser-first design** – ships as ESM, re-exports a Buffer shim, and uses
  Web Streams (`TransformStream`) for async flows.
- 🔁 **Drop-in API compatibility** – exposes `encode`, `decode`,
  `createEncoderStream`, `createDecoderStream`, block helpers, and JS bindings
  that match the original project, making migration effortless.
- 🧪 **Comprehensive test suite** – Vitest replicas of the legacy mocha suite
  ensure byte-for-byte parity (including tricky checksum cases and JS bindings).
- 🛠️ **Modern tooling** – Vite playground, tsup bundling, Tinybench perf scripts,
  np-powered releases, and GitHub Actions CI covering Node 18/20/22.

## Installation

```sh
npm install lz4-browser
```

If you consume the sources directly inside this repo, install the dev
dependencies and build artifacts once:

```sh
cd rebuild
npm install
npm run build
```

## Quick start

```ts
import { encode, decode } from 'lz4-browser';

const input = new TextEncoder().encode('Hello from LZ4!');
const compressed = encode(Buffer.from(input));
const restored = decode(compressed);

console.log(new TextDecoder().decode(restored)); // "Hello from LZ4!"
```

### Streaming pipelines

`TransformStream` support mirrors the Node.js stream helpers but works in any
runtime with Web Streams:

```ts
import { createEncoderStream, createDecoderStream } from 'lz4-browser';

const encoder = createEncoderStream({ blockChecksum: true });
const decoder = createDecoderStream();

// Pipe readable input through encoder then decoder again
await readable
  .pipeThrough(encoder)
  .pipeThrough(decoder)
  .pipeTo(writable);
```

### Block helpers

Need to work at the raw block level? Use the exposed bindings:

```ts
import { encodeBlock, decodeBlock, encodeBound } from 'lz4-browser';

const source = Buffer.from('raw block data');
const target = Buffer.alloc(encodeBound(source.length));
const blockSize = encodeBlock(source, target);

const decoded = Buffer.alloc(source.length);
const decodedSize = decodeBlock(target.subarray(0, blockSize), decoded);
```

### Pure JS bindings

When you specifically need the JavaScript fallback implementation (for
diagnostics or deterministic output), import from `lz4-browser/core/binding`:

```ts
import { compress, uncompress } from 'lz4-browser/core/binding';
```

## Project scripts

All scripts run from the `rebuild/` directory:

| Script            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Launches the Vite browser demo in `examples/`.     |
| `npm run build`   | Bundles the ESM distribution via tsup.             |
| `npm run lint`    | ESLint (flat config) across sources and tests.     |
| `npm test`        | Vitest suite (encoders, decoders, JS bindings).    |
| `npm run bench`   | Tinybench-powered block benchmark.                 |
| `npm run release` | Runs `np` to bump versions and publish to npm.     |

## Release flow

Publishing uses [np](https://github.com/sindresorhus/np):

```sh
cd rebuild
npm run lint && npm test && npm run build
npm run release
```

`np` will ensure the working tree is clean, run the checks again, update the
version, tag the release, push to GitHub, and invoke `npm publish`.

## Continuous Integration

GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests, and builds on every
push and pull request across Node 18, 20, and 22. The workflow reuses npm caches
for fast turnaround and guarantees the published bundle matches CI output.

## Benchmarks

Run `npm run bench -- --time 500` to compare block encode/decode throughput with
buffer reuse vs. fresh allocations. The script loads `data/lorem_1mb.txt` by
default and prints Tinybench summary tables.

## License

MIT © Reiss Cashmore and contributors
