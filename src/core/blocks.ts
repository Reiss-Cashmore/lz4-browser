import { Buffer } from 'buffer';
import { ensureBuffer, toBuffer } from '../env/buffer';
import * as binding from './binding';

ensureBuffer();

export function decodeBlock(
  input: Buffer,
  output: Buffer,
  startIdx?: number,
  endIdx?: number
): number {
  return binding.uncompress(toBuffer(input), toBuffer(output), startIdx, endIdx);
}

export function encodeBlock(
  input: Buffer,
  output: Buffer,
  startIdx?: number,
  endIdx?: number
): number {
  return binding.compress(toBuffer(input), toBuffer(output), startIdx, endIdx);
}

export function encodeBlockHC(
  input: Buffer,
  output: Buffer,
  startIdx?: number,
  endIdx?: number
): number {
  return binding.compressHC(toBuffer(input), toBuffer(output), startIdx, endIdx);
}

export function encodeBound(size: number): number {
  return binding.compressBound(size);
}
