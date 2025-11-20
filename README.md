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

If you are working from a clone of this repo:

```sh
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

All scripts run from the project root:

| Script            | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `npm run dev`     | Launches the Vite playground under `examples/browser`.             |
| `npm run build`   | Produces the ESM bundle and type declarations via tsup.            |
| `npm run lint`    | ESLint (flat config) across sources, tests, and example scripts.   |
| `npm test`        | Full Vitest suite (streaming, block, checksum, JS bindings, etc.). |
| `npm run bench`   | Runs the Tinybench-powered block benchmark.                        |
| `npm run release` | Triggers semantic-release (normally executed in CI).               |

## Examples

- **Browser demos** live in `examples/browser` (compress, decompress, and pure JS
  binding playgrounds) and can be served via `npm run dev`.
- **Node CLI utilities** live in `examples/node` (`compress-file.mjs`,
  `decompress-file.mjs`, `block-playground.mjs`, and `js-binding.mjs`) to mirror
  the legacy scripts with modern ESM/TypeScript bindings.

## Release flow

Releases are fully automated via [semantic-release](https://semantic-release.gitbook.io/)
and the `Release` GitHub Actions workflow (`.github/workflows/release.yml`). On
every merge to `master`:

1. CI runs lint, test, and build.
2. semantic-release analyzes commit messages (Conventional Commit friendly, but
   fallback rules ensure **every** commit is captured).
3. Versions are bumped, `CHANGELOG.md` is rewritten (including an “All Commits”
   section), and the package is published to npm.
4. A Git tag and GitHub Release entry are created automatically, and the updated
   changelog/`package.json` are pushed back to `master`.

Maintainers can run `npm run release` locally if needed, but the recommended
path is to rely on the CI pipeline so publishing stays reproducible.

## Continuous Integration

GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests, and builds on every
push and pull request across Node 18, 20, and 22. A separate `release`
workflow handles semantic-release publishing against the `production`
environment, so npm tokens and GitHub releases stay managed in one place.

## Benchmarks

Run `npm run bench -- --time 500` to compare block encode/decode throughput with
buffer reuse vs. fresh allocations. The script loads `data/lorem_1mb.txt` by
default and prints Tinybench summary tables.

## License

MIT © Reiss Cashmore and contributors
