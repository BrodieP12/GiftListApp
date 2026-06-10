import { supabase } from '../api/supabase';
import {CrashLogger} from "./LoggingService";

export interface ScrapedData {
  title?: string;
  price?: number;
  image?: string;
  description?: string;
}

export const RetailerService = {
  /**
   * Scrapes metadata from a retailer URL.
   * This calls a server-side Firebase Function to avoid CORS and performance issues.
   * * @param url The full product URL (e.g., https://amazon.com/dp/...)
   * @returns ScrapedData object (fields may be undefined if scraping fails)
   */
  async fetchItemMetadata(url: string): Promise<ScrapedData> {
    // 1. input Validation
    if (!url || !isValidUrl(url)) {
      return {};
    }

    try {
      // 2. Invoke the `scrape-product` Edge Function (Deno).
      const { data, error } = await supabase.functions.invoke<ScrapedData>(
        'scrape-product',
        { body: { url } }
      );
      if (error || !data) throw error ?? new Error('No data');

      // 3. Sanitize the result (defensive coding)
      return {
        title: data.title || '',
        price: typeof data.price === 'number' ? data.price : 0,
        image: data.image || '',
        description: data.description || ''
      };

    } catch (error) {
      CrashLogger.error(error);
      return {}; 
    }
  },

  /**
   * Helper to validate if a string is a proper URL.
   */
  isValidUrl(string: string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
};

// --- HELPER FOR URL VALIDATION ---
function isValidUrl(urlString: string) {
  try { 
    return Boolean(new URL(urlString)); 
  } catch(e) { 
    return false; 
  }
}