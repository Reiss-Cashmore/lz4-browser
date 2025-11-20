#!/usr/bin/env node
/**
 * Uses the pure JavaScript binding directly, useful for consistent output.
 */
import { Buffer } from 'buffer';
import * as binding from '../../dist/core/binding.js';

const text = process.argv[2] || 'Hello from the JS fallback!';
const input = Buffer.from(text, 'utf8');

const maxSize = binding.compressBound(input.length);
const encoded = Buffer.alloc(maxSize);
const encodedSize = binding.compress(input, encoded);
const slice = encoded.subarray(0, encodedSize);

const decoded = Buffer.alloc(input.length);
const decodedSize = binding.uncompress(slice, decoded);

console.log('Original:', text);
console.log('Encoded bytes:', encodedSize);
console.log('Decoded equals original:', decoded.slice(0, decodedSize).equals(input));
