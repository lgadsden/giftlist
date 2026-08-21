-- Optional price scraped or entered manually (USD for v1)
alter table public.gifts
  add column if not exists price numeric(12, 2);
