// manage-wishlist: ports functions/src/wishlistManager.ts
import { json, preflight } from '../_shared/cors.ts';
import { genai, parseJson } from '../_shared/genai.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { owned_items, wishlist_items, budget } = await req.json().catch(() => ({}));

  try {
    const ai = genai();
    const prompt = `
            You are a personal shopper.
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

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.2, responseMimeType: 'application/json' },
    });

    return json({ success: true, analysis: parseJson(aiResponse.text) });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
