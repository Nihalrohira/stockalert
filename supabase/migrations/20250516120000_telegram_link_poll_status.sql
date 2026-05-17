-- Replace telegram_link_poll with status-based schema (getUpdates / webhook compatible).

drop policy if exists "telegram_link_poll_anon_all" on public.telegram_link_poll;

drop table if exists public.telegram_link_poll;

create table public.telegram_link_poll (
  id uuid primary key default gen_random_uuid(),
  poll_key text not null unique,
  telegram_chat_id text,
  telegram_username text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  connected_at timestamptz,
  constraint telegram_link_poll_status_check check (status in ('pending', 'connected'))
);

create index if not exists telegram_link_poll_status_idx on public.telegram_link_poll (status);

alter table public.telegram_link_poll enable row level security;

create policy "telegram_link_poll_anon_all"
  on public.telegram_link_poll
  for all
  to anon, authenticated
  using (true)
  with check (true);
