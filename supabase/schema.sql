-- =====================================================================
--  TenderHub database setup — Phase 1 (encrypted standard mode)
--
--  How to use: Supabase → SQL Editor → New query → paste this whole
--  file → Run. Run it once on a NEW, empty Supabase project.
--
--  Privacy design:
--   * RFQ content (title, description, items, terms, attachments),
--     quotes (prices, lead times, notes), clarification Q&A and the
--     activity log are encrypted in the user's browser BEFORE they
--     are saved. The database only ever holds scrambled text.
--   * Only the buyer and the suppliers they invite hold the keys.
--     The TenderHub admin (and anyone with database access) cannot
--     read that content.
--   * What the database can see: account details (name, email,
--     company, plan), and RFQ status/deadline, who is invited to an
--     RFQ and who submitted a quote — needed for access rules,
--     plan limits and billing.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text not null default '',
  company     text not null default '',
  role        text check (role in ('buyer', 'supplier')),
  plan        text not null default 'free',
  public_key  text,   -- shareable half of the user's key pair
  key_pw      text,   -- private key, locked with the user's password (in the browser)
  key_rec     text,   -- private key, locked with the user's recovery code (in the browser)
  created_at  timestamptz not null default now()
);
create unique index profiles_email_idx on public.profiles (lower(email));

-- Emails listed here get the Admin menu (Support Inbox, Users & Plans).
create table public.admins (
  email text primary key
);

create table public.rfqs (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  owner_name       text not null default '',
  owner_company    text not null default '',
  status           text not null default 'draft' check (status in ('draft', 'open', 'closed', 'awarded')),
  confidentiality  text not null default 'standard' check (confidentiality in ('standard', 'confidential')),
  deadline         timestamptz not null,
  enc              text not null,   -- encrypted RFQ content
  awarded_quote_id uuid,
  created_at       timestamptz not null default now(),
  published_at     timestamptz
);
create index rfqs_owner_idx on public.rfqs (owner_id);

-- One row per person allowed to read an RFQ: the RFQ key, locked with that person's public key.
create table public.rfq_keys (
  rfq_id   uuid not null references public.rfqs (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  wrapped  text not null,
  primary key (rfq_id, user_id)
);

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  rfq_id       uuid not null references public.rfqs (id) on delete cascade,
  email        text not null,
  acknowledged boolean not null default false,
  link_key     text,   -- RFQ key, locked with the secret in the invitation link
  link_secret  text,   -- that link secret, locked with the RFQ key (only RFQ key holders can read it)
  created_at   timestamptz not null default now(),
  unique (rfq_id, email)
);
create index invitations_email_idx on public.invitations (email);

create table public.quotes (
  id               uuid primary key default gen_random_uuid(),
  rfq_id           uuid not null references public.rfqs (id) on delete cascade,
  supplier_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  supplier_name    text not null default '',
  supplier_company text not null default '',
  supplier_email   text not null default '',
  status           text not null default 'submitted' check (status in ('submitted', 'awarded', 'not_awarded')),
  enc              text not null,   -- encrypted quote (prices, lead time, notes)
  key_supplier     text not null,   -- quote key, locked for the supplier
  key_buyer        text not null,   -- quote key, locked for the buyer
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (rfq_id, supplier_id)
);

create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  rfq_id       uuid not null references public.rfqs (id) on delete cascade,
  asker_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  asker_label  text not null default 'Supplier',
  enc_question text not null,
  enc_answer   text,
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  rfq_id     uuid not null references public.rfqs (id) on delete cascade,
  enc        text not null,   -- encrypted: who did what
  created_at timestamptz not null default now()
);

-- Support chat is NOT encrypted: the admin must be able to read and answer it.
create table public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  user_email text not null default '',
  user_name  text not null default '',
  from_admin boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helper functions (used by the access rules below)
-- ---------------------------------------------------------------------

create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = my_email())
$$;

create or replace function public.is_owner(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rfqs where id = r and owner_id = auth.uid())
$$;

