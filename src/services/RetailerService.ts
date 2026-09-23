import { supabase } from '../api/supabase';
import { CrashLogger } from './LoggingService';

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
      const { data, error } = await supabase.functions.invoke('extractProduct', {
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
