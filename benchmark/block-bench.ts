#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bench } from 'tinybench';
import { encodeBlock, decodeBlock, encodeBound } from '../src';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultInput = resolve(repoRoot, 'data', 'lorem_1mb.txt');

interface CliOptions {
  inputPath: string;
  time: number;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  let inputPath = defaultInput;
  let time = 1000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--time=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) time = value;
    } else if (arg === '--time' && i + 1 < args.length) {
      const value = Number(args[++i]);
      if (!Number.isNaN(value) && value > 0) time = value;
    } else if (!arg.startsWith('--')) {
      inputPath = resolve(process.cwd(), arg);
    }
  }

  return { inputPath, time };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

async function main() {
  const options = parseCliArgs();
  console.log(`📥 Loading input: ${options.inputPath}`);
  const input = await readFile(options.inputPath);
  console.log(`   Size: ${formatBytes(input.length)}`);

  const maxCompressed = encodeBound(input.length);
  const encodeBuffer = Buffer.alloc(maxCompressed);
  const decodeBuffer = Buffer.alloc(input.length);
  const warmupSize = encodeBlock(input, encodeBuffer);
  const warmupCompressed = encodeBuffer.subarray(0, warmupSize);

  const bench = new Bench({ name: 'lz4-browser encode/decode', time: options.time });

  bench
    .add('encodeBlock (new buffer)', () => {
      const temp = Buffer.alloc(maxCompressed);
      encodeBlock(input, temp);
    })
    .add('encodeBlock (reuse buffer)', () => {
      encodeBlock(input, encodeBuffer);
    })
    .add('decodeBlock (warmup payload)', () => {
      decodeBlock(warmupCompressed, decodeBuffer);
    })
    .add('roundtrip (new buffers)', () => {
      const tempEncode = Buffer.alloc(maxCompressed);
      const encodedSize = encodeBlock(input, tempEncode);
      const tempCompressed = tempEncode.subarray(0, encodedSize);
      const tempDecode = Buffer.alloc(input.length);
      decodeBlock(tempCompressed, tempDecode);
    });

  bench.addEventListener('cycle', (event) => {
    const task = event.task;
    if (!task?.result) return;
    const { name, result } = task;
    const hz = result.hz.toFixed(2);
    const rme = result.rme.toFixed(2);
    console.log(`➡️  ${name}: ${hz} ops/sec ±${rme}% (${result.samples.length} samples)`);
  });

  console.log(`🏃 Running benchmarks for ~${options.time}ms per task...`);
  await bench.run();

  console.log('\nSummary');
  console.table(bench.table());
}

await main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exitCode = 1;
});
