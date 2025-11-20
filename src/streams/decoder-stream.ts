import { FrameDecoder } from '../core/decoder';
import type { DecoderOptions } from '../core/options';
import { toBuffer } from '../env/buffer';

export function createDecoderStream(options?: DecoderOptions): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new FrameDecoder(options);
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const parts = decoder.consume(toBuffer(chunk));
      for (const part of parts) {
        controller.enqueue(part.subarray());
      }
    },
    flush(controller) {
      const tail = decoder.finalize();
      for (const part of tail) {
        controller.enqueue(part.subarray());
      }
    }
  });
}
