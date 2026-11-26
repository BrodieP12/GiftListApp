import { corsHeaders, json, preflight } from '../_shared/cors.ts';

// In-memory rate limiting map: ip -> lastRequestTimestamp
const rateLimitMap = new Map<string, number>();

// Official builds registry
const BUILDS_ARCHIVE = [
  {
    version: '1.0.12',
    buildNumber: 13,
    date: '2026-11-24',
    title: 'Account Store Preferences & Gesture Scroll Optimization',
    changelog: 'Added user-configurable preferred store selection in Account Settings with automatic price/store fallback. Redesigned all settings screens with gesture-handler scroll containers for fluid vertical scrolling. Integrated live product listing extractor with retail store fallback options.',
    aabUrl: 'https://dashboard.brodiepasker.xyz/giftlistapp/GiftListApp.aab?v=1.0.13',
    apkUrl: 'https://dashboard.brodiepasker.xyz/giftlistapp/GiftListApp.apk?v=1.0.13',
    aabSize: '69.3 MB',
    apkSize: '103.8 MB',
  },
  {
    version: '1.0.11',
    buildNumber: 12,
    date: '2026-11-21',
    title: 'Store Settings Architecture & Developer Portal Initial Release',
    changelog: 'Added initial schema migrations for account store preferences. Deployed initial web distribution portal on dashboard.brodiepasker.xyz with step-by-step sideloading installation guide.',
    aabUrl: 'https://dashboard.brodiepasker.xyz/giftlistapp/builds/v1.0.11/GiftListApp.aab',
    apkUrl: 'https://dashboard.brodiepasker.xyz/giftlistapp/builds/v1.0.11/GiftListApp.apk',
    aabSize: '69.3 MB',
    apkSize: '103.7 MB',
  },
  {
    version: '1.0.10',
    buildNumber: 11,
    date: '2026-11-20',
    title: 'Complete Supabase Migration & Realtime Synchronization',
    changelog: 'Full backend transition from Firebase to Supabase. Implemented Postgres RLS policies, Realtime table subscriptions for gifts and claims, native image moderation via Edge Functions, and PostHog diagnostics telemetry.',
    aabUrl: 'https://dashboard.brodiepasker.xyz/giftlistapp/builds/v1.0.10/GiftListApp.aab',
    apkUrl: 'https://dashboard.brodiepasker.xyz/giftlistapp/builds/v1.0.10/GiftListApp.apk',
    aabSize: '69.3 MB',
    apkSize: '103.7 MB',
  }
];

async function signTicket(salt: string, expiresAt: number, code: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payload = `${salt}:${expiresAt}:${code}`;
  const signatureBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(signatureBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const clientIp = req.headers.get('cf-connecting-ip') ||
                   req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                   'unknown';

  const secret = Deno.env.get('PORTAL_SECRET') ||
                 Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
                 'giftlist-portal-fallback-secret-2026';

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON request body.' }, 400);
  }

  const action = body.action;

  // ----------------------------------------------------
  // ACTION 1: REQUEST CODE (DISPATCH TO DISCORD)
  // ----------------------------------------------------
  if (action === 'request_code') {
    // 1. Rate limiting: 1 request every 45 seconds per IP
    const now = Date.now();
    const lastTime = rateLimitMap.get(clientIp) || 0;
    if (now - lastTime < 45000) {
      const waitSec = Math.ceil((45000 - (now - lastTime)) / 1000);
      return json(
        { error: `Please wait ${waitSec} seconds before requesting another verification code.` },
        429
      );
    }
    rateLimitMap.set(clientIp, now);

    // 2. Generate a cryptographically secure 6-digit numeric OTP
    const randBuffer = new Uint32Array(1);
    crypto.getRandomValues(randBuffer);
    const code = String((randBuffer[0] % 900000) + 100000);

    // 3. Generate salt & expiry (5 minutes)
    const saltBuffer = new Uint8Array(16);
    crypto.getRandomValues(saltBuffer);
    const salt = Array.from(saltBuffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const expiresAt = now + 5 * 60 * 1000;

    // 4. Compute HMAC signature over (salt + expiresAt + code)
    const signature = await signTicket(salt, expiresAt, code, secret);
    const ticket = `${salt}:${expiresAt}:${signature}`;

    // 5. Send to Discord Webhook
    const webhookUrl = Deno.env.get('DISCORD_PORTAL_WEBHOOK_URL');
    if (!webhookUrl) {
      console.warn('DISCORD_PORTAL_WEBHOOK_URL is not set.');
      return json(
        {
          error:
            'Discord webhook URL is not configured on the backend. Please configure DISCORD_PORTAL_WEBHOOK_URL in Supabase secrets.',
          ticketNotSent: true,
        },
        500
      );
    }

    try {
      const discordPayload = {
        username: 'GiftList Portal Auth',
        avatar_url: 'https://dashboard.brodiepasker.xyz/giftlistapp/icon.png',
        embeds: [
          {
            title: '🔐 GiftList Portal Verification Code',
            description: `A request was made to unlock the GiftList App Build Archive.\n\nYour one-time verification code is:\n# \`\`\`${code}\`\`\`\n\n⏰ **Expires in 5 minutes.**\n🌐 Request IP: \`${clientIp}\``,
            color: 0x16a34a,
            timestamp: new Date().toISOString(),
            footer: {
              text: 'dashboard.brodiepasker.xyz/giftlistapp • Security Gate',
            },
          },
        ],
      };

      const discordRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
      });

      if (!discordRes.ok) {
        const errText = await discordRes.text();
        console.error('Failed to post to Discord webhook:', discordRes.status, errText);
        return json(
          { error: `Discord webhook rejected the message (status ${discordRes.status}).` },
          502
        );
      }
    } catch (err: any) {
      console.error('Error dispatching to Discord:', err);
      return json({ error: 'Failed to dispatch verification code to Discord.' }, 500);
    }

    // Notice: The OTP is NEVER returned to the browser. Only the cryptographic ticket.
    return json({
      success: true,
      ticket,
      expiresAt,
      message: 'Verification code sent to your Discord channel.',
    });
  }

  // ----------------------------------------------------
  // ACTION 2: VERIFY CODE
  // ----------------------------------------------------
  if (action === 'verify_code') {
    const { ticket, code } = body;
    if (!ticket || typeof ticket !== 'string' || !code || typeof code !== 'string') {
      return json({ error: 'Missing ticket or verification code.' }, 400);
    }

    const parts = ticket.split(':');
    if (parts.length !== 3) {
      return json({ error: 'Invalid or corrupted ticket format.' }, 400);
    }

    const [salt, expiresAtStr, signature] = parts;
    const expiresAt = Number(expiresAtStr);
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return json({ error: 'This verification code has expired. Please request a new one.' }, 400);
    }

    // Recompute the expected HMAC signature
    const cleanCode = code.trim();
    const expectedSig = await signTicket(salt, expiresAt, cleanCode, secret);

    if (!constantTimeEqual(expectedSig, signature)) {
      return json({ error: 'Invalid verification code. Please check Discord and try again.' }, 401);
    }

    // Generate authenticated builds list
    return json({
      success: true,
      authenticated: true,
      verifiedAt: new Date().toISOString(),
      builds: BUILDS_ARCHIVE,
    });
  }

  return json({ error: `Unknown action: "${action}". Valid actions are "request_code" or "verify_code".` }, 400);
});
