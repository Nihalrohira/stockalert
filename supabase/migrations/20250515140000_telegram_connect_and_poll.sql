alter table public.users add column if not exists telegram_connected boolean not null default false;

create table if not exists public.telegram_link_poll (
  poll_key text primary key,
  telegram_chat_id text,
  telegram_username text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.telegram_link_poll enable row level security;

drop policy if exists "telegram_link_poll_anon_all" on public.telegram_link_poll;

create policy "telegram_link_poll_anon_all"
  on public.telegram_link_poll
  for all
  to anon, authenticated
  using (true)
  with check (true);
