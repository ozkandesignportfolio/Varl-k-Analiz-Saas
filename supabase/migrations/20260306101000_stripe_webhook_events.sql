create table if not exists stripe_webhook_events (
  id text primary key,
  created_at timestamptz default now()
);
