import * as cheerio from 'npm:cheerio@1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXCLUDED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'wikipedia.org',
  'pinterest.com',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
];

const PREFERRED_RETAILERS = [
  'amazon.com',
  'target.com',
  'walmart.com',
  'bestbuy.com',
  'ebay.com',
  'funko.com',
  'gamestop.com',
  'entertainmentearth.com',
  'hottopic.com',
  'boxlunch.com',
  'barnesandnoble.com',
  'lego.com',
  'nike.com',
  'sephora.com',
  'ulta.com',
  'etsy.com',
  'kohls.com',
  'macys.com',
  'homedepot.com',
  'lowes.com',
];

interface FindListingRequest {
  productName: string;
  imageUrl?: string;
  imageBase64?: string;
  contentType?: string;
}

interface CandidateMatch {
  title: string;
  url: string;
  retailer: string;
  price: number | null;
  description: string | null;
  image: string | null;
  snippet: string;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function parsePriceFromText(text: string): number | null {
  const match = text.match(/\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Convert an image URL into base64 for Gemini Vision inline_data. */
async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 4 * 1024 * 1024) return null;

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return { base64: btoa(binary), mimeType };
  } catch {
    return null;
  }
}

/** Step 1: Use Gemini Flash (Free Tier Vision) to turn the photo + name into a precise search query. */
async function buildSearchQueryWithGemini(
  productName: string,
  image: { base64: string; mimeType: string } | null,
  geminiApiKey: string
): Promise<{ searchQuery: string; descriptionHint: string | null }> {
  const fallback = { searchQuery: productName.trim(), descriptionHint: null };
  if (!geminiApiKey || !image) return fallback;

  try {
    const prompt = `Look at this product photo and the user's item name: "${productName}".
Identify the exact retail product (brand, product line, character/model, edition/box number, color/size if visible).
Return ONLY valid JSON with keys:
- "searchQuery": concise 4-10 word shopping search query to find this exact product at an online store
- "descriptionHint": short 1-sentence factual description of the item (color, edition, or key detail)`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: image.mimeType, data: image.base64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (!res.ok) return fallback;
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return fallback;

    const parsed = JSON.parse(rawText);
    const searchQuery =
      typeof parsed?.searchQuery === 'string' && parsed.searchQuery.trim().length > 2
        ? parsed.searchQuery.trim()
        : fallback.searchQuery;
    const descriptionHint =
      typeof parsed?.descriptionHint === 'string' && parsed.descriptionHint.trim().length > 0
        ? parsed.descriptionHint.trim()
        : null;

    return { searchQuery, descriptionHint };
  } catch {
    return fallback;
  }
}

