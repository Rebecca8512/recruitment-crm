-- Refresh client statuses and descriptions.
-- Includes migration from older status codes.

alter table public.client_statuses
  add column if not exists help_text text;

insert into public.client_statuses (code, label, help_text, sort_order, is_active)
values
  ('prospect', 'Prospect', 'High-level target. No meaningful conversation yet.', 10, true),
  ('warm_lead', 'Warm Lead', 'Meeting held, interest shown, but no contract signed yet.', 20, true),
  ('active', 'ACTIVE', 'Signed terms AND live vacancy.', 30, true),
  ('inactive_client', 'Inactive Client', 'Signed terms but NO live vacancy', 40, true),
  ('archived', 'Archived', 'Previously worked with and no ongoing relationship', 50, true),
  ('closed', 'Closed', 'Have never worked with us / DNC', 60, true)
on conflict (code) do update
set
  label = excluded.label,
  help_text = excluded.help_text,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

-- Migrate any existing clients on legacy statuses.
update public.clients
set status_code = 'warm_lead'
where status_code = 'nurturing';

update public.clients
set status_code = 'active'
where status_code = 'active_client';

update public.clients
set status_code = 'inactive_client'
where status_code = 'dormant';

-- Keep legacy status rows for history/reference, but hide from active picklists.
update public.client_statuses
set is_active = false,
    updated_at = timezone('utc', now())
where code in ('nurturing', 'active_client', 'dormant');
