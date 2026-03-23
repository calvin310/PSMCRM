create table calendar_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) unique,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table calendar_connections enable row level security;
create policy "Users manage own calendar connection"
  on calendar_connections for all using (auth.uid() = user_id);

create table admin_users (
  user_id uuid references auth.users(id) primary key
);
alter table admin_users enable row level security;
create policy "Anyone can check admin status"
  on admin_users for select using (true);

create table meeting_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  calendar_event_id text not null,
  account_id uuid references accounts(id) on delete cascade,
  unique(user_id, calendar_event_id)
);
alter table meeting_links enable row level security;
create policy "Users manage own meeting links"
  on meeting_links for all using (auth.uid() = user_id);
