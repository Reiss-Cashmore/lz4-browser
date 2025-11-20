import { Buffer } from 'buffer';

export function bufferEquals(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.equals(b);
}

export function chunkBuffer(buffer: Buffer, chunkSize: number): Uint8Array[] {
  if (chunkSize <= 0) return [buffer];
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    chunks.push(buffer.subarray(offset, Math.min(buffer.length, offset + chunkSize)));
  }
  return chunks;
}

export async function collectReadable(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: finished } = await reader.read();
    if (finished) {
      done = true;
    } else if (value) {
      chunks.push(value);
    }
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export async function pumpTransform(
  transform: TransformStream<Uint8Array, Uint8Array>,
  inputs: Uint8Array[]
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  const outputPromise = collectReadable(transform.readable);
  for (const chunk of inputs) {
    await writer.write(chunk);
  }
  await writer.close();
  return outputPromise;
}
