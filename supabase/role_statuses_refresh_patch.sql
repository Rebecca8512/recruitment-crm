-- Refresh role statuses to the latest manual set with help text.

alter table public.role_statuses
  add column if not exists help_text text;

insert into public.role_statuses (code, label, help_text, sort_order, is_active)
values
  ('pending', 'Pending', 'The job is being scoped, but not live yet', 10, true),
  ('active', 'ACTIVE', 'Actively working to fill this role', 20, true),
  ('filled', 'Filled', 'Role has been successfully filled, pending rebate', 30, true),
  ('won', 'Won', 'The full fee is earned. CONGRATULATIONS!', 40, true),
  ('paused', 'Paused', 'Client temporarily paused the recruitment process', 50, true),
  ('lost', 'Lost', 'Role filled elsewhere or direct with client', 60, true),
  ('cancelled', 'Cancelled', 'Role has been pulled', 70, true)
on conflict (code) do update
set
  label = excluded.label,
  help_text = excluded.help_text,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

-- Migrate existing roles from legacy statuses.
update public.roles
set status_code = case status_code
  when 'intake' then 'pending'
  when 'sourcing' then 'active'
  when 'shortlist' then 'active'
  when 'interview' then 'active'
  when 'offer' then 'active'
  when 'placed' then 'filled'
  when 'on_hold' then 'paused'
  when 'closed_lost' then 'lost'
  else status_code
end
where status_code is not null;

-- Enforce new default.
alter table public.roles
  alter column status_code set default 'pending';

-- Keep legacy values for history, but hide from active picklists.
update public.role_statuses
set
  is_active = false,
  updated_at = timezone('utc', now())
where code in ('intake', 'sourcing', 'shortlist', 'interview', 'offer', 'placed', 'on_hold', 'closed_lost');
