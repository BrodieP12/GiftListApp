// moderate-and-upload-image
// ---------------------------------------------------------------------------
// Supabase Edge Function matching the exact function name invoked by the app.
// Handles image moderation and upload to the item-images storage bucket.

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'item-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user;
}

const NUDITY_REJECT_THRESHOLDS: Record<string, number> = {
  sexual_activity: 0.5,
  sexual_display: 0.5,
  erotica: 0.5,
  very_suggestive: 0.5,
};

interface RequestBody {
  imageBase64: string;
  contentType: string;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function checkNudity(
  imageBytes: Uint8Array,
  contentType: string,
  apiUser: string,
  apiSecret: string
): Promise<string[]> {
  const form = new FormData();
  form.append('media', new Blob([imageBytes as BlobPart], { type: contentType }), 'upload');
  form.append('models', 'nudity-2.1');
  form.append('api_user', apiUser);
  form.append('api_secret', apiSecret);

  const response = await fetch('https://api.sightengine.com/1.0/check.json', {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Sightengine request failed with status ${response.status}`);
  }

  const result = await response.json();
  if (result.status !== 'success') {
    throw new Error(`Sightengine returned an error: ${JSON.stringify(result.error ?? result)}`);
  }

  const nudity = result.nudity ?? {};
  const violations: string[] = [];
  for (const [key, threshold] of Object.entries(NUDITY_REJECT_THRESHOLDS)) {
    if (typeof nudity[key] === 'number' && nudity[key] >= threshold) {
      violations.push(key);
    }
  }
  return violations;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const user = await getUser(req);
  if (!user) {
    return json({ error: 'unauthorized', message: 'Missing Authorization header or invalid session.' }, 401);
  }
  const userId = user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request', message: 'Expected a JSON body.' }, 400);
  }

  if (!body?.imageBase64 || !body?.contentType) {
    return json({ error: 'bad_request', message: 'imageBase64 and contentType are required.' }, 400);
  }
  if (!body.contentType.startsWith('image/')) {
    return json({ error: 'bad_request', message: 'contentType must be an image/* type.' }, 400);
  }

  let imageBytes: Uint8Array;
  try {
    const cleanBase64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    imageBytes = base64ToUint8Array(cleanBase64);
  } catch {
    return json({ error: 'bad_request', message: 'imageBase64 is not valid base64.' }, 400);
  }

  if (imageBytes.byteLength === 0 || imageBytes.byteLength > MAX_IMAGE_BYTES) {
    return json({ error: 'bad_request', message: 'Image is empty or exceeds the size limit.' }, 400);
  }

  // Moderation check with Sightengine.
  // In dev mode (if Sightengine keys are unset), allow upload as fallback.
  const apiUser = Deno.env.get('SIGHTENGINE_API_USER');
  const apiSecret = Deno.env.get('SIGHTENGINE_API_SECRET');

  if (!apiUser || !apiSecret) {
    console.warn('SIGHTENGINE_API_USER or SIGHTENGINE_API_SECRET not configured. Bypassing moderation in dev fallback mode.');
  } else {
    try {
      const violations = await checkNudity(imageBytes, body.contentType, apiUser, apiSecret);
      if (violations.length > 0) {
        console.log(`Rejected image from user ${userId}: flagged for ${violations.join(', ')}`);
        return json(
          { error: 'nsfw_detected', message: 'This image was flagged by our content filter. Please choose a different photo.' },
          422,
        );
      }
    } catch (err) {
      console.error('Moderation check failed:', err);
      return json(
        { error: 'moderation_unavailable', message: 'Could not verify this image right now. Please try again.' },
        503,
      );
    }
  }

  // Upload using service role adminClient so it bypasses RLS on item-images bucket
  const db = adminClient();
  const extension = body.contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, imageBytes, { contentType: body.contentType, upsert: false });

  if (uploadError) {
    console.error('Storage upload failed:', uploadError);
    return json({ error: 'upload_failed', message: 'Failed to store the image.' }, 500);
  }

  const { data: publicUrlData } = db.storage.from(BUCKET).getPublicUrl(path);
  return json({ url: publicUrlData.publicUrl }, 200);
});
