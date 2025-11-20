import type { EncoderOptions } from './options';

export const MAGICNUMBER = 0x184d2204;
export const MAGICNUMBER_SKIPPABLE = 0x184d2a50;
export const EOS = 0;
export const VERSION = 1;

export const blockMaxSizes = [
  null,
  null,
  null,
  null,
  64 << 10,
  256 << 10,
  1 << 20,
  4 << 20
] as const;

export const STATES = {
  MAGIC: 0,
  DESCRIPTOR: 1,
  SIZE: 2,
  DICTID: 3,
  DESCRIPTOR_CHECKSUM: 4,
  DATABLOCK_SIZE: 5,
  DATABLOCK_DATA: 6,
  DATABLOCK_CHECKSUM: 7,
  DATABLOCK_UNCOMPRESS: 8,
  DATABLOCK_COMPRESS: 9,
  CHECKSUM: 10,
  CHECKSUM_UPDATE: 11,
  EOS: 90,
  SKIP_SIZE: 101,
  SKIP_DATA: 102
} as const;

export const SIZES = {
  MAGIC: 4,
  DESCRIPTOR: 2,
  SIZE: 8,
  DICTID: 4,
  DESCRIPTOR_CHECKSUM: 1,
  DATABLOCK_SIZE: 4,
  DATABLOCK_CHECKSUM: 4,
  CHECKSUM: 4,
  EOS: 4,
  SKIP_SIZE: 4
} as const;

export const defaultEncoderOptions: Required<EncoderOptions> = {
  blockIndependence: true,
  blockChecksum: false,
  blockMaxSize: 4 << 20,
  streamSize: false,
  streamChecksum: true,
  dict: false,
  dictId: 0,
  highCompression: false,
  useJS: true
};
