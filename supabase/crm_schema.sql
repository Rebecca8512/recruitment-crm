-- CRM schema for Whitmore Recruitment.
-- Run this after supabase/setup.sql.

create extension if not exists "pgcrypto";

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.can_access_crm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'staff'), false);
$$;

create table if not exists public.client_statuses (
  code text primary key,
  label text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.role_statuses (
  code text primary key,
  label text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.candidate_statuses (
  code text primary key,
  label text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.client_statuses (code, label, sort_order)
values
  ('prospect', 'Prospect', 10),
  ('nurturing', 'Nurturing', 20),
  ('active_client', 'Active Client', 30),
  ('dormant', 'Dormant', 40),
  ('archived', 'Archived', 50)
on conflict (code) do nothing;

insert into public.role_statuses (code, label, sort_order)
values
  ('intake', 'Intake', 10),
  ('sourcing', 'Sourcing', 20),
  ('shortlist', 'Shortlist', 30),
  ('interview', 'Interview', 40),
  ('offer', 'Offer', 50),
  ('placed', 'Placed', 60),
  ('on_hold', 'On Hold', 70),
  ('closed_lost', 'Closed Lost', 80)
on conflict (code) do nothing;

insert into public.candidate_statuses (code, label, sort_order)
values
  ('new', 'New', 10),
  ('screening', 'Screening', 20),
  ('shortlisted', 'Shortlisted', 30),
  ('interviewing', 'Interviewing', 40),
  ('offered', 'Offered', 50),
  ('placed', 'Placed', 60),
  ('unavailable', 'Unavailable', 70)
on conflict (code) do nothing;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_number text,
  account_manager_id uuid references auth.users(id),
  parent_client_id uuid references public.clients(id) on delete set null,
  email text,
  website text,
  google_drive_url text,
  companies_house_number text,
  industry text,
  about text,
  status_code text not null default 'prospect' references public.client_statuses(code),
  source text,
  source_other text,
  address_line_1 text,
  address_line_2 text,
  city text,
  county text,
  postcode text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
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
  )
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  department text,
  email text,
  secondary_email text,
  job_title text,
  work_phone text,
  mobile text,
  phone text,
  linkedin_url text,
  x_url text,
  facebook_url text,
  instagram_url text,
  source text,
  owner_user_id uuid references auth.users(id),
  marketing_email_opt_out boolean not null default false,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    source is null
    or source in (
      'paid_ad',
      'cold_call',
      'referral',
      'internal',
      'search_engine',
      'networking'
    )
  )
);

create table if not exists public.contact_employments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  job_title text,
  start_date date,
  end_date date,
  is_primary boolean not null default false,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  owner_user_id uuid references auth.users(id),
  target_date date,
  status_code text not null default 'intake' references public.role_statuses(code),
  industry text,
  job_type text not null default 'full_time',
  salary_text text,
  work_experience text not null default 'none',
  notes text,
  address_line_1 text,
  address_line_2 text,
  city text,
  county text,
  postcode text,
  address_text text,
  is_remote boolean not null default false,
  is_hybrid boolean not null default false,
  number_of_positions integer,
  expected_revenue_per_position text,
  total_expected_revenue text,
  actual_revenue text,
  job_description_html text,
  requirements_html text,
  benefits_html text,
  listing_job_boards text,
  listing_social_media text,
  location text,
  salary_min numeric(12, 2),
  salary_max numeric(12, 2),
  fee_percent numeric(5, 2),
  estimated_fee numeric(12, 2),
  earned_fee numeric(12, 2),
  invoice_status text,
  opened_on date,
  closed_on date,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (salary_min is null or salary_max is null or salary_max >= salary_min),
  check (
    job_type in (
      'none',
      'full_time',
      'part_time',
      'temporary',
      'contract',
      'seasonal',
      'freelance'
    )
  ),
  check (
    work_experience in (
      'none',
      '0_1_year',
      '1_3_years',
      '4_5_years',
      '5_plus_years'
    )
  )
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  mobile text,
  address_line_1 text,
  address_line_2 text,
  city text,
  county text,
  postcode text,
  linkedin_url text,
  facebook_url text,
  x_url text,
  instagram_url text,
  current_employer_client_id uuid references public.clients(id) on delete set null,
  current_company text,
  current_title text,
  highest_qualification text,
  current_salary numeric(12, 2),
  status_code text not null default 'new' references public.candidate_statuses(code),
  expected_salary numeric(12, 2),
  owner_user_id uuid references auth.users(id),
  source text,
  marketing_email_opt_out boolean not null default false,
  education_institution text,
  education_field text,
  education_graduation_year integer,
  experience_years numeric(6, 2),
  notice_period_weeks integer,
  core_skills text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    source is null
    or source in (
      'referral',
      'paid_ad',
      'social_media',
      'jobboard',
      'cold_call'
    )
  )
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  stage text not null default 'applied',
  source text,
  submitted_on date default current_date,
  outcome text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (role_id, candidate_id)
);

create unique index if not exists contacts_email_unique_when_present
on public.contacts (lower(email))
where email is not null;

