-- Make due_at optional so only task title is required.

alter table public.tasks
alter column due_at drop not null;
