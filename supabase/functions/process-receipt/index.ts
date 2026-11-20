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

    const { image_data, mime_type = 'image/jpeg', store_context = '', raw_ocr = '' } =
      await req.json();

    if (!image_data && !raw_ocr) {
      return jsonResponse({ success: false, error: 'image_data or raw_ocr required' }, 400);
    }

    const instruction = `Analyze this receipt and extract structured product data.
Store Context: ${store_context}
${raw_ocr ? `Receipt Text:\n${raw_ocr}` : 'Read all line items directly from the attached receipt image.'}

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
      "brand": "Brand",
      "category": "Category"
    }
  ]
}`;

    const parts: Array<Record<string, unknown>> = [{ text: instruction }];
    if (image_data && !raw_ocr) {
      const cleanBase64 = String(image_data).replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inline_data: {
          mime_type,
          data: cleanBase64,
        },
      });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedData = JSON.parse(cleanJson(rawText));

    const items = Array.isArray(parsedData?.line_items)
      ? parsedData.line_items.map((item: Record<string, unknown>) => ({
          ...item,
          image_url: '',
        }))
      : [];

    return jsonResponse({
      success: true,
      receipt_data: {
        store_info: parsedData.store_info ?? { name: store_context || 'Unknown', date: '' },
        items,
      },
    });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});