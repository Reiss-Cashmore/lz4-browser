import { describe, it, expect } from 'vitest';
import { Buffer } from 'buffer';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import LZ4, {
  encode,
  decode,
  createEncoderStream,
  createDecoderStream,
  encodeBlock,
  encodeBlockHC,
  decodeBlock,
  encodeBound
} from '../src';
import { bufferEquals, chunkBuffer, pumpTransform } from './helpers/streams';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../data');
const sample = readFileSync(resolve(dataDir, 'test'));
const legacyArchive = readFileSync(resolve(dataDir, 'test.lz4'));
const savePath = resolve(__dirname, '../examples/data/save.hg');

const BLOCK_MAGIC = 0xfeeda1e5;

function uint32(buffer: Buffer, offset = 0): number {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  ) >>> 0;
}

function decodeSavePayload(buffer: Buffer): Buffer {
  let pos = 0;
  const chunks: Buffer[] = [];
  while (pos < buffer.length) {
    const magic = uint32(buffer, pos);
    if (magic !== BLOCK_MAGIC) {
      throw new Error(`Unexpected block magic ${magic.toString(16)}`);
    }
    const compressedSize = uint32(buffer, pos + 4);
    const uncompressedSize = uint32(buffer, pos + 8);
    pos += 16;
    const compressedBlock = buffer.subarray(pos, pos + compressedSize);
    pos += compressedSize;

    const target = Buffer.alloc(uncompressedSize);
    const decodedSize = decodeBlock(compressedBlock, target);
    if (decodedSize !== uncompressedSize) {
      throw new Error(`Decoded ${decodedSize} bytes, expected ${uncompressedSize}`);
    }
    chunks.push(target);
  }
  return Buffer.concat(chunks);
}

describe('LZ4 rebuild API', () => {
  it('decodes legacy data', () => {
    const decoded = decode(legacyArchive);
    expect(bufferEquals(decoded, sample)).toBe(true);
  });

  it('encodes and decodes buffers synchronously', () => {
    const encoded = encode(sample);
    const decoded = decode(encoded);
    expect(bufferEquals(decoded, sample)).toBe(true);
  });

  it('handles block helpers', () => {
    const bound = encodeBound(sample.length);
    const output = Buffer.alloc(bound);
    const blockSize = encodeBlock(sample, output);
    expect(blockSize).toBeGreaterThan(0);
    const decoded = Buffer.alloc(sample.length);
    const decodedSize = decodeBlock(output.subarray(0, blockSize), decoded);
    expect(decodedSize).toBe(sample.length);
    expect(bufferEquals(decoded.subarray(0, decodedSize) as Buffer, sample)).toBe(true);

    const hcOutput = Buffer.alloc(bound);
    const hcSize = encodeBlockHC(sample, hcOutput);
    expect(hcSize).toBeGreaterThan(0);
  });

  it('streams through TransformStream pipeline', async () => {
    const chunkSize = 1024;
    const chunks = chunkBuffer(sample, chunkSize);

    const encoded = await pumpTransform(createEncoderStream(), chunks);
    const decoded = await pumpTransform(createDecoderStream(), [encoded]);
    expect(bufferEquals(Buffer.from(decoded), sample)).toBe(true);
  });

  it('exposes namespace API', () => {
    const encoded = LZ4.encode(sample);
    expect(bufferEquals(LZ4.decode(encoded), sample)).toBe(true);
  });

  it('decodes save.hg into structured JSON', () => {
    const saveBytes = readFileSync(savePath);
    const payload = decodeSavePayload(saveBytes);
    const jsonText = payload.toString('utf8').replace(/\0+$/, '');
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    console.log(parsed);
    expect(parsed).toHaveProperty('XTp', 'Main');
    expect(parsed).toHaveProperty('F2P');
  });
});
