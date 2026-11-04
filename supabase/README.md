# قاعدة بيانات ضيافتي (Supabase)

## الملفات بالترتيب
| الملف | شو بيعمل |
|---|---|
| `01_schema.sql` | الجداول كلها |
| `02_policies.sql` | الصلاحيات (RLS)، وسطل الصور `images`، والـ realtime للطلبات |
| `03_functions.sql` | `place_order`، `get_order`، `get_orders`، `check_coupon`، `submit_review` |
| `04_seed.sql` | الإعدادات، وأصناف وقصص الديمو، ومناطق توصيل للمثال |
| `05_make_admin.sql` | بيخلّي حساب صاحب المحل أدمن |
| `06_test.sql` | فحص إنو الزبون ما بيقدر يغش أو يقرأ شي ممنوع (ما بيترك أثر) |
| `07_hardening.sql` | تصليحات الـ Security Advisor (للمشروع اللي انشغّل عليه 03 القديم) |

كل الملفات آمنة لو انشغّلت مرتين.

## التشغيل من SQL Editor
1. افتح المشروع بـ supabase.com ← **SQL Editor** ← **New query**.
2. انسخ محتوى `01_schema.sql` كله، الصقه، واكبس **Run**. لازم يطلع `Success`.
3. نفس الشي لـ `02_policies.sql`، بعدين `03_functions.sql`، بعدين `04_seed.sql`.
4. **Authentication ← Users ← Add user ← Create new user**: إيميل وكلمة سر لصاحب المحل، وعلّم **Auto Confirm User**.
5. انسخ `05_make_admin.sql` للـ SQL Editor، وبدّل `owner@example.com` بالإيميل **هناك بس**، وشغّله. لازم يطلع صف فيه الإيميل. **الملف نفسه ما بيتعدّل أبداً** (الريبو public).
6. شغّل `06_test.sql`. إذا طلع `Success` بلا أحمر، كلشي تمام. أي مشكلة بتطلع برسالة أولها `FAIL`.
7. **Authentication ← Sign In / Providers**: سكّر **Allow new users to sign up** و **Anonymous sign-ins**. (حتى لو حدا سجّل، ما بيصير أدمن، بس هيك أنضف.)
8. شغّل `07_hardening.sql`.
9. **Project Settings ← API Keys**: خود الـ `Project URL` والـ `anon public` key لملف `config.js`. **الـ `service_role` لا تحطه بأي مكان بالريبو.**

## إعدادات تسجيل الدخول (Authentication ← URL Configuration)
| | هلق (Live Server) | بعد الدومين |
|---|---|---|
| **Site URL** | `http://127.0.0.1:5500` | `https://الدومين` |
| **Redirect URLs** | `http://127.0.0.1:5500/**` و `http://localhost:5500/**` و `https://dev--diyafati-dev.netlify.app/**` | `https://الدومين/**` (وشيل روابط localhost و dev قبل التسليم) |

- رابط «نسيت كلمة السر» بيرجع على `reset.html` بنفس المكان اللي انطلب منه، ولازم يكون مسموح بـ Redirect URLs، وإلا Supabase بيبعت على الـ Site URL.
- **إيميلات Supabase المجانية** بتوصل بس لإيميلات أعضاء الفريق بالمشروع (ولعدد قليل بالساعة). لهيك قبل التسليم لازم نضبط **SMTP خاص** (Authentication ← Emails ← SMTP Settings)، متل Resend أو Gmail بـ App Password. بدونه إيميل «نسيت كلمة السر» ما رح يوصل لصاحب المحل.

## الإشعارات (Edge Function: `notify-order`)
الكود بـ `functions/notify-order/index.ts`، ملف واحد بلا مكتبات. المفتاح العام بـ `config.js`، والباقي أسرار.

**الأسرار** (Edge Functions ← Secrets)، وما بتنحط بالريبو أبداً: `VAPID_PUBLIC_KEY` و `VAPID_PRIVATE_KEY` و `VAPID_SUBJECT` و `WEBHOOK_SECRET`.

**الرفع:** Edge Functions ← Deploy a new function ← Via Editor. الاسم `notify-order`، الصق الملف، Deploy. بعدها من إعدادات الدالة طفّي **Verify JWT**، لأن الدالة بتفحص الصلاحية لحالها (`is_admin` أو `x-webhook-secret`).

**ربط الطلبات الجديدة** (منعمله بعد ما تنجح التجربة): Integrations ← Database Webhooks ← Create. الجدول `orders`، الحدث `Insert`، النوع Supabase Edge Function، الدالة `notify-order`، وضيف هيدر `x-webhook-secret` قيمته نفس `WEBHOOK_SECRET`.

- `accepted` بنتيجة الزر التجريبي معناها خدمة الإشعارات استلمت، مو إنو الموبايل عرضه. الدليل الوحيد إنو الإشعار طلع عالشاشة.
- الإشعار بيروح لكل جهاز مشترك. بعد التجربة وقّف الإشعارات على موبايل التجربة.

## Security Advisor: التحذيرات اللي بتضل (متوقعة)
بعد `07_hardening.sql` بيضل 13 تحذير (و 0 أخطاء)، وكلهن مقصودين:
- **SECURITY DEFINER** على `place_order` و `get_order` و `get_orders` و `check_coupon` و `submit_review` و `is_admin`.
  هاد هو التصميم: الزبون ما إله صلاحية عالجداول، وهالدوال هي الباب الوحيد، وكل وحدة بتفحص مدخلاتها (التوكن، الأسعار، الكوبون...).
- **Leaked Password Protection**: ميزة بالباقة المدفوعة بس. بدالها: كلمة سر صاحب المحل قوية (12 حرف وأكتر).

إذا طلع تحذير جديد غير هدول، وقّف وشوف شو هو قبل ما تكمّل.

## ملاحظات
- الأسعار أرقام صحيحة بالليرة. الكمية بالكيلو لازم تكون مضاعفات نص كيلو، وغير هيك أعداد صحيحة.
- `delivery_fee` فاضي يعني «حسب الاتفاق» (متل خارج سوريا)، وما بينحسب بالمجموع.
- أخطاء `place_order` بترجع بكلمة إنكليزية قصيرة (`invalid_coupon`، `shop_closed`...). القائمة كاملة بأول `03_functions.sql`، والواجهة بتترجمها.
- صفحة متابعة الطلب بتسأل `get_order` كل شوي (polling)، لأن الزبون ما إله realtime على جدول الطلبات.
