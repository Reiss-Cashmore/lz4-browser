#!/usr/bin/env node
/**
 * Decompress a file produced by the stream encoder.
 *
 * Usage: node decompress-file.mjs path/to/input.lz4 [path/to/output]
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { resolve, basename } from 'node:path';
import LZ4 from '../../dist/index.js';

const [, , inputArg, outputArg] = process.argv;
if (!inputArg) {
  console.error('Please provide an input .lz4 file.');
  process.exit(1);
}

const inputFile = resolve(process.cwd(), inputArg);
const outputFile = outputArg
  ? resolve(process.cwd(), outputArg)
  : inputFile.replace(/\.lz4$/i, '') || `${inputFile}.decoded`;

console.log(`📦 Decompressing ${basename(inputFile)} → ${basename(outputFile)}...`);

const decoder = LZ4.createDecoderStream();
const start = performance.now();

decoder.on('end', () => {
  const ms = (performance.now() - start).toFixed(2);
  console.log(`✅ Done (${ms}ms)`);
});

createReadStream(inputFile).pipe(decoder).pipe(createWriteStream(outputFile));
