# Layout

Before this, every page was its own island — `<main>` and nothing else,
including its own copy of the logout button and the "Manage users" link
(duplicated in `dashboard/page.tsx`, only present there, nowhere else).

## `SiteHeader`

`src/components/site-header.tsx` — a client component rendered once, in the
root layout above `{children}`, so it's present on every page without each
page needing to render it itself.

- **Guest** (`user === null`, not loading): "Log in" / "Register" links.
- **Loading** (`isLoading === true`): renders nothing. The alternative —
  a skeleton — wasn't worth it for how briefly this state is visible in
  practice; revisit if that stops being true.
- **Authenticated**: an icon-only avatar-or-initial button (`aria-label`/
  `title` carry the user's name, since there's no visible text) that opens a
  small dropdown menu containing just `Log out`. Everything else that used
  to live here (`Dashboard`, `Manage users`) moved to `SiteSidebar` — see
  below.
- The theme toggle and locale switcher are icon-only too (`ThemeToggle`,
  `LocaleSwitcher` — both `size="icon"` `Button`s with `aria-label`/`title`,
  no visible text), for a consistent icon-only topbar.

## `SiteSidebar`

`src/components/site-sidebar.tsx` — a client component rendered once, in the
root layout next to `{children}` (not inside it), so every page gets the same
nav without rendering it itself. Same guest/loading gate as `SiteHeader`:
renders nothing until `useAuth()` resolves to a logged-in user. Hidden below
the `md` breakpoint (`hidden md:flex`) — no mobile drawer built for it yet.

Links, each a plain `<Link>` highlighted via `usePathname()` when active:
- `Dashboard`
- `Stages`
- `Manage users` — only rendered when `can("manage-users")`, same check
  used everywhere else permission-gated UI exists (see
  [authorization.md](./authorization.md))

`src/app/[locale]/layout.tsx`:

```tsx
<AuthProvider>
  <SiteHeader />
  <div className="flex flex-1">
    <SiteSidebar />
    <div className="flex flex-1 flex-col">{children}</div>
  </div>
</AuthProvider>
```

Both have to be inside `AuthProvider`, not outside it — `useAuth()` needs the
provider above it in the tree. `SiteSidebar` sits next to `{children}`, not
wrapping it, so it renders once per layout instead of once per page and
individual pages don't need to know it exists.

## What moved out of `dashboard/page.tsx`

The dashboard page no longer renders its own logout button or "Manage users"
link — logout lives only in `SiteHeader`, nav links only in `SiteSidebar`,
once each, instead of duplicated on every page that happened to need them.
`dashboard/page.tsx` is back to just page content: the avatar uploader and a
welcome message.

## Why the header's authenticated state doesn't appear in the initial HTML

Curling any page shows the "Your App" brand text but not the guest links or
user menu until JavaScript runs. That's not a bug introduced here — it's the
same client-driven auth architecture documented in
[authentication.md](./authentication.md): `useAuth()`'s `user` comes from a
`useQuery` that only fetches after the browser mounts, so `isLoading` is
`true` for the entire server-rendered HTML and `SiteHeader` correctly renders
nothing for that state until hydration resolves it.

## Adding a new authenticated-only nav item

Add a `SidebarLink` inside `SiteSidebar`, gated by `can()`/`hasRole()` the
same way `Manage users` is if it's permission-specific, or unconditionally
(like `Dashboard`/`Stages`) if every logged-in user should see it.
`SiteHeader`'s dropdown is only for account-level actions (`Log out`) now,
not feature nav.
