import { FrameEncoder } from '../core/encoder';
import type { EncoderOptions } from '../core/options';
import { toBuffer } from '../env/buffer';

export function createEncoderStream(options?: EncoderOptions): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new FrameEncoder(options);
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const parts = encoder.read(toBuffer(chunk));
      for (const part of parts) {
        controller.enqueue(part.subarray());
      }
    },
    flush(controller) {
      const footer = encoder.finalize();
      controller.enqueue(footer.subarray());
    }
  });
}
