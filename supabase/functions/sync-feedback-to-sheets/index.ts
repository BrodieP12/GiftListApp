// sync-feedback-to-sheets: ports functions/src/syncFeedbackToSheets.ts
//
// Invoked as a Supabase Database Webhook on INSERT into public.feedback
// (replaces the Firestore onDocumentCreated trigger). Appends a row to a
// Google Sheet using the Sheets REST API, authenticated with a service-account
// JWT signed in-process (replaces the Node `googleapis` client).
//
// Secrets required:
//   GOOGLE_SHEETS_SA_JSON  -> the full service account JSON (string)
//   FEEDBACK_SHEET_ID      -> target spreadsheet id
import { create, getNumericDate } from 'djwt';
import { json, preflight } from '../_shared/cors.ts';

interface FeedbackRecord {
  created_at?: string;
  user_email?: string;
  user_id?: string;
  text?: string;
  platform?: string;
  type?: string;
}

/** Imports a PEM PKCS8 private key for RS256 signing. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/** Exchanges a signed service-account JWT for a Google OAuth access token. */
async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const key = await importPrivateKey(sa.private_key);
  const now = getNumericDate(0);
  const assertion = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: getNumericDate(3600),
    },
    key
  );

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const tok = await resp.json();
  if (!tok.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(tok)}`);
  return tok.access_token;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const payload = await req.json();
    // Database Webhook payload: { type, table, record, ... }
    const data: FeedbackRecord = payload.record ?? payload;

    const sa = JSON.parse(Deno.env.get('GOOGLE_SHEETS_SA_JSON') || '{}');
    const sheetId = Deno.env.get('FEEDBACK_SHEET_ID');
    if (!sa.client_email || !sheetId) {
      return json({ error: 'Sheets credentials not configured' }, 500);
    }

    const accessToken = await getAccessToken(sa);

    const row = [
      data.created_at || new Date().toISOString(),
      data.user_email || 'Anonymous',
      data.user_id || 'N/A',
      data.text || '',
      data.platform || 'mobile',
      data.type || 'general',
    ];

    const appendResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A2:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      }
    );

    if (!appendResp.ok) {
      const errText = await appendResp.text();
      if (appendResp.status === 403) {
        console.error('PRO TIP: Share the Google Sheet with the service account as an Editor.');
      }
      throw new Error(`Sheets append failed (${appendResp.status}): ${errText}`);
    }

    return json({ success: true });
  } catch (error) {
    console.error('Error syncing feedback to Google Sheets:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
