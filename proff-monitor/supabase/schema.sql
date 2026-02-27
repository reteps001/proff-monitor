-- Create companies table
create table public.companies (
  id uuid not null default gen_random_uuid (),
  name text not null,
  proff_url text not null,
  cv_number text,
  last_known_statement_year integer,
  last_checked_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  constraint companies_pkey primary key (id),
  constraint companies_proff_url_key unique (proff_url)
);

-- Create subscriptions table
create table public.subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now(),
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_user_company_key unique (user_id, company_id)
);

-- Create notifications table
create table public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid null references public.companies (id) on delete set null,
  message text not null,
  read boolean not null default false,
  created_at timestamp with time zone default now(),
  constraint notifications_pkey primary key (id)
);

-- Enable RLS
alter table public.companies enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;

-- Policies

-- Companies are readable by everyone (or authenticated users)
create policy "Companies are viewable by everyone" on public.companies
  for select using (true);

-- Subscriptions are viewable/editable by the user who owns them
create policy "Users can view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "Users can insert own subscriptions" on public.subscriptions
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own subscriptions" on public.subscriptions
  for delete using (auth.uid() = user_id);


-- Notifications are viewable by the user who owns them
create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- Add financial data columns to companies
alter table public.companies add column if not exists latest_gross_profit bigint;
alter table public.companies add column if not exists latest_annual_result bigint;
alter table public.companies add column if not exists latest_currency text;

