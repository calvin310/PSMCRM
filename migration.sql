-- Drive OAuth tokens and sync state per PSM
create table drive_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) unique,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  gemini_folder_id text,
  last_synced_at timestamptz default '2000-01-01',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table drive_connections enable row level security;
create policy "Users manage own drive connection"
  on drive_connections for all using (auth.uid() = user_id);

-- Temporary queue — notes waiting for PSM to assign and process
create table pending_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  file_id text not null,
  file_name text,
  content text,
  drive_created_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, file_id)
);
alter table pending_notes enable row level security;
create policy "Users see own pending notes"
  on pending_notes for all using (auth.uid() = user_id);

-- Full meeting archive — one row per processed meeting
-- This is the foundation for the AI chat later
create table meeting_history (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references accounts(id) on delete cascade,
  user_id uuid references auth.users(id),
  file_id text,
  file_name text,
  meeting_date timestamptz,
  processed_at timestamptz default now(),
  -- Full extracted fields stored per meeting
  summary text[],
  psm_action_items text[],
  protocol_action_items text[],
  health_status text,
  health_reason text,
  blockers text[],
  what_working text[],
  exploring text[],
  key_dates text[],
  follow_up_draft text[],
  raw_transcript text
);
alter table meeting_history enable row level security;
create policy "Users manage own meeting history"
  on meeting_history for all using (auth.uid() = user_id);
