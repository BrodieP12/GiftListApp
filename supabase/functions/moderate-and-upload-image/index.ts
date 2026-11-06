// moderate-and-upload-image
// ---------------------------------------------------------------------------
// Supabase Edge Function. Given a base64-encoded image from the app (already
// resized/compressed client-side by ImageUploadService), this:
//   1. Verifies the caller is a signed-in user (via their JWT).
//   2. Sends the image to Sightengine's nudity-detection model BEFORE it is
//      ever written to storage.
//   3. If the image is flagged as NSFW, rejects the request — nothing is
//      stored.
//   4. If the image is clean, uploads it to the `item-images` Storage
//      bucket using the service_role key and returns its public URL.
//
// This whole check runs server-side (rather than in the React Native app)
// for two reasons: the Sightengine API secret can't be safely embedded in a
// mobile client, and the `item-images` bucket intentionally has no
// client-writable RLS policy — the only way an image reaches storage at all
// is through this function, which guarantees every stored image has been
// moderated. See supabase/migrations/003_item_images_storage.sql for the
// storage RLS side of this guarantee.
//
// Required secrets (set via `supabase secrets set`):
//   SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET  - from sightengine.com
// Auto-provided by the Supabase platform (no setup needed):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'item-images';

// Defensive upper bound on the decoded image size this function will
// accept. The client is expected to compress images to well under this
// (see ImageUploadService.ts), so hitting this limit means either a bug in
// the client or a caller bypassing the app entirely.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Nudity-2.1 model score thresholds (0-1 confidence) above which an image
// is rejected. Deliberately conservative: this app is a gift-list product
// catalog, so ordinary product photos (including things like swimwear)
// should pass, while actual nudity/sexual content should not. Tune these
// if moderation turns out too strict/lenient in practice.
const NUDITY_REJECT_THRESHOLDS: Record<string, number> = {
  sexual_activity: 0.5,
  sexual_display: 0.5,
  erotica: 0.5,
  very_suggestive: 0.5,
};

interface RequestBody {
  /** Base64-encoded image bytes (no `data:` URI prefix). */
  imageBase64: string;
  /** MIME type of the image, e.g. `image/jpeg`. */
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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Calls Sightengine's nudity-2.1 model directly with the image bytes (a
 * multipart POST, not a URL reference) so the image never needs to be
 * publicly hosted just to be checked.
 *
 * Returns the list of score keys that exceeded their reject threshold; an
 * empty array means the image passed moderation.
 */
async function checkNudity(imageBytes: Uint8Array, contentType: string): Promise<string[]> {
  const apiUser = Deno.env.get('SIGHTENGINE_API_USER');
  const apiSecret = Deno.env.get('SIGHTENGINE_API_SECRET');
  if (!apiUser || !apiSecret) {
    throw new Error('Sightengine credentials are not configured (SIGHTENGINE_API_USER/SECRET).');
  }

  const form = new FormData();
  // `imageBytes` is typed as Uint8Array<ArrayBufferLike>, which TS won't
  // narrow to BlobPart (it excludes SharedArrayBuffer-backed views) even
  // though Blob accepts it fine at runtime — the cast just satisfies the
  // type checker.
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
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // Identify the caller from their JWT. Using the anon-key client's
  // auth.getUser(jwt) (rather than decoding the token ourselves) lets
  // Supabase Auth do the actual signature/expiry verification.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return jsonResponse({ error: 'unauthorized', message: 'Missing Authorization header.' }, 401);
  }

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: userData, error: userError } = await anonClient.auth.getUser(jwt);
  if (userError || !userData.user) {
    return jsonResponse({ error: 'unauthorized', message: 'Invalid or expired session.' }, 401);
  }
  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'bad_request', message: 'Expected a JSON body.' }, 400);
  }

  if (!body.imageBase64 || !body.contentType) {
    return jsonResponse({ error: 'bad_request', message: 'imageBase64 and contentType are required.' }, 400);
  }
  if (!body.contentType.startsWith('image/')) {
    return jsonResponse({ error: 'bad_request', message: 'contentType must be an image/* type.' }, 400);
  }

  let imageBytes: Uint8Array;
  try {
    imageBytes = base64ToUint8Array(body.imageBase64);
  } catch {
    return jsonResponse({ error: 'bad_request', message: 'imageBase64 is not valid base64.' }, 400);
  }

  if (imageBytes.byteLength === 0 || imageBytes.byteLength > MAX_IMAGE_BYTES) {
    return jsonResponse({ error: 'bad_request', message: 'Image is empty or exceeds the size limit.' }, 400);
  }

  // Moderation happens before anything touches storage. If Sightengine
  // itself is unreachable/misconfigured, this fails CLOSED (rejects the
  // upload) rather than silently letting an unmoderated image through.
  try {
    const violations = await checkNudity(imageBytes, body.contentType);
    if (violations.length > 0) {
      console.log(`Rejected image from user ${userId}: flagged for ${violations.join(', ')}`);
      return jsonResponse(
        { error: 'nsfw_detected', message: 'This image was flagged by our content filter. Please choose a different photo.' },
        422,
      );
    }
  } catch (err) {
    console.error('Moderation check failed:', err);
    return jsonResponse(
      { error: 'moderation_unavailable', message: 'Could not verify this image right now. Please try again.' },
      503,
    );
  }

  // Only reachable once the image has passed moderation. Uses the
  // service_role key specifically so this is the only code path that can
  // ever write to the item-images bucket (see the migration for the RLS
  // reasoning).
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const extension = body.contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(path, imageBytes, { contentType: body.contentType, upsert: false });

  if (uploadError) {
    console.error('Storage upload failed:', uploadError);
    return jsonResponse({ error: 'upload_failed', message: 'Failed to store the image.' }, 500);
  }

  const { data: publicUrlData } = serviceClient.storage.from(BUCKET).getPublicUrl(path);
  return jsonResponse({ url: publicUrlData.publicUrl }, 200);
});
