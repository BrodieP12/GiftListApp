import { httpsCallable } from 'firebase/functions';
import { functions } from '../api/firebase';

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
      console.warn('Invalid URL format');
      return {};
    }

    try {
      // 2. Define the Cloud Function reference
      // Ensure you have deployed a function named 'scrapeProduct' to Firebase!
      const scrapeFunction = httpsCallable<{ url: string }, ScrapedData>(
        functions, 
        'scrapeProduct'
      );

      // 3. Execute the function
      const response = await scrapeFunction({ url });
      const data = response.data;

      // 4. Sanitize the result (defensive coding)
      return {
        title: data.title || '',
        price: typeof data.price === 'number' ? data.price : 0,
        image: data.image || '',
        description: data.description || ''
      };

    } catch (error) {
      console.error('Retailer Service Error:', error);
      // Fail gracefully: Return empty data so the user can still fill the form manually.
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