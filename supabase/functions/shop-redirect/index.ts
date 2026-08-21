# deno-types ignored by app tsconfig via exclude; keep Edge Function self-contained
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Merchant = {
  id: string;
  host_patterns: string[];
  tag_param: string | null;
  tag_value: string | null;
  enabled: boolean;
};

function hostMatches(hostname: string, patterns: string[]) {
  const host = hostname.toLowerCase();
  return patterns.some((p) => host === p.toLowerCase() || host.endsWith(`.${p.toLowerCase()}`));
}

function rewrite(rawUrl: string, merchants: Merchant[]) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { url: rawUrl, merchantId: null as string | null, tagged: false };
  }
  const merchant = merchants.find((m) => m.enabled && hostMatches(parsed.hostname, m.host_patterns));
  if (!merchant?.tag_param || !merchant.tag_value) {
    return { url: parsed.toString(), merchantId: merchant?.id ?? null, tagged: false };
  }
  parsed.searchParams.set(merchant.tag_param, merchant.tag_value);
  return { url: parsed.toString(), merchantId: merchant.id, tagged: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const url = new URL(req.url);
  const giftId = url.searchParams.get('giftId') ?? url.pathname.split('/').filter(Boolean).pop();
  if (!giftId) {
    return new Response('Missing giftId', { status: 400, headers: cors });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const authHeader = req.headers.get('Authorization');
  let userId: string | null = null;
  if (authHeader) {
    const anon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data } = await anon.auth.getUser();
    userId = data.user?.id ?? null;
  }

  const { data: gift, error } = await supabase
    .from('gifts')
    .select('id, url')
    .eq('id', giftId)
    .maybeSingle();

  if (error || !gift?.url) {
    return new Response('Gift not found', { status: 404, headers: cors });
  }

  const { data: merchants } = await supabase
    .from('affiliate_merchants')
    .select('id, host_patterns, tag_param, tag_value, enabled');

  const rewritten = rewrite(gift.url, (merchants as Merchant[]) ?? []);

  await supabase.from('affiliate_clicks').insert({
    gift_id: gift.id,
    user_id: userId,
    destination_url: rewritten.url,
    merchant_id: rewritten.merchantId,
    tagged: rewritten.tagged,
  });

  return Response.redirect(rewritten.url, 302);
});
