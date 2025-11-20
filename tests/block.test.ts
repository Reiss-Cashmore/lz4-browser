import { describe, it, expect } from 'vitest';
import { Buffer } from 'buffer';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeBlock, decodeBlock, encodeBound } from '../src';
import { bufferEquals } from './helpers/streams';

const __dirname = dirname(fileURLToPath(import.meta.url));
const decodedData = readFileSync(resolve(__dirname, '../data/test'));

describe('LZ4 block encoder/decoder (compat)', () => {
  it('encodes and decodes a block roundtrip', () => {
    const encoded = Buffer.alloc(encodeBound(decodedData.length));
    const encodedSize = encodeBlock(decodedData, encoded);
    expect(encodedSize).toBeGreaterThan(0);
    const sliced = encoded.subarray(0, encodedSize);

    const output = Buffer.alloc(decodedData.length);
    const decodedSize = decodeBlock(sliced, output);
    expect(decodedSize).toBe(decodedData.length);
    expect(bufferEquals(output, decodedData)).toBe(true);
  });

  it('encodes short uncompressible strings', () => {
    const source = Buffer.from('Test');
    const target = Buffer.alloc(encodeBound(source.length));
    const encoded = encodeBlock(source, target);
    expect(encoded).toBeGreaterThanOrEqual(0);
  });

  it('supports non-zero output offsets', () => {
    const offset = 4;
    const encoded = Buffer.alloc(encodeBound(decodedData.length) + offset);
    const encodedSize = encodeBlock(decodedData, encoded, offset);
    expect(encodedSize).toBeGreaterThan(offset);

    const payload = encoded.subarray(offset, encodedSize);
    const decoded = Buffer.alloc(decodedData.length);
    const decodedSize = decodeBlock(payload, decoded);
    expect(decodedSize).toBe(decodedData.length);
    expect(bufferEquals(decoded, decodedData)).toBe(true);
  });
});
