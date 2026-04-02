-- Add card_variant column to cards table
alter table public.cards add column if not exists card_variant text;
