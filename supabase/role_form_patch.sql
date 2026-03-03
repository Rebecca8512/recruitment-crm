-- Patch for existing databases to support the Add Role form.

alter table public.roles
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists owner_user_id uuid references auth.users(id),
  add column if not exists target_date date,
  add column if not exists industry text,
  add column if not exists job_type text not null default 'full_time',
  add column if not exists salary_text text,
  add column if not exists work_experience text not null default 'none',
  add column if not exists notes text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists county text,
  add column if not exists postcode text,
  add column if not exists address_text text,
  add column if not exists is_remote boolean not null default false,
  add column if not exists is_hybrid boolean not null default false,
  add column if not exists number_of_positions integer,
  add column if not exists expected_revenue_per_position text,
  add column if not exists total_expected_revenue text,
  add column if not exists actual_revenue text,
  add column if not exists job_description_html text,
  add column if not exists requirements_html text,
  add column if not exists benefits_html text,
  add column if not exists listing_job_boards text,
  add column if not exists listing_social_media text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'roles_job_type_check'
      and conrelid = 'public.roles'::regclass
  ) then
    alter table public.roles
    add constraint roles_job_type_check
    check (
      job_type in (
        'none',
        'full_time',
        'part_time',
        'temporary',
        'contract',
        'seasonal',
        'freelance'
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'roles_work_experience_check'
      and conrelid = 'public.roles'::regclass
  ) then
    alter table public.roles
    add constraint roles_work_experience_check
    check (
      work_experience in (
        'none',
        '0_1_year',
        '1_3_years',
        '4_5_years',
        '5_plus_years'
      )
    );
  end if;
end
$$;

create index if not exists roles_contact_id_idx
on public.roles (contact_id);

create index if not exists roles_owner_user_id_idx
on public.roles (owner_user_id);
