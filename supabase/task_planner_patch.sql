-- Task planner tables + RLS policies.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task_type text not null default 'general',
  task_status text not null default 'todo',
  due_at timestamptz,
  primary_client_id uuid references public.clients(id) on delete set null,
  primary_contact_id uuid references public.contacts(id) on delete set null,
  primary_role_id uuid references public.roles(id) on delete set null,
  primary_candidate_id uuid references public.candidates(id) on delete set null,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (task_type in ('general', 'client', 'contact', 'role', 'candidate')),
  check (task_status in ('todo', 'done', 'cancelled'))
);

create table if not exists public.task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  note_body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (length(trim(note_body)) > 0)
);

create table if not exists public.task_related_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  role_id uuid references public.roles(id) on delete set null,
  candidate_id uuid references public.candidates(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  check (
    client_id is not null
    or contact_id is not null
    or role_id is not null
    or candidate_id is not null
    or application_id is not null
  )
);

create index if not exists tasks_due_at_idx on public.tasks (due_at);
create index if not exists tasks_task_status_idx on public.tasks (task_status);
create index if not exists tasks_task_type_idx on public.tasks (task_type);
create index if not exists tasks_primary_client_id_idx on public.tasks (primary_client_id);
create index if not exists tasks_primary_contact_id_idx on public.tasks (primary_contact_id);
create index if not exists tasks_primary_role_id_idx on public.tasks (primary_role_id);
create index if not exists tasks_primary_candidate_id_idx on public.tasks (primary_candidate_id);
create index if not exists task_notes_task_id_idx on public.task_notes (task_id);
create index if not exists task_notes_created_at_idx on public.task_notes (created_at desc);
create index if not exists task_related_links_task_id_idx on public.task_related_links (task_id);
create index if not exists task_related_links_client_id_idx on public.task_related_links (client_id);
create index if not exists task_related_links_contact_id_idx on public.task_related_links (contact_id);
create index if not exists task_related_links_role_id_idx on public.task_related_links (role_id);
create index if not exists task_related_links_candidate_id_idx on public.task_related_links (candidate_id);
create index if not exists task_related_links_application_id_idx on public.task_related_links (application_id);

alter table public.tasks enable row level security;
alter table public.task_notes enable row level security;
alter table public.task_related_links enable row level security;

grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.task_notes to authenticated;
grant select, insert, update, delete on table public.task_related_links to authenticated;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists trg_task_notes_updated_at on public.task_notes;
create trigger trg_task_notes_updated_at
before update on public.task_notes
for each row
execute function public.set_updated_at();

drop policy if exists "tasks_crm_access" on public.tasks;
create policy "tasks_crm_access"
on public.tasks
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());

drop policy if exists "task_notes_crm_access" on public.task_notes;
create policy "task_notes_crm_access"
on public.task_notes
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());

drop policy if exists "task_related_links_crm_access" on public.task_related_links;
create policy "task_related_links_crm_access"
on public.task_related_links
for all
to authenticated
using (public.can_access_crm())
with check (public.can_access_crm());
