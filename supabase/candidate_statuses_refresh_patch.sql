-- Refresh candidate statuses to the latest manual set with help text.

alter table public.candidate_statuses
  add column if not exists help_text text;

insert into public.candidate_statuses (code, label, help_text, sort_order, is_active)
values
  ('new', 'New', 'Data is in the system but I have not spoken to them', 10, true),
  ('vetted', 'Vetted', 'Screened, actively looking but not currently in a process', 20, true),
  ('active', 'ACTIVE', 'Currently being submitted or interviewing for a role', 30, true),
  ('placed', 'Placed', 'I found them a job', 40, true),
  ('unavailable', 'Unavailable', 'Found a job elsewhere or not actively looking', 50, true),
  ('blacklisted', 'Blacklisted', 'No-showed an interview, unprofessional or did not pass screening', 60, true)
on conflict (code) do update
set
  label = excluded.label,
  help_text = excluded.help_text,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

-- Migrate legacy candidate statuses.
update public.candidates
set status_code = case status_code
  when 'screening' then 'vetted'
  when 'shortlisted' then 'active'
  when 'interviewing' then 'active'
  when 'offered' then 'active'
  else status_code
end
where status_code is not null;

-- Keep legacy statuses for history, but hide them from active picklists.
update public.candidate_statuses
set
  is_active = false,
  updated_at = timezone('utc', now())
where code in ('screening', 'shortlisted', 'interviewing', 'offered');
