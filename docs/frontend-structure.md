# Frontend file structure

## Feature folders

`Post` and `AdminUsers` (the two modules that existed before this project's
real features started) scatter each module's pieces across three top-level
folders: `src/components/<model>-form.tsx`, one more entry in the shared
`src/lib/schemas.ts`, and `src/types/<model>.ts`. That's fine for two
modules. It stops being fine once `Stage`/`Grade`/`Classroom`/etc pile in —
`lib/schemas.ts` turns into an unreadable grab-bag and `components/` mixes
unrelated forms together with no grouping.

Every module from `Stage` onward lives in its own folder instead:

```
src/features/<model>/
  types.ts        # re-export from @/types/generated
  schema.ts        # zod schema mirroring the backend FormRequest
  <model>-form.tsx
  <model>s-page.tsx  # the actual page component ("use client" + hooks)
```

`src/app/[locale]/<model>s/page.tsx` stays a one-line re-export:

```ts
export { StagesPage as default } from "@/features/stages/stages-page";
```

Route folders under `app/` never grow beyond `page.tsx` (plus `layout.tsx`
where needed) — all real logic lives in `features/`, so a module's files are
never split across the route tree and the top-level `components/`/`lib`/
`types` folders. Genuinely cross-module things (`components/ui/*`, `lib/api.ts`,
`lib/form-errors.ts`, shared `types/generated.ts`) stay where they are — only
per-module pieces move into `features/`.

See [reference-module.md](./reference-module.md) for the full "copying it
for a new module" checklist that uses this layout.
