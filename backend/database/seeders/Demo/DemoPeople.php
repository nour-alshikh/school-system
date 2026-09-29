<?php

namespace Database\Seeders\Demo;

use App\Enums\MembershipRole;
use App\Models\AcademicYear;
use App\Models\BloodType;
use App\Models\Classroom;
use App\Models\Father;
use App\Models\Governorate;
use App\Models\Mother;
use App\Models\Nationality;
use App\Models\Religion;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Services\MembershipService;
use Database\Seeders\StudentSeeder;
use Illuminate\Support\Facades\Hash;

/**
 * Creates demo people at the current school the way the app does:
 * accounts get their per-school role and membership together through
 * MembershipService::grant(). Every password is "password".
 */
class DemoPeople
{
    private int $nameIndex = 0;

    private ?array $lookups = null;

    /** Hashed once: bcrypt is deliberately slow. */
    private ?string $password = null;

    public function __construct(private readonly MembershipService $memberships) {}

    /** An account, or the existing one with that email (users are global). */
    public function user(string $name, string $email): User
    {
        return User::firstOrCreate(['email' => $email], ['name' => $name, 'password' => $this->password ??= Hash::make('password')]);
    }

    public function grant(User $user, MembershipRole $role): void
    {
        $this->memberships->grant($user, $role);
    }

    /**
     * A teacher with a login at the current school, teaching $subjects.
     *
     * @param  list<string>  $subjects  English subject names
     */
    public function teacher(string $name, string $email, array $subjects): Teacher
    {
        $user = $this->user($name, $email);
        $this->grant($user, MembershipRole::Teacher);

        $teacher = Teacher::create([
            'user_id' => $user->id,
            'name' => $name,
            'email' => $email,
            'phone' => fake()->numerify('01#########'),
            'joining_date' => fake()->dateTimeBetween('-5 years', '-3 months')->format('Y-m-d'),
            'status' => 'active',
        ]);

        $teacher->subjects()->sync(
            Subject::all()
                ->filter(fn (Subject $s) => in_array($s->getTranslation('name', 'en'), $subjects, true))
                ->pluck('id')
                ->all()
        );

        return $teacher;
    }

    /**
     * A student in $classroom with a student login and a parent account.
     * Names cycle through StudentSeeder's list; $parent reuses an existing
     * parent account (a family with children at several schools).
     */
    public function student(Classroom $classroom, AcademicYear $year, string $domain, ?User $parent = null): Student
    {
        $person = StudentSeeder::NAMES[$this->nameIndex % count(StudentSeeder::NAMES)];
        $this->nameIndex++;
        $slug = strtolower(str_replace(' ', '.', $person['en'])).$this->nameIndex;

        $studentUser = $this->user($person['en'], "{$slug}.student@{$domain}");
        $this->grant($studentUser, MembershipRole::Student);

        $parent ??= $this->user('Parent of '.$person['en'], "{$slug}.parent@{$domain}");
        $this->grant($parent, MembershipRole::Parent);

        $classroom->loadMissing('grade');
        $lookups = $this->lookups();

        $student = Student::create([
            'user_id' => $studentUser->id,
            'parent_user_id' => $parent->id,
            'name' => ['en' => $person['en'], 'ar' => $person['ar']],
            'gender' => $person['gender'],
            'nationality_id' => $lookups['nationality_id'],
            'governorate_id' => fake()->randomElement($lookups['governorate_ids']),
            'blood_type_id' => fake()->randomElement($lookups['blood_type_ids']),
            'stage_id' => $classroom->grade->stage_id,
            'grade_id' => $classroom->grade_id,
            'classroom_id' => $classroom->id,
            'academic_year_id' => $year->id,
        ]);

        $guardian = fn () => [
            'student_id' => $student->id,
            'job' => fake()->jobTitle(),
            'national_id' => fake()->numerify('#############'),
            'phone' => fake()->numerify('01#########'),
            'nationality_id' => $lookups['nationality_id'],
            'governorate_id' => fake()->randomElement($lookups['governorate_ids']),
            'blood_type_id' => fake()->randomElement($lookups['blood_type_ids']),
            'religion_id' => fake()->randomElement($lookups['religion_ids']),
            'address' => fake()->address(),
        ];

        Father::create([...$guardian(), 'name' => 'Father of '.$person['en']]);
        Mother::create([...$guardian(), 'name' => 'Mother of '.$person['en']]);

        return $student;
    }

    /** Global lookup tables (not per school), loaded once. */
    private function lookups(): array
    {
        return $this->lookups ??= [
            'nationality_id' => Nationality::value('id'),
            'governorate_ids' => Governorate::pluck('id')->all(),
            'blood_type_ids' => BloodType::pluck('id')->all(),
            'religion_ids' => Religion::pluck('id')->all(),
        ];
    }
}
