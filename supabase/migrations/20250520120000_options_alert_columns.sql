-- Options alert columns (apply in Supabase SQL editor or via migration runner)
alter table alerts
  add column if not exists market_type text default 'equity';

alter table alerts
  add column if not exists underlying_symbol text;

alter table alerts
  add column if not exists expiry_date date;

alter table alerts
  add column if not exists strike_price numeric;

alter table alerts
  add column if not exists option_type text;

alter table alerts
  add column if not exists alert_type text default 'price';

alter table alerts
  add column if not exists timeframe text;
