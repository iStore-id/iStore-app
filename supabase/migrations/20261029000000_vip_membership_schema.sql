-- VIP membership schema used by the existing membership services.
-- Access is restricted to server-side service-role queries; no client policies are added.
create table if not exists public.membership_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  tier_level integer not null check (tier_level >= 1),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  price numeric(14,2) not null default 0 check (price >= 0),
  duration_days integer not null default 0 check (duration_days >= 0),
  point_multiplier numeric(8,2) not null default 1 check (point_multiplier >= 1 and point_multiplier <= 100),
  discount_rate numeric(5,2) not null default 0 check (discount_rate >= 0 and discount_rate <= 100),
  access_tags jsonb not null default '[]'::jsonb check (jsonb_typeof(access_tags) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists membership_plans_status_tier_idx
  on public.membership_plans (status, tier_level);

create table if not exists public.customer_memberships (
  id text primary key,
  plan_id text not null references public.membership_plans(id) on update cascade on delete restrict,
  status text not null default 'ACTIVE' check (status in ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'REVOKED')),
  start_date timestamptz not null default now(),
  expiry_date timestamptz,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'MANUAL' check (source in ('PURCHASE', 'MANUAL')),
  order_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index if not exists customer_memberships_status_expiry_idx
  on public.customer_memberships (status, expiry_date);
create index if not exists customer_memberships_plan_idx
  on public.customer_memberships (plan_id);
create index if not exists customer_memberships_assigned_at_idx
  on public.customer_memberships (assigned_at desc);

alter table public.membership_plans enable row level security;
alter table public.customer_memberships enable row level security;

revoke all on table public.membership_plans from anon, authenticated;
revoke all on table public.customer_memberships from anon, authenticated;
grant all on table public.membership_plans to service_role;
grant all on table public.customer_memberships to service_role;
