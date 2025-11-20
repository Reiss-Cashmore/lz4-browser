import { readUInt32LE } from './byte-utils';

const CHECKSUM_SEED = 0;

const PRIME32_1 = 0x9e3779b1 >>> 0;
const PRIME32_2 = 0x85ebca77 >>> 0;
const PRIME32_3 = 0xc2b2ae3d >>> 0;
const PRIME32_4 = 0x27d4eb2f >>> 0;
const PRIME32_5 = 0x165667b1 >>> 0;

const STRIPE_LENGTH = 16;

const rotl = (value: number, bits: number): number =>
  ((value << bits) | (value >>> (32 - bits))) >>> 0;

const round = (acc: number, lane: number): number => {
  acc = (acc + Math.imul(lane, PRIME32_2)) >>> 0;
  acc = rotl(acc, 13);
  return Math.imul(acc, PRIME32_1) >>> 0;
};

export interface HashContext {
  update(bytes: Uint8Array): HashContext;
  digest(): number;
}

class XxHash32Context implements HashContext {
  private readonly seed: number;
  private totalLength = 0;
  private tail = new Uint8Array(STRIPE_LENGTH);
  private tailSize = 0;
  private acc1: number;
  private acc2: number;
  private acc3: number;
  private acc4: number;

  constructor(seed = CHECKSUM_SEED) {
    this.seed = seed >>> 0;
    this.acc1 = (this.seed + PRIME32_1 + PRIME32_2) >>> 0;
    this.acc2 = (this.seed + PRIME32_2) >>> 0;
    this.acc3 = (this.seed + 0) >>> 0;
    this.acc4 = (this.seed - PRIME32_1) >>> 0;
  }

  update(chunk: Uint8Array): HashContext {
    if (!chunk || chunk.length === 0) return this;

    let offset = 0;
    this.totalLength += chunk.length;

    if (this.tailSize + chunk.length < STRIPE_LENGTH) {
      this.tail.set(chunk, this.tailSize);
      this.tailSize += chunk.length;
      return this;
    }

    if (this.tailSize > 0) {
      const fill = STRIPE_LENGTH - this.tailSize;
      this.tail.set(chunk.subarray(0, fill), this.tailSize);
      this.processStripe(this.tail, 0);
      offset += fill;
      this.tailSize = 0;
    }

    const limit = chunk.length - STRIPE_LENGTH;
    while (offset <= limit) {
      this.processStripe(chunk, offset);
      offset += STRIPE_LENGTH;
    }

    if (offset < chunk.length) {
      this.tail.set(chunk.subarray(offset), 0);
      this.tailSize = chunk.length - offset;
    }

    return this;
  }

  digest(): number {
    let acc: number;

    if (this.totalLength >= STRIPE_LENGTH) {
      acc =
        rotl(this.acc1, 1) +
        rotl(this.acc2, 7) +
        rotl(this.acc3, 12) +
        rotl(this.acc4, 18);
      acc >>>= 0;
    } else {
      acc = (this.seed + PRIME32_5) >>> 0;
    }

    acc = (acc + this.totalLength) >>> 0;

    let offset = 0;
    while (offset + 4 <= this.tailSize) {
      const lane = readUInt32LE(this.tail, offset);
      acc = (acc + Math.imul(lane, PRIME32_3)) >>> 0;
      acc = rotl(acc, 17);
      acc = Math.imul(acc, PRIME32_4) >>> 0;
      offset += 4;
    }

    while (offset < this.tailSize) {
      const lane = this.tail[offset++];
      acc = (acc + Math.imul(lane, PRIME32_5)) >>> 0;
      acc = rotl(acc, 11);
      acc = Math.imul(acc, PRIME32_1) >>> 0;
    }

    acc ^= acc >>> 15;
    acc = Math.imul(acc, PRIME32_2) >>> 0;
    acc ^= acc >>> 13;
    acc = Math.imul(acc, PRIME32_3) >>> 0;
    acc ^= acc >>> 16;

    return acc >>> 0;
  }

  private processStripe(buffer: Uint8Array, offset: number): void {
    this.acc1 = round(this.acc1, readUInt32LE(buffer, offset));
    this.acc2 = round(this.acc2, readUInt32LE(buffer, offset + 4));
    this.acc3 = round(this.acc3, readUInt32LE(buffer, offset + 8));
    this.acc4 = round(this.acc4, readUInt32LE(buffer, offset + 12));
  }
}

const xxHash32 = (bytes: Uint8Array, seed = CHECKSUM_SEED): number => {
  const ctx = new XxHash32Context(seed);
  ctx.update(bytes);
  return ctx.digest() >>> 0;
};

export function descriptorChecksum(bytes: Uint8Array): number {
  const full = xxHash32(bytes, CHECKSUM_SEED) >>> 0;
  return (full >> 8) & 0xff;
}

export function blockChecksum(bytes: Uint8Array): number {
  return xxHash32(bytes, CHECKSUM_SEED) >>> 0;
}

export function createStreamChecksum(): HashContext {
  return new XxHash32Context(CHECKSUM_SEED);
}

export function updateStreamChecksum(
  ctx: HashContext,
  bytes: Uint8Array
): HashContext {
  return ctx.update(bytes);
}

export function finalizeStreamChecksum(ctx: HashContext): number {
  return ctx.digest() >>> 0;
}
