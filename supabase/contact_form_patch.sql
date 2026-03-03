-- Patch for existing databases to support the Add Contact form.

alter table public.contacts
  add column if not exists department text,
  add column if not exists secondary_email text,
  add column if not exists job_title text,
  add column if not exists work_phone text,
  add column if not exists mobile text,
  add column if not exists x_url text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists source text,
  add column if not exists owner_user_id uuid references auth.users(id),
  add column if not exists marketing_email_opt_out boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contacts_source_check'
      and conrelid = 'public.contacts'::regclass
  ) then
    alter table public.contacts
    add constraint contacts_source_check
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
    );
  end if;
end
$$;

create unique index if not exists contacts_secondary_email_unique_when_present
on public.contacts (lower(secondary_email))
where secondary_email is not null;

create index if not exists contacts_owner_user_id_idx
on public.contacts (owner_user_id);
