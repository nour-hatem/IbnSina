create table patients (
  mrn text primary key,
  full_name text not null,
  age int not null,
  sex text not null,
  phone text,
  created_at timestamptz default now()
);

create table encounters (
  id uuid primary key default gen_random_uuid(),
  mrn text references patients(mrn),
  arrival_at timestamptz default now(),
  chief_complaint text,
  esi_level int,
  status text default 'in_progress',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references encounters(id) on delete cascade,
  kind text not null,
  code text, name text, priority text, rationale text,
  result_value text, result_flag text,
  signed_by text, signed_at timestamptz
);

create table imaging_studies (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references encounters(id) on delete cascade,
  modality text, storage_path text,
  ai_read jsonb, radiologist_read jsonb,
  created_at timestamptz default now()
);

create table audit_log (
  id bigserial primary key,
  encounter_id uuid,
  actor text not null,
  action text not null,
  node text, payload jsonb,
  at timestamptz default now()
);
create index on audit_log (encounter_id, at desc);

insert into storage.buckets (id, name, public) values ('cxr', 'cxr', false)
  on conflict do nothing;
