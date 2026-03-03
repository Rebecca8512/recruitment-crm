-- Client communication notes for Client Profile > Notes tab.

create table if not exists public.client_communication_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  communication_type text not null,
  activity_type text not null default 'Outbound',
  note_body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (communication_type in ('Email', 'Phone', 'Social', 'In person')),
  check (activity_type in ('Outbound', 'Inbound')),
  check (length(trim(note_body)) > 0)
);

create index if not exists client_communication_notes_client_id_idx
on public.client_communication_notes (client_id);

create index if not exists client_communication_notes_role_id_idx
on public.client_communication_notes (role_id);

create index if not exists client_communication_notes_contact_id_idx
on public.client_communication_notes (contact_id);

create index if not exists client_communication_notes_created_at_idx
on public.client_communication_notes (created_at desc);

drop trigger if exists trg_client_communication_notes_updated_at on public.client_communication_notes;
create trigger trg_client_communication_notes_updated_at
before update on public.client_communication_notes
for each row
execute function public.set_updated_at();

alter table public.client_communication_notes enable row level security;

grant select, insert, update, delete on table public.client_communication_notes to authenticated;

drop policy if exists "client_communication_notes_crm_access" on public.client_communication_notes;
create policy "client_communication_notes_crm_access"
on public.client_communication_notes
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());
