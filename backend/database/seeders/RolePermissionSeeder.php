<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $manageUsers = Permission::firstOrCreate(['name' => 'manage-users']);
        $manageAcademics = Permission::firstOrCreate(['name' => 'manage-academics']);
        $manageStudents = Permission::firstOrCreate(['name' => 'manage-students']);
        $manageTeachers = Permission::firstOrCreate(['name' => 'manage-teachers']);
        $manageFees = Permission::firstOrCreate(['name' => 'manage-fees']);
        $manageAttendance = Permission::firstOrCreate(['name' => 'manage-attendance']);
        $manageExams = Permission::firstOrCreate(['name' => 'manage-exams']);
        $manageMeetings = Permission::firstOrCreate(['name' => 'manage-meetings']);
        $manageSettings = Permission::firstOrCreate(['name' => 'manage-settings']);
        $manageCalendar = Permission::firstOrCreate(['name' => 'manage-calendar']);

        // school_id null = the role exists at every school. Without it,
        // spatie (teams on) stamps the current school onto a new role and no
        // other school could assign it. Assignments are per school instead.
        $admin = Role::firstOrCreate(['name' => 'admin', 'school_id' => null]);
        $admin->givePermissionTo($manageUsers);
        $admin->givePermissionTo($manageAcademics);
        $admin->givePermissionTo($manageStudents);
        $admin->givePermissionTo($manageTeachers);
        $admin->givePermissionTo($manageFees);
        $admin->givePermissionTo($manageAttendance);
        $admin->givePermissionTo($manageExams);
        $admin->givePermissionTo($manageMeetings);
        $admin->givePermissionTo($manageSettings);
        $admin->givePermissionTo($manageCalendar);

        Role::firstOrCreate(['name' => 'student', 'school_id' => null]);
        Role::firstOrCreate(['name' => 'parent', 'school_id' => null]);

        // No permissions of its own — a teacher's access to attendance and
        // exams is scoped per classroom (only ones they're assigned a
        // subject in via ClassroomSubjectTeacher), which a blanket
        // permission can't express. See AttendanceController's and
        // ExamController's ownership checks.
        Role::firstOrCreate(['name' => 'teacher', 'school_id' => null]);
    }
}
