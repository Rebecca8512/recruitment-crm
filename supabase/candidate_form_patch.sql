-- Patch for existing databases to support the Add Candidate form.

alter table public.candidates
  add column if not exists mobile text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists county text,
  add column if not exists postcode text,
  add column if not exists facebook_url text,
  add column if not exists x_url text,
  add column if not exists instagram_url text,
  add column if not exists current_employer_client_id uuid references public.clients(id) on delete set null,
  add column if not exists highest_qualification text,
  add column if not exists current_salary numeric(12, 2),
  add column if not exists owner_user_id uuid references auth.users(id),
  add column if not exists source text,
  add column if not exists marketing_email_opt_out boolean not null default false,
  add column if not exists education_institution text,
  add column if not exists education_field text,
  add column if not exists education_graduation_year integer,
  add column if not exists experience_years numeric(6, 2),
  add column if not exists notice_period_weeks integer,
  add column if not exists core_skills text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'candidates_source_check'
      and conrelid = 'public.candidates'::regclass
  ) then
    alter table public.candidates
    add constraint candidates_source_check
    check (
      source is null
      or source in (
        'referral',
        'paid_ad',
        'social_media',
        'jobboard',
        'cold_call'
      )
    );
  end if;
end
$$;

create index if not exists candidates_owner_user_id_idx
on public.candidates (owner_user_id);

create index if not exists candidates_current_employer_client_id_idx
on public.candidates (current_employer_client_id);
