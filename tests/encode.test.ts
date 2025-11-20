import { describe, it, expect } from 'vitest';
import { Buffer } from 'buffer';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encode,
  decode,
  createEncoderStream,
  encodeBlockHC,
  decodeBlock
} from '../src';
import { bufferEquals, chunkBuffer, pumpTransform } from './helpers/streams';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../data');
const decodedData = readFileSync(resolve(dataDir, 'test'));
const colladaText = readFileSync(resolve(dataDir, 'sphere.dae'), 'utf8');

async function encodeViaStream(
  data: Buffer,
  chunkSize: number,
  options?: Parameters<typeof createEncoderStream>[0]
): Promise<Buffer> {
  const chunks = chunkBuffer(data, chunkSize);
  const encoded = await pumpTransform(createEncoderStream(options), chunks);
  return Buffer.from(encoded);
}

describe('LZ4 encoder parity', () => {
  describe('sync', () => {
    it('encodes empty buffers', () => {
      const empty = Buffer.alloc(0);
      const encoded = encode(empty);
      const decoded = decode(encoded);
      expect(bufferEquals(decoded, empty)).toBe(true);
    });

    it('encodes string inputs', () => {
      const text = 'Test';
      const encoded = encode(text);
      const decoded = decode(encoded);
      expect(decoded.toString()).toBe(text);
    });

    it('encodes buffers with default mode', () => {
      const encoded = encode(decodedData);
      expect(bufferEquals(decode(encoded), decodedData)).toBe(true);
    });

    it('encodes collada text payloads', () => {
      const encoded = encode(colladaText);
      expect(decode(encoded).toString()).toBe(colladaText);
    });

    it('encodes buffers with high compression', () => {
      const encoded = encode(decodedData, { highCompression: true });
      expect(bufferEquals(decode(encoded), decodedData)).toBe(true);
    });

    it('performs HC block compression (#69)', () => {
      const str = 'a'.repeat(81) + 'XXXXXX' + 'a'.repeat(65531) + 'XXXXXXaaaaaa';
      const input = Buffer.from(str);
      const output = Buffer.alloc(input.length * 2);
      const compressedSize = encodeBlockHC(input, output);
      const compressed = output.subarray(0, compressedSize);

      const decoded = Buffer.alloc(input.length);
      const decodedSize = decodeBlock(compressed, decoded);
      expect(bufferEquals(input, decoded.subarray(0, decodedSize))).toBe(true);
    });
  });

  describe('async', () => {
    it('encodes via default stream settings', async () => {
      const encoded = await encodeViaStream(decodedData, decodedData.length);
      expect(bufferEquals(decode(encoded), decodedData)).toBe(true);
    });

    it('encodes with smaller chunk size', async () => {
      const encoded = await encodeViaStream(decodedData, 32 * 1024, { blockMaxSize: 64 << 10 });
      expect(bufferEquals(decode(encoded), decodedData)).toBe(true);
    });

    it('encodes with high compression stream', async () => {
      const encoded = await encodeViaStream(decodedData, 48 * 1024, { highCompression: true });
      expect(bufferEquals(decode(encoded), decodedData)).toBe(true);
    });

    it('encodes collada text via stream', async () => {
      const source = Buffer.from(colladaText, 'utf8');
      const encoded = await encodeViaStream(source, 32 * 1024);
      expect(decode(encoded).toString()).toBe(colladaText);
    });
  });
});
