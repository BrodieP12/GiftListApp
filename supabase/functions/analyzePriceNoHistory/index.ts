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

    const { product } = await req.json();
    if (!product || !product.name || product.price === undefined) {
      return jsonResponse({ success: false, error: 'Product name and price are required.' }, 400);
    }

    const prompt = `You are an e-commerce pricing analyst. Evaluate this product's current price without historical records:
Product Name: ${product.name}
Brand: ${product.brand || 'Unknown'}
Category: ${product.category || 'Unknown'}
Current Listed Price: ${product.price} ${product.currency || 'USD'}

Return EXACTLY this JSON:
{
  "estimated_standard_price": 0.00,
  "deal_rating": "Excellent/Fair/Poor",
  "price_context": "Briefly explain if this is below MSRP, at standard retail, or overpriced.",
  "seasonal_advice": "When does this typically go on sale?",
  "recommendation": "Buy Now / Wait / Shop Around",
  "analysis_notes": "A 1-2 sentence explanation of your recommendation."
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
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      captureGeminiGeneration({
        traceId,
        spanName: 'price_analysis_no_history',
        input: prompt,
        status: res.status,
        startedAt: generationStartedAt,
        temperature: 0.2,
      });
      throw new Error(`Gemini API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    captureGeminiGeneration({
      traceId,
      spanName: 'price_analysis_no_history',
      input: prompt,
      output: rawText,
      response: data,
      status: res.status,
      startedAt: generationStartedAt,
      temperature: 0.2,
    });
    const analysis = JSON.parse(cleanJson(rawText));

    return jsonResponse({ success: true, input_price: product.price, analysis });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});
