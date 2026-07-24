-- Mercatino Nautico Trieste — setup database Supabase
-- Da eseguire UNA volta nel SQL Editor del progetto Supabase
-- (Dashboard → SQL Editor → New query → incolla tutto → Run).

-- ============ tabella annunci ============
create table if not exists public.annunci (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  titolo      text not null check (char_length(titolo) between 3 and 90),
  descrizione text check (char_length(descrizione) <= 1200),
  prezzo      numeric check (prezzo >= 0),
  categoria   text not null default 'altro',
  stato       text not null default 'disponibile' check (stato in ('disponibile', 'venduto')),
  venditore   text check (char_length(venditore) <= 40),
  telefono    text check (char_length(telefono) <= 20),
  foto        jsonb not null default '[]'::jsonb
);

alter table public.annunci enable row level security;

-- chiunque (anche non loggato) può leggere gli annunci: servono i link pubblici
create policy "lettura pubblica"
  on public.annunci for select
  using (true);

-- solo utenti loggati possono inserire, e solo a proprio nome
create policy "inserimento proprio"
  on public.annunci for insert
  with check (auth.uid() = user_id);

-- si modifica/elimina solo la propria roba
create policy "modifica propria"
  on public.annunci for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "eliminazione propria"
  on public.annunci for delete
  using (auth.uid() = user_id);

-- ============ bucket foto ============
insert into storage.buckets (id, name, public)
values ('foto', 'foto', true)
on conflict (id) do nothing;

-- lettura pubblica delle foto
create policy "foto lettura pubblica"
  on storage.objects for select
  using (bucket_id = 'foto');

-- upload solo loggati, solo nella propria cartella <uid>/...
create policy "foto upload proprio"
  on storage.objects for insert
  with check (
    bucket_id = 'foto'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- cancellazione solo delle proprie foto
create policy "foto delete proprio"
  on storage.objects for delete
  using (
    bucket_id = 'foto'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
