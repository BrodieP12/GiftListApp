// analyze-price: ports functions/src/priceAnalyzer.ts (both analyzePrice and
// analyzePriceNoHistory). Behavior selected by presence of `history`.
import { json, preflight } from '../_shared/cors.ts';
import { genai, parseJson } from '../_shared/genai.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { product, history } = await req.json().catch(() => ({}));

  try {
    const ai = genai();

    // Path A: history provided -> data-driven analysis.
    if (history !== undefined && history !== null) {
      const prompt = `
            You are an e-commerce pricing analyst.
            Product: ${JSON.stringify(product)}
            History: ${JSON.stringify(history)}

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
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.1, responseMimeType: 'application/json' },
      });
      return json({ success: true, analysis: parseJson(aiResponse.text) });
    }

    // Path B: no history -> rely on model market knowledge.
    if (!product || !product.name || product.price === undefined) {
      return json({ success: false, error: 'Product name and price are required.' }, 400);
    }

    const prompt = `
            You are an expert e-commerce pricing analyst and personal shopping assistant.
            The user is considering buying the following product:

            Product Name: ${product.name}
            Brand: ${product.brand || 'Unknown'}
            Category: ${product.category || 'Unknown'}
            Current Listed Price: ${product.price} ${product.currency || 'USD'}

            Based on your knowledge of this product, this brand's pricing strategy, and general market value for this category, evaluate if this current price is a good deal.

            Tasks:
            1. Estimate the standard MSRP or typical street price for this item.
            2. Determine if the current price is Excellent (heavy discount), Fair (standard MSRP), or Poor (inflated/scalper pricing).
            3. Provide seasonal advice (e.g., "Wait for Black Friday" or "Apple products rarely drop further").

            Return EXACTLY this JSON format:
            {
                "estimated_standard_price": 0.00,
                "deal_rating": "Excellent/Fair/Poor",
                "price_context": "Briefly explain if this is below MSRP, at standard retail, or overpriced.",
                "seasonal_advice": "When does this typically go on sale?",
                "recommendation": "Buy Now / Wait / Shop Around",
                "analysis_notes": "A 1-2 sentence explanation of your recommendation."
            }`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.2, responseMimeType: 'application/json' },
    });

    return json({
      success: true,
      input_price: product.price,
      analysis: parseJson(aiResponse.text),
    });
  } catch (error) {
    console.error('Price Analysis Error:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
