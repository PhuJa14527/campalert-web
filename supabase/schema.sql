-- ตารางสำหรับค่ายไหนดี + CampAlert
-- วิธีใช้: เปิด Supabase → SQL Editor → วางทั้งไฟล์นี้ → Run
-- รันซ้ำได้ ไม่พัง (มี if not exists / drop policy if exists)

-- 1) โปรไฟล์ผู้ใช้ (ผูกกับบัญชีที่ล็อกอินด้วย Discord)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- สร้างโปรไฟล์อัตโนมัติเมื่อมีคนล็อกอินครั้งแรก
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, discord_id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'provider_id',
    coalesce(
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    discord_id = excluded.discord_id,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 2) การตั้งค่าการแจ้งเตือน (1 คนมี 1 แถว)
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'both' check (mode in ('new', 'deadline', 'both')),
  field text not null default 'ทั้งหมด',
  advance int not null default 3 check (advance between 1 and 14),
  updated_at timestamptz not null default now()
);

-- 3) ค่ายที่ผู้ใช้กดมาร์กไว้
create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  camp_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, camp_id)
);

-- 4) เปิด RLS ให้แต่ละคนเห็นแค่ข้อมูลตัวเอง
alter table public.profiles enable row level security;
alter table public.notification_settings enable row level security;
alter table public.bookmarks enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "own settings" on public.notification_settings;
create policy "own settings"
  on public.notification_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own bookmarks" on public.bookmarks;
create policy "own bookmarks"
  on public.bookmarks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
