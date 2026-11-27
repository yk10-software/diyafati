// =========================================================
// ضيافتي — Edge Function: notify-order
// بتبعت إشعار Web Push لكل موبايل مفعّل الإشعارات باللوحة.
// مين بيستدعيها:
//   1) زر «إشعار تجريبي» باللوحة: لازم يكون الحساب أدمن (منفحص is_admin).
//   2) trigger عـ orders (net.http_post) على كل طلب جديد: بيبعت صف الطلب.
//      ما في سر مشترك: منتأكد إنو الطلب موجود فعلاً بالقاعدة وانعمل هلق،
//      ومنبني نص الإشعار من القاعدة، مو من اللي انبعت.
//      وكل طلب إله إشعار واحد بس (notified_at، ملف 10_notified_at.sql).
//   3) trigger لما تتغيّر حالة الطلب (type = 'STATUS'، ملف 23_customer_push.sql):
//      بتبعت للزبون، لموبايلاته المشتركة بهالطلب بس (order_push_subscriptions).
//      الحالة منقراها من القاعدة، وكل حالة إلها إشعار واحد (status_notified).
//   4) trigger لما صاحب المحل يبعت رسالة للكل (type = 'BROADCAST'، ملف 24_broadcasts.sql):
//      بتبعت لكل الموبايلات اللي كبست «بلّغني بالعروض» (promo_push_subscriptions).
//      النص منقراه من جدول broadcasts، وكل رسالة بتنبعت مرة وحدة (sent_at).
// لازم تنعمل مع Verify JWT مطفي، لأن الـ trigger ما معه JWT، والفحص صاير هون.
// ما في أي مكتبة خارجية: التشفير كله WebCrypto، حسب RFC 8291 و RFC 8292.
//
// الأسرار (Edge Functions ← Secrets)، وما بتنحط بالريبو أبداً:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// =========================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT');

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

const TEST_MESSAGE = () => ({
  title: 'إشعار تجريبي من ضيافتي', body: 'إذا شايف هالإشعار، الإشعارات شغّالة ✅',
  url: 'admin.html', tag: `test-${Date.now()}`,
});

// منحجز الإشعار بـ update شرطي: الطلب لازم يكون موجود، وانعمل آخر 10 دقايق،
// و notified_at فاضي. القاعدة بتسمح لاستدعاء واحد بس ياخد الصف،
// فإذا انستدعت الدالة مرتين لنفس الطلب، الإشعار بيروح مرة وحدة.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function orderMessage(id) {
  if (!UUID.test(String(id))) return null;
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${id}&created_at=gte.${encodeURIComponent(since)}&notified_at=is.null&select=code,customer_name,total`,
    {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ notified_at: new Date().toISOString() }),
    });
  if (!res.ok) throw new Error(`order_${res.status}`);
  const [o] = await res.json();
  if (!o) return null;
  return {
    title: `طلب جديد #${o.code}`,
    body: `${o.customer_name}، ${Number(o.total).toLocaleString('en-US')} ل.س`,
    url: 'admin.html#orders',
    tag: o.code,
  };
}

/* ---------- إشعار الزبون لما تتغيّر حالة طلبه ---------- */
const STATUS_TEXT = {
  preparing: { title: 'طلبك عم يتحضّر 👌', body: 'المحل بلّش يحضّر طلبك' },
  on_way:    { title: 'طلبك طلع بالطريق 🚗', body: 'رح يوصلك قريباً' },
  delivered: { title: 'وصل طلبك 🌹', body: 'نتمنى يعجبك. قيّم طلبك من هون' },
  cancelled: { title: 'انلغى طلبك', body: 'لأي سؤال راسل المحل عالواتس' },
};

// منحجز الإشعار بـ update شرطي: الحالة لازم تكون نفسها، وما انبعتلها إشعار قبل.
// هيك إذا انستدعت الدالة كذا مرة، الزبون بيوصله إشعار واحد لكل حالة.
async function statusMessage(id) {
  if (!UUID.test(String(id))) return null;
  const cur = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}&select=status,status_notified`, { headers: adminHeaders() });
  if (!cur.ok) throw new Error(`order_${cur.status}`);
  const [o] = await cur.json();
  if (!o || !STATUS_TEXT[o.status] || o.status_notified === o.status) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${id}&status=eq.${o.status}` +
    `&or=(status_notified.is.null,status_notified.neq.${o.status})&select=code,token,status`,
    {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status_notified: o.status }),
    });
  if (!res.ok) throw new Error(`order_${res.status}`);
  const [row] = await res.json();
  if (!row) return null;
  const t = STATUS_TEXT[row.status];
  return {
    title: t.title,
    body: `${t.body} · #${row.code}`,
    url: `./?order=${encodeURIComponent(row.token)}`,
    tag: `order-${row.code}`,
  };
}

