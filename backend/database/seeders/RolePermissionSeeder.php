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

        $admin = Role::firstOrCreate(['name' => 'admin']);
        $admin->givePermissionTo($manageUsers);
        $admin->givePermissionTo($manageAcademics);
        $admin->givePermissionTo($manageStudents);
        $admin->givePermissionTo($manageTeachers);
        $admin->givePermissionTo($manageFees);
        $admin->givePermissionTo($manageAttendance);

        Role::firstOrCreate(['name' => 'user']);
        Role::firstOrCreate(['name' => 'student']);
        Role::firstOrCreate(['name' => 'parent']);

        // No permissions of its own — a teacher's access to attendance is
        // scoped per classroom (only ones they're assigned a subject in via
        // ClassroomSubjectTeacher), which a blanket permission can't
        // express. See AttendanceController's ownership check.
        Role::firstOrCreate(['name' => 'teacher']);
    }
}
