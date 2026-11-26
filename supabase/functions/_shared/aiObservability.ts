type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
};

const projectToken = Deno.env.get('POSTHOG_API_KEY');
const host = Deno.env.get('POSTHOG_HOST');

if (Deno.env.get('ENV') !== 'production') {
  for (const variable of ['POSTHOG_API_KEY', 'POSTHOG_HOST'] as const) {
    if (!Deno.env.get(variable)) {
      console.warn(
        `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`
      );
    }
  }
}

export type GeminiGeneration = {
  traceId: string;
  spanName: string;
  input: unknown;
  output: string;
  latencySeconds: number;
  httpStatus: number;
  temperature: number;
  usage?: GeminiUsage;
};

/**
 * Sends a completed direct Gemini REST call as an AI Observability generation.
 * Edge Functions are short-lived, so delivery is bounded and awaited without
 * allowing telemetry failures to affect the function response.
 */
export async function captureGeminiGeneration(generation: GeminiGeneration): Promise<void> {
  if (!projectToken || !host) return;

  try {
    await fetch(`${host.replace(/\/$/, '')}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2000),
      body: JSON.stringify({
        api_key: projectToken,
        event: '$ai_generation',
        properties: {
          distinct_id: 'anonymous',
          $ai_trace_id: generation.traceId,
          $ai_session_id: null,
          $ai_span_id: crypto.randomUUID(),
          $ai_span_name: generation.spanName,
          $ai_model: 'gemini-2.5-flash',
          $ai_provider: 'gemini',
          $ai_input: [{ role: 'user', content: generation.input }],
          $ai_output_choices: [{ role: 'assistant', content: generation.output }],
          $ai_input_tokens: generation.usage?.promptTokenCount,
          $ai_output_tokens: generation.usage?.candidatesTokenCount,
          $ai_latency: generation.latencySeconds,
          $ai_http_status: generation.httpStatus,
          $ai_temperature: generation.temperature,
        },
      }),
    });
  } catch {
    // AI Observability must never affect a successful Gemini request.
  }
}
