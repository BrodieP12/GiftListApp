// extract-product: ports functions/src/productExtractor.ts
// Scrapes a page with cheerio, then asks Gemini to extract structured product
// data (including resolving social-media links to the real storefront).
import * as cheerio from 'cheerio';
import { json, preflight } from '../_shared/cors.ts';
import { genai, parseJson } from '../_shared/genai.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { url } = await req.json().catch(() => ({}));
  if (!url) return json({ success: false, error: 'URL is required' }, 400);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 503 || response.status === 403) {
      return json(
        { success: false, error: 'Website blocked the connection (Bot Protection).', source: url },
        response.status
      );
    }
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const responseText = await response.text();
    const $ = cheerio.load(responseText);
    const pageTitle = $('title').text().toLowerCase();

    if (
      pageTitle.includes('robot check') ||
      pageTitle.includes('captcha') ||
      pageTitle.includes('are you a human')
    ) {
      return json(
        {
          success: false,
          error: "Scraping blocked by the website's anti-bot protection (CAPTCHA).",
          source: url,
        },
        403
      );
    }

    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
    const ogDesc = $('meta[property="og:description"]').attr('content');

    $('script, style').remove();
    const pageText = $('body').text().replace(/\s+/g, ' ').slice(0, 5000);

    const outboundLinks: string[] = [];
    $('a[href^="http"]').each((i, el) => {
      if (i < 20) outboundLinks.push($(el).attr('href')!);
    });

    const ai = genai();
    const prompt = `
            Analyze this web page metadata to extract E-COMMERCE PRODUCT information.
            Original URL: ${url}
            Title: ${ogTitle}
            Description: ${ogDesc}
            Links found on page: ${JSON.stringify(outboundLinks)}

            Text Snippet:
            ${pageText}

            Task:
            1. Identify the product (Brand and Name).
            2. Extract price.
            3. CRITICAL: If the URL is social media (TikTok/IG/YouTube), find the ACTUAL storefront link (Amazon, Linktree) from the text or links array. Otherwise, use the Original URL.

            Return EXACTLY this JSON:
            {
                "name": "Product Name",
                "description": "Product Description",
                "price": 99.99,
                "currency": "USD",
                "brand": "Brand Name",
                "category": "Category",
                "storefront_url": "https://actual-store-link.com",
                "extracted_image_url": "${ogImage || ''}"
            }`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.1, responseMimeType: 'application/json' },
    });

    return json({ success: true, product: parseJson(aiResponse.text), source: url });
  } catch (error) {
    if ((error as Error).name === 'TimeoutError') {
      return json({ success: false, error: 'Website parsing timed out.', source: url }, 504);
    }
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
