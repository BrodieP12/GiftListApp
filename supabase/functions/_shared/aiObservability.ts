type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

type CaptureGeminiGenerationOptions = {
  traceId: string;
  spanName: string;
  input: string;
  output?: string;
  response?: GeminiResponse;
  status: number;
  startedAt: number;
  temperature: number;
};

const projectToken = Deno.env.get('POSTHOG_PROJECT_TOKEN');
const host = Deno.env.get('POSTHOG_HOST');
const isProduction =
  Deno.env.get('NODE_ENV') === 'production' || Boolean(Deno.env.get('DENO_DEPLOYMENT_ID'));

if ((!projectToken || !host) && !isProduction) {
  const variable = projectToken ? 'POSTHOG_HOST' : 'POSTHOG_PROJECT_TOKEN';
  console.warn(
    `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`
  );
}

/**
 * Queues one raw Gemini REST response for AI Observability without delaying the Edge Function.
 * Each Edge Function request is a one-shot trace, so its AI session is explicitly null.
 */
export function captureGeminiGeneration({
  traceId,
  spanName,
  input,
  output,
  response,
  status,
  startedAt,
  temperature,
}: CaptureGeminiGenerationOptions): void {
  if (!projectToken || !host) return;

  const usage = response?.usageMetadata;
  const properties: Record<string, unknown> = {
    distinct_id: 'anonymous',
    $ai_trace_id: traceId,
    $ai_session_id: null,
    $ai_span_id: crypto.randomUUID(),
    $ai_span_name: spanName,
    $ai_model: 'gemini-2.5-flash',
    $ai_provider: 'gemini',
    $ai_input: [{ role: 'user', content: input }],
    $ai_latency: (performance.now() - startedAt) / 1000,
    $ai_http_status: status,
    $ai_temperature: temperature,
    $ai_input_tokens: usage?.promptTokenCount,
    $ai_output_tokens: usage?.candidatesTokenCount,
    $ai_stop_reason: response?.candidates?.[0]?.finishReason,
  };

  if (output) {
    properties.$ai_output_choices = [{ role: 'assistant', content: output }];
  }

  if (status < 200 || status >= 300) {
    properties.$ai_is_error = true;
  }

  const delivery = fetch(`${host.replace(/\/$/, '')}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(2000),
    body: JSON.stringify({
      api_key: projectToken,
      event: '$ai_generation',
      properties,
    }),
  }).catch(() => undefined);

  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime) {
    edgeRuntime.waitUntil(delivery);
  }
}
