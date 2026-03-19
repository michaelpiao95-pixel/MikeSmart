-- ============================================================
-- Student Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users (extends Supabase auth.users) ──────────────────

create table public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  email           text not null,
  full_name       text,
  avatar_url      text,
  canvas_base_url text,
  -- Token stored as text; encrypt at application layer before storing
  canvas_api_token_encrypted text,
  canvas_last_synced_at timestamptz,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ─── Courses ──────────────────────────────────────────────

create table public.courses (
  id                uuid default uuid_generate_v4() primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  canvas_course_id  bigint not null,
  name              text not null,
  course_code       text not null,
  color             text default '#6366f1' not null,
  current_grade     numeric(5,2),
  target_grade      numeric(5,2),
  grade_components  jsonb default '[]'::jsonb,
  notes             text,
  links             jsonb default '[]'::jsonb,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null,
  unique(user_id, canvas_course_id)
);

alter table public.courses enable row level security;

create policy "Users can manage own courses"
  on public.courses for all using (auth.uid() = user_id);

create index idx_courses_user_id on public.courses(user_id);

-- ─── Assignments ──────────────────────────────────────────

create table public.assignments (
  id                     uuid default uuid_generate_v4() primary key,
  user_id                uuid references public.profiles(id) on delete cascade not null,
  course_id              uuid references public.courses(id) on delete set null,
  canvas_assignment_id   bigint,
  canvas_course_id       bigint,
  title                  text not null,
  description            text,
  due_at                 timestamptz,
  points_possible        numeric(8,2),
  priority               text default 'medium' check (priority in ('low','medium','high','critical')),
  is_completed           boolean default false not null,
  completed_at           timestamptz,
  canvas_html_url        text,
  is_synced_from_canvas  boolean default false not null,
  created_at             timestamptz default now() not null,
  updated_at             timestamptz default now() not null,
  -- Unique constraint: one canvas assignment per user
  unique(user_id, canvas_assignment_id)
);

alter table public.assignments enable row level security;

create policy "Users can manage own assignments"
  on public.assignments for all using (auth.uid() = user_id);

create index idx_assignments_user_id on public.assignments(user_id);
create index idx_assignments_due_at on public.assignments(due_at);
create index idx_assignments_course_id on public.assignments(course_id);
create index idx_assignments_canvas_id on public.assignments(canvas_assignment_id);

-- ─── Tasks ────────────────────────────────────────────────

create table public.tasks (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  title            text not null,
  description      text,
  category         text default 'personal' check (category in ('academic','personal')),
  status           text default 'pending' check (status in ('pending','in_progress','completed')),
  priority         text default 'medium' check (priority in ('low','medium','high','critical')),
  due_date         date,
  scheduled_date   date,
  scheduled_start  time,
  scheduled_end    time,
  is_habit         boolean default false not null,
  habit_days       integer[] default '{}', -- 0=Sun..6=Sat
  completed_at     timestamptz,
  sort_order       integer default 0,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

alter table public.tasks enable row level security;

create policy "Users can manage own tasks"
  on public.tasks for all using (auth.uid() = user_id);

create index idx_tasks_user_id on public.tasks(user_id);
create index idx_tasks_scheduled_date on public.tasks(scheduled_date);
create index idx_tasks_due_date on public.tasks(due_date);

-- ─── Pomodoro Sessions ────────────────────────────────────

create table public.pomodoro_sessions (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  task_id          uuid references public.tasks(id) on delete set null,
  assignment_id    uuid references public.assignments(id) on delete set null,
  duration_minutes integer not null default 25,
  completed        boolean default false,
  started_at       timestamptz default now() not null,
  ended_at         timestamptz,
  notes            text
);

alter table public.pomodoro_sessions enable row level security;

create policy "Users can manage own sessions"
  on public.pomodoro_sessions for all using (auth.uid() = user_id);

create index idx_pomodoro_user_id on public.pomodoro_sessions(user_id);
create index idx_pomodoro_started_at on public.pomodoro_sessions(started_at);

-- ─── Daily Reflections ────────────────────────────────────

create table public.daily_reflections (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  date             date not null,
  wins             text default '',
  mistakes         text default '',
  improvements     text default '',
  completion_score integer default 0 check (completion_score between 0 and 100),
  mood             integer default 3 check (mood between 1 and 5),
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null,
  unique(user_id, date)
);

alter table public.daily_reflections enable row level security;

create policy "Users can manage own reflections"
  on public.daily_reflections for all using (auth.uid() = user_id);

create index idx_reflections_user_date on public.daily_reflections(user_id, date);

-- ─── Streaks ──────────────────────────────────────────────

create table public.streaks (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.profiles(id) on delete cascade not null,
  streak_type         text not null check (streak_type in ('task_completion','study_session','daily_reflection')),
  current_streak      integer default 0,
  longest_streak      integer default 0,
  last_activity_date  date,
  updated_at          timestamptz default now() not null,
  unique(user_id, streak_type)
);

alter table public.streaks enable row level security;

create policy "Users can manage own streaks"
  on public.streaks for all using (auth.uid() = user_id);

-- ─── Canvas Sync Logs ─────────────────────────────────────

create table public.canvas_sync_logs (
  id                   uuid default uuid_generate_v4() primary key,
  user_id              uuid references public.profiles(id) on delete cascade not null,
  synced_at            timestamptz default now() not null,
  courses_synced       integer default 0,
  assignments_synced   integer default 0,
  assignments_updated  integer default 0,
  status               text default 'success' check (status in ('success','partial','failed')),
  error_message        text
);

alter table public.canvas_sync_logs enable row level security;

create policy "Users can view own sync logs"
  on public.canvas_sync_logs for all using (auth.uid() = user_id);

create index idx_sync_logs_user_id on public.canvas_sync_logs(user_id);
create index idx_sync_logs_synced_at on public.canvas_sync_logs(synced_at desc);

-- ─── Trigger: auto-update updated_at ──────────────────────

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger courses_updated_at before update on public.courses
  for each row execute function public.handle_updated_at();

create trigger assignments_updated_at before update on public.assignments
  for each row execute function public.handle_updated_at();

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.handle_updated_at();

create trigger reflections_updated_at before update on public.daily_reflections
  for each row execute function public.handle_updated_at();

-- ─── Trigger: auto-create profile on signup ───────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  -- Seed default streaks
  insert into public.streaks(user_id, streak_type)
  values
    (new.id, 'task_completion'),
    (new.id, 'study_session'),
    (new.id, 'daily_reflection');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Grants ───────────────────────────────────────────────
-- Required so the authenticated role can access tables via PostgREST

grant usage on schema public to anon, authenticated;

grant all on public.profiles          to authenticated;
grant all on public.courses           to authenticated;
grant all on public.assignments       to authenticated;
grant all on public.tasks             to authenticated;
grant all on public.pomodoro_sessions to authenticated;
grant all on public.daily_reflections to authenticated;
grant all on public.streaks           to authenticated;
grant all on public.canvas_sync_logs  to authenticated;
