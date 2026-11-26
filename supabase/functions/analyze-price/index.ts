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

    const { product, history } = await req.json();
    if (!product) {
      return jsonResponse({ success: false, error: 'product is required.' }, 400);
    }

    const prompt = `You are an e-commerce pricing analyst.
Product: ${JSON.stringify(product)}
History: ${JSON.stringify(history ?? [])}

Return EXACTLY this JSON:
{
  "current_deal_rating": "Excellent/Average/Poor",
  "average_historical_price": 0.00,
  "lowest_recorded_price": 0.00,
  "highest_recorded_price": 0.00,
  "volatility_status": "stable/volatile/seasonal",
  "recommendation": "Buy Now / Wait",
  "analysis_notes": "Brief explanation"
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const analysis = JSON.parse(cleanJson(rawText));

    return jsonResponse({ success: true, analysis });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});
