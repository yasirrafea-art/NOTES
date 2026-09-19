-- ============================================================
-- دفتر العمل — التحويل إلى نظام Multi-User آمن
-- هذا الملف انتقالي وآمن: لا يحذف أي بيانات.
-- التشغيل: لوحة Supabase → SQL Editor → New query → لصق → Run
--
-- ما يفعله:
--   1) تحويل user_id في الجداول الأربعة من text إلى uuid.
--   2) إبقاء سجلات القديمة محفوظة (un-owned، لا يراها أحد) دون حذف.
--   3) ربط user_id بجدول auth.users(id) عبر Foreign Key.
--   4) إنشاء جدول public.profiles المرتبط بـ auth.users.
--   5) Trigger يملأ user_id تلقائيًا من الجلسة (auth.uid()) عند الإنشاء.
--   6) تفعيل RLS: لكل مستخدم قراءة/إضافة/تعديل/حذف سجلاته فقط.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) تحويل user_id من text إلى uuid مع معالجة آمنة للقيم القديمة
--    (لا حذف لأي سجل؛ فقط القيم غير الصالحة تصبح null)
-- ------------------------------------------------------------
do $$
declare
  col_type text;
begin
  select data_type into col_type from information_schema.columns
    where table_schema = 'public' and table_name = 'entries' and column_name = 'user_id';
  -- إن كان العمود قد تحوّل بالفعل إلى uuid فلا نعيد المحاولة (تجنّب أخطاء repeat)
  if col_type = 'uuid' then return; end if;

  alter table public.entries alter column user_id type uuid using (
    case when user_id is null then null
         when user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then user_id::uuid
         else null end
  );
  alter table public.projects alter column user_id type uuid using (
    case when user_id is null then null
         when user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then user_id::uuid
         else null end
  );
  alter table public.activities alter column user_id type uuid using (
    case when user_id is null then null
         when user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then user_id::uuid
         else null end
  );
  alter table public.attachments alter column user_id type uuid using (
    case when user_id is null then null
         when user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then user_id::uuid
         else null end
  );
end $$;

-- ------------------------------------------------------------
-- 2) البيانات القديمة بلا مالك: تُحفظ كما هي دون حذف،
--    لكن بعد تفعيل RLS لن يراها أي مستخدم ولن تعدّل أبدًا.
--    (للنقل لاحقًا: update ... set user_id = '<uuid>' where user_id is null)
-- ------------------------------------------------------------

-- تنظيف أي قيمة تشير إلى مستخدم غير موجود (تفقد الملكية لا المحتوى)
update public.entries set user_id = null where user_id is not null
  and not exists (select 1 from auth.users u where u.id = public.entries.user_id);
update public.projects set user_id = null where user_id is not null
  and not exists (select 1 from auth.users u where u.id = public.projects.user_id);
update public.activities set user_id = null where user_id is not null
  and not exists (select 1 from auth.users u where u.id = public.activities.user_id);
update public.attachments set user_id = null where user_id is not null
  and not exists (select 1 from auth.users u where u.id = public.attachments.user_id);

-- ------------------------------------------------------------
-- 3) فهارس + ربط بـ auth.users(id)
-- ------------------------------------------------------------
create index if not exists entries_user_id_idx on public.entries(user_id);
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists activities_user_id_idx on public.activities(user_id);
create index if not exists attachments_user_id_idx on public.attachments(user_id);

alter table public.entries drop constraint if exists entries_user_id_fkey;
alter table public.entries add constraint entries_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.projects drop constraint if exists projects_user_id_fkey;
alter table public.projects add constraint projects_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.activities drop constraint if exists activities_user_id_fkey;
alter table public.activities add constraint activities_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.attachments drop constraint if exists attachments_user_id_fkey;
alter table public.attachments add constraint attachments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ------------------------------------------------------------
-- 4) جدول profiles (اسم المستخدم الظاهر داخل النظام)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_created_at_idx on public.profiles(created_at desc);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

-- ------------------------------------------------------------
-- 5) Trigger: يملأ user_id تلقائيًا من الجلسة عند أي إدراج
--    (حتى لو أرسل العميل قيمة مختلفة تُستبدل من auth.uid())
-- ------------------------------------------------------------
create or replace function public.set_user_id_on_insert()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  new.user_id = auth.uid();
  return new;
end $$;

drop trigger if exists entries_set_user on public.entries;
create trigger entries_set_user before insert on public.entries
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists projects_set_user on public.projects;
create trigger projects_set_user before insert on public.projects
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists activities_set_user on public.activities;
create trigger activities_set_user before insert on public.activities
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists attachments_set_user on public.attachments;
create trigger attachments_set_user before insert on public.attachments
  for each row execute function public.set_user_id_on_insert();

-- ------------------------------------------------------------
-- 6) RLS: حذف السياسات القديمة (الجميع/anonym + سياسات الـ text)
--    وإنشاء سياسات عزل حقيقية لكل عملية
-- ------------------------------------------------------------
drop policy if exists entries_anon on public.entries;
drop policy if exists projects_anon on public.projects;
drop policy if exists activities_anon on public.activities;
drop policy if exists attachments_anon on public.attachments;

drop policy if exists entries_all_auth on public.entries;
drop policy if exists projects_all_auth on public.projects;
drop policy if exists activities_all_auth on public.activities;
drop policy if exists attachments_all_auth on public.attachments;

do $$
declare
  t text;
begin
  foreach t in array array['entries', 'projects', 'activities', 'attachments']
  loop
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format('create policy %I_select_own on public.%I for select to authenticated using (user_id = auth.uid())', t, t);

    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format('create policy %I_insert_own on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);

    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format('create policy %I_update_own on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);

    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- سياسات جدول profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = auth.uid());

-- ------------------------------------------------------------
-- Realtime: يبقى مفعّلًا للجداول الثلاثة؛ سيرسل الأحداث لكل
-- مستخدم لسجلاته فقط (Realtime يخضع لـ RLS تلقائيًا).
-- ------------------------------------------------------------

commit;