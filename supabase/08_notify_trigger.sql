-- =========================================================
-- ضيافتي — 08: إشعار صاحب المحل بكل طلب جديد
-- بدل الـ Database Webhook: trigger على جدول orders بيستدعي notify-order
-- عن طريق net.http_post (إضافة pg_net).
-- الاستدعاء بينبعت بعد ما ينحفظ الطلب. وإذا فشل، الطلب ما بيتأثر.
-- ما في بهالملف أي سر: بس رابط المشروع (عام) و Content-Type.
-- منبعت أقل معلومات لازمة، بلا التوكن ولا رقم الزبون،
-- لأن pg_net بيخزّن الطلبات شوي بجداوله.
-- آمن لو شغّلته مرتين.
-- =========================================================
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://quznimzbgfcrntyrpfim.supabase.co/functions/v1/notify-order',
    body := jsonb_build_object(
      'type',   'INSERT',
      'table',  'orders',
      'schema', 'public',
      'record', jsonb_build_object(
        'id',            new.id,
        'code',          new.code,
        'customer_name', new.customer_name,
        'total',         new.total,
        'created_at',    new.created_at
      )
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- الإشعار شغلة إضافية: مشكلة فيه ما لازم تضيّع طلب الزبون
  raise warning 'notify_new_order: %', sqlerrm;
  return new;
end $$;

-- الـ trigger بس هو اللي بيستدعيها، ما حدا من برّا
revoke execute on function public.notify_new_order() from public, anon, authenticated;

drop trigger if exists notify_new_order on public.orders;
create trigger notify_new_order
  after insert on public.orders
  for each row execute function public.notify_new_order();
