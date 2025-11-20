#!/usr/bin/env node
/**
 * Stream a file through the modern LZ4 encoder.
 *
 * Usage: node compress-file.mjs path/to/input.txt [path/to/output.lz4]
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import LZ4 from '../../dist/index.js';

const [, , inputArg, outputArg] = process.argv;
if (!inputArg) {
  console.error('Please provide an input file.');
  process.exit(1);
}

const inputFile = resolve(process.cwd(), inputArg);
const outputFile = outputArg
  ? resolve(process.cwd(), outputArg)
  : `${inputFile}${LZ4.extension || '.lz4'}`;

console.log(`🗜️ Compressing ${basename(inputFile)} → ${basename(outputFile)}...`);

const start = performance.now();
const encoder = LZ4.createEncoderStream();
const input = createReadStream(inputFile);
const output = createWriteStream(outputFile);

encoder.on('end', () => {
  const ms = (performance.now() - start).toFixed(2);
  const size = statSync(inputFile).size;
  const mbps = ((size / (parseFloat(ms) / 1000)) / (1 << 20)).toFixed(2);
  console.log(`✅ Done (${size.toLocaleString()} bytes in ${ms}ms · ${mbps} MB/s)`);
});

input.pipe(encoder).pipe(output);
