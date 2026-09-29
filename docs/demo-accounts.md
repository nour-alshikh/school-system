# Demo accounts

Login credentials for one account per role, for demoing/testing the app after
seeding. All passwords are `password` (the `UserFactory` default — see
[authentication.md](./authentication.md#running-locally)).

Get this data with:

```bash
cd backend
php artisan migrate:fresh --seed
```

## Accounts

| Role | Email | Password | What it can do |
| --- | --- | --- | --- |
| `admin` at both schools + platform admin | `test@example.com` | `password` | Full access: users, academic structure (stages/grades/classrooms/subjects), teachers, students. See [authorization.md](./authorization.md). Admin of **School System** and **Hilltop School**: picks the school at login, switches from the user menu. Also a platform admin: Platform → Schools lists both (see [multi-tenancy.md](./multi-tenancy.md)). |
| `admin` at Hilltop only | `admin@hilltop.demo` | `password` | A second school's admin sees only Hilltop (USD, Monday–Friday week, purple branding). |
| `teacher` at both schools | `shared.teacher@demo.school` | `password` | Same role at two schools: the school picker at login, and the user-menu switcher. Teaches English in one classroom at each. |
| `parent` at both schools | `family.parent@demo.school` | `password` | One child at each school: the parent overview shows two cards, each child's fees in their own school's currency (EGP / USD). |
| none (plain) | `user@example.com` | `password` | Signed in, no school and no roles. The API answers 403 for school data ([authorization.md](./authorization.md#enforcement-boundary)); the dashboard sends it to **Create your school**. |
| `parent` | `ali.hassan1.parent@demo.school` | `password` | Parent self-service portal: own account info, and each child's guardian info, attendance, fees and library. A parent with several children (at one school or several) sees them all on the dashboard, with a child picker on each page. |
| `student` | `ali.hassan1.student@demo.school` | `password` | Signed in, no dedicated portal yet — role exists for the student's own account created at registration. |
| `teacher` | `mona.ali@teachers.demo` | `password` | Teacher self-service dashboard for their own classes/subjects. |

The parent/student pair above belongs to the same seeded student (**Ali
Hassan**, Grade 1 — A). `StudentSeeder` creates one such pair per grade's "A"
classroom (`{name}.parent@demo.school` / `{name}.student@demo.school`,
`password`) if you want a different grade/stage — list them all with:

```bash
php artisan tinker --execute="
App\Models\Student::with('user','parentUser','grade')->get()->each(fn(\$s) =>
  print(\$s->getTranslation('name','en').' ('.\$s->grade->getTranslation('name','en').'): '
    .\$s->user->email.' / '.\$s->parentUser->email.PHP_EOL)
);
"
```

## Other seeded data worth knowing about for a demo

- **Activity** (`database/seeders/Demo`, see [demo-seeder-plan.md](./demo-seeder-plan.md)),
  seeded when `APP_ENV` is `local`/`testing` or `SEED_DEMO=true`: fees with
  every payment status, 20 school days of attendance, three exams per school (a
  closed quiz with scores, one open now, a draft), calendar events, three meetings
  with a placeholder link (no Zoom), posts, a library with links and PDFs, student
  photos, and one promotion batch plus one graduate (the "B" classrooms of grades
  5, 6 and 12).
- **School settings**: School System uses EGP and a Sunday–Thursday week; Hilltop
  uses USD and Monday–Friday.

- **Teachers** are listed in `TeacherSeeder`, e.g. `mona.ali@teachers.demo`
  teaches Arabic. Each also gets a `teacher` login (`password`).
- **Academic years**: 2024 and 2025 (current), `AcademicYearSeeder`.
- **Subjects**: 10 subjects spread across the 3 stages, `SubjectSeeder`.
- Every classroom already has a teacher assigned per subject
  (`ClassroomSubjectTeacherSeeder`) — open any classroom's edit form to see
  the subject cards pre-filled.