-- Invited to an RFQ that has been published (suppliers never see drafts).
create or replace function public.is_invited(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invitations i join rfqs q on q.id = i.rfq_id
                 where i.rfq_id = r and i.email = my_email() and q.status <> 'draft')
$$;

-- Invited, whatever the RFQ status (used for picking up the RFQ key early).
create or replace function public.is_invited_any(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invitations where rfq_id = r and email = my_email())
$$;

create or replace function public.system_change() returns boolean
language sql stable as $$ select coalesce(current_setting('tenderhub.sys', true), '') = 'on' $$;

-- Plan rules. Keep in step with the plans in config.js.
create or replace function public.plan_limit(p text) returns integer
language sql immutable as $$
  select case p when 'free' then 2 when 'lite' then 3 when 'plus' then 10 when 'growth' then 25
                when 'enterprise' then null else 2 end
$$;
create or replace function public.plan_confidential(p text) returns boolean
language sql immutable as $$ select p in ('plus', 'growth', 'enterprise') $$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- New sign-up → profile row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name)
  values (new.id, lower(new.email), coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their name, company, role and keys — never their plan or email.
create or replace function public.guard_profile() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not system_change() then
    new.plan := old.plan;
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  new.id := old.id;
  return new;
end $$;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- RFQ rules: owner details, plan limits, confidential RFQs, publishing.
create or replace function public.guard_rfq() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p profiles;
  lim integer;
  active integer;
begin
  if auth.uid() is null then return new; end if;   -- changes made by you in the SQL editor
  select * into p from profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.owner_name := coalesce(p.name, '');
    new.owner_company := coalesce(p.company, '');
    new.created_at := now();
    if new.status not in ('draft', 'open') then new.status := 'draft'; end if;
    new.awarded_quote_id := null;
  else
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    if not system_change() then
      if new.status = 'awarded' and old.status <> 'awarded' then
        raise exception 'Use the Award button to award an RFQ.';
      end if;
      if old.status = 'awarded' then
        raise exception 'This RFQ has been awarded and can no longer be changed.';
      end if;
      new.awarded_quote_id := old.awarded_quote_id;
    end if;
  end if;

  if new.confidentiality = 'confidential' and not plan_confidential(p.plan)
     and (tg_op = 'INSERT' or old.confidentiality <> 'confidential') then
    raise exception 'Confidential RFQs are available on Starter Plus and above.';
  end if;

  if new.status in ('draft', 'open') and (tg_op = 'INSERT' or old.status not in ('draft', 'open')) then
    lim := plan_limit(p.plan);
    if lim is not null then
      select count(*) into active from rfqs
        where owner_id = new.owner_id and status in ('draft', 'open') and id <> new.id;
      if active >= lim then
        raise exception 'Your plan allows % active RFQs at a time. Close or award an RFQ, or upgrade your plan.', lim;
      end if;
    end if;
  end if;

  if new.status = 'open' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger guard_rfq before insert or update on public.rfqs
  for each row execute function public.guard_rfq();

create or replace function public.guard_invitation() returns trigger
language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  if tg_op = 'UPDATE' and auth.uid() is not null and not system_change() then
    new.acknowledged := old.acknowledged;   -- only the supplier can acknowledge (via acknowledge_rfq)
    new.rfq_id := old.rfq_id;
  end if;
  return new;
end $$;
create trigger guard_invitation before insert or update on public.invitations
  for each row execute function public.guard_invitation();

-- Quote rules: only invited suppliers, only while the RFQ is open, never change the award status.
create or replace function public.guard_quote() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p profiles;
  r rfqs;
  inv invitations;
begin
  if auth.uid() is null or system_change() then return new; end if;
  select * into p from profiles where id = auth.uid();
  select * into r from rfqs where id = new.rfq_id;
  select * into inv from invitations where rfq_id = new.rfq_id and email = my_email();

  if inv.id is null then raise exception 'You are not invited to this RFQ.'; end if;
  if r.status <> 'open' or r.deadline < now() then raise exception 'This RFQ is no longer accepting quotes.'; end if;
  if r.confidentiality = 'confidential' and not inv.acknowledged then
    raise exception 'Please acknowledge confidentiality first.';
  end if;

  new.supplier_id := auth.uid();
  new.supplier_name := coalesce(p.name, '');
  new.supplier_company := coalesce(p.company, '');
  new.supplier_email := p.email;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.status := 'submitted';
    new.created_at := now();
  else
    new.status := old.status;
    new.rfq_id := old.rfq_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger guard_quote before insert or update on public.quotes
  for each row execute function public.guard_quote();

-- Questions: anonymous label for the asker; only the buyer can add an answer.
create or replace function public.guard_question() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.asker_id := auth.uid();
    select count(*) into n from invitations
      where rfq_id = new.rfq_id
        and created_at < (select created_at from invitations where rfq_id = new.rfq_id and email = my_email());
    new.asker_label := 'Supplier ' || chr(65 + least(n, 25));
    new.enc_answer := null;
    new.answered_at := null;
    new.created_at := now();
  else
    new.rfq_id := old.rfq_id;
    new.asker_id := old.asker_id;
    new.asker_label := old.asker_label;
    new.enc_question := old.enc_question;
    new.created_at := old.created_at;
    new.answered_at := now();
  end if;
  return new;
end $$;
create trigger guard_question before insert or update on public.questions
  for each row execute function public.guard_question();

create or replace function public.guard_support() returns trigger
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if auth.uid() is null then return new; end if;
  if not new.from_admin then
    select * into p from profiles where id = auth.uid();
    new.user_id := auth.uid();
    new.user_email := p.email;
    new.user_name := p.name;
  else
    select * into p from profiles where id = new.user_id;
    new.user_email := coalesce(p.email, '');
    new.user_name := coalesce(p.name, '');
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger guard_support before insert on public.support_messages
  for each row execute function public.guard_support();

-- ---------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------

create or replace function public.acknowledge_rfq(r uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('tenderhub.sys', 'on', true);
  update invitations set acknowledged = true where rfq_id = r and email = my_email();
  if not found then raise exception 'You are not invited to this RFQ.'; end if;
end $$;

create or replace function public.award_quote(r uuid, q uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(r) then raise exception 'Only the buyer can award this RFQ.'; end if;
  if not exists (select 1 from quotes where id = q and rfq_id = r) then raise exception 'Quote not found.'; end if;
  if exists (select 1 from rfqs where id = r and status = 'awarded') then raise exception 'This RFQ is already awarded.'; end if;
  perform set_config('tenderhub.sys', 'on', true);
  update quotes set status = case when id = q then 'awarded' else 'not_awarded' end where rfq_id = r;
  update rfqs set status = 'awarded', awarded_quote_id = q where id = r;
end $$;

-- Supplier search for the Bidders List (name, company and email only).
create or replace function public.directory_search(q text)
returns table (id uuid, name text, company text, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.company, p.email from profiles p
  where auth.uid() is not null and length(trim(q)) >= 2 and p.id <> auth.uid()
    and (p.name ilike '%' || trim(q) || '%' or p.company ilike '%' || trim(q) || '%' or p.email ilike '%' || trim(q) || '%')
  order by p.company, p.name limit 8
$$;

-- Look up registered users by email: names for the Bidders List and public keys for sharing RFQ keys.
create or replace function public.directory_lookup(emails text[])
returns table (id uuid, email text, name text, company text, public_key text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.name, p.company, p.public_key from profiles p
  where auth.uid() is not null and lower(p.email) = any (select lower(e) from unnest(emails) e)
$$;

-- Public key of an RFQ's buyer (so a supplier can lock their quote for the buyer).
create or replace function public.rfq_owner_key(r uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.public_key from rfqs q join profiles p on p.id = q.owner_id
  where q.id = r and (is_invited(r) or q.owner_id = auth.uid())
$$;

create or replace function public.admin_profiles()
returns table (id uuid, email text, name text, company text, role text, plan text, created_at timestamptz, active_rfqs bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  return query
    select p.id, p.email, p.name, p.company, p.role, p.plan, p.created_at,
           (select count(*) from rfqs r where r.owner_id = p.id and r.status in ('draft', 'open'))
    from profiles p order by p.created_at desc;
end $$;

create or replace function public.admin_set_plan(u uuid, p text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  if p not in ('free', 'lite', 'plus', 'growth', 'enterprise') then raise exception 'Unknown plan: %', p; end if;
  perform set_config('tenderhub.sys', 'on', true);
  update profiles set plan = p where id = u;
end $$;

-- ---------------------------------------------------------------------
-- Access rules (row-level security)
-- ---------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.admins           enable row level security;
alter table public.rfqs             enable row level security;
alter table public.rfq_keys         enable row level security;
alter table public.invitations      enable row level security;
alter table public.quotes           enable row level security;
alter table public.questions        enable row level security;
alter table public.events           enable row level security;
alter table public.support_messages enable row level security;

create policy "own profile"        on public.profiles for select to authenticated using (id = auth.uid());
create policy "edit own profile"   on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "am I admin"         on public.admins for select to authenticated using (lower(email) = my_email());

create policy "read rfq"           on public.rfqs for select to authenticated using (owner_id = auth.uid() or is_invited(id));
create policy "create rfq"         on public.rfqs for insert to authenticated with check (owner_id = auth.uid());
create policy "edit own rfq"       on public.rfqs for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own rfq"     on public.rfqs for delete to authenticated using (owner_id = auth.uid());

create policy "read key"           on public.rfq_keys for select to authenticated using (user_id = auth.uid() or is_owner(rfq_id));
create policy "share key"          on public.rfq_keys for insert to authenticated
  with check (is_owner(rfq_id) or (user_id = auth.uid() and is_invited_any(rfq_id)));
create policy "remove key"         on public.rfq_keys for delete to authenticated using (is_owner(rfq_id));

create policy "read invitation"    on public.invitations for select to authenticated using (is_owner(rfq_id) or email = my_email());
create policy "invite"             on public.invitations for insert to authenticated with check (is_owner(rfq_id));
create policy "edit invitation"    on public.invitations for update to authenticated using (is_owner(rfq_id)) with check (is_owner(rfq_id));
create policy "remove invitation"  on public.invitations for delete to authenticated using (is_owner(rfq_id));

create policy "read quote"         on public.quotes for select to authenticated using (supplier_id = auth.uid() or is_owner(rfq_id));
create policy "submit quote"       on public.quotes for insert to authenticated with check (supplier_id = auth.uid());
create policy "revise quote"       on public.quotes for update to authenticated using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

create policy "read questions"     on public.questions for select to authenticated using (is_owner(rfq_id) or is_invited(rfq_id));
create policy "ask"                on public.questions for insert to authenticated with check (asker_id = auth.uid() and is_invited(rfq_id));
create policy "answer"             on public.questions for update to authenticated using (is_owner(rfq_id)) with check (is_owner(rfq_id));

create policy "read activity"      on public.events for select to authenticated using (is_owner(rfq_id));
create policy "log activity"       on public.events for insert to authenticated with check (is_owner(rfq_id) or is_invited(rfq_id));

create policy "read support"       on public.support_messages for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "send support"       on public.support_messages for insert to authenticated
  with check ((user_id = auth.uid() and not from_admin) or is_admin());

-- ---------------------------------------------------------------------
-- File storage for T&C PDFs (files are encrypted before upload)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('rfq-files', 'rfq-files', false)
  on conflict (id) do nothing;

create policy "upload own files" on storage.objects for insert to authenticated
  with check (bucket_id = 'rfq-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read files" on storage.objects for select to authenticated
  using (bucket_id = 'rfq-files');

-- ---------------------------------------------------------------------
-- Make yourself admin: change the email below to your login email.
-- ---------------------------------------------------------------------
insert into public.admins (email) values ('julius.stating@gmail.com') on conflict do nothing;
