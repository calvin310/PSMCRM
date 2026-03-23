-- Meeting preferences for calendar events
create table meeting_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_event_id text not null,
  preference text not null check (preference in ('record', 'skip', 'sync')),
  created_at timestamptz default now(),
  unique(user_id, calendar_event_id)
);
alter table meeting_preferences enable row level security;
create policy "Users manage own meeting preferences"
  on meeting_preferences for all using (auth.uid() = user_id);
