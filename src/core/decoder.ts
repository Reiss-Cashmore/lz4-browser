import { Buffer } from 'buffer';
import { ensureBuffer, toBuffer } from '../env/buffer';
import { MAGICNUMBER, MAGICNUMBER_SKIPPABLE, EOS, SIZES, STATES, blockMaxSizes, VERSION } from './constants';
import type { DecoderOptions } from './options';
import * as binding from './binding';
import {
  blockChecksum,
  descriptorChecksum,
  createStreamChecksum,
  finalizeStreamChecksum,
  updateStreamChecksum,
  type HashContext
} from '../shared/checksum';
import { readUInt32LE } from '../shared/byte-utils';

ensureBuffer();

type StateValue = (typeof STATES)[keyof typeof STATES];

interface Descriptor {
  blockIndependence: boolean;
  blockChecksum: boolean;
  blockMaxSize: number;
  streamSize: boolean;
  streamChecksum: boolean;
  dict: boolean;
  dictId: number;
}

export class FrameDecoder {
  private readonly options: DecoderOptions;
  private readonly binding = binding;
  private buffer: Buffer | null = null;
  private pos = 0;
  private descriptor: Descriptor | null = null;
  private state: StateValue = STATES.MAGIC;
  private notEnoughData = false;
  private descriptorStart = 0;
  private streamSize: Buffer | null = null;
  private dictId: number | null = null;
  private streamChecksumCtx: HashContext | null = null;
  private dataBlockSize = 0;
  private skippableSize = 0;

  constructor(options?: DecoderOptions) {
    this.options = options || {};
  }

  public consume(data: Buffer): Buffer[] {
    const chunks: Buffer[] = [];

    if (this.skippableSize > 0) {
      this.skippableSize -= data.length;
      if (this.skippableSize > 0) {
        return chunks;
      }
      data = data.subarray(-this.skippableSize);
      this.skippableSize = 0;
      this.state = STATES.MAGIC;
    }

    if (this.buffer) {
      this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length);
    } else {
      this.buffer = data;
    }

    let loopGuard = true;
    while (loopGuard && this.buffer && this.pos < this.buffer.length) {
      switch (this.state) {
        case STATES.MAGIC:
          loopGuard = !this.readMagicNumber();
          break;
        case STATES.SKIP_SIZE:
          loopGuard = !this.readSkippableSize();
          break;
        case STATES.DESCRIPTOR:
          loopGuard = !this.readDescriptor();
          break;
        case STATES.SIZE:
          loopGuard = !this.readSize();
          break;
        case STATES.DICTID:
          loopGuard = !this.readDictId();
          break;
        case STATES.DESCRIPTOR_CHECKSUM:
          loopGuard = !this.readDescriptorChecksum();
          break;
        case STATES.DATABLOCK_SIZE:
          loopGuard = !this.readDataBlockSize();
          break;
        case STATES.DATABLOCK_DATA:
          loopGuard = !this.readDataBlockData();
          break;
        case STATES.DATABLOCK_CHECKSUM:
          loopGuard = !this.readDataBlockChecksum();
          break;
        case STATES.DATABLOCK_UNCOMPRESS: {
          const block = this.uncompressDataBlock();
          if (block) {
            chunks.push(block);
            loopGuard = true;
          } else {
            loopGuard = false;
          }
          break;
        }
        case STATES.EOS:
          loopGuard = !this.readEOS();
          break;
        default:
          loopGuard = false;
      }
    }

    if (this.buffer && this.pos > 0) {
      this.buffer = this.buffer.subarray(this.pos);
      this.pos = 0;
    }

