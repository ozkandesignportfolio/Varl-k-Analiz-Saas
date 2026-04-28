-- Add cancel_at_period_end column to profiles table for Stripe subscription cancellation tracking
begin;

alter table public.profiles
  add column if not exists cancel_at_period_end boolean not null default false;

commit;
