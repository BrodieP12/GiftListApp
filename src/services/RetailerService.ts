import { supabase } from '../api/supabase';
import { CrashLogger } from './LoggingService';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * RetailerService
 * ---------------
 * Auto-fills the "add gift item" form by scraping product metadata
 * (title, price, image, description) from a retailer URL the user pastes
 * in. The actual scraping happens server-side via a Supabase Edge Function
 * (`extractProduct`), not on-device — retailer sites commonly block
 * scraping from mobile app user agents/IPs, so the request is proxied
 * through Supabase's backend instead.
 *
 * This service is intentionally best-effort: any failure (invalid URL,
 * scrape error, edge function timeout) resolves to an empty `ScrapedData`
 * object rather than throwing, so the user can always fall back to typing
 * the item details in manually instead of being blocked by a broken
 * scrape.
 */

export interface ProductMatchCandidate {
  title: string;
  url: string;
  retailer: string;
  price: number | null;
  description: string | null;
  image: string | null;
  snippet: string;
}

export interface FindListingResponse {
  searchQuery: string;
  bestMatch: ProductMatchCandidate | null;
  candidates: ProductMatchCandidate[];
}
export interface ScrapedData {
  title?: string;
  price?: number;
  image?: string;
  description?: string;
}

/** Returns true if `urlString` parses as a well-formed URL (protocol, host, etc. all valid). */
function isValidUrl(urlString: string): boolean {
  try { return Boolean(new URL(urlString)); } catch { return false; }
}

export const RetailerService = {
  
  async findProductListing(
    productName: string,
    imageUri?: string | null
  ): Promise<FindListingResponse> {
    const payload: {
      productName: string;
      imageUrl?: string;
      imageBase64?: string;
      contentType?: string;
    } = { productName: productName.trim() };

    if (imageUri) {
      if(/^https?:\/\//i.test(imageUri)) {
        payload.imageUrl = imageUri
      } else {
        const rendered = await ImageManipulator.manipulate(imageUri)
          .resize({ width: 800 })
          .renderAsync();
     
          const saved = await rendered.saveAsync({
            compress: 0.65,
            format: SaveFormat.JPEG,
            base64: true
          });
          if (saved.base64) {
            payload.imageBase64 = saved.base64;
            payload.contentType = 'image/jpeg';
          }
        }
      }

      const { data, error } = await supabase.functions.invoke<FindListingResponse>(
        'find-product-listing',
        { body: payload }
      );

      if (error) {
        throw new Error(error.message || 'Could not search for product online.');
      }
      return data ?? { searchQuery: productName, bestMatch: null, candidates: [] };
      
    },
  
  
  
  /**
   * Fetches product metadata for a retailer product page URL.
   *
   * @param url - The product page URL pasted by the user.
   *
   * Validates the URL first and returns `{}` immediately if it's empty or malformed — no
   * network call is made for garbage input. Otherwise invokes the `extractProduct` Supabase
   * Edge Function, which does the actual scraping server-side and returns raw scraped fields.
   * Response fields are coerced to safe defaults (`price` falls back to `0` if it isn't a
   * number, other string fields fall back to `''`) so callers never have to null-check.
   *
   * On any error — the edge function invocation failing, the scrape itself failing, or an
   * unexpected exception — the error is logged via `CrashLogger.error` (tagged
   * `'RetailerService.fetchItemMetadata'`) and swallowed, resolving to `{}` rather than
   * rejecting, so a bad/unsupported URL never blocks the user from continuing to add the item
   * manually.
   *
   * @returns The scraped fields (whichever were found), or `{}` if the URL was invalid or the
   *   scrape failed. Never throws.
   */
  async fetchItemMetadata(url: string): Promise<ScrapedData> {
    if (!url || !isValidUrl(url)) return {};

    try {
      const { data, error } = await supabase.functions.invoke('extract-product', {
        body: { url },
      });
      if (error) throw error;
      return {
        title: data?.title ?? '',
        price: typeof data?.price === 'number' ? data.price : 0,
        image: data?.image ?? '',
        description: data?.description ?? '',
      };
    } catch (error) {
      CrashLogger.error(error, 'RetailerService.fetchItemMetadata');
      return {};
    }
  },



  /** Re-exported so callers (e.g. form validation in the UI) can validate a URL before submitting, without duplicating the parsing logic. */
  isValidUrl,
};
