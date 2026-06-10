// compare-products: ports functions/src/productComparison.ts
import { json, preflight } from '../_shared/cors.ts';
import { genai, parseJson } from '../_shared/genai.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { products } = await req.json().catch(() => ({}));
  if (!products || products.length < 2) {
    return json({ success: false, error: 'Requires at least 2 products' }, 400);
  }

  try {
    const ai = genai();
    const prompt = `
            You are an expert product reviewer. Compare these products:
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

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.2, responseMimeType: 'application/json' },
    });

    return json({ success: true, comparison: parseJson(aiResponse.text) });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
