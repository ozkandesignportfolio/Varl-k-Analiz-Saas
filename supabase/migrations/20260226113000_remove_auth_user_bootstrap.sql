begin;

drop trigger if exists trg_seed_onboarding_demo_data on auth.users;
drop trigger if exists trg_first_login_onboarding_seed on auth.users;

drop function if exists public.seed_onboarding_demo_data();
drop function if exists public.first_login_onboarding_seed();

commit;
