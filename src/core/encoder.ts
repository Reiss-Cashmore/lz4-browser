import { Buffer } from 'buffer';
import { ensureBuffer, toBuffer } from '../env/buffer';
import { MAGICNUMBER, EOS, VERSION, SIZES, blockMaxSizes, defaultEncoderOptions } from './constants';
import type { EncoderOptions } from './options';
import * as binding from './binding';
import {
  blockChecksum,
  descriptorChecksum,
  createStreamChecksum,
  finalizeStreamChecksum,
  updateStreamChecksum,
  type HashContext
} from '../shared/checksum';

ensureBuffer();

export type EncoderBinding = typeof binding;

export class FrameEncoder {
  private readonly options: Required<EncoderOptions>;
  private readonly descriptor: { flg: number; bd: number };
  private readonly binding: EncoderBinding;
  private isHeaderSent = false;
  private size = 0;
  private bufferedChunks: Buffer[] = [];
  private bufferedLength = 0;
  private checksumCtx: HashContext | null = null;

  constructor(options?: EncoderOptions) {
    this.options = { ...defaultEncoderOptions, ...options };
    const descriptorFlag =
      (VERSION << 6) |
      ((Number(this.options.blockIndependence) & 1) << 5) |
      ((Number(this.options.blockChecksum) & 1) << 4) |
      ((Number(this.options.streamSize) & 1) << 3) |
      ((Number(this.options.streamChecksum) & 1) << 2) |
      (Number(this.options.dict) & 1);

    const bdIdx = blockMaxSizes.indexOf(this.options.blockMaxSize as never);
    if (bdIdx < 0) {
      throw new Error(`Invalid blockMaxSize: ${this.options.blockMaxSize}`);
    }

    this.descriptor = { flg: descriptorFlag, bd: (bdIdx & 0x7) << 4 };
    this.binding = binding;
    this.checksumCtx = this.options.streamChecksum ? createStreamChecksum() : null;
  }

  public accumulate(data: Buffer): void {
    if (!data || data.length === 0) return;
    this.bufferedChunks.push(data);
    this.bufferedLength += data.length;
  }

  private emitHeader(): Buffer {
    const headerSize = this.headerSize();
    const out = Buffer.alloc(headerSize);
    out.writeUInt32LE(MAGICNUMBER, 0);
    let offset = SIZES.MAGIC;
    out.writeUInt8(this.descriptor.flg, offset);
    out.writeUInt8(this.descriptor.bd, offset + 1);
    offset += 2;

    if (this.options.streamSize) {
      const sizeBig = BigInt(this.size);
      const low = Number(sizeBig & BigInt(0xffffffff));
      const high = Number(sizeBig >> BigInt(32));
      out.writeUInt32LE(low >>> 0, offset);
      out.writeUInt32LE(high >>> 0, offset + 4);
      offset += SIZES.SIZE;
    }

    if (this.options.dict) {
      out.writeUInt32LE(this.options.dictId >>> 0, offset);
      offset += SIZES.DICTID;
    }

    const checksumSlice = out.subarray(offset, offset + 1);
    checksumSlice[0] = descriptorChecksum(out.subarray(SIZES.MAGIC, offset));
    this.isHeaderSent = true;
    return out;
  }

  private headerSize(): number {
    const streamSizeBytes = this.options.streamSize ? SIZES.SIZE : 0;
    const dictBytes = this.options.dict ? SIZES.DICTID : 0;
    return SIZES.MAGIC + SIZES.DESCRIPTOR + streamSizeBytes + dictBytes + SIZES.DESCRIPTOR_CHECKSUM;
  }

  private flushBlock(data: Buffer): Buffer {
    const blockChecksumSize = this.options.blockChecksum ? SIZES.DATABLOCK_CHECKSUM : 0;
    const maxCompressed = this.binding.compressBound(data.length);
    const target = Buffer.alloc(SIZES.DATABLOCK_SIZE + maxCompressed + blockChecksumSize);
    const compressed = target.subarray(SIZES.DATABLOCK_SIZE, SIZES.DATABLOCK_SIZE + maxCompressed);
    const encoder = this.options.highCompression ? this.binding.compressHC : this.binding.compress;
    const compressedSize = encoder(data, compressed);

    let payloadSize = compressedSize;
    if (compressedSize <= 0 || compressedSize > this.options.blockMaxSize) {
      payloadSize = data.length;
      target.writeUInt32LE((0x80000000 | payloadSize) >>> 0, 0);
      data.copy(target, SIZES.DATABLOCK_SIZE);
    } else {
      target.writeUInt32LE(payloadSize, 0);
      compressed.subarray(0, payloadSize).copy(target, SIZES.DATABLOCK_SIZE);
    }

    let sliceEnd = SIZES.DATABLOCK_SIZE + payloadSize;
    if (this.options.blockChecksum) {
      const checksum = blockChecksum(target.subarray(SIZES.DATABLOCK_SIZE, sliceEnd));
      target.writeUInt32LE(checksum >>> 0, sliceEnd);
      sliceEnd += SIZES.DATABLOCK_CHECKSUM;
    }

    if (this.options.streamChecksum && this.checksumCtx) {
      updateStreamChecksum(this.checksumCtx, data);
    }

    this.size += data.length;
    return target.subarray(0, sliceEnd);
  }

  public read(data?: Buffer): Buffer[] {
    if (data && data.length > 0) {
      this.accumulate(data);
    }

    const output: Buffer[] = [];
    if (!this.isHeaderSent) {
      output.push(this.emitHeader());
    }

    if (this.bufferedLength >= this.options.blockMaxSize) {
      const aggregate = Buffer.concat(this.bufferedChunks, this.bufferedLength);
      let offset = 0;
      while (aggregate.length - offset >= this.options.blockMaxSize) {
        const block = aggregate.subarray(offset, offset + this.options.blockMaxSize);
        output.push(this.flushBlock(block));
        offset += this.options.blockMaxSize;
      }

      const remainder = aggregate.subarray(offset);
      this.bufferedChunks = remainder.length ? [remainder] : [];
      this.bufferedLength = remainder.length;
    }

    return output;
  }

  public finalize(): Buffer {
    const parts: Buffer[] = [];
    if (!this.isHeaderSent) {
      parts.push(this.emitHeader());
    }

    if (this.bufferedLength > 0) {
      const block = Buffer.concat(this.bufferedChunks, this.bufferedLength);
      parts.push(this.flushBlock(block));
      this.bufferedChunks = [];
      this.bufferedLength = 0;
    }

    const footerSize = this.options.streamChecksum ? SIZES.EOS + SIZES.CHECKSUM : SIZES.EOS;
    const footer = Buffer.alloc(footerSize);
    footer.writeUInt32LE(EOS, 0);

    if (this.options.streamChecksum && this.checksumCtx) {
      const checksum = finalizeStreamChecksum(this.checksumCtx);
      footer.writeUInt32LE(checksum >>> 0, SIZES.EOS);
    }

    parts.push(footer);
    return Buffer.concat(parts);
  }
}

export function encode(input: Buffer, options?: EncoderOptions): Buffer {
  const buf = toBuffer(input);
  const encoder = new FrameEncoder(options);
  const chunks = encoder.read(buf);
  chunks.push(encoder.finalize());
  return Buffer.concat(chunks);
}
