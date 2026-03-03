-- Patch for existing projects that already ran supabase/crm_schema.sql.
-- Adds additional client fields used by /admin/clients/new.

alter table public.clients
  add column if not exists contact_number text,
  add column if not exists account_manager_id uuid references auth.users(id),
  add column if not exists parent_client_id uuid references public.clients(id) on delete set null,
  add column if not exists email text,
  add column if not exists google_drive_url text,
  add column if not exists companies_house_number text,
  add column if not exists about text,
  add column if not exists source_other text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists county text,
  add column if not exists postcode text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_source_check'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
    add constraint clients_source_check
    check (
      source is null
      or source in (
        'referral',
        'cold_outreach',
        'inbound_lead',
        'social_media',
        'networking',
        'paid_ads',
        'other'
      )
    );
  end if;
end
$$;

create unique index if not exists clients_companies_house_unique_when_present
on public.clients (upper(companies_house_number))
where companies_house_number is not null;

create index if not exists clients_parent_client_id_idx
on public.clients (parent_client_id);

create index if not exists clients_account_manager_id_idx
on public.clients (account_manager_id);
