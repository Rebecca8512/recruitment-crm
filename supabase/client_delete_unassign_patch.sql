-- Ensures deleting a client unassigns related records instead of deleting them.
-- Run once on existing databases that already ran crm_schema.sql.

alter table public.roles
  drop constraint if exists roles_client_id_fkey;

alter table public.roles
  alter column client_id drop not null;

alter table public.roles
  add constraint roles_client_id_fkey
  foreign key (client_id)
  references public.clients(id)
  on delete set null;

alter table public.contact_employments
  drop constraint if exists contact_employments_client_id_fkey;

alter table public.contact_employments
  alter column client_id drop not null;

alter table public.contact_employments
  add constraint contact_employments_client_id_fkey
  foreign key (client_id)
  references public.clients(id)
  on delete set null;
