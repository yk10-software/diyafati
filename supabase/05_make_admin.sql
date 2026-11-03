-- =========================================================
-- ضيافتي — 05: تعيين صاحب المحل كأدمن
-- قبل ما تشغّله:
--   1) من Authentication ← Users ← Add user ← Create new user
--      حط إيميل وكلمة سر لصاحب المحل، وعلّم «Auto Confirm User».
--   2) انسخ هالملف للـ SQL Editor، وبدّل الإيميل هناك بس.
-- ⚠ لا تعدّل الإيميل بهالملف أبداً: الريبو public، والملف لازم يضل فيه المثال.
-- =========================================================

insert into public.admins (user_id)
select id from auth.users
where email = lower('owner@example.com')   -- ← بدّل هون (بالـ SQL Editor بس)
on conflict (user_id) do nothing;

-- لازم يطلع صف واحد. إذا طلع فاضي يعني الإيميل غلط أو المستخدم مو موجود.
select u.email, a.created_at
from public.admins a join auth.users u on u.id = a.user_id;