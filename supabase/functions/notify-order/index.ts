// =========================================================
// ضيافتي — Edge Function: notify-order
// بتبعت إشعار Web Push لكل موبايل مفعّل الإشعارات باللوحة.
// مين بيستدعيها:
//   1) زر «إشعار تجريبي» باللوحة: لازم يكون الحساب أدمن (منفحص is_admin).
//   2) Database Webhook على كل طلب جديد: بيبعت الهيدر x-webhook-secret.
// لازم تنعمل مع Verify JWT مطفي، لأن الـ webhook ما معه JWT، والفحص صاير هون.
// ما في أي مكتبة خارجية: التشفير كله WebCrypto، حسب RFC 8291 و RFC 8292.
//
// الأسرار (Edge Functions ← Secrets)، وما بتنحط بالريبو أبداً:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEBHOOK_SECRET
// =========================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT');
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

const enc = new TextEncoder();

/* ---------- base64url ---------- */
function toB64u(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64u(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

/* ---------- توقيع VAPID: بيثبت لخدمة الإشعارات إنو الطلب من عنا ---------- */
async function vapidHeader(endpoint) {
  const pub = fromB64u(VAPID_PUBLIC);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE,
    x: toB64u(pub.slice(1, 33)), y: toB64u(pub.slice(33, 65)),
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const head = toB64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toB64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${toB64u(sig)}, k=${VAPID_PUBLIC}`;
}

/* ---------- تشفير الرسالة (aes128gcm): بس موبايل الزبون بيقدر يفتحها ---------- */
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

async function encrypt(text, p256dh, authSecret) {
  const uaPublic = fromB64u(p256dh);
  const auth = fromB64u(authSecret);

  // مفتاح مؤقت لكل رسالة
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, pair.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const padded = concat(enc.encode(text), new Uint8Array([2]));   // 2 = آخر قطعة
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, padded));

  // الترويسة: salt + حجم القطعة 4096 + طول المفتاح + المفتاح المؤقت
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

/* ---------- إرسال لموبايل واحد ---------- */
async function sendPush(sub, message) {
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',        // إذا الموبايل مطفي، بيوصل الإشعار لما يرجع خلال 24 ساعة
      Urgency: 'high',     // لحتى ما يتأخر وهو مقفول
    },
    body: await encrypt(JSON.stringify(message), sub.p256dh, sub.auth),
  });
}

/* ---------- جدول الاشتراكات (بالـ service key، لأن الـ webhook ما معه مستخدم) ---------- */
const adminHeaders = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

async function loadSubscriptions() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, { headers: adminHeaders() });
  if (!res.ok) throw new Error(`subscriptions_${res.status}`);
  return res.json();
}
async function removeSubscription(endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE', headers: adminHeaders(),
  });
}

// هل اللي استدعى الدالة أدمن؟ منسأل is_admin بنفس جلسته
async function isAdmin(req) {
  const authorization = req.headers.get('authorization');
  if (!authorization) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: authorization, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.ok && (await res.json()) === true;
}

function buildMessage(fromWebhook, body) {
  if (!fromWebhook) {
    return { title: 'إشعار تجريبي من ضيافتي', body: 'إذا شايف هالإشعار، الإشعارات شغّالة ✅', url: 'admin.html', tag: `test-${Date.now()}` };
  }
  const o = body.record;
  if (body.type !== 'INSERT' || !o) return null;
  return {
    title: `طلب جديد #${o.code}`,
    body: `${o.customer_name}، ${Number(o.total).toLocaleString('en-US')} ل.س`,
    url: 'admin.html#orders',
    tag: o.code,
  };
}

Deno.serve(async req => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') || 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const secret = req.headers.get('x-webhook-secret');
  const fromWebhook = !!WEBHOOK_SECRET && secret === WEBHOOK_SECRET;
  if (!fromWebhook && !(await isAdmin(req))) return reply({ error: 'unauthorized' }, 401);

  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) return reply({ error: 'missing_vapid_secrets' }, 500);

  const body = await req.json().catch(() => ({}));
  const message = buildMessage(fromWebhook, body);
  if (!message) return reply({ skipped: true });

  try {
    const subs = await loadSubscriptions();
    const result = { subscriptions: subs.length, accepted: 0, removed: 0, failed: [] };

    await Promise.all(subs.map(async sub => {
      const host = new URL(sub.endpoint).host;
      try {
        const res = await sendPush(sub, message);
        if (res.ok) result.accepted++;
        else if (res.status === 404 || res.status === 410) {
          // الاشتراك انتهى (ألغوا الإشعارات أو حذفوا التطبيق)
          await removeSubscription(sub.endpoint);
          result.removed++;
        } else {
          result.failed.push({ host, status: res.status, detail: (await res.text()).slice(0, 200) });
        }
      } catch (err) {
        result.failed.push({ host, status: 0, detail: String(err).slice(0, 200) });
      }
    }));

    // accepted معناها خدمة الإشعارات استلمت، مو إنو الموبايل عرضه
    console.log(JSON.stringify(result));
    return reply(result);
  } catch (err) {
    console.error(err);
    return reply({ error: String(err.message || err) }, 500);
  }
});
