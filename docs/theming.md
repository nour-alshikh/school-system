# Theming (light/dark)

`next-themes` was already a dependency and `src/components/ui/sonner.tsx`
already called `useTheme()` — both left over from shadcn's init, with no
`ThemeProvider` actually mounted anywhere, so `useTheme()` silently fell
back to its default and dark mode only ever applied via the OS-level
`prefers-color-scheme` media query, with no way for a user to override it.

## Setup

- `src/app/[locale]/layout.tsx` wraps the app in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>` (imported directly from
  `next-themes` — it's already a client component, no extra wrapper file
  needed). `<html>` carries `suppressHydrationWarning`: next-themes sets the
  `dark` class via a blocking inline script before hydration, so the
  server-rendered class attribute is expected to mismatch client's.
- `src/app/globals.css` — `:root` (light) and `.dark` (dark) each define the
  full token set (`--background`, `--foreground`, etc.), matched via
  `@custom-variant dark (&:is(.dark *))`. The old `@media
  (prefers-color-scheme: dark)` fallback block was removed — it existed only
  because no toggle existed yet to ever add the `.dark` class; now
  `defaultTheme="system"` covers the same "follow the OS" default, and an
  explicit choice can override it.
- `src/components/theme-toggle.tsx` — a light/dark icon-button toggle
  (`useTheme()`'s `resolvedTheme`/`setTheme`), rendered in `SiteHeader` next
  to the locale switcher (visible to guests too — it's a display
  preference, not an authenticated feature). Guards against a hydration
  mismatch with `useSyncExternalStore` (server snapshot `false`, client
  snapshot `true`) rather than the usual `useEffect(() => setMounted(true))`
  — the latter trips this project's `react-hooks/set-state-in-effect` lint
  rule.

## Adding a new themed color/component

Reference existing tokens (`bg-background`, `text-foreground`,
`text-muted-foreground`, etc.) rather than hardcoding a color — they already
flip between `:root` and `.dark`. A component that needs a color with no
existing token yet should add one to both blocks in `globals.css`, not
inline a raw color that only looks right in one theme.
