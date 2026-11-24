/**
 * Supported Retailers Directory
 * ---------------------------------------------------------------------------
 * Defines known shopping domains, branding labels, icons, and categories
 * used by the product extractor and account/list store preference settings.
 */

export interface RetailerOption {
  domain: string;
  name: string;
  category: 'General' | 'Electronics' | 'Toys & Hobbies' | 'Fashion' | 'Home' | 'Books';
  icon: string; // FontAwesome5 icon name
}

export const SUPPORTED_RETAILERS: RetailerOption[] = [
  // General & Department Stores
  { domain: 'amazon.com', name: 'Amazon', category: 'General', icon: 'amazon' },
  { domain: 'target.com', name: 'Target', category: 'General', icon: 'bullseye' },
  { domain: 'walmart.com', name: 'Walmart', category: 'General', icon: 'shopping-cart' },
  { domain: 'ebay.com', name: 'eBay', category: 'General', icon: 'tags' },
  { domain: 'etsy.com', name: 'Etsy', category: 'General', icon: 'paint-brush' },
  { domain: 'kohls.com', name: 'Kohl\'s', category: 'General', icon: 'shopping-bag' },
  { domain: 'macys.com', name: 'Macy\'s', category: 'General', icon: 'star' },

  // Electronics & Tech
  { domain: 'bestbuy.com', name: 'Best Buy', category: 'Electronics', icon: 'tv' },
  { domain: 'gamestop.com', name: 'GameStop', category: 'Electronics', icon: 'gamepad' },
  { domain: 'apple.com', name: 'Apple', category: 'Electronics', icon: 'apple' },
  { domain: 'microcenter.com', name: 'Micro Center', category: 'Electronics', icon: 'microchip' },

  // Toys & Collectibles
  { domain: 'lego.com', name: 'LEGO', category: 'Toys & Hobbies', icon: 'cubes' },
  { domain: 'funko.com', name: 'Funko', category: 'Toys & Hobbies', icon: 'smile' },
  { domain: 'entertainmentearth.com', name: 'Entertainment Earth', category: 'Toys & Hobbies', icon: 'globe' },
  { domain: 'hottopic.com', name: 'Hot Topic', category: 'Toys & Hobbies', icon: 'fire' },
  { domain: 'boxlunch.com', name: 'BoxLunch', category: 'Toys & Hobbies', icon: 'box-open' },

  // Books
  { domain: 'barnesandnoble.com', name: 'Barnes & Noble', category: 'Books', icon: 'book' },

  // Fashion & Beauty
  { domain: 'nike.com', name: 'Nike', category: 'Fashion', icon: 'running' },
  { domain: 'sephora.com', name: 'Sephora', category: 'Fashion', icon: 'heart' },
  { domain: 'ulta.com', name: 'Ulta Beauty', category: 'Fashion', icon: 'gem' },

  // Home & Hardware
  { domain: 'homedepot.com', name: 'The Home Depot', category: 'Home', icon: 'hammer' },
  { domain: 'lowes.com', name: 'Lowe\'s', category: 'Home', icon: 'wrench' },
];

export const DEFAULT_PREFERRED_RETAILERS: string[] = [
  'amazon.com',
  'target.com',
  'walmart.com',
  'bestbuy.com',
];

/**
 * Returns a human-friendly name for a given domain string.
 */
export function getRetailerDisplayName(domainOrHostname: string): string {
  const clean = domainOrHostname.replace(/^www\./, '').toLowerCase();
  const match = SUPPORTED_RETAILERS.find(
    (r) => clean === r.domain || clean.endsWith(`.${r.domain}`)
  );
  if (match) return match.name;

  // Capitalize first letter of domain root as fallback
  const parts = clean.split('.');
  if (parts.length > 1) {
    const root = parts[parts.length - 2];
    return root.charAt(0).toUpperCase() + root.slice(1);
  }
  return clean;
}
