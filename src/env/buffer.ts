import { Buffer } from 'buffer';

export type BufferLike = Buffer | Uint8Array | ArrayBufferLike;

export function ensureBuffer(): typeof Buffer {
  if (typeof globalThis.Buffer === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).Buffer = Buffer;
  }
  return Buffer;
}

export function toBuffer(data: BufferLike): Buffer {
  const BufferCtor = ensureBuffer();
  if (BufferCtor.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return BufferCtor.from(new Uint8Array(data));
  }
  if (ArrayBuffer.isView(data)) {
    return BufferCtor.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return BufferCtor.from(data as Uint8Array);
}
