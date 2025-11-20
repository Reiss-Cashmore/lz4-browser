import { describe, it, expect } from 'vitest';
import { Buffer } from 'buffer';
import { encode, decode } from '../src';

function roundtrip(data: Buffer): void {
  const encoded = encode(data, { blockChecksum: true });
  const decoded = decode(encoded);
  expect(decoded.equals(data)).toBe(true);
}

describe('LZ4 checksum parity', () => {
  it('handles all-zero buffers', () => {
    const data = Buffer.alloc(200);
    data.fill(0);
    roundtrip(data);
  });

  it('handles constant byte buffers', () => {
    const data = Buffer.alloc(200);
    data.fill(16);
    roundtrip(data);
  });

  it('handles mixed halves', () => {
    const data = Buffer.alloc(200);
    data.subarray(0, 100).fill(0);
    data.subarray(100).fill(16);
    roundtrip(data);
  });

  it('handles short lorem payload (#107)', () => {
    const data = Buffer.from('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
    roundtrip(data);
  });
});
