# EARTH ONLINE — Session Handoff

## Project Overview
**EARTH ONLINE** is a retro pixel-art "real-life quest" website. Users receive random real-world missions displayed inside a CRT monitor UI, and can mark them DONE or SKIP. Features include user auth, bilingual UI (EN/CN), public + custom task tracks, and an admin panel.

- **Live URL**: https://earth-online-gamma.vercel.app
- **Stack**: Next.js 16 (App Router) + Tailwind CSS 4 + Supabase + Vercel
- **Path**: `/Users/liuzhiyu/Desktop/Claude/earth-online`

---

## Environment & Credentials

### `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://iwndbljpyfbluttcnqvq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bmRibGpweWZibHV0dGNucXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njc3NzcsImV4cCI6MjA5MTE0Mzc3N30.i140cOYuAkq_EpntTvLrGHY4I_wb31an1H_jXMcJgSc
ADMIN_EMAIL=2799786996@qq.com
```

### Network (China)
All npm/Vercel/Supabase commands require proxy:
```bash
export PATH="/usr/local/bin:$PATH"
export https_proxy=http://127.0.0.1:1082
export http_proxy=http://127.0.0.1:1082
```

### Commands
```bash
npm run dev          # Dev server on :3000
npm run build        # Production build
npx vercel --yes --prod   # Deploy to Vercel (needs proxy)
```

---

## File Structure (key files only)

```
src/
  app/
    page.tsx              # Just renders <Game />
    layout.tsx            # HTML head (Google Fonts: Space Grotesk + Material Symbols)
    globals.css           # ALL custom CSS (294 lines) — monitor, buttons, animations, mobile responsive
    admin/page.tsx        # Admin panel — task CRUD, bulk import, pending review, stats
    auth/callback/route.ts # Handles email verification + OAuth redirects → /?verified=1
  components/
    Game.tsx              # THE MAIN FILE (993 lines) — all game logic + screen rendering
    Monitor.tsx           # CRT monitor shell (div.computer-wrap > div.mon > div.scn)
    Clouds.tsx            # Animated cloud elements
    Tags.tsx              # Bottom nav tags (CUSTOMIZE / PROGRESS / OFFER A MISSION)
  lib/
    supabase.ts           # Supabase client singleton
    translations.ts       # TX object — all EN/CN UI strings, NO translation API
    critters.ts           # 6 pixel animal SVGs (cat, dog, rabbit, bird, frog, fish)
    store.ts              # TypeScript types: PublicTask, CustomTask, GameState
supabase-schema.sql       # Full DB schema + RLS policies
scripts/
  run-seed.mjs            # Seeds 295 tasks (uses service_role key + proxy)
  fix-quotes.mjs          # Fixed ASCII quotes → smart quotes in DB
