import * as cheerio from 'npm:cheerio@1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function findProductNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }

  const record = node as Record<string, unknown>;
  const typeVal = record['@type'];
  const types = Array.isArray(typeVal) ? typeVal : [typeVal];
  if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'product')) {
    return record;
  }

  if (Array.isArray(record['@graph'])) {
    return findProductNode(record['@graph']);
  }
  return null;
}

function parseNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const candidate = segments.reverse().find((s) => s.includes('-') && s.length > 5) || '';
    return candidate
      .replace(/\.html?$/i, '')
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
      .trim();
  } catch {
    return '';
  }
}

function parsePriceFromText(text: string): number | null {
  const match = text.match(/\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/);
  if (!match) return null;
  const num = Number.parseFloat(match[1].replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

async function fetchViaTavilySearch(
  url: string,
  slugName: string,
  tavilyKey: string
): Promise<{ text: string; image: string; price: number | null; description: string }> {
  const empty = { text: '', image: '', price: null, description: '' };
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const query = slugName ? `${slugName} ${hostname} price` : url;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tavilyKey) {
      headers.Authorization = `Bearer ${tavilyKey}`;
    } else {
      // Free rate-limited fallback if TAVILY_API_KEY isn't set yet
      headers['X-Tavily-Access-Mode'] = 'keyless';
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 4,
        include_images: true,
        include_answer: false,
      }),
    });

    if (!res.ok) return empty;
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    const combinedText = results
      .map((r: { title?: string; content?: string; url?: string }) =>
        `${r.title || ''}\n${r.url || ''}\n${r.content || ''}`
      )
      .join('\n\n');

    const firstDesc = results[0]?.content?.slice(0, 300) || '';
    const firstImage =
      Array.isArray(data?.images) && typeof data.images[0] === 'string'
        ? data.images[0]
        : '';

    return {
      text: combinedText.slice(0, 4000),
      image: firstImage,
      price: parsePriceFromText(combinedText),
      description: firstDesc,
    };
  } catch {
    return empty;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return jsonResponse({ error: 'A valid http(s) url is required' }, 400);
    }

    let name = '';
    let description = '';
    let price: number | null = null;
    let image = '';
    let brand = '';
    let currency = 'USD';
    let pageText = '';
    const jsonLdBlocks: unknown[] = [];

    // 1. Try direct fetch first (fastest, $0)
    try {
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const $ = cheerio.load(html);

        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const parsed = JSON.parse($(el).text());
            jsonLdBlocks.push(parsed);
            const product = findProductNode(parsed);
            if (!product) return;

            if (!name && typeof product.name === 'string') name = product.name.trim();
            if (!description && typeof product.description === 'string') {
              description = product.description.trim().slice(0, 400);
            }
            if (!brand) {
              if (typeof product.brand === 'string') brand = product.brand.trim();
              else if (
                product.brand &&
                typeof (product.brand as Record<string, unknown>).name === 'string'
              ) {
                brand = String((product.brand as Record<string, unknown>).name).trim();
              }
            }
            if (!image) {
              if (typeof product.image === 'string') image = product.image;
              else if (Array.isArray(product.image) && typeof product.image[0] === 'string') {
                image = product.image[0];
              }
            }
            if (price === null && product.offers) {
              const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
              const offerObj = offer as Record<string, unknown>;
              const rawPrice = offerObj?.price ?? offerObj?.lowPrice;
              if (rawPrice !== undefined && rawPrice !== null) {
                const num = Number.parseFloat(String(rawPrice).replace(/[^0-9.]/g, ''));
                if (Number.isFinite(num) && num > 0) price = num;
              }
              if (typeof offerObj?.priceCurrency === 'string') currency = offerObj.priceCurrency;
            }
          } catch {
            // Ignore malformed JSON-LD
          }
        });

        if (!name) {
          name = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim();
        }
        if (!description) {
          description =
            $('meta[property="og:description"]').attr('content')?.trim() ||
            $('meta[name="description"]').attr('content')?.trim() ||
            '';
        }
        if (!image) image = $('meta[property="og:image"]').attr('content')?.trim() || '';
        if (price === null) {
          const metaPrice =
            $('meta[property="product:price:amount"]').attr('content') ||
            $('meta[property="og:price:amount"]').attr('content');
          if (metaPrice) {
            const num = Number.parseFloat(metaPrice.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(num) && num > 0) price = num;
          }
        }

        $('script, style, noscript').remove();
        pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3500);
      }
    } catch {
      // Direct fetch timed out or failed; continue to fallbacks
    }

    // 2. If direct fetch was blocked (403/503) or missed the price, pull from Tavily Search snippets
    const tavilyKey = Deno.env.get('TAVILY_API_KEY') ?? '';
    if (!pageText || price === null) {
      const slugName = name || parseNameFromUrl(url);
      const searchFallback = await fetchViaTavilySearch(url, slugName, tavilyKey);
      if (searchFallback.text) {
        pageText = pageText ? `${pageText}\n\n${searchFallback.text}` : searchFallback.text;
      }
      if (price === null && searchFallback.price !== null) price = searchFallback.price;
      if (!image && searchFallback.image) image = searchFallback.image;
      if (!description && searchFallback.description) description = searchFallback.description;
    }

    // 3. Gemini Flash Free Tier fallback if name, price, or brand is still missing
    const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    if (geminiKey && (!name || price === null || !brand) && (pageText || jsonLdBlocks.length > 0)) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Extract product details as JSON with keys: name (string), description (string), price (number or null), image (string), brand (string).
URL: ${url}
JSON-LD: ${JSON.stringify(jsonLdBlocks).slice(0, 2000)}
Page Content: ${pageText}`,
                    },
                  ],
                },
              ],
              generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (!name && typeof parsed.name === 'string') name = parsed.name.trim();
            if (!description && typeof parsed.description === 'string') {
              description = parsed.description.trim();
            }
            if (price === null && typeof parsed.price === 'number' && parsed.price > 0) {
              price = parsed.price;
            }
            if (!image && typeof parsed.image === 'string') image = parsed.image;
            if (!brand && typeof parsed.brand === 'string') brand = parsed.brand;
          }
        }
      } catch {
        // Keep whatever we extracted so far
      }
    }

    // 4. Last-resort URL slug fallback so blocked sites still pre-fill a readable name
    if (!name) name = parseNameFromUrl(url);

    return jsonResponse({
      name,
      title: name,
      description,
      price,
      currency,
      image,
      imageUri: image,
      brand,
      url,
      storefront_url: url,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to extract product metadata' },
      500
    );
  }
});