import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../api/supabase';
import { CrashLogger } from './LoggingService';

/**
 * ImageUploadService
 * -------------------
 * Handles turning a locally-picked photo (from `expo-image-picker`, e.g. in
 * AddItemScreen) into a moderated, publicly-hosted URL suitable for
 * `GiftItem.imageUri`.
 *
 * Business rule: no image reaches permanent storage without first passing
 * an NSFW check. This service never talks to Supabase Storage directly —
 * it always compresses the image client-side (to keep upload size/cost
 * down, see the Supabase Storage cost discussion this was built from) and
 * then hands the bytes to the `moderate-and-upload-image` Edge Function,
 * which runs the actual moderation check and is the only thing with
 * permission to write to the `item-images` bucket. See
 * supabase/functions/moderate-and-upload-image/index.ts and
 * supabase/migrations/003_item_images_storage.sql for the server side of
 * this guarantee.
 */

// Resize target: wide enough to look good in the item list/detail views,
// small enough to keep upload size (and therefore both Supabase egress
// cost and the user's mobile data usage) low. See RetailerService/
// GiftItemRow for how images are actually displayed (thumbnail-sized).
const MAX_DIMENSION = 1200;
// JPEG quality 0-1. 0.7 is a standard "visually near-lossless but much
// smaller" compromise for photos.
const JPEG_QUALITY = 0.7;

/** Thrown when an image is rejected — `reason` distinguishes moderation
 * rejections (show the user a specific message) from generic failures. */
export class ImageUploadError extends Error {
  constructor(message: string, public reason: 'nsfw' | 'unavailable' | 'unknown') {
    super(message);
  }
}

export const ImageUploadService = {
  /**
   * Compresses the image at `localUri`, sends it to the moderation/upload
   * Edge Function, and returns the resulting public URL.
   *
   * @param localUri - A local file URI as returned by `expo-image-picker`
   *   (e.g. `file://...`).
   * @throws {ImageUploadError} with `reason: 'nsfw'` if the image is
   *   flagged by content moderation, `reason: 'unavailable'` if the
   *   moderation service couldn't be reached (fails closed — the image is
   *   never uploaded unmoderated), or `reason: 'unknown'` for any other
   *   failure (network error, storage failure, etc).
   */
  async uploadItemImage(localUri: string): Promise<string> {
    let base64: string | undefined;
    try {
      const context = ImageManipulator.manipulate(localUri).resize({ width: MAX_DIMENSION });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        compress: JPEG_QUALITY,
        format: SaveFormat.JPEG,
        base64: true,
      });
      base64 = saved.base64;
    } catch (error) {
      CrashLogger.error(error, 'ImageUploadService.compress');
      throw new ImageUploadError('Failed to process the selected image.', 'unknown');
    }

    if (!base64) {
      throw new ImageUploadError('Failed to process the selected image.', 'unknown');
    }

    const { data, error } = await supabase.functions.invoke<{ url: string }>(
      'moderate-and-upload-image',
      { body: { imageBase64: base64, contentType: 'image/jpeg' } },
    );

    if (error) {
      // `FunctionsHttpError.context` is the raw Response from the function;
      // parse it to recover the structured `{ error, message }` body the
      // function sends back (see moderate-and-upload-image/index.ts).
      const context = (error as { context?: Response }).context;
      let payload: { error?: string; message?: string } | null = null;
      try {
        payload = context ? await context.json() : null;
      } catch {
        payload = null;
      }

      if (payload?.error === 'nsfw_detected') {
        throw new ImageUploadError(
          payload.message ?? 'This image was flagged by our content filter.',
          'nsfw',
        );
      }
      if (payload?.error === 'moderation_unavailable') {
        throw new ImageUploadError(
          payload.message ?? 'Could not verify this image right now. Please try again.',
          'unavailable',
        );
      }

      CrashLogger.error(error, 'ImageUploadService.uploadItemImage');
      throw new ImageUploadError(payload?.message ?? 'Failed to upload image.', 'unknown');
    }

    if (!data?.url) {
      throw new ImageUploadError('Upload succeeded but no image URL was returned.', 'unknown');
    }
    return data.url;
  },
};
