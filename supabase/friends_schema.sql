-- ============================================================
-- Friends & Leaderboard Schema
-- Run this in the Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- ─── Allow authenticated users to search other profiles ────
-- (needed for friend search by email)
create policy "Authenticated users can view any profile"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- ─── Friend Requests ───────────────────────────────────────

create table public.friend_requests (
  id          uuid default uuid_generate_v4() primary key,
  sender_id   uuid references auth.users(id) on delete cascade not null,
  receiver_id uuid references auth.users(id) on delete cascade not null,
  status      text default 'pending' check (status in ('pending','accepted','declined')),
  created_at  timestamptz default now() not null,
  constraint no_self_request check (sender_id <> receiver_id),
  unique(sender_id, receiver_id)
);

alter table public.friend_requests enable row level security;

create policy "Users can send friend requests"
  on public.friend_requests for insert
  with check (auth.uid() = sender_id);

create policy "Users can view own friend requests"
  on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Receivers can update friend requests"
  on public.friend_requests for update
  using (auth.uid() = receiver_id);

create index idx_friend_requests_receiver on public.friend_requests(receiver_id, status);
create index idx_friend_requests_sender   on public.friend_requests(sender_id);

-- ─── Friendships ───────────────────────────────────────────

create table public.friendships (
  id         uuid default uuid_generate_v4() primary key,
  user_id_1  uuid references auth.users(id) on delete cascade not null,
  user_id_2  uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  constraint ordered_friendship check (user_id_1 < user_id_2),
  unique(user_id_1, user_id_2)
);

alter table public.friendships enable row level security;

create policy "Users can view own friendships"
  on public.friendships for select
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

create policy "Users can insert own friendships"
  on public.friendships for insert
  with check (auth.uid() = user_id_1 or auth.uid() = user_id_2);

create index idx_friendships_user1 on public.friendships(user_id_1);
create index idx_friendships_user2 on public.friendships(user_id_2);

-- ─── Grants ────────────────────────────────────────────────

grant all on public.friend_requests to authenticated;
grant all on public.friendships      to authenticated;
