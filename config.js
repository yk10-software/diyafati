/* =========================================================
   ضيافتي — مفاتيح Supabase
   من لوحة Supabase: Project Settings ← API Keys
   - SUPABASE_URL: رابط المشروع
   - SUPABASE_KEY: الـ publishable key (sb_publishable_...) أو الـ anon key القديم
   هدول عامّين ومسموح ينحطوا بالريبو، لأن الحماية كلها بالـ RLS.
   ⚠ ممنوع تحط هون الـ secret key (sb_secret_...) أو service_role أبداً.
   ========================================================= */

const SUPABASE_URL = 'https://quznimzbgfcrntyrpfim.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Kar2IP1VC0WtjFNlQ34YNA_4LAltiKP';

// مفتاح VAPID العام للإشعارات. الخاص سرّ وبينحفظ بـ Supabase بس (Edge Functions ← Secrets).
const VAPID_PUBLIC_KEY = 'BCDIsfCsSqkqqbH2wT04AUdYe-3wgF3W6pvbAl7BRZPLv-5_DybxBmZxKjcwi_7HRXceTwjCYKq-ww60D2yDmn0';
