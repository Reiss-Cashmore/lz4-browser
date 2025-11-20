#!/usr/bin/env node
/**
 * Demonstrates raw block encoding/decoding for scripts that need manual framing.
 */
import { Buffer } from 'buffer';
import { encodeBlock, decodeBlock, encodeBound } from '../../dist/index.js';

const message = process.argv[2] || 'Block-level APIs are handy for custom framing!';
const input = Buffer.from(message, 'utf8');

const target = Buffer.alloc(encodeBound(input.length));
const compressedSize = encodeBlock(input, target);
const sliced = target.subarray(0, compressedSize);

const decoded = Buffer.alloc(input.length);
const decodedSize = decodeBlock(sliced, decoded);

console.log('Input bytes:', input.length);
console.log('Compressed bytes:', compressedSize);
console.log('Decoded size matches:', decodedSize === input.length);
console.log('Decoded text:', decoded.toString('utf8'));
