import { Buffer } from 'buffer';
import LZ4 from '../src';

const inputText = 'LZ4 browser rebuild demo data repeated '.repeat(5);
const input = new TextEncoder().encode(inputText);
const encoded = LZ4.encode(Buffer.from(input));
const decoded = LZ4.decode(encoded);

const output = document.createElement('pre');
output.textContent = `Original: ${input.length} bytes\nEncoded: ${encoded.length} bytes\nDecoded equals original: ${new TextDecoder().decode(decoded) === inputText}`;

document.body.appendChild(output);