/** Step 2: Search for product listings via Tavily (1 credit per call using search_depth: "fast"). */
async function searchListingsWithTavily(
  searchQuery: string,
  tavilyApiKey: string
): Promise<Array<{ title: string; url: string; content: string }>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tavilyApiKey) {
    headers.Authorization = `Bearer ${tavilyApiKey}`;
  } else {
    headers['X-Tavily-Access-Mode'] = 'keyless';
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(7000),
    body: JSON.stringify({
      query: `${searchQuery} buy price`,
      search_depth: 'fast',
      max_results: 6,
      exclude_domains: EXCLUDED_DOMAINS,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  return results
    .filter((r: { url?: string }) => typeof r?.url === 'string' && r.url.startsWith('http'))
    .sort((a: { url: string }, b: { url: string }) => {
      const aPreferred = PREFERRED_RETAILERS.some((d) => getHostname(a.url).endsWith(d)) ? 1 : 0;
      const bPreferred = PREFERRED_RETAILERS.some((d) => getHostname(b.url).endsWith(d)) ? 1 : 0;
      return bPreferred - aPreferred;
    });
}

/** Helper to recursively locate a schema.org Product node inside JSON-LD blocks. */
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

/** Step 3: Extract exact metadata from a product URL using JSON-LD + OpenGraph (zero AI cost). */
async function extractMetadataFromUrl(url: string): Promise<{
  title: string | null;
  price: number | null;
  description: string | null;
  image: string | null;
}> {
  const empty = { title: null, price: null, description: null, image: null };
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return empty;
    const html = await res.text();
    const $ = cheerio.load(html);

    let title: string | null = null;
    let price: number | null = null;
    let description: string | null = null;
    let image: string | null = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      if (price !== null && title && description) return;
      try {
        const parsed = JSON.parse($(el).text());
        const product = findProductNode(parsed);
        if (!product) return;

        if (!title && typeof product.name === 'string') title = product.name.trim();
        if (!description && typeof product.description === 'string') {
          description = product.description.trim().slice(0, 300);
        }

        if (!image) {
          if (typeof product.image === 'string') image = product.image;
          else if (Array.isArray(product.image) && typeof product.image[0] === 'string') {
            image = product.image[0];
          }
        }

        if (price === null && product.offers) {
          const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          const rawPrice =
            (offers as Record<string, unknown>)?.price ??
            (offers as Record<string, unknown>)?.lowPrice;
          if (rawPrice !== undefined && rawPrice !== null) {
            const num = Number.parseFloat(String(rawPrice).replace(/[^0-9.]/g, ''));
            if (Number.isFinite(num) && num > 0) price = num;
          }
        }
      } catch {
        // Ignore malformed JSON-LD blocks
      }
    });

    if (!title) {
      title =
        $('meta[property="og:title"]').attr('content')?.trim() ||
        $('title').text().trim() ||
        null;
    }
    if (!description) {
      description =
        $('meta[property="og:description"]').attr('content')?.trim() ||
        $('meta[name="description"]').attr('content')?.trim() ||
        null;
    }
    if (!image) {
      image = $('meta[property="og:image"]').attr('content')?.trim() || null;
    }
    if (price === null) {
      const metaPrice =
        $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[property="og:price:amount"]').attr('content');
      if (metaPrice) {
        const num = Number.parseFloat(metaPrice.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(num) && num > 0) price = num;
      }
    }

    return { title, price, description, image };
  } catch {
    return empty;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const tavilyApiKey = Deno.env.get('TAVILY_API_KEY') ?? '';

    const body = (await req.json()) as FindListingRequest;
    const productName = body?.productName?.trim();
    if (!productName) {
      return jsonResponse({ error: 'productName is required' }, 400);
    }

    // Load image for Gemini Vision (supports either raw base64 or uploaded Supabase URL)
    let imagePayload: { base64: string; mimeType: string } | null = null;
    if (body.imageBase64) {
      imagePayload = {
        base64: body.imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        mimeType: body.contentType || 'image/jpeg',
      };
    } else if (body.imageUrl) {
      imagePayload = await fetchImageAsBase64(body.imageUrl);
    }

    // 1. Refine query using Gemini Flash Vision
    const { searchQuery, descriptionHint } = await buildSearchQueryWithGemini(
      productName,
      imagePayload,
      geminiApiKey
    );

    // 2. Find matching retail URLs with Tavily (1 free credit)
    const rawResults = await searchListingsWithTavily(searchQuery, tavilyApiKey);
    if (rawResults.length === 0) {
      return jsonResponse({
        searchQuery,
        bestMatch: null,
        candidates: [],
      });
    }

    // 3. Extract JSON-LD metadata on the top 3 candidates in parallel
    const topThree = rawResults.slice(0, 3);
    const candidates: CandidateMatch[] = await Promise.all(
      topThree.map(async (item) => {
        const meta = await extractMetadataFromUrl(item.url);
        const snippetPrice = parsePriceFromText(`${item.title} ${item.content}`);

        return {
          title: meta.title || item.title,
          url: item.url,
          retailer: getHostname(item.url),
          price: meta.price ?? snippetPrice,
          description: meta.description || descriptionHint || item.content.slice(0, 220),
          image: meta.image,
          snippet: item.content.slice(0, 220),
        };
      })
    );

    // Pick the first candidate with a verified price, otherwise the top-ranked listing
    const bestMatch = candidates.find((c) => c.price !== null) ?? candidates[0];

    return jsonResponse({
      searchQuery,
      bestMatch,
      candidates,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      500
    );
  }
});