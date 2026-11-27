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

    const { product, preferences } = await req.json();
    if (!product || !product.name) {
      return jsonResponse({ success: false, error: 'Product name is required.' }, 400);
    }

    const prefText = preferences
      ? `Specific User Preference: ${preferences}`
      : 'Provide a mix of budget-friendly, direct competitors, and premium upgrades.';

    const prompt = `You are an expert product advisor. Suggest 3 to 4 relevant alternative products for this item:
Name: ${product.name}
Brand: ${product.brand || 'Unknown'}
Price: ${product.price ?? 'Unknown'}
Category: ${product.category || 'Unknown'}
Description: ${product.description || 'None'}
${prefText}

Return EXACTLY this JSON:
{
  "original_item_analysis": "Brief summary of the original product",
  "substitutions": [
    {
      "name": "Product Name",
      "brand": "Brand",
      "estimated_price": 99.99,
      "type": "budget_friendly / direct_competitor / premium_upgrade",
      "pros_vs_original": ["Pro 1", "Pro 2"],
      "cons_vs_original": ["Con 1"],
      "reason_for_suggestion": "Why this is a good alternative"
    }
  ]
}`;

    const traceId = crypto.randomUUID();
    const generationStartedAt = performance.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      captureGeminiGeneration({
        traceId,
        spanName: 'substitution_suggestion',
        input: prompt,
        status: res.status,
        startedAt: generationStartedAt,
        temperature: 0.3,
      });
      throw new Error(`Gemini API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    captureGeminiGeneration({
      traceId,
      spanName: 'substitution_suggestion',
      input: prompt,
      output: rawText,
      response: data,
      status: res.status,
      startedAt: generationStartedAt,
      temperature: 0.3,
    });
    const analysis = JSON.parse(cleanJson(rawText));

    return jsonResponse({ success: true, target_product: product.name, analysis });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});
