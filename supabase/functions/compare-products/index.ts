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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return jsonResponse({ success: false, error: 'GEMINI_API_KEY is not set' }, 500);

    const { products } = await req.json();
    if (!Array.isArray(products) || products.length < 2) {
      return jsonResponse({ success: false, error: 'Requires at least 2 products' }, 400);
    }

    const prompt = `You are an expert product reviewer. Compare these products:
${JSON.stringify(products, null, 2)}

Return EXACTLY this JSON:
{
  "comparison_summary": "Brief overall summary",
  "products_evaluated": [
    { "name": "Name", "pros": ["Pro 1"], "cons": ["Con 1"], "value_score": 8.5 }
  ],
  "winner": { "name": "Winning Product", "reason": "Why" },
  "feature_differences": "Explanation"
}`;

    const traceId = crypto.randomUUID();
    const startedAt = performance.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    await captureGeminiGeneration({
      traceId,
      spanName: 'compare_products',
      input: prompt,
      output: rawText,
      latencySeconds: (performance.now() - startedAt) / 1000,
      httpStatus: res.status,
      temperature: 0.2,
      usage: data?.usageMetadata,
    });
    const comparison = JSON.parse(cleanJson(rawText));

    return jsonResponse({ success: true, comparison });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});