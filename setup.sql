-- Mercatino Nautico Trieste — setup database Supabase
-- Da eseguire UNA volta nel SQL Editor del progetto Supabase
-- (Dashboard → SQL Editor → New query → incolla tutto → Run).

-- ============ negozianti (abilitati alla sezione Negozio) ============
-- Si aggiungono a mano dal dashboard (nessuna policy di scrittura):
--   insert into public.negozianti (user_id, nome)
--   select id, 'Nome Negozio' from auth.users where email = 'email@negoziante.it';
-- (il negoziante deve aver fatto login almeno una volta sul sito)
create table if not exists public.negozianti (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome    text not null
);

alter table public.negozianti enable row level security;

create policy "negozianti lettura pubblica"
  on public.negozianti for select
  using (true);

-- ============ tabella annunci ============
create table if not exists public.annunci (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tipo        text not null default 'vendo' check (tipo in ('vendo', 'cerco')),
  negozio     boolean not null default false,
  dispo       text check (dispo in ('disponibile', 'ordinazione', 'ultimi', 'esaurito')),
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

-- solo utenti loggati possono inserire, solo a proprio nome;
-- gli annunci "negozio" solo se si è nella tabella negozianti
create policy "inserimento proprio"
  on public.annunci for insert
  with check (
    auth.uid() = user_id
    and (negozio = false
         or exists (select 1 from public.negozianti n where n.user_id = auth.uid()))
  );

-- si modifica/elimina solo la propria roba
create policy "modifica propria"
  on public.annunci for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (negozio = false
         or exists (select 1 from public.negozianti n where n.user_id = auth.uid()))
  );

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
