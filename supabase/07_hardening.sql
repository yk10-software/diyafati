-- =========================================================
-- ضيافتي — 07: تصليحات الـ Security Advisor
-- هالملف للمشاريع اللي انشغّل عليها 03_functions.sql القديم.
-- بالمشروع الجديد، 03 صار فيه هالتصليحات من الأساس، بس تشغيل هالملف ما بيضر.
-- آمن لو شغّلته مرتين.
-- =========================================================

-- «Function Search Path Mutable»:
-- الدالة بلا search_path ثابت ممكن حدا يخدعها بجدول بنفس الاسم بـ schema تانية.
-- منثبّتها على public.
alter function public.touch_updated_at()   set search_path = public;
alter function public.stamp_order_status() set search_path = public;

-- rls_auto_enable: دالة بيعملها Supabase لحاله ببعض المشاريع (بتشغّل RLS على الجداول الجديدة).
-- ما في داعي حدا من برّا يقدر يستدعيها، فمنسحب الصلاحية.
-- إذا مو موجودة بالمشروع، منتجاوزها بلا خطأ.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
