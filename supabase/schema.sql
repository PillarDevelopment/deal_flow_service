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

create table if not exists public.broker_campaigns (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  campaign_name text not null,
  status text not null default 'draft',
  objective text,
  owner_user_id uuid,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_campaigns_status_check check (
    status in (
      'draft',
      'needs_review',
      'approved',
      'scheduled',
      'running',
      'paused',
      'completed',
      'archived'
    )
  )
);

create table if not exists public.broker_campaign_briefs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broker_campaigns(id) on delete cascade,
  property_snapshot jsonb not null default '{}'::jsonb,
  original_brief text,
  attachments_snapshot jsonb not null default '[]'::jsonb,
  source_version text,
  created_at timestamptz not null default now(),
  constraint broker_campaign_briefs_campaign_id_unique unique (campaign_id)
);

create table if not exists public.broker_campaign_hypotheses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broker_campaigns(id) on delete cascade,
  segment_name text not null,
  segment_type text not null,
  value_prop text,
  channel text,
  priority integer not null default 0,
  status text not null default 'draft',
  reasoning text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_campaign_hypotheses_status_check check (
    status in ('draft', 'approved', 'rejected', 'deprecated')
  )
);

create table if not exists public.broker_campaign_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broker_campaigns(id) on delete cascade,
  company_name text not null,
  contact_name text,
  email text not null,
  source text,
  object_role text,
  domain text,
  status text not null default 'eligible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_campaign_targets_unique unique (campaign_id, email),
  constraint broker_campaign_targets_status_check check (
    status in ('eligible', 'sent', 'followed_up', 'suppressed', 'bounced', 'replied')
  )
);

create table if not exists public.broker_company_directory (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  email text not null,
  site_title text,
  company_type text,
  city text,
  city_district text,
  region text,
  federal_district text,
  rubric text,
  subrubric text,
  subrubric_type text,
  coordinates text,
  working_hours text,
  timezone text,
  business_status text,
  internet_rating text,
  review_count_estimate text,
  domain text,
  source text not null default 'companies_may_csv',
  source_file text,
  import_batch text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_company_directory_email_company_unique unique (email, company_name)
);

create table if not exists public.broker_message_threads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broker_campaigns(id) on delete cascade,
  target_id uuid not null references public.broker_campaign_targets(id) on delete cascade,
  thread_type text not null default 'first_touch',
  status text not null default 'draft',
  current_step integer not null default 1,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_message_threads_unique unique (campaign_id, target_id, thread_type),
  constraint broker_message_threads_type_check check (
    thread_type in ('first_touch', 'followup', 'ping')
  ),
  constraint broker_message_threads_status_check check (
    status in ('draft', 'approved', 'scheduled', 'sending', 'sent', 'failed', 'paused')
  )
);

create table if not exists public.broker_message_versions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.broker_message_threads(id) on delete cascade,
  version_number integer not null default 1,
  subject text not null,
  body_html text not null,
  body_text text,
  tone text,
  status text not null default 'draft',
  edited_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_message_versions_unique unique (thread_id, version_number),
  constraint broker_message_versions_status_check check (
    status in ('draft', 'approved', 'scheduled', 'sent', 'failed')
  )
);

create table if not exists public.broker_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.broker_message_threads(id) on delete cascade,
  step_order integer not null,
  delay_hours integer not null default 0,
  step_type text not null default 'followup',
  template_version_id uuid references public.broker_message_versions(id) on delete set null,
  send_window text,
  stop_on_reply boolean not null default true,
  stop_on_bounce boolean not null default true,
  stop_on_suppression boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_sequence_steps_unique unique (thread_id, step_order),
  constraint broker_sequence_steps_type_check check (
    step_type in ('first_touch', 'followup', 'ping')
  )
);

create table if not exists public.broker_send_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broker_campaigns(id) on delete cascade,
  thread_id uuid not null references public.broker_message_threads(id) on delete cascade,
  message_version_id uuid references public.broker_message_versions(id) on delete set null,
  mailbox_id text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text not null default 'queued',
  provider_message_id text,
  provider_response jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_send_jobs_status_check check (
    status in ('queued', 'sending', 'sent', 'failed', 'suppressed', 'bounced', 'replied', 'skipped')
  )
);

