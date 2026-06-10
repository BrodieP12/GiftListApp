// extract-product-from-video: ports functions/src/videoExtractor.ts
//
// Re-architected for Deno Edge (per SUPABASE_MIGRATION_PLAN.md §8):
//   - youtube-dl-exec download and fluent-ffmpeg frame extraction are DROPPED
//     (Node/binary-bound, unavailable in the Edge sandbox).
//   - Instead the video URL is passed DIRECTLY to Gemini multimodal via a
//     fileData part. Gemini ingests the video (incl. YouTube URLs) natively.
//
// Request:  { video_url: string }
// Response: { success, product, source_metadata }
import { json, preflight } from '../_shared/cors.ts';
import { genai, parseJson } from '../_shared/genai.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { video_url } = await req.json().catch(() => ({}));
  if (!video_url) return json({ success: false, error: 'video_url is required' }, 400);

  try {
    const ai = genai();

    const promptText = `
            Analyze this video and its on-screen content to extract E-COMMERCE PRODUCT information.

            Tasks:
            1. Identify the product shown in the video.
            2. Find the ACTUAL storefront URL (e.g. Amazon, Linktree) mentioned in the video or its description.

            Return EXACTLY this JSON:
            {
                "name": "Product Name",
                "brand": "Brand",
                "category": "Category",
                "price": 99.99,
                "storefront_url": "extracted link",
                "extracted_image_url": ""
            }`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            // Gemini accepts a remote file (including YouTube) by URI.
            { fileData: { fileUri: video_url, mimeType: 'video/mp4' } },
          ],
        },
      ],
      config: { temperature: 0.1, responseMimeType: 'application/json' },
    });

    return json({
      success: true,
      product: parseJson(aiResponse.text),
      source_metadata: { source_url: video_url },
    });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
