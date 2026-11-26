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

    const { owned_items = [], wishlist_items = [], budget } = await req.json();
    if (budget === undefined || budget === null) {
      return jsonResponse({ success: false, error: 'budget is required.' }, 400);
    }

    const prompt = `You are a personal shopper.
Owned Gear: ${JSON.stringify(owned_items)}
Wishlist: ${JSON.stringify(wishlist_items)}
Budget: $${budget}

1. Select best combinations of wishlist items maximizing value without exceeding budget.
2. Suggest 2 relevant accessories based on owned/recommended gear.

Return EXACTLY this JSON:
{
  "recommended_purchases": [{ "name": "Item", "price": 99.99, "reason": "Why" }],
  "total_estimated_cost": 0.00,
  "remaining_budget": 0.00,
  "suggested_accessories": [{ "name": "Item", "estimated_price": 25.0, "reason": "Why" }],
  "purchase_strategy_notes": "Advice"
}`;

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
    const analysis = JSON.parse(cleanJson(rawText));

    return jsonResponse({ success: true, analysis });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});
