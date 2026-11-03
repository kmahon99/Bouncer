-- Bouncer pilot domain model. Client access is read-only through RLS for now;
-- privileged mutations belong in authenticated Edge Functions.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  incident_retention_days integer check (incident_retention_days > 0),
  location_retention_days integer check (location_retention_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_memberships (
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'incident_manager')),
  created_at timestamptz not null default now(),
  primary key (customer_id, user_id)
);

create table public.workplaces (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  address text,
  perimeter_north_lat double precision,
  perimeter_south_lat double precision,
  perimeter_east_lon double precision,
  perimeter_west_lon double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, customer_id),
  check (
    (perimeter_north_lat is null and perimeter_south_lat is null and perimeter_east_lon is null and perimeter_west_lon is null)
    or (
      perimeter_north_lat is not null
      and perimeter_south_lat is not null
      and perimeter_east_lon is not null
      and perimeter_west_lon is not null
      and
      perimeter_north_lat between -90 and 90
      and perimeter_south_lat between -90 and 90
      and perimeter_east_lon between -180 and 180
      and perimeter_west_lon between -180 and 180
      and perimeter_north_lat > perimeter_south_lat
    )
  )
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  work_email text not null check (work_email = lower(trim(work_email))),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, customer_id)
);

create unique index employees_customer_email_unique
  on public.employees (customer_id, lower(work_email));
create unique index employees_auth_user_unique
  on public.employees (customer_id, auth_user_id)
  where auth_user_id is not null;

create table public.employee_workplaces (
  customer_id uuid not null,
  employee_id uuid not null,
  workplace_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (employee_id, workplace_id),
  foreign key (employee_id, customer_id) references public.employees(id, customer_id) on delete cascade,
  foreign key (workplace_id, customer_id) references public.workplaces(id, customer_id) on delete cascade
);

create table public.incident_types (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  workplace_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (workplace_id, customer_id) references public.workplaces(id, customer_id) on delete cascade,
  unique (id, customer_id, workplace_id)
);

create table public.incident_protocol_versions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  workplace_id uuid not null,
  incident_type_id uuid not null,
  version integer not null check (version > 0),
  instructions text not null check (length(trim(instructions)) > 0),
  assembly_points jsonb not null default '[]'::jsonb check (jsonb_typeof(assembly_points) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (incident_type_id, customer_id, workplace_id)
    references public.incident_types(id, customer_id, workplace_id) on delete cascade,
  unique (incident_type_id, version),
  unique (id, customer_id, workplace_id)
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  workplace_id uuid not null,
  incident_type_id uuid not null,
  protocol_version_id uuid not null,
  status text not null default 'active' check (status in ('active', 'resolved')),
  declared_by uuid references auth.users(id) on delete set null,
  declared_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, customer_id, workplace_id),
  foreign key (workplace_id, customer_id) references public.workplaces(id, customer_id),
  foreign key (incident_type_id, customer_id, workplace_id)
    references public.incident_types(id, customer_id, workplace_id),
  foreign key (protocol_version_id, customer_id, workplace_id)
    references public.incident_protocol_versions(id, customer_id, workplace_id),
  check ((status = 'active' and resolved_at is null) or (status = 'resolved' and resolved_at is not null))
);

create unique index incidents_one_active_per_workplace
  on public.incidents (workplace_id)
  where status = 'active';

create table public.incident_roster (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  workplace_id uuid not null,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  employee_id uuid not null,
  response_status text not null default 'unacknowledged'
    check (response_status in ('unacknowledged', 'acknowledged', 'denied_access', 'unreachable')),
  presence_status text not null default 'manual_check'
    check (presence_status in ('manual_check', 'within_perimeter', 'outside_perimeter', 'stale_unknown', 'denied_access')),
  safety_status text not null default 'unconfirmed' check (safety_status in ('unconfirmed', 'safe')),
  acknowledged_at timestamptz,
  safety_checked_by uuid references auth.users(id) on delete set null,
  safety_checked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (incident_id, customer_id, workplace_id)
    references public.incidents(id, customer_id, workplace_id),
  foreign key (employee_id, customer_id)
    references public.employees(id, customer_id),
  unique (incident_id, employee_id),
  unique (id, customer_id, workplace_id)
);

