export interface EncoderOptions {
  blockIndependence?: boolean;
  blockChecksum?: boolean;
  blockMaxSize?: number;
  streamSize?: boolean;
  streamChecksum?: boolean;
  dict?: boolean;
  dictId?: number;
  highCompression?: boolean;
  useJS?: boolean;
}

export interface DecoderOptions {
  useJS?: boolean;
}
