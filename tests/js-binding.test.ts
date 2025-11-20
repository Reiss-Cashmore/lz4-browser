import { describe, it, expect } from 'vitest';
import { Buffer } from 'buffer';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as jsBinding from '../src/core/binding';
import { bufferEquals } from './helpers/streams';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(resolve(__dirname, '../data/test'));

function roundtrip(data: Buffer): void {
  const maxSize = jsBinding.compressBound(data.length);
  const encoded = Buffer.alloc(maxSize);
  const encodedSize = jsBinding.compress(data, encoded);
  expect(encodedSize).toBeGreaterThan(0);

  const compressed = encoded.subarray(0, encodedSize);
  const decoded = Buffer.alloc(data.length);
  const decodedSize = jsBinding.uncompress(compressed, decoded);
  expect(decodedSize).toBeGreaterThan(0);
  expect(bufferEquals(data, decoded.subarray(0, decodedSize))).toBe(true);
}

describe('LZ4 JS binding compatibility', () => {
  it('encodes and decodes fixture data', () => {
    roundtrip(sample);
  });

  it('encodes and decodes inline payload', () => {
    const payload = Buffer.from(
      'R0lGODlhDAAMAIAAAGZmZv///yH5BAEAAAEALAAAAAAMAAwAAAIYjI8BmbBsHIwPSsXuPbrSj3QRKIrKYl4FADs='
    );
    roundtrip(payload);
  });
});
