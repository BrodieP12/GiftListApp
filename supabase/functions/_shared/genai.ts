import { GoogleGenAI } from '@google/genai';

/**
 * Gemini client for Edge Functions.
 *
 * The original Firebase functions used Vertex AI (service-account auth), which
 * is awkward in Deno. Edge Functions use the Gemini API key instead — set via:
 *   supabase secrets set GEMINI_API_KEY=...
 */
export function genai(): GoogleGenAI {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  return new GoogleGenAI({ apiKey });
}

/** Parses model JSON output, stripping ```json fences if present. */
export function parseJson<T = unknown>(text: string | undefined): T {
  let t = (text || '{}').trim();
  if (t.startsWith('```')) {
    t = t.replace(/```json/gi, '').replace(/```/g, '').trim();
  }
  return JSON.parse(t) as T;
}
