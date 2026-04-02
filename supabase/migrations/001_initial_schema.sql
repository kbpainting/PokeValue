-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Cards table
create table public.cards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  card_name text not null,
  card_number text not null,
  set_name text not null default '',
  grading_company text not null check (grading_company in ('PSA', 'CGC', 'BGS', 'TAG', 'RAW')),
  grade text,
  cert_number text,
  cert_image_url text,
  card_image_url text,
  purchase_price decimal,
  purchase_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cards enable row level security;
create policy "Users can view own cards" on public.cards for select using (auth.uid() = user_id);
create policy "Users can insert own cards" on public.cards for insert with check (auth.uid() = user_id);
create policy "Users can update own cards" on public.cards for update using (auth.uid() = user_id);
create policy "Users can delete own cards" on public.cards for delete using (auth.uid() = user_id);

-- Price history table
create table public.price_history (
  id uuid default uuid_generate_v4() primary key,
  card_id uuid references public.cards(id) on delete cascade not null,
  source text not null check (source in ('TCGPLAYER', 'EBAY', 'PRICECHARTING', 'GOLDIN')),
  price decimal not null,
  sale_date date,
  listing_title text,
  listing_url text,
  fetched_at timestamptz default now()
);

alter table public.price_history enable row level security;
create policy "Users can view own price history" on public.price_history
  for select using (
    exists (select 1 from public.cards where cards.id = price_history.card_id and cards.user_id = auth.uid())
  );
create policy "Users can insert price history for own cards" on public.price_history
  for insert with check (
    exists (select 1 from public.cards where cards.id = price_history.card_id and cards.user_id = auth.uid())
  );

-- Population data table
create table public.population_data (
  id uuid default uuid_generate_v4() primary key,
  card_id uuid references public.cards(id) on delete cascade not null,
  grading_company text not null,
  grade text not null,
  population integer default 0,
  population_higher integer default 0,
  fetched_at timestamptz default now()
);

alter table public.population_data enable row level security;
create policy "Users can view own pop data" on public.population_data
  for select using (
    exists (select 1 from public.cards where cards.id = population_data.card_id and cards.user_id = auth.uid())
  );
create policy "Users can insert pop data for own cards" on public.population_data
  for insert with check (
    exists (select 1 from public.cards where cards.id = population_data.card_id and cards.user_id = auth.uid())
  );

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cards_updated_at
  before update on public.cards
  for each row execute procedure public.update_updated_at();

-- Indexes
create index idx_cards_user_id on public.cards(user_id);
create index idx_price_history_card_id on public.price_history(card_id);
create index idx_population_data_card_id on public.population_data(card_id);