    return chunks;
  }

  public finalize(): Buffer[] {
    this.notEnoughData = true;
    return this.consume(Buffer.alloc(0));
  }

  private checkSize(size: number): boolean {
    if (!this.buffer) return true;
    const delta = this.buffer.length - this.pos;
    if (delta <= 0 || delta < size) {
      if (this.notEnoughData) {
        throw new Error('Unexpected end of LZ4 stream');
      }
      return true;
    }
    this.pos += size;
    return false;
  }

  private readMagicNumber(): boolean {
    if (!this.buffer) return true;
    const posSnapshot = this.pos;
    if (this.checkSize(SIZES.MAGIC)) return true;
    const magic = readUInt32LE(this.buffer, posSnapshot);
    if ((magic & 0xfffffff0) === MAGICNUMBER_SKIPPABLE) {
      this.state = STATES.SKIP_SIZE;
      return false;
    }
    if (magic !== MAGICNUMBER) {
      throw new Error(`Invalid magic number: ${magic.toString(16).toUpperCase()}`);
    }
    this.state = STATES.DESCRIPTOR;
    return false;
  }

  private readSkippableSize(): boolean {
    if (!this.buffer) return true;
    if (this.checkSize(SIZES.SKIP_SIZE)) return true;
    this.skippableSize = readUInt32LE(this.buffer, this.pos - SIZES.SKIP_SIZE);
    this.state = STATES.SKIP_DATA;
    if (this.skippableSize === 0) {
      this.state = STATES.MAGIC;
    }
    return false;
  }

  private readDescriptor(): boolean {
    if (!this.buffer) return true;
    const start = this.pos;
    if (this.checkSize(SIZES.DESCRIPTOR)) return true;

    this.descriptorStart = start;
    const descriptorFlg = this.buffer[start];
    const version = descriptorFlg >> 6;
    if (version !== VERSION) {
      throw new Error(`Invalid version: ${version} != ${VERSION}`);
    }
    if ((descriptorFlg >> 1) & 0x1) {
      throw new Error('Reserved bit set');
    }

    const blockMaxSizeIndex = (this.buffer[start + 1] >> 4) & 0x7;
    const blockMaxSize = blockMaxSizes[blockMaxSizeIndex];
    if (!blockMaxSize) {
      throw new Error(`Invalid block max size: ${blockMaxSizeIndex}`);
    }

    this.descriptor = {
      blockIndependence: Boolean((descriptorFlg >> 5) & 0x1),
      blockChecksum: Boolean((descriptorFlg >> 4) & 0x1),
      blockMaxSize,
      streamSize: Boolean((descriptorFlg >> 3) & 0x1),
      streamChecksum: Boolean((descriptorFlg >> 2) & 0x1),
      dict: Boolean(descriptorFlg & 0x1),
      dictId: 0
    };

    if (this.descriptor.streamChecksum) {
      this.streamChecksumCtx = createStreamChecksum();
    } else {
      this.streamChecksumCtx = null;
    }

    this.state = STATES.SIZE;
    return false;
  }

  private readSize(): boolean {
    if (!this.buffer || !this.descriptor) return true;
    if (this.descriptor.streamSize) {
      if (this.checkSize(SIZES.SIZE)) return true;
      this.streamSize = this.buffer.subarray(this.pos - SIZES.SIZE, this.pos);
    }
    this.state = STATES.DICTID;
    return false;
  }

  private readDictId(): boolean {
    if (!this.buffer || !this.descriptor) return true;
    if (this.descriptor.dict) {
      if (this.checkSize(SIZES.DICTID)) return true;
      this.dictId = readUInt32LE(this.buffer, this.pos - SIZES.DICTID);
    }
    this.state = STATES.DESCRIPTOR_CHECKSUM;
    return false;
  }

  private readDescriptorChecksum(): boolean {
    if (!this.buffer) return true;
    const checksumPos = this.pos;
    if (this.checkSize(SIZES.DESCRIPTOR_CHECKSUM)) return true;
    const checksum = this.buffer[checksumPos];
    const descriptorBytes = this.buffer.subarray(this.descriptorStart, checksumPos);
    const current = descriptorChecksum(descriptorBytes);
    if (checksum !== current) {
      throw new Error('Invalid stream descriptor checksum');
    }
    this.state = STATES.DATABLOCK_SIZE;
    return false;
  }

  private readDataBlockSize(): boolean {
    if (!this.buffer) return true;
    if (this.checkSize(SIZES.DATABLOCK_SIZE)) return true;
    this.dataBlockSize = readUInt32LE(this.buffer, this.pos - SIZES.DATABLOCK_SIZE);
    if (this.dataBlockSize === EOS) {
      this.state = STATES.EOS;
      return false;
    }
    this.state = STATES.DATABLOCK_DATA;
    return false;
  }

  private readDataBlockData(): boolean {
    if (!this.buffer) return true;
    let size = this.dataBlockSize;
    if (size & 0x80000000) {
      size &= 0x7fffffff;
    }
    if (this.checkSize(size)) return true;
    this.state = STATES.DATABLOCK_CHECKSUM;
    return false;
  }

  private readDataBlockChecksum(): boolean {
    if (!this.buffer || !this.descriptor) return true;
    if (this.descriptor.blockChecksum) {
      if (this.checkSize(SIZES.DATABLOCK_CHECKSUM)) return true;
      const checksum = readUInt32LE(this.buffer, this.pos - SIZES.DATABLOCK_CHECKSUM);
      const start = this.pos - SIZES.DATABLOCK_CHECKSUM - (this.dataBlockSize & 0x7fffffff);
      const block = this.buffer.subarray(start, this.pos - SIZES.DATABLOCK_CHECKSUM);
      const current = blockChecksum(block);
      if (checksum !== current) {
        throw new Error('Invalid block checksum');
      }
    }
    this.state = STATES.DATABLOCK_UNCOMPRESS;
    return false;
  }

  private uncompressDataBlock(): Buffer | null {
    if (!this.buffer || !this.descriptor) return null;
    let isUncompressed = false;
    let size = this.dataBlockSize;
    if (size & 0x80000000) {
      isUncompressed = true;
      size &= 0x7fffffff;
    }
    const checksumBytes = this.descriptor.blockChecksum ? SIZES.DATABLOCK_CHECKSUM : 0;
    const endPos = this.pos - checksumBytes;
    const startPos = endPos - size;
    const dataBlock = this.buffer.subarray(startPos, endPos);
    let output: Buffer;
    if (isUncompressed) {
      output = Buffer.from(dataBlock);
    } else {
      const target = Buffer.alloc(this.descriptor.blockMaxSize);
      const decodedSize = this.binding.uncompress(dataBlock, target);
      if (decodedSize < 0) {
        throw new Error(`Invalid data block: ${-decodedSize}`);
      }
      output = decodedSize < this.descriptor.blockMaxSize ? target.subarray(0, decodedSize) : target;
    }

    if (this.descriptor.streamChecksum && this.streamChecksumCtx) {
      updateStreamChecksum(this.streamChecksumCtx, output);
    }

    this.state = STATES.DATABLOCK_SIZE;
    return output;
  }

  private readEOS(): boolean {
    if (!this.buffer || !this.descriptor) return true;
    if (this.descriptor.streamChecksum && this.streamChecksumCtx) {
      if (this.checkSize(SIZES.EOS)) return true;
      const checksum = readUInt32LE(this.buffer, this.pos - SIZES.EOS);
      const current = finalizeStreamChecksum(this.streamChecksumCtx);
      if (checksum !== current) {
        throw new Error(`Invalid stream checksum: ${checksum.toString(16).toUpperCase()}`);
      }
    }
    this.state = STATES.MAGIC;
    return false;
  }
}

export function decode(input: Buffer, options?: DecoderOptions): Buffer {
  const decoder = new FrameDecoder(options);
  const chunks = decoder.consume(toBuffer(input));
  const tail = decoder.finalize();
  return Buffer.concat([...chunks, ...tail]);
}
