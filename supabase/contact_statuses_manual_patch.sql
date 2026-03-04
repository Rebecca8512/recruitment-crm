-- Manual contact statuses + status definitions.

create table if not exists public.contact_statuses (
  code text primary key,
  label text not null unique,
  help_text text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.contacts
  add column if not exists status_code text;

insert into public.contact_statuses (code, label, help_text, sort_order, is_active)
values
  ('target_contact', 'Target Contact', 'A person at a prospect company that has not been spoken to yet', 10, true),
  ('active_contact', 'Active Contact', 'A person currently attached to a client that has been spoken to', 20, true),
  ('in_transit', 'In-Transit', 'A contact that is leaving/has left their current employ but not started at new one yet', 30, true),
  ('referrer_influencer', 'Referrer / Influencer', 'People not tied to a specific hiring company but who provide leads', 40, true),
  ('dnc', 'DNC', 'Someone you should never contact again', 50, true)
on conflict (code) do update
set
  label = excluded.label,
  help_text = excluded.help_text,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

-- Map legacy auto statuses to manual statuses, then set default.
update public.contacts
set status_code = case status_code
  when 'assigned' then 'active_contact'
  when 'previous' then 'in_transit'
  when 'unassigned' then 'target_contact'
  else status_code
end
where status_code is not null;

update public.contacts
set status_code = 'target_contact'
where status_code is null;

alter table public.contacts
  alter column status_code set default 'target_contact';

alter table public.contacts
  alter column status_code set not null;

alter table public.contacts
  drop constraint if exists contacts_status_code_fkey;

alter table public.contacts
  add constraint contacts_status_code_fkey
  foreign key (status_code) references public.contact_statuses(code);

create index if not exists contacts_status_code_idx
on public.contacts (status_code);

drop trigger if exists trg_contact_statuses_updated_at on public.contact_statuses;
create trigger trg_contact_statuses_updated_at
before update on public.contact_statuses
for each row
execute function public.set_updated_at();

alter table public.contact_statuses enable row level security;

grant select, insert, update, delete on table public.contact_statuses to authenticated;

drop policy if exists "contact_status_select_crm_users" on public.contact_statuses;
create policy "contact_status_select_crm_users"
on public.contact_statuses
for select
to authenticated
using (public.can_access_crm());

drop policy if exists "contact_status_modify_admin_only" on public.contact_statuses;
create policy "contact_status_modify_admin_only"
on public.contact_statuses
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
