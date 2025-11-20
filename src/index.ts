import { encode as encodeStream, FrameEncoder } from './core/encoder';
import { decode as decodeStream, FrameDecoder } from './core/decoder';
import { createEncoderStream } from './streams/encoder-stream';
import { createDecoderStream } from './streams/decoder-stream';
import { decodeBlock, encodeBlock, encodeBlockHC, encodeBound } from './core/blocks';
import type { EncoderOptions, DecoderOptions } from './core/options';
import { Buffer } from 'buffer';
import { ensureBuffer, toBuffer } from './env/buffer';

ensureBuffer();

export { FrameEncoder, FrameDecoder };
export { createEncoderStream, createDecoderStream };
export { encodeBlock, encodeBlockHC, decodeBlock, encodeBound };
export type { EncoderOptions, DecoderOptions };

export function encode(input: Buffer, options?: EncoderOptions): Buffer {
  return encodeStream(toBuffer(input), options);
}

export function decode(input: Buffer, options?: DecoderOptions): Buffer {
  return decodeStream(toBuffer(input), options);
}

const LZ4 = {
  encode,
  decode,
  createEncoderStream,
  createDecoderStream,
  encodeBlock,
  encodeBlockHC,
  decodeBlock,
  encodeBound
};

export default LZ4;
