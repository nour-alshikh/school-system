<?php

namespace Database\Seeders;

use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TeacherSeeder extends Seeder
{
    private ?string $password = null;

    public function run(): void
    {
        // One dedicated teacher per subject, plus a couple that cover more
        // than one — enough spread for the classroom subject/teacher picker
        // (ClassroomSubjectTeachers) to have a real choice on some subjects.
        $teachers = [
            ['name' => 'Mona Ali', 'email' => 'mona.ali@teachers.demo', 'subjects' => ['Arabic']],
            ['name' => 'Ahmed Youssef', 'email' => 'ahmed.youssef@teachers.demo', 'subjects' => ['English']],
            ['name' => 'Sara Ibrahim', 'email' => 'sara.ibrahim@teachers.demo', 'subjects' => ['Mathematics']],
            ['name' => 'Khaled Mostafa', 'email' => 'khaled.mostafa@teachers.demo', 'subjects' => ['Science']],
            ['name' => 'Heba Adel', 'email' => 'heba.adel@teachers.demo', 'subjects' => ['Social Studies']],
            ['name' => 'Nour Hassan', 'email' => 'nour.hassan@teachers.demo', 'subjects' => ['French']],
            ['name' => 'Omar Fathy', 'email' => 'omar.fathy@teachers.demo', 'subjects' => ['Physics']],
            ['name' => 'Laila Samir', 'email' => 'laila.samir@teachers.demo', 'subjects' => ['Chemistry']],
            ['name' => 'Youssef Tarek', 'email' => 'youssef.tarek@teachers.demo', 'subjects' => ['Biology'], 'status' => 'on_leave'],
            ['name' => 'Mariam Nabil', 'email' => 'mariam.nabil@teachers.demo', 'subjects' => ['History']],
            ['name' => 'Amr Salah', 'email' => 'amr.salah@teachers.demo', 'subjects' => ['Mathematics', 'Physics']],
            ['name' => 'Dina Farouk', 'email' => 'dina.farouk@teachers.demo', 'subjects' => ['Arabic', 'Social Studies'], 'status' => 'inactive'],
        ];

        $subjectsByEnName = Subject::all()->keyBy(fn (Subject $subject) => $subject->getTranslation('name', 'en'));
        $faker = fake();

        foreach ($teachers as $row) {
            $teacher = Teacher::firstOrCreate(
                ['email' => $row['email']],
                [
                    'name' => $row['name'],
                    'phone' => $faker->numerify('01#########'),
                    'joining_date' => $faker->dateTimeBetween('-6 years', '-3 months')->format('Y-m-d'),
                    'status' => $row['status'] ?? 'active',
                ]
            );

            if (! $teacher->user_id) {
                $user = User::create([
                    'name' => $teacher->name,
                    'email' => $teacher->email,
                    'password' => $this->password(),
                ]);
                $user->assignRole('teacher');

                $teacher->update(['user_id' => $user->id]);
            }

            $subjectIds = collect($row['subjects'])
                ->map(fn (string $subjectName) => $subjectsByEnName->get($subjectName)?->id)
                ->filter()
                ->all();

            $teacher->subjects()->sync($subjectIds);
        }
    }

    /** Hashed once: bcrypt is deliberately slow, and every demo account shares it. */
    private function password(): string
    {
        return $this->password ??= Hash::make('password');
    }
}
