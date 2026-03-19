"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SCHEMA_SQL = `-- Run this entire block in your Supabase SQL Editor
-- supabase.com → your project → SQL Editor → New query → paste → Run

create extension if not exists "uuid-ossp";

create table public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  email           text not null,
  full_name       text,
  avatar_url      text,
  canvas_base_url text,
  canvas_api_token_encrypted text,
  canvas_last_synced_at timestamptz,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

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
create policy "Users can manage own courses" on public.courses for all using (auth.uid() = user_id);
create index idx_courses_user_id on public.courses(user_id);

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
  unique(user_id, canvas_assignment_id)
);
alter table public.assignments enable row level security;
create policy "Users can manage own assignments" on public.assignments for all using (auth.uid() = user_id);
create index idx_assignments_user_id on public.assignments(user_id);
create index idx_assignments_due_at on public.assignments(due_at);
create index idx_assignments_course_id on public.assignments(course_id);
create index idx_assignments_canvas_id on public.assignments(canvas_assignment_id);

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
  habit_days       integer[] default '{}',
  completed_at     timestamptz,
  sort_order       integer default 0,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);
alter table public.tasks enable row level security;
create policy "Users can manage own tasks" on public.tasks for all using (auth.uid() = user_id);
create index idx_tasks_user_id on public.tasks(user_id);
create index idx_tasks_scheduled_date on public.tasks(scheduled_date);

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
create policy "Users can manage own sessions" on public.pomodoro_sessions for all using (auth.uid() = user_id);
create index idx_pomodoro_user_id on public.pomodoro_sessions(user_id);

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
create policy "Users can manage own reflections" on public.daily_reflections for all using (auth.uid() = user_id);
create index idx_reflections_user_date on public.daily_reflections(user_id, date);

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
create policy "Users can manage own streaks" on public.streaks for all using (auth.uid() = user_id);

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
create policy "Users can view own sync logs" on public.canvas_sync_logs for all using (auth.uid() = user_id);
create index idx_sync_logs_user_id on public.canvas_sync_logs(user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.handle_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute function public.handle_updated_at();
create trigger assignments_updated_at before update on public.assignments for each row execute function public.handle_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.handle_updated_at();
create trigger reflections_updated_at before update on public.daily_reflections for each row execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  insert into public.streaks(user_id, streak_type) values
    (new.id, 'task_completion'), (new.id, 'study_session'), (new.id, 'daily_reflection');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Required grants for PostgREST / authenticated role
grant usage on schema public to anon, authenticated;
grant all on public.profiles          to authenticated;
grant all on public.courses           to authenticated;
grant all on public.assignments       to authenticated;
grant all on public.tasks             to authenticated;
grant all on public.pomodoro_sessions to authenticated;
grant all on public.daily_reflections to authenticated;
grant all on public.streaks           to authenticated;
grant all on public.canvas_sync_logs  to authenticated;`;

export default function SetupPage() {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; missing?: string[] } | null>(null);
  const router = useRouter();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    const res = await fetch("/api/health");
    const json = await res.json();
    setCheckResult(json);
    setChecking(false);
    if (json.ok) {
      setTimeout(() => router.push("/"), 1500);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Database Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your Supabase database tables need to be created before you can use the app.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {[
          {
            n: 1,
            title: "Open Supabase SQL Editor",
            body: (
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 text-sm mt-1"
              >
                supabase.com/dashboard
                <ExternalLink className="w-3 h-3" />
              </a>
            ),
            detail: "Go to your project → SQL Editor → New query",
          },
          {
            n: 2,
            title: "Copy the schema SQL",
            body: null,
            detail: "Click the button below to copy the entire schema to your clipboard.",
          },
          {
            n: 3,
            title: "Paste and click Run",
            body: null,
            detail: 'Paste into the SQL Editor and click the green "Run" button. It takes a few seconds.',
          },
          {
            n: 4,
            title: "Come back and verify",
            body: null,
            detail: 'Click "Check Database" below. If everything is green, you\'re done.',
          },
        ].map(({ n, title, body, detail }) => (
          <div key={n} className="flex gap-4 bg-surface-2 border border-border rounded-xl p-4">
            <div className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center shrink-0 text-brand-400 text-xs font-bold">
              {n}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
              {body}
            </div>
          </div>
        ))}
      </div>

      {/* Copy SQL button */}
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-mono text-muted-foreground">schema.sql</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy SQL
              </>
            )}
          </button>
        </div>
        <pre className="p-4 text-xs text-muted-foreground font-mono overflow-auto max-h-64 leading-relaxed">
          {SCHEMA_SQL.slice(0, 600)}
          {"\n  ... ("}
          {SCHEMA_SQL.split("\n").length} lines total — click Copy SQL above{")"}
        </pre>
      </div>

      {/* Check result */}
      {checkResult && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
            checkResult.ok
              ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400"
              : "bg-red-950/30 border-red-900/50 text-red-400"
          }`}
        >
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            {checkResult.ok ? (
              <p className="font-medium">All tables found — redirecting to dashboard...</p>
            ) : (
              <>
                <p className="font-medium">Still missing tables:</p>
                <ul className="mt-1 space-y-0.5">
                  {checkResult.missing?.map((t) => (
                    <li key={t} className="font-mono text-xs">
                      public.{t}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-red-400/70 text-xs">
                  Make sure you ran the full SQL and hit Run in Supabase.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleCopy} size="sm" className="flex-1">
          <Copy className="w-3.5 h-3.5" />
          {copied ? "Copied!" : "Copy Schema SQL"}
        </Button>
        <Button onClick={handleCheck} variant="outline" size="sm" disabled={checking} className="flex-1">
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking..." : "Check Database"}
        </Button>
      </div>
    </div>
  );
}
