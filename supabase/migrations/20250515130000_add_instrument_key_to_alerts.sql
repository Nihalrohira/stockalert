-- Upstox instrument key for LTP (e.g. NSE_EQ|INE002A01018). Run in Supabase SQL editor or via CLI.
alter table public.alerts add column if not exists instrument_key text;
