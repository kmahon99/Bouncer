-- Synthetic local-only data. No auth users, push tokens, or real employee data.
insert into public.customers (id, name, slug, incident_retention_days, location_retention_days)
values ('10000000-0000-4000-8000-000000000001', 'Bouncer Demo Company', 'bouncer-demo', 365, 30)
on conflict (id) do nothing;

insert into public.workplaces (id, customer_id, name, address)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Demo Office', 'Example address')
on conflict (id, customer_id) do nothing;

insert into public.employees (id, customer_id, full_name, work_email)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Employee 001', 'employee001@example.test'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Employee 002', 'employee002@example.test'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Employee 003', 'employee003@example.test'),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Employee 004', 'employee004@example.test')
on conflict (id) do nothing;

insert into public.employee_workplaces (customer_id, employee_id, workplace_id)
select '10000000-0000-4000-8000-000000000001', employee.id, '20000000-0000-4000-8000-000000000001'
from public.employees employee
where employee.customer_id = '10000000-0000-4000-8000-000000000001'
on conflict do nothing;

insert into public.incident_types (id, customer_id, workplace_id, name)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Fire drill')
on conflict (id) do nothing;

insert into public.incident_protocol_versions (id, customer_id, workplace_id, incident_type_id, version, instructions, assembly_points)
values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  1,
  'Leave by the nearest safe exit. Go to the designated assembly point. Do not re-enter until the incident manager says it is safe.',
  '[{"name":"Demo assembly point","description":"Example only"}]'::jsonb
)
on conflict (id) do nothing;
