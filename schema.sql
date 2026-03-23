create table accounts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  psm_id uuid references auth.users(id),
  health_status text default 'green',
  health_reason text,
  what_building text,
  current_focus text,
  current_status text,
  what_working text[],
  blockers text[],
  exploring text[],
  sector_trends text,
  last_meeting_date timestamptz,
  last_meeting_summary text[],
  psm_action_items text[],
  protocol_action_items text[],
  follow_up_draft text[],
  key_dates text[],
  raw_transcript text,
  relationship_stage text default 'active',
  comms_channel text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table accounts enable row level security;

create policy "PSMs see own accounts"
on accounts for all
using (auth.uid() = psm_id);

create policy "PSMs insert own accounts"
on accounts for insert
with check (auth.uid() = psm_id);
