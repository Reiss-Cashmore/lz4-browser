import { describe, it, expect } from 'vitest';
import { Buffer } from 'buffer';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, createDecoderStream } from '../src';
import { chunkBuffer, pumpTransform } from './helpers/streams';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../data');
const decodedData = readFileSync(resolve(dataDir, 'test')).toString().replace(/\r/g, '');
const decodedMedium = readFileSync(resolve(dataDir, 'test_medium')).toString().replace(/\r/g, '');
const colladaText = readFileSync(resolve(dataDir, 'sphere.dae')).toString();
const encodedData = readFileSync(resolve(dataDir, 'test.lz4'));
const encodedMedium = readFileSync(resolve(dataDir, 'test_medium.lz4'));
const encodedCollada = readFileSync(resolve(dataDir, 'sphere.lz4.dat'));

async function decodeViaStream(buffer: Buffer, chunkSize: number): Promise<Buffer> {
  const chunks = chunkBuffer(buffer, chunkSize);
  const decoded = await pumpTransform(createDecoderStream(), chunks);
  return Buffer.from(decoded);
}

describe('LZ4 decoder parity', () => {
  describe('sync', () => {
    it('decodes data', () => {
      const decoded = decode(encodedData);
      expect(decoded.toString()).toBe(decodedData);
    });

    it('decodes collada data encoded in Node', () => {
      const decoded = decode(encodedCollada);
      expect(decoded.toString()).toBe(colladaText);
    });
  });

  describe('async', () => {
    it('decodes data via stream', async () => {
      const decoded = await decodeViaStream(encodedData, encodedData.length);
      expect(decoded.toString()).toBe(decodedData);
    });

    it('decodes medium data with small chunks', async () => {
      const decoded = await decodeViaStream(encodedMedium, 1024);
      expect(decoded.toString()).toBe(decodedMedium);
    });

    it('decodes collada data via stream', async () => {
      const decoded = await decodeViaStream(encodedCollada, 2048);
      expect(decoded.toString()).toBe(colladaText);
    });
  });
});
