# Zoom integration

Teachers (and admins, via `manage-meetings`) schedule a Zoom meeting for one
or more classrooms; every student in those classrooms sees it on their
`/my-meetings` page and can join with one click.

## How it works

- `app/Services/ZoomService.php` talks to the Zoom REST API using a regular
  **OAuth (user) app** — not Server-to-Server. Zoom restricts
  Server-to-Server apps to paid plans (Pro/Business/Enterprise); this
  project can't assume the school has one, so it uses the OAuth flow every
  Basic/free account can create instead.
- One admin authorizes the app **once**, from `/meetings` (the "Connect
  Zoom" banner, visible when `manage-meetings` is held and no account is
  connected). That's a real browser redirect to `zoom.us` and back — not
  an API call — because Zoom's consent screen has to run in the user's own
  browser. The resulting access/refresh token pair is stored in the
  `zoom_connections` table (`app/Models/ZoomConnection.php`, at most one
  row) and reused for **every** meeting after that, by every teacher —
  there's no per-teacher Zoom login.
- Access tokens expire in about an hour; `ZoomService::accessToken()`
  refreshes automatically using the stored `refresh_token`, and — since
  Zoom rotates the refresh token on every use — persists the new pair back
  each time. Nothing needs to re-run the consent screen unless the
  connection is explicitly disconnected or Zoom revokes it.
- `Meeting` (`app/Models/Meeting.php`) belongs to a creator and an academic
  year, and belongs-to-many `Classroom` via `meeting_classroom`. A student
  sees a meeting when it's linked to their `classroom_id` for their current
  `academic_year_id` (`StudentPortal\MeetingController::index()`).
- Authorization to *schedule* a meeting mirrors `AttendanceController`/
  `ExamController`: an admin (`manage-meetings`) can target any classroom;
  a teacher can only target classrooms they hold a subject slot in
  (`Teacher::classroomSubjects()`). Connecting/disconnecting the shared
  Zoom account is `manage-meetings`-only — a teacher can see whether one's
  connected (`GET /api/zoom/status`) but can't change it.

**Free-plan limit that doesn't go away with this setup:** Zoom's Basic
plan caps any meeting with 3+ participants at 40 minutes, regardless of
which app/auth type created it. If classes run longer, the connected
account needs a paid Zoom plan (this integration works the same either
way — no code change).

## Creating the Zoom OAuth app

1. Go to the [Zoom App Marketplace](https://marketplace.zoom.us/) and sign
   in with whichever account should host every meeting (this is the
   account that will click "Connect Zoom" in the app later).
2. **Develop → Build App → OAuth** → give it a name (e.g. "School System
   Meetings") → choose **User-managed app** → Create.
3. **App Credentials** tab:
   - Copy **Client ID** → `ZOOM_CLIENT_ID`
   - Copy **Client Secret** → `ZOOM_CLIENT_SECRET`
   - Set **Redirect URL for OAuth** to `{APP_URL}/api/zoom/callback` — for
     local dev that's `http://localhost:8000/api/zoom/callback`. This must
     point at the **Laravel backend**, not the frontend — Zoom redirects
     the browser here directly, and `ZoomController::callback()` is what
     forwards it on to the frontend's `/meetings` page afterward.
   - Add that same URL under **Whitelist URL** too.
4. **Scopes** tab, add:
   - `meeting:write:meeting` (create meetings)
   - `meeting:delete:meeting` (cancel meetings)
   - (older/classic-scope accounts may instead show `meeting:write` /
     `meeting:delete` — either works)
5. No review/activation needed for a user-managed app used by its own
   account — it's usable immediately.
6. Set `ZOOM_REDIRECT_URI` in `.env` to the exact same URL entered in step
   3 (Zoom rejects a mismatch).

## `.env`

```
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_REDIRECT_URI=http://localhost:8000/api/zoom/callback
```

## Connecting the account

1. Log in as an admin (holds `manage-meetings`) and go to `/meetings`.
2. Click **Connect Zoom** in the banner — this redirects to Zoom's consent
   screen.
3. Approve. Zoom redirects back to `/api/zoom/callback`, which exchanges
   the code, stores the token pair, and redirects to `/meetings?zoom=connected`.
4. The banner now shows who connected it, with a **Disconnect** option.

If the redirect ends in a Laravel error page instead of back at
`/meetings`, check `storage/logs/laravel.log` — the most common causes are
a `ZOOM_REDIRECT_URI` that doesn't exactly match the app's configured
redirect URL, or `FRONTEND_URLS` not matching the origin actually being
used (see `AppServiceProvider`/`config/cors.php`, which the callback reuses
to find the frontend to redirect back to).
