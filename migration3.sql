alter table accounts
  add column if not exists psm_action_items_status jsonb default '[]',
  add column if not exists protocol_action_items_status jsonb default '[]';

create table if not exists account_notes (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references accounts(id) on delete cascade,
  user_id uuid references auth.users(id),
  user_email text,
  content text not null,
  created_at timestamptz default now()
);
alter table account_notes enable row level security;
create policy "Users see notes for their accounts"
  on account_notes for select
  using (
    exists (
      select 1 from accounts
      where accounts.id = account_notes.account_id
    )
  );
create policy "Users insert own notes"
  on account_notes for insert
  with check (auth.uid() = user_id);