create unique index if not exists contacts_secondary_email_unique_when_present
on public.contacts (lower(secondary_email))
where secondary_email is not null;

create unique index if not exists clients_companies_house_unique_when_present
on public.clients (upper(companies_house_number))
where companies_house_number is not null;

create unique index if not exists candidates_email_unique_when_present
on public.candidates (lower(email))
where email is not null;

create unique index if not exists contact_primary_employment_unique
on public.contact_employments (contact_id)
where is_primary and end_date is null;

create index if not exists roles_client_id_idx on public.roles (client_id);
create index if not exists roles_contact_id_idx on public.roles (contact_id);
create index if not exists roles_owner_user_id_idx on public.roles (owner_user_id);
create index if not exists clients_parent_client_id_idx on public.clients (parent_client_id);
create index if not exists clients_account_manager_id_idx on public.clients (account_manager_id);
create index if not exists contacts_owner_user_id_idx on public.contacts (owner_user_id);
create index if not exists candidates_owner_user_id_idx on public.candidates (owner_user_id);
create index if not exists candidates_current_employer_client_id_idx on public.candidates (current_employer_client_id);
create index if not exists applications_role_id_idx on public.applications (role_id);
create index if not exists applications_candidate_id_idx on public.applications (candidate_id);
create index if not exists contact_employments_contact_id_idx on public.contact_employments (contact_id);
create index if not exists contact_employments_client_id_idx on public.contact_employments (client_id);

drop trigger if exists trg_client_statuses_updated_at on public.client_statuses;
create trigger trg_client_statuses_updated_at
before update on public.client_statuses
for each row
execute function public.set_updated_at();

drop trigger if exists trg_role_statuses_updated_at on public.role_statuses;
create trigger trg_role_statuses_updated_at
before update on public.role_statuses
for each row
execute function public.set_updated_at();

drop trigger if exists trg_candidate_statuses_updated_at on public.candidate_statuses;
create trigger trg_candidate_statuses_updated_at
before update on public.candidate_statuses
for each row
execute function public.set_updated_at();

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_contact_employments_updated_at on public.contact_employments;
create trigger trg_contact_employments_updated_at
before update on public.contact_employments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_roles_updated_at on public.roles;
create trigger trg_roles_updated_at
before update on public.roles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_candidates_updated_at on public.candidates;
create trigger trg_candidates_updated_at
before update on public.candidates
for each row
execute function public.set_updated_at();

drop trigger if exists trg_applications_updated_at on public.applications;
create trigger trg_applications_updated_at
before update on public.applications
for each row
execute function public.set_updated_at();

alter table public.client_statuses enable row level security;
alter table public.role_statuses enable row level security;
alter table public.candidate_statuses enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_employments enable row level security;
alter table public.roles enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;

grant select, insert, update, delete on table public.client_statuses to authenticated;
grant select, insert, update, delete on table public.role_statuses to authenticated;
grant select, insert, update, delete on table public.candidate_statuses to authenticated;
grant select, insert, update, delete on table public.clients to authenticated;
grant select, insert, update, delete on table public.contacts to authenticated;
grant select, insert, update, delete on table public.contact_employments to authenticated;
grant select, insert, update, delete on table public.roles to authenticated;
grant select, insert, update, delete on table public.candidates to authenticated;
grant select, insert, update, delete on table public.applications to authenticated;

drop policy if exists "status_select_crm_users" on public.client_statuses;
create policy "status_select_crm_users"
on public.client_statuses
for select
to authenticated
using (public.can_access_crm());

drop policy if exists "status_modify_admin_only" on public.client_statuses;
create policy "status_modify_admin_only"
on public.client_statuses
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "role_status_select_crm_users" on public.role_statuses;
create policy "role_status_select_crm_users"
on public.role_statuses
for select
to authenticated
using (public.can_access_crm());

drop policy if exists "role_status_modify_admin_only" on public.role_statuses;
create policy "role_status_modify_admin_only"
on public.role_statuses
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "candidate_status_select_crm_users" on public.candidate_statuses;
create policy "candidate_status_select_crm_users"
on public.candidate_statuses
for select
to authenticated
using (public.can_access_crm());

drop policy if exists "candidate_status_modify_admin_only" on public.candidate_statuses;
create policy "candidate_status_modify_admin_only"
on public.candidate_statuses
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "clients_crm_access" on public.clients;
create policy "clients_crm_access"
on public.clients
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());

drop policy if exists "contacts_crm_access" on public.contacts;
create policy "contacts_crm_access"
on public.contacts
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());

drop policy if exists "contact_employments_crm_access" on public.contact_employments;
create policy "contact_employments_crm_access"
on public.contact_employments
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());

drop policy if exists "roles_crm_access" on public.roles;
create policy "roles_crm_access"
on public.roles
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());

drop policy if exists "candidates_crm_access" on public.candidates;
create policy "candidates_crm_access"
on public.candidates
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());

drop policy if exists "applications_crm_access" on public.applications;
create policy "applications_crm_access"
on public.applications
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());
