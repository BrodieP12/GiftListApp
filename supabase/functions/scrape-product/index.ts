// scrape-product: lightweight metadata scraper for RetailerService.fetchItemMetadata.
// Returns { title, price, image, description } from OpenGraph / meta tags.
// (The original `scrapeProduct` callable was referenced but unmigrated; this
//  provides the same client contract.)
import * as cheerio from 'cheerio';
import { json, preflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { url } = await req.json().catch(() => ({}));
  if (!url) return json({}, 400);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return json({});

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';
    const image = $('meta[property="og:image"]').attr('content') || '';

    // Best-effort price from common meta tags.
    const priceRaw =
      $('meta[property="product:price:amount"]').attr('content') ||
      $('meta[property="og:price:amount"]').attr('content') ||
      '';
    const price = priceRaw ? parseFloat(priceRaw) : undefined;

    return json({ title, price: Number.isFinite(price) ? price : undefined, image, description });
  } catch (_error) {
    return json({});
  }
});
