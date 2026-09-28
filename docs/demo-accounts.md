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
| `admin` | `test@example.com` | `password` | Full access: users, academic structure (stages/grades/classrooms/subjects), teachers, students. See [authorization.md](./authorization.md). |
| none (plain) | `user@example.com` | `password` | Signed in, no school and no roles — demonstrates the 403-from-the-API case in [authorization.md](./authorization.md#enforcement-boundary). |
| `parent` | `ali.hassan1.parent@demo.school` | `password` | Parent self-service portal: own account info + their one student's guardian info. |
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

- **Teachers** are listed in `TeacherSeeder`, e.g. `mona.ali@teachers.demo`
  teaches Arabic. Each also gets a `teacher` login (`password`).
- **Academic years**: 2024 and 2025 (current), `AcademicYearSeeder`.
- **Subjects**: 10 subjects spread across the 3 stages, `SubjectSeeder`.
- Every classroom already has a teacher assigned per subject
  (`ClassroomSubjectTeacherSeeder`) — open any classroom's edit form to see
  the subject cards pre-filled.
