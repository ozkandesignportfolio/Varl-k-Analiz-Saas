-- Fix missing updated_at/created_at columns on profiles table
-- Some environments may have the profiles table without these columns,
-- causing trigger errors when set_updated_at() tries to reference NEW.updated_at

begin;

-- Add created_at column if it doesn't exist
alter table public.profiles
add column if not exists created_at timestamptz not null default now();

-- Add updated_at column if it doesn't exist
alter table public.profiles
add column if not exists updated_at timestamptz not null default now();

-- Ensure the updated_at trigger exists and is attached to profiles table
-- This is idempotent and safe to run multiple times
drop trigger if exists trg_profiles_updated_at on public.profiles;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

commit;
