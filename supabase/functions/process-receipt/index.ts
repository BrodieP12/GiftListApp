// process-receipt: ports functions/src/receiptProcessor.ts
//
// Re-architected for Deno Edge (per SUPABASE_MIGRATION_PLAN.md §8):
//   - tesseract.js OCR is DROPPED. The receipt image is sent directly to
//     Gemini vision, which both reads and structures it in one call.
//   - duck-duck-scrape image lookup is DROPPED (Node-only). `image_url` is
//     returned empty; wire a search API later if needed.
//
// Request:  { image_data?: base64, raw_ocr?: string, store_context?: string }
// Response shape is unchanged: { success, receipt_data: { store_info, items } }
import { json, preflight } from '../_shared/cors.ts';
import { genai, parseJson } from '../_shared/genai.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const { image_data, store_context = '', raw_ocr = '' } = await req.json().catch(() => ({}));
    if (!image_data && !raw_ocr) {
      return json({ success: false, error: 'image_data or raw_ocr required' }, 400);
    }

    const ai = genai();
    const structurePrompt = `
            Analyze this receipt and extract structured product data.
            Store Context: ${store_context}
            ${raw_ocr ? `Receipt Text:\n${raw_ocr}` : 'The receipt is provided as an image.'}

            Return EXACTLY this JSON structure:
            {
                "store_info": { "name": "Store name", "date": "YYYY-MM-DD" },
                "line_items": [
                    {
                        "raw_description": "Original text",
                        "quantity": 1,
                        "unit_price": 2.99,
                        "total_price": 2.99,
                        "resolved_name": "Clear product name",
                        "brand": "Brand name or null",
                        "category": "Electronics/Grocery/Clothing etc"
                    }
                ]
            }`;

    // Build multimodal parts: prompt + (optional) the receipt image inline.
    const parts: unknown[] = [{ text: structurePrompt }];
    if (image_data) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: image_data } });
    }

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.1, responseMimeType: 'application/json' },
    });

    const parsed = parseJson<{ store_info?: unknown; line_items?: unknown[] }>(aiResponse.text);

    // image_url intentionally empty (DuckDuckGo image search removed).
    const items = (parsed.line_items || []).map((it) => ({ ...(it as object), image_url: '' }));

    return json({
      success: true,
      receipt_data: { store_info: parsed.store_info, items },
    });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
