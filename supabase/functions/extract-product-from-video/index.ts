import * as cheerio from 'npm:cheerio@1.0.0';
import { captureGeminiGeneration } from '../_shared/aiObservability.ts';

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

function cleanJson(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return { base64: btoa(binary), mimeType };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return jsonResponse({ success: false, error: 'GEMINI_API_KEY is not set' }, 500);

    const { video_url } = await req.json();
    if (!video_url || typeof video_url !== 'string') {
      return jsonResponse({ success: false, error: 'video_url is required' }, 400);
    }

    const pageRes = await fetch(video_url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    const html = pageRes.ok ? await pageRes.text() : '';
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim() || '';
    const description =
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      '';
    const thumbnail = $('meta[property="og:image"]').attr('content')?.trim() || '';
    const uploader = $('link[itemprop="name"]').attr('content')?.trim() || '';

    // Extract any storefront/affiliate URLs embedded in the page description or HTML
    const rawLinks = Array.from(
      new Set(
        html.match(/https?:\/\/(?:www\.)?(?:amazon\.com|amzn\.to|target\.com|walmart\.com|bestbuy\.com|linktr\.ee|shopltk\.com)[^\s"'<>\\]+/gi) ?? []
      )
    ).slice(0, 10);

    const prompt = `Analyze this video thumbnail, metadata, and extracted links to identify the featured E-COMMERCE PRODUCT.
Video URL: ${video_url}
Title: ${title}
Description: ${description}
Extracted Storefront/Affiliate Links: ${JSON.stringify(rawLinks)}

Tasks:
1. Identify the product shown or discussed.
2. Pick the ACTUAL storefront URL (e.g. Amazon, Target, Linktree) from the description or extracted links if present.

Return EXACTLY this JSON:
{
  "name": "Product Name",
  "brand": "Brand",
  "category": "Category",
  "price": 0.00,
  "storefront_url": "extracted link or empty string",
  "extracted_image_url": "${thumbnail}"
}`;

    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    if (thumbnail) {
      const thumbData = await fetchImageAsBase64(thumbnail);
      if (thumbData) {
        parts.push({ inline_data: { mime_type: thumbData.mimeType, data: thumbData.base64 } });
      }
    }

    const traceId = crypto.randomUUID();
    const generationStartedAt = performance.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      captureGeminiGeneration({
        traceId,
        spanName: 'video_product_extraction',
        input: prompt,
        status: res.status,
        startedAt: generationStartedAt,
        temperature: 0.1,
      });
      throw new Error(`Gemini API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    captureGeminiGeneration({
      traceId,
      spanName: 'video_product_extraction',
      input: prompt,
      output: rawText,
      response: data,
      status: res.status,
      startedAt: generationStartedAt,
      temperature: 0.1,
    });
    const product = JSON.parse(cleanJson(rawText));

    return jsonResponse({
      success: true,
      product,
      source_metadata: { title, uploader },
    });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});