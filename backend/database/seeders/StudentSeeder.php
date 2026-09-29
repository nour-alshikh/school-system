<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\BloodType;
use App\Models\Father;
use App\Models\Governorate;
use App\Models\Grade;
use App\Models\Mother;
use App\Models\Nationality;
use App\Models\Religion;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class StudentSeeder extends Seeder
{
    /**
     * Bilingual first/last name pairs, reused cyclically — curated instead
     * of random Arabic/English faker output so the two translations of a
     * student's name actually match each other.
     */
    public const NAMES = [
        ['en' => 'Ali Hassan', 'ar' => 'علي حسن', 'gender' => 'male'],
        ['en' => 'Mona Abdel Rahman', 'ar' => 'منى عبد الرحمن', 'gender' => 'female'],
        ['en' => 'Youssef Ibrahim', 'ar' => 'يوسف إبراهيم', 'gender' => 'male'],
        ['en' => 'Salma Mahmoud', 'ar' => 'سلمى محمود', 'gender' => 'female'],
        ['en' => 'Omar Khaled', 'ar' => 'عمر خالد', 'gender' => 'male'],
        ['en' => 'Nour El-Din Tarek', 'ar' => 'نور الدين طارق', 'gender' => 'male'],
        ['en' => 'Habiba Sayed', 'ar' => 'حبيبة سيد', 'gender' => 'female'],
        ['en' => 'Karim Fathy', 'ar' => 'كريم فتحي', 'gender' => 'male'],
        ['en' => 'Farida Adel', 'ar' => 'فريدة عادل', 'gender' => 'female'],
        ['en' => 'Ziad Ahmed', 'ar' => 'زياد أحمد', 'gender' => 'male'],
        ['en' => 'Malak Sherif', 'ar' => 'ملك شريف', 'gender' => 'female'],
        ['en' => 'Hassan Nabil', 'ar' => 'حسن نبيل', 'gender' => 'male'],
        ['en' => 'Jana Samir', 'ar' => 'جنى سمير', 'gender' => 'female'],
        ['en' => 'Mostafa Ashraf', 'ar' => 'مصطفى أشرف', 'gender' => 'male'],
        ['en' => 'Rana Gamal', 'ar' => 'رنا جمال', 'gender' => 'female'],
        ['en' => 'Adam Hany', 'ar' => 'آدم هاني', 'gender' => 'male'],
        ['en' => 'Lina Farouk', 'ar' => 'لينا فاروق', 'gender' => 'female'],
        ['en' => 'Seif Magdy', 'ar' => 'سيف مجدي', 'gender' => 'male'],
        ['en' => 'Yasmin Ezzat', 'ar' => 'ياسمين عزت', 'gender' => 'female'],
        ['en' => 'Tarek Anwar', 'ar' => 'طارق أنور', 'gender' => 'male'],
        ['en' => 'Dalia Wael', 'ar' => 'داليا وائل', 'gender' => 'female'],
        ['en' => 'Amir Reda', 'ar' => 'أمير رضا', 'gender' => 'male'],
        ['en' => 'Nada Sameh', 'ar' => 'ندى سامح', 'gender' => 'female'],
        ['en' => 'Bilal Emad', 'ar' => 'بلال عماد', 'gender' => 'male'],
    ];

    private const STUDENTS_PER_CLASSROOM = 2;

    private ?string $password = null;

    public function run(): void
    {
        $academicYear = AcademicYear::where('is_current', true)->first();
        $egypt = Nationality::first();
        $governorateIds = Governorate::pluck('id')->all();
        $bloodTypeIds = BloodType::pluck('id')->all();
        $religionIds = Religion::pluck('id')->all();

        if (! $academicYear || ! $egypt || empty($governorateIds) || empty($bloodTypeIds) || empty($religionIds)) {
            $this->command?->warn('StudentSeeder: missing lookup data, skipping.');

            return;
        }

        $faker = fake();
        $nameIndex = 0;

        // Only the "A" section of every grade gets demo students, to keep
        // the seeded roster small enough to skim through in a demo instead
        // of filling every single classroom.
        Grade::with('classrooms')->get()->each(function (Grade $grade) use (
            $academicYear, $egypt, $governorateIds, $bloodTypeIds, $religionIds, $faker, &$nameIndex
        ) {
            $classroomName = $grade->getTranslation('name', 'en').' - A';
            $classroom = $grade->classrooms->firstWhere('name', $classroomName);

            if (! $classroom || $classroom->students()->exists()) {
                return;
            }

            for ($i = 0; $i < self::STUDENTS_PER_CLASSROOM; $i++) {
                $person = self::NAMES[$nameIndex % count(self::NAMES)];
                $nameIndex++;

                $slug = strtolower(str_replace(' ', '.', $person['en'])).$nameIndex;

                $studentUser = User::create([
                    'name' => $person['en'],
                    'email' => "{$slug}.student@demo.school",
                    'password' => $this->password(),
                ]);
                $studentUser->assignRole('student');

                $parentUser = User::create([
                    'name' => 'Parent of '.$person['en'],
                    'email' => "{$slug}.parent@demo.school",
                    'password' => $this->password(),
                ]);
                $parentUser->assignRole('parent');

                $student = Student::create([
                    'user_id' => $studentUser->id,
                    'parent_user_id' => $parentUser->id,
                    'name' => ['en' => $person['en'], 'ar' => $person['ar']],
                    'gender' => $person['gender'],
                    'nationality_id' => $egypt->id,
                    'governorate_id' => $faker->randomElement($governorateIds),
                    'blood_type_id' => $faker->randomElement($bloodTypeIds),
                    'stage_id' => $grade->stage_id,
                    'grade_id' => $grade->id,
                    'classroom_id' => $classroom->id,
                    'academic_year_id' => $academicYear->id,
                ]);

                $guardianDefaults = [
                    'job' => $faker->jobTitle(),
                    'national_id' => $faker->numerify('#############'),
                    'phone' => $faker->numerify('01#########'),
                    'nationality_id' => $egypt->id,
                    'governorate_id' => $faker->randomElement($governorateIds),
                    'blood_type_id' => $faker->randomElement($bloodTypeIds),
                    'religion_id' => $faker->randomElement($religionIds),
                    'address' => $faker->address(),
                ];

                Father::create([
                    ...$guardianDefaults,
                    'student_id' => $student->id,
                    'name' => 'Father of '.$person['en'],
                ]);

                Mother::create([
                    ...$guardianDefaults,
                    'student_id' => $student->id,
                    'name' => 'Mother of '.$person['en'],
                    'governorate_id' => $faker->randomElement($governorateIds),
                    'blood_type_id' => $faker->randomElement($bloodTypeIds),
                    'religion_id' => $faker->randomElement($religionIds),
                ]);
            }
        });
    }

    /** Hashed once: bcrypt is deliberately slow, and every demo account shares it. */
    private function password(): string
    {
        return $this->password ??= Hash::make('password');
    }
}
