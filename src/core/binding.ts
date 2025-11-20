const maxInputSize = 0x7e000000;
const minMatch = 4;
const hashLog = 16;
const hashShift = minMatch * 8 - hashLog;
const hashSize = 1 << hashLog;
const copyLength = 8;
const mfLimit = copyLength + minMatch;
const skipStrength = 6;
const mlBits = 4;
const mlMask = (1 << mlBits) - 1;
const runBits = 8 - mlBits;
const runMask = (1 << runBits) - 1;
const hasher = 2654435761;

export function uncompress(
  input: Uint8Array,
  output: Uint8Array,
  startIdx = 0,
  endIdx = input.length
): number {
  let writeIndex = 0;
  let readIndex = startIdx;

  while (readIndex < endIdx) {
    const token = input[readIndex++];

    let literalLength = token >> 4;
    if (literalLength > 0) {
      let len = literalLength + 240;
      while (len === 255) {
        len = input[readIndex++];
        literalLength += len;
      }

      const literalEnd = readIndex + literalLength;
      while (readIndex < literalEnd) {
        output[writeIndex++] = input[readIndex++];
      }

      if (readIndex === endIdx) {
        return writeIndex;
      }
    }

    const offset = input[readIndex++] | (input[readIndex++] << 8);
    if (offset === 0 || offset > writeIndex) {
      return -(readIndex - 2);
    }

    let matchLength = token & 0xf;
    let len = matchLength + 240;
    while (len === 255) {
      len = input[readIndex++];
      matchLength += len;
    }

    let matchPos = writeIndex - offset;
    const end = writeIndex + matchLength + 4;
    while (writeIndex < end) {
      output[writeIndex++] = output[matchPos++];
    }
  }

  return writeIndex;
}

export function compressBound(size: number): number {
  if (size > maxInputSize) return 0;
  return (size + size / 255 + 16) | 0;
}

export function compress(
  src: Uint8Array,
  dst: Uint8Array,
  startIdx = 0,
  endIdx = dst.length
): number {
  const hashTable = new Int32Array(hashSize);
  hashTable.fill(0);
  return compressBlock(src, dst, 0, hashTable, startIdx, endIdx);
}

export const compressHC = compress;
export const compressDependent = compressBlock;

function compressBlock(
  src: Uint8Array,
  dst: Uint8Array,
  pos: number,
  hashTable: Int32Array,
  startIdx: number,
  endIdx: number
): number {
  let dpos = startIdx;
  const dlen = endIdx - startIdx;
  let anchor = 0;

  if (src.length >= maxInputSize) {
    throw new Error('input too large');
  }

  if (src.length > mfLimit) {
    const maxBound = compressBound(src.length);
    if (dlen < maxBound) {
      throw new Error(`output too small: ${dlen} < ${maxBound}`);
    }

    let step = 1;
    let findMatchAttempts = (1 << skipStrength) + 3;
    const srcLimit = src.length - mfLimit;

    while (pos + minMatch < srcLimit) {
      const sequenceLow = (src[pos + 1] << 8) | src[pos];
      const sequenceHigh = (src[pos + 3] << 8) | src[pos + 2];
      const hash = Math.imul(sequenceLow | (sequenceHigh << 16), hasher) >>> hashShift;
      const ref = (hashTable[hash] | 0) - 1;
      hashTable[hash] = pos + 1;

      if (
        ref < 0 ||
        ((pos - ref) >>> 16) > 0 ||
        src[ref] !== src[pos] ||
        src[ref + 1] !== src[pos + 1] ||
        src[ref + 2] !== src[pos + 2] ||
        src[ref + 3] !== src[pos + 3]
      ) {
        step = (findMatchAttempts++ >> skipStrength) >>> 0;
        pos += step;
        continue;
      }

      findMatchAttempts = (1 << skipStrength) + 3;
      const literalsLength = pos - anchor;
      const offset = pos - ref;
      pos += minMatch;
      let refPos = ref + minMatch;

      const matchLengthMarker = pos;
      while (pos < srcLimit && src[pos] === src[refPos]) {
        pos++;
        refPos++;
      }

      let matchLength = pos - matchLengthMarker;
      const token = matchLength < mlMask ? matchLength : mlMask;

      if (literalsLength >= runMask) {
        dst[dpos++] = (runMask << mlBits) + token;
        let len = literalsLength - runMask;
        while (len > 254) {
          dst[dpos++] = 255;
          len -= 255;
        }
        dst[dpos++] = len;
      } else {
        dst[dpos++] = (literalsLength << mlBits) + token;
      }

      for (let i = 0; i < literalsLength; i++) {
        dst[dpos++] = src[anchor + i];
      }

      dst[dpos++] = offset & 0xff;
      dst[dpos++] = (offset >>> 8) & 0xff;

      if (matchLength >= mlMask) {
        matchLength -= mlMask;
        while (matchLength >= 255) {
          matchLength -= 255;
          dst[dpos++] = 255;
        }
        dst[dpos++] = matchLength;
      }

      anchor = pos;
    }
  }

  if (anchor === 0) {
    return 0;
  }

  const literalsLength = src.length - anchor;
  if (literalsLength >= runMask) {
    dst[dpos++] = runMask << mlBits;
    let len = literalsLength - runMask;
    while (len > 254) {
      dst[dpos++] = 255;
      len -= 255;
    }
    dst[dpos++] = len;
  } else {
    dst[dpos++] = literalsLength << mlBits;
  }

  let posCopy = anchor;
  while (posCopy < src.length) {
    dst[dpos++] = src[posCopy++];
  }

  return dpos;
}
