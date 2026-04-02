-- ============================================
-- PORTFOLIOS: Multiple collection folders
-- ============================================
create table public.portfolios (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null default 'My Collection',
  description text,
  color text default '#EAB308', -- yellow default
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.portfolios enable row level security;
create policy "Users can view own portfolios" on public.portfolios for select using (auth.uid() = user_id);
create policy "Users can insert own portfolios" on public.portfolios for insert with check (auth.uid() = user_id);
create policy "Users can update own portfolios" on public.portfolios for update using (auth.uid() = user_id);
create policy "Users can delete own portfolios" on public.portfolios for delete using (auth.uid() = user_id);

-- Add portfolio_id to cards (nullable for backward compat)
alter table public.cards add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null;

-- ============================================
-- PORTFOLIO SNAPSHOTS: Daily value tracking
-- ============================================
create table public.portfolio_snapshots (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  snapshot_date date not null,
  total_value decimal not null default 0,
  total_cards integer not null default 0,
  total_cost decimal not null default 0,
  created_at timestamptz default now(),
  unique(user_id, portfolio_id, snapshot_date)
);

alter table public.portfolio_snapshots enable row level security;
create policy "Users can view own snapshots" on public.portfolio_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert own snapshots" on public.portfolio_snapshots for insert with check (auth.uid() = user_id);

create index idx_snapshots_user_date on public.portfolio_snapshots(user_id, snapshot_date);

-- ============================================
-- WISHLIST: Cards user wants but doesn't own
-- ============================================
create table public.wishlist (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  card_name text not null,
  card_number text not null default '',
  set_name text not null default '',
  card_variant text,
  grading_company text not null default 'RAW',
  target_grade text,
  card_image_url text,
  target_price decimal,
  notes text,
  created_at timestamptz default now()
);

alter table public.wishlist enable row level security;
create policy "Users can view own wishlist" on public.wishlist for select using (auth.uid() = user_id);
create policy "Users can insert own wishlist" on public.wishlist for insert with check (auth.uid() = user_id);
create policy "Users can update own wishlist" on public.wishlist for update using (auth.uid() = user_id);
create policy "Users can delete own wishlist" on public.wishlist for delete using (auth.uid() = user_id);

-- ============================================
-- PRICE ALERTS
-- ============================================
create table public.price_alerts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  card_id uuid references public.cards(id) on delete cascade,
  card_name text not null,
  condition_type text not null check (condition_type in ('BELOW', 'ABOVE')),
  target_price decimal not null,
  is_triggered boolean default false,
  triggered_at timestamptz,
  created_at timestamptz default now()
);

alter table public.price_alerts enable row level security;
create policy "Users can view own alerts" on public.price_alerts for select using (auth.uid() = user_id);
create policy "Users can insert own alerts" on public.price_alerts for insert with check (auth.uid() = user_id);
create policy "Users can update own alerts" on public.price_alerts for update using (auth.uid() = user_id);
create policy "Users can delete own alerts" on public.price_alerts for delete using (auth.uid() = user_id);