create table public.device_installations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  employee_id uuid not null,
  device_kind text not null default 'employee_phone'
    check (device_kind in ('employee_phone', 'workstation')),
  platform text not null check (platform in ('android', 'windows')),
  device_name text,
  expo_push_token text unique,
  active boolean not null default true,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  foreign key (employee_id, customer_id) references public.employees(id, customer_id) on delete cascade,
  unique (id, customer_id)
);

create table public.incident_events (
  id bigint generated always as identity primary key,
  customer_id uuid not null,
  workplace_id uuid not null,
  incident_id uuid not null,
  employee_id uuid,
  device_installation_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (length(trim(event_type)) > 0),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (incident_id, customer_id, workplace_id)
    references public.incidents(id, customer_id, workplace_id) on delete cascade,
  foreign key (employee_id, customer_id)
    references public.employees(id, customer_id),
  foreign key (device_installation_id, customer_id)
    references public.device_installations(id, customer_id)
);

create index incident_events_timeline
  on public.incident_events (incident_id, occurred_at, id);

create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  workplace_id uuid not null,
  incident_id uuid not null,
  employee_id uuid not null,
  device_installation_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  notification_kind text not null check (notification_kind in ('incident', 'resolution', 'heartbeat')),
  state text not null default 'queued'
    check (state in ('queued', 'provider_accepted', 'provider_failed', 'provider_delivered', 'acknowledged', 'stopped')),
  provider_ticket_id text,
  attempted_at timestamptz,
  next_attempt_at timestamptz,
  provider_error text,
  created_at timestamptz not null default now(),
  foreign key (incident_id, customer_id, workplace_id)
    references public.incidents(id, customer_id, workplace_id) on delete cascade,
  foreign key (employee_id, customer_id)
    references public.employees(id, customer_id),
  foreign key (device_installation_id, customer_id)
    references public.device_installations(id, customer_id),
  unique (incident_id, device_installation_id, notification_kind, attempt_number)
);

create index push_deliveries_due
  on public.push_deliveries (next_attempt_at)
  where state = 'queued';

create table public.location_observations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  workplace_id uuid not null,
  incident_roster_id uuid not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  captured_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (incident_roster_id, customer_id, workplace_id)
    references public.incident_roster(id, customer_id, workplace_id) on delete cascade
);

create index location_observations_roster_time
  on public.location_observations (incident_roster_id, captured_at desc);

create or replace function public.can_manage_incidents(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customer_memberships cm
    where cm.customer_id = target_customer_id
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner', 'admin', 'incident_manager')
  );
$$;

revoke all on function public.can_manage_incidents(uuid) from public, anon;
grant execute on function public.can_manage_incidents(uuid) to authenticated;

alter table public.customers enable row level security;
alter table public.customer_memberships enable row level security;
alter table public.workplaces enable row level security;
alter table public.employees enable row level security;
alter table public.employee_workplaces enable row level security;
alter table public.incident_types enable row level security;
alter table public.incident_protocol_versions enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_roster enable row level security;
alter table public.device_installations enable row level security;
alter table public.incident_events enable row level security;
alter table public.push_deliveries enable row level security;
alter table public.location_observations enable row level security;

-- Browser/mobile clients can read only tenant-scoped data. Mutations are reserved
-- for authenticated Edge Functions that validate roles and append audit events.
grant select on public.customers, public.customer_memberships, public.workplaces,
  public.employees, public.employee_workplaces, public.incident_types,
  public.incident_protocol_versions, public.incidents, public.incident_roster,
  public.device_installations, public.incident_events, public.push_deliveries,
  public.location_observations to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
revoke select on all tables in schema public from anon;
grant all on all tables in schema public to service_role;

create policy customers_read_managers on public.customers
  for select to authenticated using (public.can_manage_incidents(id));
create policy memberships_read_self_or_managers on public.customer_memberships
  for select to authenticated using (user_id = (select auth.uid()) or public.can_manage_incidents(customer_id));
create policy workplaces_read_customer on public.workplaces
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy employees_read_customer on public.employees
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy employee_workplaces_read_customer on public.employee_workplaces
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy incident_types_read_customer on public.incident_types
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy protocols_read_customer on public.incident_protocol_versions
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy incidents_read_customer on public.incidents
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy incident_roster_read_customer on public.incident_roster
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy devices_read_managers on public.device_installations
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy events_read_managers on public.incident_events
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy deliveries_read_managers on public.push_deliveries
  for select to authenticated using (public.can_manage_incidents(customer_id));
create policy locations_read_managers on public.location_observations
  for select to authenticated using (public.can_manage_incidents(customer_id));

