-- Futbolityx API - esquema inicial (PostgreSQL 14+)
-- Borrador para la etapa de cuentas y suscripciones. Todavia no se ejecuta
-- desde el servidor: primero hay que elegir el proveedor de base de datos.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  email_verified_at timestamptz,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'elite')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create index if not exists subscriptions_user_status_idx on subscriptions (user_id, status);
create index if not exists subscriptions_period_idx on subscriptions (current_period_end);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists usage_events (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_time_idx on usage_events (user_id, created_at);
