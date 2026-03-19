# Student Dashboard — Setup Guide

## What You're Getting

A full-stack "Life Operating System" with:

- **Today Dashboard** — task manager (Academic / Personal), Pomodoro timer, daily score
- **Canvas LMS Integration** — one-click sync of all assignments + due dates
- **Assignment Checklist** — grouped by Overdue / Today / This Week / Later, with visual urgency
- **Course Manager** — weighted grade calculator, "what I need on the final" calculator
- **Focus Mode** — fullscreen Pomodoro, streaks, daily reflection
- **Analytics** — charts for study hours, task completion, and score trends
- **Command Palette** — ⌘K for instant navigation

---

## Prerequisites

- Node.js 18+
- A Supabase account (free tier works)
- Your school's Canvas LMS URL + an API token

---

## Step 1 — Clone & Install

```bash
cd student-dashboard
npm install
```

---

## Step 2 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, open the **SQL Editor** in your Supabase dashboard
3. Paste the entire contents of `supabase/schema.sql` and click **Run**
4. Go to **Project Settings → API**:
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon/public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 3 — Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 4 — Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Step 5 — Create Your Account

1. Go to `http://localhost:3000/login`
2. Click **Sign up**
3. Enter your email + password → check email for confirmation
4. After confirming, sign in

---

## Step 6 — Connect Canvas

1. In the app, go to **Settings**
2. Enter your school's Canvas URL:
   - Example: `https://canvas.university.edu`
3. Generate a Canvas API token:
   - Log in to Canvas → Account → Settings → Approved Integrations → + New Access Token
   - Copy the token
4. Paste the token in Settings → click **Test Connection**
5. If it shows "Connected as: Your Name" → click **Save Canvas Settings**
6. Click **Sync Canvas** — all your courses and assignments will appear

---

## Step 7 — Daily Workflow

**Morning:**
- Open Today dashboard
- Review assignments due today (pulled from Canvas)
- Add your personal tasks for the day
- Start a Pomodoro session

**Throughout the day:**
- Check off assignments as you complete them
- Track your Daily Score (shows % of tasks + assignments done)

**Evening:**
- Go to Focus → Daily Reflection
- Log your wins, mistakes, and improvements
- Check your streak

---

## Project Structure

```
student-dashboard/
├── app/
│   ├── (auth)/login/         # Login/signup page
│   ├── (dashboard)/
│   │   ├── page.tsx          # Today dashboard
│   │   ├── assignments/      # Assignment checklist
│   │   ├── courses/          # Course + grade management
│   │   ├── focus/            # Pomodoro + streaks + reflection
│   │   ├── analytics/        # Charts
│   │   └── settings/         # Canvas + profile settings
│   └── api/
│       ├── canvas/sync/      # POST — syncs Canvas to DB
│       ├── assignments/      # GET list, POST create
│       ├── assignments/[id]/ # PATCH (toggle), DELETE
│       ├── tasks/            # GET list, POST create
│       ├── tasks/[id]/       # PATCH, DELETE
│       ├── courses/          # GET list
│       ├── analytics/        # GET stats
│       └── reflection/       # GET/POST daily reflection
├── components/
│   ├── ui/                   # Button, Badge, Progress, Spinner
│   ├── dashboard/            # PomodoroTimer, DailyScore
│   ├── assignments/          # AssignmentCard, AssignmentList
│   ├── canvas/               # SyncButton
│   ├── CommandPalette.tsx    # ⌘K command palette
│   └── Sidebar.tsx           # Navigation sidebar
├── lib/
│   ├── supabase/             # client.ts, server.ts
│   ├── canvas/client.ts      # Canvas API client
│   ├── utils.ts              # Date utils, grade calc, etc.
│   └── hooks/                # usePomodoro, useCommandPalette, useStreak
├── types/index.ts            # All TypeScript types
├── supabase/schema.sql       # Full DB schema
└── middleware.ts             # Auth guard
```

---

## Canvas API — How It Works

The sync flow (`/api/canvas/sync`):

1. Reads your Canvas URL + token from your profile in Supabase
2. Calls `GET /api/v1/courses` on Canvas — fetches active enrollments
3. For each course, calls `GET /api/v1/courses/:id/assignments`
4. **Upsert logic:**
   - New Canvas assignments → inserted with `is_synced_from_canvas = true`
   - Existing assignments → due date updated if changed
   - Your manual `is_completed` checkbox is **never overwritten** by a sync
5. Uses `canvas_assignment_id` as the unique key to prevent duplicates
6. Logs the sync with counts in `canvas_sync_logs`

---

## Extending the App

### Add Google Calendar sync
- Create `/api/google/sync/route.ts`
- Use the Google Calendar API to pull events into the time-block schedule
- Store events in a new `events` table

### Add push notifications
- Use Supabase Edge Functions + a notification service (e.g., web push)
- Trigger reminders when assignments are due in 24 hours

### Add AI study suggestions
- Use the Claude API (via Anthropic SDK) to analyze your completion patterns
- Suggest optimal study schedules based on your analytics data

### Add OAuth for Canvas
- Canvas supports OAuth 2.0
- Add `/api/canvas/oauth/route.ts` for the authorization flow
- Store access + refresh tokens encrypted in `profiles`

### Mobile app
- The app is fully responsive — open it on mobile and add to home screen (PWA)
- Add `manifest.json` and a service worker for offline support

---

## Production Deployment

### Deploy to Vercel (recommended)

```bash
npm install -g vercel
vercel --prod
```

Add environment variables in the Vercel dashboard (same as `.env.local`).

### Update Supabase Auth redirect URLs

In Supabase → Authentication → URL Configuration:
- **Site URL:** `https://your-domain.vercel.app`
- **Redirect URLs:** `https://your-domain.vercel.app/**`

---

## Security Notes

- Canvas tokens are stored as plain text in `profiles.canvas_api_token_encrypted`
- For production, encrypt tokens at rest using a KMS or Supabase Vault
- All API routes authenticate via Supabase JWT + Row Level Security
- Canvas API calls are server-side only — the token never reaches the browser
