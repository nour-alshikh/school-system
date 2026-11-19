# Demo sandboxes

A public demo deployment where every visitor gets **their own copy of the demo
data**. They can edit or delete anything; nobody else sees it, and it's thrown away
after a few hours (or when they click **Reset demo data** in the user menu).

## How it works

```
Browser ──► Next.js BFF ──X-Demo-Sandbox: <id>──► Laravel ──► storage/app/demo/sandboxes/<id>.sqlite
           (demo_sandbox cookie,                  (UseDemoSandbox)   storage/app/public/demo/<id>/
            httpOnly, random id)                                     storage/app/private/demo/<id>/
```

1. The first page view gets a random 32-hex id in an httpOnly `demo_sandbox` cookie
   (`frontend/src/proxy.ts`, `src/lib/demo-sandbox.ts`). It's set there, not only in
   the BFF, so a page's API calls, which start together, all carry the same id.
2. The BFF sends it on every call as `X-Demo-Sandbox`.
3. `App\Http\Middleware\UseDemoSandbox` (global, right after `TrustBffClientIp`)
   points the default SQLite connection and the `public`/`local` disks at that
   visitor's copy. A new id is copied from the template first (`App\Demo\Sandboxes`):
   a 1–2 MB file copy plus about 200 KB of uploaded files. No valid id: `400`, so
   nothing ever runs against the template.
4. Everything inside a copy is the visitor's: users and their sign-in tokens,
   sessions, the database cache, uploads, AI usage. A token from one copy is a
   `401` in another.

What stays shared across copies, on purpose:

| What | Where | Why |
| --- | --- | --- |
| Rate limits (login, signup, AI…) | file cache (`cache.limiter = file`) | A new copy mustn't reset a visitor's throttle. |
| Total AI calls per day | file cache, `DEMO_AI_DAILY_CAP` (default 150) | Each copy counts its own `ai_usage` from zero, and AI calls cost money. |

Demo mode also forces `queue.default = sync` (a worker couldn't tell which copy a job
belongs to) and `mail.default = log` (invitations and resets never leave the server),
and turns off system admin two-factor unless `PLATFORM_TWO_FACTOR` says otherwise.

## Cleanup

- `php artisan demo:prune` deletes copies idle for `DEMO_IDLE_MINUTES` (default 180).
  Scheduled every 15 minutes when demo mode is on.
- Without a cron, it still happens: creating a new copy prunes at most every 10
  minutes, and at once when `DEMO_MAX_SANDBOXES` (default 200) is reached (the
  longest-idle copies go first).
- `POST /api/demo/reset` (the **Reset demo data** menu item) deletes the visitor's
  copy and the BFF clears their sign-in cookies. The next request starts a fresh one.

## Deploying

Backend `.env`:

```
DEMO_MODE=true
DB_CONNECTION=sqlite          # the copies are SQLite files, whatever you use elsewhere
APP_URL=https://your-api-domain   # uploaded files are linked from it
PLATFORM_TWO_FACTOR=false     # or delete the line: demo mode then defaults it to off
# optional
DEMO_IDLE_MINUTES=180
DEMO_MAX_SANDBOXES=200
DEMO_AI_DAILY_CAP=150
```

Frontend (Vercel) environment:

```
DEMO_SANDBOXES=true           # server only, must match DEMO_MODE
NEXT_PUBLIC_DEMO_LOGINS=true  # the "Use the demo account" buttons and the reset item
```

Then, on the server:

```bash
php artisan config:clear      # or config:cache, after .env changes
php artisan storage:link      # if public/storage isn't linked yet
php artisan demo:build        # builds storage/app/demo/template.sqlite (+ files)
```

`demo:build` migrates and seeds a new template next to the old one and swaps it in at
the end, so visitors keep working while it runs. `demo:build --fresh` also deletes
every visitor's copy, so all of them start from the new data. Run it again after
deploying new migrations or seeder changes.

Cron (cPanel → Cron Jobs), every minute:

```
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

Optional: the pruning on new copies covers it if cron isn't available.

### Shared hosting checklist

- **PHP has `pdo_sqlite`**: `php -m | grep -i sqlite` (or cPanel → Select PHP
  Version → Extensions). Required.
- **`storage/` is writable** by PHP (it already is if uploads work).
- **Disk space**: about 2 MB per active visitor; 200 copies ≈ 400 MB.
- **Concurrency**: one SQLite file per visitor, so visitors never wait on each
  other's writes.

## Code

- `backend/config/demo.php`: the settings above.
- `backend/app/Demo/Sandboxes.php`: create, activate, delete, prune.
- `backend/app/Http/Middleware/UseDemoSandbox.php`, `app/Http/Controllers/DemoController.php`.
- `backend/app/Console/Commands/DemoBuild.php`, `DemoPrune.php`.
- `frontend/src/lib/demo-sandbox.ts`, `src/proxy.ts`, `src/app/api/[...path]/route.ts`.
- Tests: `backend/tests/Feature/DemoSandboxTest.php`.
