declare module 'pixelmatch' {
  interface PixelmatchOptions {
    /** Matching threshold (0 to 1); smaller is more sensitive. Default: 0.1 */
    threshold?: number;
    /** If true, disables detecting and ignoring anti-aliased pixels. Default: false */
    includeAA?: boolean;
    /** Blending factor of unchanged pixels in the diff output. Default: 0.1 */
    alpha?: number;
    /** The color of differing pixels in the diff output. [R, G, B] */
    diffColor?: [number, number, number];
    /** An alternative color to use for dark on light differences to differentiate. */
    diffColorAlt?: [number, number, number];
    /** If true, masks the output with diff pixels only. Default: false */
    diffMask?: boolean;
  }

  /**
   * Compares two images pixel by pixel.
   * @param img1 - First image data (Uint8Array or Uint8ClampedArray)
   * @param img2 - Second image data (Uint8Array or Uint8ClampedArray)
   * @param output - Output diff image data (can be null)
   * @param width - Image width
   * @param height - Image height
   * @param options - Comparison options
   * @returns Number of mismatched pixels
   */
  function pixelmatch(
    img1: Uint8Array | Uint8ClampedArray | Buffer,
    img2: Uint8Array | Uint8ClampedArray | Buffer,
    output: Uint8Array | Uint8ClampedArray | Buffer | null,
    width: number,
    height: number,
    options?: PixelmatchOptions
  ): number;

  export = pixelmatch;
}
