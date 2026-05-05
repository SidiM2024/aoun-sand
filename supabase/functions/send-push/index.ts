// supabase/functions/send-push/index.ts
// Supabase Edge Function — sends Web Push notifications to all subscribers
// Deploy: supabase functions deploy send-push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ── VAPID signing ── */
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:admin@aoun-sand.com';

async function signVapidJwt(audience: string): Promise<string> {
  // Convert base64url private key to PEM
  const rawKey = Uint8Array.from(
    atob(VAPID_PRIVATE_KEY.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );
  // Import as EC private key (P-256)
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  ).catch(async () => {
    // fallback: try importing via jose
    return await importPKCS8(
      `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...rawKey))}\n-----END PRIVATE KEY-----`,
      'ES256'
    );
  });

  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ sub: VAPID_SUBJECT })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 12 * 3600)
    .sign(privateKey);
}

/* ── Send single push ── */
async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: object
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await signVapidJwt(audience);

    const vapidHeader = `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;
    const body = JSON.stringify(payload);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
        'Authorization': vapidHeader,
        'Urgency': 'high',
      },
      body,
    });

    if (!response.ok && response.status !== 201) {
      return { ok: false, error: `HTTP ${response.status}: ${await response.text()}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { title, message, link, media_url } = body;

    if (!title || !message) {
      return new Response(JSON.stringify({ error: 'title and message required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all subscriptions
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key');

    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = { title, message, link: link || '/', media_url: media_url || null };

    // Send to all — in parallel batches of 10
    const results: { ok: boolean; error?: string }[] = [];
    const staleEndpoints: string[] = [];

    const batchSize = 10;
    for (let i = 0; i < subs.length; i += batchSize) {
      const batch = subs.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((sub) => sendPush(sub, payload))
      );
      batchResults.forEach((r, idx) => {
        results.push(r);
        // 410 Gone = subscription expired → mark for cleanup
        if (!r.ok && r.error?.includes('410')) {
          staleEndpoints.push(batch[idx].endpoint);
        }
      });
    }

    // Cleanup stale subscriptions
    if (staleEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', staleEndpoints);
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return new Response(
      JSON.stringify({ sent, failed, total: subs.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