async function loadOrderSubscriptions(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/order_push_subscriptions?order_id=eq.${id}&select=id,endpoint,p256dh,auth`, { headers: adminHeaders() });
  if (!res.ok) throw new Error(`order_subscriptions_${res.status}`);
  return res.json();
}
async function removeOrderSubscription(subId) {
  await fetch(`${SUPABASE_URL}/rest/v1/order_push_subscriptions?id=eq.${subId}`, { method: 'DELETE', headers: adminHeaders() });
}

/* ---------- رسالة صاحب المحل لكل المشتركين ---------- */
// منحجز الرسالة بـ update شرطي (sent_at فاضي)، فما بتنبعت مرتين.
async function claimBroadcast(id) {
  if (!/^\d{1,12}$/.test(String(id))) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/broadcasts?id=eq.${id}&sent_at=is.null&select=id,title,body`,
    {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ sent_at: new Date().toISOString() }),
    });
  if (!res.ok) throw new Error(`broadcast_${res.status}`);
  const [b] = await res.json();
  return b || null;
}

// كل الاشتراكات، 1000 ورا 1000 (أكتر شي بيرجّعه Supabase بالمرة)
async function loadPromoSubscriptions() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/promo_push_subscriptions?select=id,endpoint,p256dh,auth&order=id&limit=1000&offset=${from}`,
      { headers: adminHeaders() });
    if (!res.ok) throw new Error(`promo_subscriptions_${res.status}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

async function sendBroadcast(b) {
  const message = { title: b.title, body: b.body, url: './', tag: `promo-${b.id}` };
  const subs = await loadPromoSubscriptions();
  let accepted = 0;
  const dead = [];
  // 50 ورا 50، لحتى ما نفتح آلاف الاتصالات بنفس اللحظة
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(subs.slice(i, i + 50).map(async sub => {
      try {
        const res = await sendPush(sub, message);
        if (res.ok) accepted++;
        else if (res.status === 404 || res.status === 410) dead.push(sub.id);
        else console.warn(new URL(sub.endpoint).host, res.status);
      } catch (err) {
        console.warn(String(err).slice(0, 200));
      }
    }));
  }
  // الاشتراكات المنتهية (ألغوا الإشعارات أو حذفوا التطبيق)
  for (let i = 0; i < dead.length; i += 200) {
    await fetch(`${SUPABASE_URL}/rest/v1/promo_push_subscriptions?id=in.(${dead.slice(i, i + 200).join(',')})`,
      { method: 'DELETE', headers: adminHeaders() });
  }
  await fetch(`${SUPABASE_URL}/rest/v1/broadcasts?id=eq.${b.id}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sent_count: accepted, removed_count: dead.length }),
  });
  console.log(JSON.stringify({ broadcast: b.id, subscriptions: subs.length, accepted, removed: dead.length }));
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

  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) return reply({ error: 'missing_vapid_secrets' }, 500);

  const body = await req.json().catch(() => ({}));
  // الـ trigger بيبعت صف الطلب نفسه، والـ webhook القديم كان يبعته جوّا record
  const orderId = body?.record?.id ?? body?.id;

  // رسالة للكل: منرد دغري، والإرسال بيكمل بالخلفية (ممكن يكونوا آلاف الموبايلات)
  if (body?.type === 'BROADCAST') {
    let b;
    try {
      b = await claimBroadcast(orderId);
    } catch (err) {
      console.error(err);
      return reply({ error: 'broadcast_check_failed' }, 500);
    }
    if (!b) return reply({ skipped: true });
    const job = sendBroadcast(b).catch(err => console.error(err));
    // @ts-ignore: EdgeRuntime موجود على Supabase بس
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(job); else await job;
    return reply({ queued: true });
  }

  let message;
  let forCustomer = false;
  if (body?.type === 'STATUS') {
    try {
      message = await statusMessage(orderId);
    } catch (err) {
      console.error(err);
      return reply({ error: 'order_check_failed' }, 500);
    }
    if (!message) return reply({ skipped: true });
    forCustomer = true;
  } else if (orderId) {
    try {
      message = await orderMessage(orderId);
    } catch (err) {
      console.error(err);
      return reply({ error: 'order_check_failed' }, 500);
    }
    // ما في صف: الطلب مو موجود، أو قديم، أو انبعت إشعاره من قبل
    if (!message) return reply({ skipped: true });
  } else {
    if (!(await isAdmin(req))) return reply({ error: 'unauthorized' }, 401);
    message = TEST_MESSAGE();
  }

  try {
    const subs = forCustomer ? await loadOrderSubscriptions(orderId) : await loadSubscriptions();
    const result = { subscriptions: subs.length, accepted: 0, removed: 0, failed: [] };

    await Promise.all(subs.map(async sub => {
      const host = new URL(sub.endpoint).host;
      try {
        const res = await sendPush(sub, message);
        if (res.ok) result.accepted++;
        else if (res.status === 404 || res.status === 410) {
          // الاشتراك انتهى (ألغوا الإشعارات أو حذفوا التطبيق)
          if (forCustomer) await removeOrderSubscription(sub.id);
          else await removeSubscription(sub.endpoint);
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