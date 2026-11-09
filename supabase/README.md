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
| `08_order_ref.sql` | رقم مرجعي للطلب، لحتى ما يتكرر إذا انبعت مرتين عالنت الضعيف (بعده لازم تعيد تشغيل `03_functions.sql`) |
| `08_notify_trigger.sql` | trigger اسمه `notify_new_order` بيستدعي `notify-order` مع كل طلب جديد عن طريق `net.http_post` |
| `09_shop_hours.sql` | ساعة الفتح والسكر، ومنهم بتطلع مواعيد التوصيل (بعده لازم تعيد تشغيل `03_functions.sql`) |
| `10_notified_at.sql` | عمود `notified_at`، لحتى يوصل إشعار واحد لكل طلب (لازم قبل رفع الدالة الجديدة) |
| `11_public_reviews.sql` | التقييمات بالموقع بالاسم الأول وأول حرف من الكنية، ومنع قراءة جدول `reviews` مباشرة |
| `12_social_links.sql` | روابط انستغرام وفيسبوك بأسفل الموقع، وبتنعدّل من الإعدادات |
| `13_category_images.sql` | صورة القسم، وعدد الحبات بالكيلو |
| `14_featured.sql` | الأصناف المميزة للشريط فوق الموقع |
| `15_quarter_kilo.sql` | الطلب بربع كيلو (بعده لازم تعيد تشغيل `03_functions.sql`) |

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

**الأسرار** (Edge Functions ← Secrets)، وما بتنحط بالريبو أبداً: `VAPID_PUBLIC_KEY` و `VAPID_PRIVATE_KEY` و `VAPID_SUBJECT`.

**الرفع:** Edge Functions ← Deploy a new function ← Via Editor. الاسم `notify-order`، الصق الملف، Deploy. بعدها من إعدادات الدالة طفّي **Verify JWT**، لأن الدالة بتفحص الطلب لحالها.

**ربط الطلبات الجديدة:** شغّل `08_notify_trigger.sql` من SQL Editor. ما في Database Webhook، والـ trigger بيبعت هيدر واحد بس هو `Content-Type`، بلا أي سر. فالدالة ما بتثق بالطلب الجاي، وبتتأكد بنفسها إنو الطلب موجود بالقاعدة وانعمل آخر 10 دقايق.

**إشعار واحد لكل طلب:** الدالة بتعمل update شرطي (`where notified_at is null`)، وما بتبعت إلا إذا رجّع صف. يعني الاستدعاء التاني بيرجع `skipped`. وإذا فشل الإرسال بعد الحجز ما في إعادة محاولة، لأن `notified_at` انكتب.

**إذا ما وصل الإشعار:** شوف شو رجّعت الدالة من SQL Editor:
```sql
select created, status_code, content, error_msg from net._http_response order by created desc limit 5;
```

- `accepted` بنتيجة الزر التجريبي معناها خدمة الإشعارات استلمت، مو إنو الموبايل عرضه. الدليل الوحيد إنو الإشعار طلع عالشاشة.
- الإشعار بيروح لكل جهاز مشترك. بعد التجربة وقّف الإشعارات على موبايل التجربة.

## إدخال الأصناف (`tools/import.html`)
صفحة بتشتغل من Live Server بس، وبتدخل بحساب الأدمن، وما في فيها أي مفتاح سري. ما بتنرفع مع الموقع (`netlify.toml`). حزمة الأصناف نفسها ما بتنحط بالريبو.

- لازم `13_category_images.sql` يكون منشغّل قبلها.
- لو انعاد التشغيل، القسم أو الصنف بنفس الاسم ما بيتكرر، فبتقدر تعيدها لتكمّل اللي فشل.
- خيار حذف النسخة التجريبية بيحذف صور القصص القديمة (مسارات `img/`)، والقصص اللي صورها مرفوعة بتضل، وبترجع تنربط بالصنف الجديد إذا إله نفس الاسم.

## منع توقف المشروع (keep-alive)
المشروع المجاني بيتوقف بعد أسبوع بلا نشاط. `.github/workflows/keep-alive.yml` بيقرأ صف من `settings` كل يوم.

- **المفتاح:** الريبو ← Settings ← Secrets and variables ← Actions ← New repository secret. الاسم `SUPABASE_KEY` والقيمة الـ publishable key. **لا تحط `service_role` أبداً.**
- **لازم الملف يكون على `main`:** GitHub بيشغّل `schedule` و«Run workflow» من الفرع الافتراضي بس، فعلى `dev` لحاله ما بيشتغل.
- **GitHub بيوقّف الجدولة** بالريبو العام إذا ضل 60 يوم بلا أي نشاط، وبيبعت إيميل. وقتها بينكبس **Enable workflow** من تبويب Actions.

## Security Advisor: التحذيرات اللي بتضل (متوقعة)
بعد `07_hardening.sql` بيضل 13 تحذير (و 0 أخطاء)، وبعد `11_public_reviews.sql` ممكن يصيروا 14 بسبب `get_public_reviews`، وكلهن مقصودين:
- **SECURITY DEFINER** على `place_order` و `get_order` و `get_orders` و `check_coupon` و `submit_review` و `get_public_reviews` و `is_admin`.
  هاد هو التصميم: الزبون ما إله صلاحية عالجداول، وهالدوال هي الباب الوحيد، وكل وحدة بتفحص مدخلاتها (التوكن، الأسعار، الكوبون...).
- **Leaked Password Protection**: ميزة بالباقة المدفوعة بس. بدالها: كلمة سر صاحب المحل قوية (12 حرف وأكتر).

إذا طلع تحذير جديد غير هدول، وقّف وشوف شو هو قبل ما تكمّل.

## ملاحظات
- الأسعار أرقام صحيحة بالليرة. الكمية بالكيلو لازم تكون مضاعفات نص كيلو، وغير هيك أعداد صحيحة.
- `delivery_fee` فاضي يعني «حسب الاتفاق» (متل خارج سوريا)، وما بينحسب بالمجموع.
- أخطاء `place_order` بترجع بكلمة إنكليزية قصيرة (`invalid_coupon`، `shop_closed`...). القائمة كاملة بأول `03_functions.sql`، والواجهة بتترجمها.
- صفحة متابعة الطلب بتسأل `get_order` كل شوي (polling)، لأن الزبون ما إله realtime على جدول الطلبات.
