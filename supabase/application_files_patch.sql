-- Per-role paperwork metadata for candidate applications.

create table if not exists public.application_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  has_resume boolean not null default false,
  has_formatted_resume boolean not null default false,
  has_cover_letter boolean not null default false,
  has_offer boolean not null default false,
  has_contract boolean not null default false,
  has_other boolean not null default false,
  other_note text,
  folder_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (application_id)
);

create index if not exists application_files_application_id_idx
on public.application_files (application_id);

drop trigger if exists trg_application_files_updated_at on public.application_files;
create trigger trg_application_files_updated_at
before update on public.application_files
for each row
execute function public.set_updated_at();

alter table public.application_files enable row level security;

grant select, insert, update, delete on table public.application_files to authenticated;

drop policy if exists "application_files_crm_access" on public.application_files;
create policy "application_files_crm_access"
on public.application_files
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());
