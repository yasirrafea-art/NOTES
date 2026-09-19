-- ============================================================
-- دفتر العمل — استبدال Email بالـ Username في نظام الحسابات
-- هذا الملف انتقالي وآمن: لا يحذف أي جدول ولا أي بيانات.
--
-- الفكرة التقنية:
--   Supabase Auth لا يقبل Username مباشرة؛ لذا يُخزَّن اسم المستخدم
--   داخل حقل auth.users.email بالصيغة  username@workbook.local  (مفتاح
--   فريد من Supabase يمنع تكرار اسم المستخدم في كل المحاولات)، ويُكمل
--   النظامُ عرضَ username عبر عمود فريد في profiles. كلمة المرور تبقى
--   مشفرة داخل GoTrue ولا تظهر بأي حال كنص عادي. RLS لا يتغير إطلاقًا.
--
-- التشغيل: لوحة Supabase → SQL Editor → New query → لصق → Run
-- ============================================================

begin;

-- 1) عمود username في profiles (أثناء العرض/العدّ؛ الفريدة الفعلية تأتي من
--    فريدة auth.users.email المركّبة username@app)
alter table public.profiles add column if not exists username text;

-- الفريدة: لا يمكن لشخصين استخدام نفس اسم المستخدم
create unique index if not exists profiles_username_key
  on public.profiles(username)
  where username is not null;

-- 2) ملء تلقائي للحسابات القديمة (إن وُجدت): username = الجزء الأول من البريد المركّب
do $$
declare
  r record;
  base text;
  cand text;
  i int;
begin
  for r in
    select p.id, lower(split_part(a.email, '@', 1)) as uname
    from public.profiles p
    join auth.users a on a.id = p.id
    where p.username is null and position('@' in coalesce(a.email, '')) > 0
  loop
    if r.uname is null or btrim(r.uname) = '' then continue; end if;
    base := r.uname;
    cand := base;
    i := 1;
    while exists (select 1 from public.profiles where username = cand and id <> r.id) loop
      i := i + 1;
      cand := base || i::text;
    end loop;
    update public.profiles set username = cand where id = r.id;
  end loop;
end $$;

commit;