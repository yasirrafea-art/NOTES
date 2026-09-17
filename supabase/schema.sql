-- دفتر العمل — Supabase schema (قابل لإعادة التشغيل بأمان)
-- جداول: projects, entries, activities, attachments

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text default 'violet',
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('task', 'note', 'directive', 'agreement')),
  text text not null,
  description text,
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  status text check (status in ('not_started', 'in_progress', 'done', 'postponed')),
  project_id uuid references public.projects(id) on delete set null,
  due_date date,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists entries_project_id_idx on public.entries(project_id);
create index if not exists entries_created_at_idx on public.entries(created_at desc);
create index if not exists entries_kind_idx on public.entries(kind);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.entries(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  type text not null check (type in ('add', 'complete', 'reopen', 'status', 'edit')),
  kind text,
  text text not null,
  user_id text,
  created_at timestamptz not null default now()
);

create index if not exists activities_created_at_idx on public.activities(created_at desc);

-- جدول المرفقات احتياطي؛ الملفات نفسها تبقى محلية (IndexedDB) حاليًا
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.entries(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  file_name text not null,
  file_type text,
  size bigint,
  user_id text,
  created_at timestamptz not null default now()
);

-- تحديث updated_at تلقائيًا
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
for each row execute function public.touch_updated_at();

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
for each row execute function public.touch_updated_at();

-- تفعيل Row Level Security
alter table public.entries enable row level security;
alter table public.projects enable row level security;
alter table public.activities enable row level security;
alter table public.attachments enable row level security;

-- سياسات مؤقتة للتطبيق بدون تسجيل دخول (مؤقتة: الجميع يقرأ/يكتب).
-- بعد تفعيل Auth لاحقًا: احذف هذه السياسات ووقّع المستخدم في،
-- وستعمل سياسات authenticated أدناه تلقائيًا.
drop policy if exists entries_anon on public.entries;
create policy entries_anon on public.entries
  for all using (true) with check (true);

drop policy if exists projects_anon on public.projects;
create policy projects_anon on public.projects
  for all using (true) with check (true);

drop policy if exists activities_anon on public.activities;
create policy activities_anon on public.activities
  for all using (true) with check (true);

drop policy if exists attachments_anon on public.attachments;
create policy attachments_anon on public.attachments
  for all using (true) with check (true);

-- سياسات مستقبلية للمستخدمين المسجلين (غير فعّالة حاليًا لأن العمود user_id فارغ)
drop policy if exists entries_all_auth on public.entries;
create policy entries_all_auth on public.entries
  for all to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists projects_all_auth on public.projects;
create policy projects_all_auth on public.projects
  for all to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists activities_all_auth on public.activities;
create policy activities_all_auth on public.activities
  for all to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists attachments_all_auth on public.attachments;
create policy attachments_all_auth on public.attachments
  for all to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- تفعيل Realtime لهذه الجداول (إن وُجدت publication supabase_realtime)
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['entries', 'projects', 'activities']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when others then null;
end $$;