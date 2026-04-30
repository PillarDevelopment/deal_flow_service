-- Apply this script to the existing Sector8Estate Supabase project.
-- It adds broker CRM tables into the same public schema and links deals to public.properties.

create extension if not exists pgcrypto;

create table if not exists public.broker_clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  phone text,
  email text,
  telegram text,
  lead_source text,
  budget_from numeric,
  budget_to numeric,
  regions_of_interest text[] not null default '{}',
  asset_types_of_interest text[] not null default '{}',
  investment_goal text,
  status text not null default 'active',
  notes text,
  broker_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.broker_deals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.broker_clients(id) on delete cascade,
  title text not null,
  stage text not null default 'new_lead',
  priority text not null default 'normal',
  broker_user_id uuid,
  next_step text,
  next_step_due_at timestamptz,
  last_contact_at timestamptz,
  deal_notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_deals_stage_check check (
    stage in (
      'new_lead',
      'contacted',
      'qualified',
      'objects_sent',
      'discussion',
      'meeting',
      'negotiation',
      'won',
      'lost'
    )
  )
);

create table if not exists public.broker_deal_properties (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.broker_deals(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  status text not null default 'shortlist',
  comment text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_deal_properties_unique unique (deal_id, property_id),
  constraint broker_deal_properties_status_check check (
    status in (
      'shortlist',
      'sent',
      'viewed',
      'feedback_pending',
      'rejected',
      'in_negotiation'
    )
  )
);

create table if not exists public.broker_deal_activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.broker_deals(id) on delete cascade,
  client_id uuid references public.broker_clients(id) on delete set null,
  activity_type text not null default 'note',
  comment text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint broker_deal_activities_type_check check (
    activity_type in (
      'call',
      'message',
      'meeting',
      'object_sent',
      'feedback',
      'status_changed',
      'note'
    )
  )
);

create index if not exists broker_clients_updated_at_idx on public.broker_clients(updated_at desc);
create index if not exists broker_clients_search_idx on public.broker_clients using gin (
  to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(company, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, ''))
);
create index if not exists broker_deals_client_id_idx on public.broker_deals(client_id);
create index if not exists broker_deals_stage_idx on public.broker_deals(stage);
create index if not exists broker_deals_updated_at_idx on public.broker_deals(updated_at desc);
create index if not exists broker_deal_properties_deal_id_idx on public.broker_deal_properties(deal_id);
create index if not exists broker_deal_properties_property_id_idx on public.broker_deal_properties(property_id);
create index if not exists broker_deal_activities_deal_id_idx on public.broker_deal_activities(deal_id, created_at desc);

create or replace function public.broker_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists broker_clients_set_updated_at on public.broker_clients;
create trigger broker_clients_set_updated_at
before update on public.broker_clients
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_deals_set_updated_at on public.broker_deals;
create trigger broker_deals_set_updated_at
before update on public.broker_deals
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_deal_properties_set_updated_at on public.broker_deal_properties;
create trigger broker_deal_properties_set_updated_at
before update on public.broker_deal_properties
for each row execute function public.broker_set_updated_at();