```

---

## Game.tsx Architecture (993 lines, single client component)

### State
| State | Purpose |
|-------|---------|
| `lang` | 'en' or 'cn', persisted to localStorage |
| `screen` | Current view: home/boot/task/next/celebrate/customize/progress/statlist/offer/signin |
| `customMode` | Toggle between public and custom task tracks, persisted to localStorage |
| `user` | `{id, email, username}` or null |
| `publicTasks` | Array of `{id, content_en, content_cn, category}` from DB |
| `customTasks` | Array of `{id, content}` — user-created |
| `completedPublic/Custom` | Arrays of completed task IDs |
| `skippedPublic/Custom` | Arrays of skipped task IDs |
| `currentTaskId` | Currently displayed task |
| `tasksLoaded` | Boolean — gates ENTER button to prevent celebration-on-refresh bug |
| `hasPlayed` | Whether user has entered a game session |
| `savingCust` / `actionBusy` | Debounce flags |

### Key Functions
- **`startBoot()`** — Boot terminal animation → picks random task → shows task screen. Guarded by `tasksLoaded`.
- **`doDone()` / `doSkip()`** — Optimistic UI updates (instant), DB sync in background (fire-and-forget).
- **`showCelebration()`** — Fireworks canvas animation with `fwRunId` pattern to prevent animation speedup on re-trigger.
- **`custSave()`** — Optimistic add with temp ID, replaced by real DB ID in background.
- **`doAuth()`** — Handles both sign in and register. Register sends verification email via Supabase.
- **`syncFromDB()`** — On login, loads completions/skips/custom tasks from DB, merges with local state.

### Screens Rendered (conditionally by `screen` state)
1. **home** — Title "EARTH ONLINE" + ENTER button + rodent icon + Tags
2. **boot** — Terminal animation inside Monitor
3. **task** — Task text + SKIP/DONE buttons inside Monitor
4. **next** — Random pixel animal + "NEXT MISSION" + random subtitle
5. **celebrate** — Fireworks canvas + congratulations + HOME/PLAY AGAIN/PROGRESS
6. **customize** — Custom task list + input + CUSTOM ON/OFF toggle
7. **progress** — Progress bar + percentage + DONE/REMAINING/SKIPPED stats
8. **statlist** — Scrollable list of tasks by category (done/remaining/skipped)
9. **offer** — Email-style form to suggest missions → pending_tasks table
10. **signin** — Sign In / Register tabs + Forgot Password flow

---

## CSS Architecture (globals.css, 294 lines)

### Desktop (default)
- `.mon` — 580x440px, beveled gray frame with inset shadows
- `.scn` — Dark screen with scanline overlay (::after), flex center
- `.stand` — 300x48px connector piece
- `.base` — 620x72px bottom with decorative elements
- `.bo` / `.bs` — Outlined / filled buttons with pixel-shadow hover effects
- `.pxb` — Pixel box-shadow (used on ENTER button)
- `.screen` — `position: fixed; inset: 0; flex center` — full viewport overlay
- Background: `body::before` fixed pseudo-element (for iOS Safari compatibility)
- CRT scanlines: `.crt1` + `.crt2` overlays at z-index 200-201

### Mobile (CSS zoom approach)
Uses `zoom` on `.computer-wrap` to proportionally scale the entire monitor — no layout breakage, no content clipping:
```css
@media (max-width: 680px) { .computer-wrap { zoom: 0.78; } }
@media (max-width: 520px) { .computer-wrap { zoom: 0.62; } }
@media (max-width: 400px) { .computer-wrap { zoom: 0.52; } }
```
`.screen` gets `overflow-y: auto; justify-content: flex-start; padding-top: 100px` on mobile.
Home title gets responsive font-size via `.home-title` class.
Header elements (`.hdr`, `.hdr-logo`, `.hdr-lang`, `.hdr-user`) scale down.

---

## Database Schema (Supabase PostgreSQL + RLS)

### Tables
| Table | Purpose |
|-------|---------|
| `public_tasks` | Admin-maintained missions (id, content_en, content_cn, category) — 295 seeded |
| `custom_tasks` | User-created private tasks (user_id, content) |
| `public_completions` | Tracks completed public tasks (user_id + task_id, unique) |
| `custom_completions` | Tracks completed custom tasks |
| `public_skips` | Tracks skipped public tasks |
| `custom_skips` | Tracks skipped custom tasks |
| `pending_tasks` | User-submitted suggestions (content, description, submitted_language, status) |

### RLS Policies
- `public_tasks`: Anyone reads. Only admin (`2799786996@qq.com`) writes.
- `custom_tasks` / completions / skips: Users CRUD only their own rows.
- `pending_tasks`: Anyone inserts. Only admin reads/updates.

---

## Auth Flow
1. **Register**: Supabase signUp with `emailRedirectTo` → `/auth/callback`
2. **Email verification**: User clicks link → `/auth/callback` exchanges token → redirects to `/?verified=1`
3. **Login**: `signInWithPassword` → sets user state → loads data from DB
4. **Logout**: Clears auth + resets all local state
5. **Forgot password**: `resetPasswordForEmail` with redirect to `/auth/callback`
6. **Unregistered users**: Can play with temp IDs stored in local state. When they register, temp data syncs to DB.

---

## What's Working
- All game screens (home, boot, task, next, celebrate, customize, progress, statlist, offer, signin)
- Full auth flow (register, login, logout, email verification, forgot password)
- 295 public tasks seeded in DB (categories: wellness, mindful, social, creative, learning)
- Bilingual UI (EN/CN toggle, persisted)
- Custom tasks with CUSTOM ON/OFF toggle (persisted)
- Two independent progress tracks (public vs custom)
- Optimistic UI updates for DONE/SKIP/Save (instant feel)
- Admin panel at `/admin` (task CRUD, bulk import, pending review, stats)
- Desktop layout: pixel-perfect CRT monitor
- Mobile layout: all screens fit and are usable via CSS zoom scaling
- Loading gate on ENTER button prevents celebration-on-refresh bug
- Deployed to Vercel: https://earth-online-gamma.vercel.app

---

## Known Issues / Remaining Work

### Must Fix
1. **Supabase Site URL** — Need to set Site URL to `https://earth-online-gamma.vercel.app` in Supabase Dashboard → Authentication → URL Configuration. Without this, email verification links may not work correctly in production.

### Nice to Have
2. **VPN required from China** — Vercel + Supabase are blocked without proxy. Options: custom domain on Vercel, or alternative hosting (Cloudflare Pages, etc.)
3. **custSave debouncing** — `savingCust` flag exists and is wired up, but rapid keyboard Enter could still queue multiple saves. Consider disabling input briefly.
4. **Celebration edge case** — If a user completes the very last task, then refreshes mid-celebration, they'll see the celebration again (correct behavior, but no way to dismiss without clicking HOME/PLAY AGAIN).
5. **Mobile keyboard** — On customize screen, mobile keyboard may push content up. Could add viewport meta adjustments.
6. **Custom domain** — User asked about getting `earthonline.com` — requires purchasing domain and adding to Vercel.

---

## User Preferences & Notes
- User communicates in Chinese, UI explanations should be in Chinese
- User's Supabase account is via GitHub login, admin email is `2799786996@qq.com`
- User's proxy is Shadowrocket at `http://127.0.0.1:1082`
- Supabase free tier limits email sending to ~4/hour
- User manually verified their own account via SQL (bypassed email verification)
- Service role key was used for seed scripts — stored in `scripts/run-seed.mjs`