create table if not exists public.broker_send_events (
  id uuid primary key default gen_random_uuid(),
  send_job_id uuid not null references public.broker_send_jobs(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.broker_mailboxes (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  domain text not null,
  status text not null default 'active',
  daily_cap integer not null default 0,
  monthly_cap integer not null default 0,
  unique_cap integer not null default 0,
  health_score numeric,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_mailboxes_status_check check (
    status in ('active', 'warming', 'cooling', 'paused', 'quarantined')
  )
);

create table if not exists public.broker_quota_windows (
  id uuid primary key default gen_random_uuid(),
  window_type text not null,
  window_start timestamptz not null,
  sent_count integer not null default 0,
  unique_email_count integer not null default 0,
  active_campaign_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_quota_windows_unique unique (window_type, window_start),
  constraint broker_quota_windows_type_check check (window_type in ('day', 'month'))
);

create table if not exists public.broker_amo_exports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broker_campaigns(id) on delete cascade,
  deal_id uuid references public.broker_deals(id) on delete set null,
  contact_id uuid references public.broker_campaign_targets(id) on delete set null,
  export_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  external_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_amo_exports_status_check check (
    status in ('pending', 'exported', 'failed', 'needs_review')
  )
);

create table if not exists public.broker_approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  approval_type text not null,
  status text not null default 'draft',
  approver_user_id uuid,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_approvals_status_check check (
    status in ('draft', 'needs_approval', 'approved', 'rejected')
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
create index if not exists broker_campaigns_property_id_idx on public.broker_campaigns(property_id);
create index if not exists broker_campaigns_status_idx on public.broker_campaigns(status);
create index if not exists broker_campaign_hypotheses_campaign_id_idx on public.broker_campaign_hypotheses(campaign_id);
create index if not exists broker_campaign_targets_campaign_id_idx on public.broker_campaign_targets(campaign_id);
create index if not exists broker_company_directory_email_idx on public.broker_company_directory(email);
create index if not exists broker_company_directory_region_idx on public.broker_company_directory(region);
create index if not exists broker_company_directory_rubric_idx on public.broker_company_directory(rubric);
create index if not exists broker_company_directory_search_idx on public.broker_company_directory using gin (
  to_tsvector('simple', coalesce(company_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(city, '') || ' ' || coalesce(region, '') || ' ' || coalesce(rubric, '') || ' ' || coalesce(subrubric, ''))
);
create index if not exists broker_message_threads_campaign_id_idx on public.broker_message_threads(campaign_id, created_at desc);
create index if not exists broker_message_versions_thread_id_idx on public.broker_message_versions(thread_id, version_number desc);
create index if not exists broker_sequence_steps_thread_id_idx on public.broker_sequence_steps(thread_id, step_order);
create index if not exists broker_send_jobs_campaign_id_idx on public.broker_send_jobs(campaign_id, created_at desc);
create index if not exists broker_send_events_send_job_id_idx on public.broker_send_events(send_job_id, event_at desc);
create index if not exists broker_mailboxes_status_idx on public.broker_mailboxes(status);
create index if not exists broker_quota_windows_type_start_idx on public.broker_quota_windows(window_type, window_start desc);
create index if not exists broker_amo_exports_campaign_id_idx on public.broker_amo_exports(campaign_id, created_at desc);
create index if not exists broker_approvals_entity_idx on public.broker_approvals(entity_type, entity_id, approval_type);

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

drop trigger if exists broker_campaigns_set_updated_at on public.broker_campaigns;
create trigger broker_campaigns_set_updated_at
before update on public.broker_campaigns
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_campaign_hypotheses_set_updated_at on public.broker_campaign_hypotheses;
create trigger broker_campaign_hypotheses_set_updated_at
before update on public.broker_campaign_hypotheses
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_campaign_targets_set_updated_at on public.broker_campaign_targets;
create trigger broker_campaign_targets_set_updated_at
before update on public.broker_campaign_targets
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_company_directory_set_updated_at on public.broker_company_directory;
create trigger broker_company_directory_set_updated_at
before update on public.broker_company_directory
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_message_threads_set_updated_at on public.broker_message_threads;
create trigger broker_message_threads_set_updated_at
before update on public.broker_message_threads
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_message_versions_set_updated_at on public.broker_message_versions;
create trigger broker_message_versions_set_updated_at
before update on public.broker_message_versions
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_sequence_steps_set_updated_at on public.broker_sequence_steps;
create trigger broker_sequence_steps_set_updated_at
before update on public.broker_sequence_steps
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_send_jobs_set_updated_at on public.broker_send_jobs;
create trigger broker_send_jobs_set_updated_at
before update on public.broker_send_jobs
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_mailboxes_set_updated_at on public.broker_mailboxes;
create trigger broker_mailboxes_set_updated_at
before update on public.broker_mailboxes
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_quota_windows_set_updated_at on public.broker_quota_windows;
create trigger broker_quota_windows_set_updated_at
before update on public.broker_quota_windows
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_amo_exports_set_updated_at on public.broker_amo_exports;
create trigger broker_amo_exports_set_updated_at
before update on public.broker_amo_exports
for each row execute function public.broker_set_updated_at();

drop trigger if exists broker_approvals_set_updated_at on public.broker_approvals;
create trigger broker_approvals_set_updated_at
before update on public.broker_approvals
for each row execute function public.broker_set_updated_at();
