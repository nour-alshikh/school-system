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

        $admin = Role::firstOrCreate(['name' => 'admin']);
        $admin->givePermissionTo($manageUsers);
        $admin->givePermissionTo($manageAcademics);
        $admin->givePermissionTo($manageStudents);
        $admin->givePermissionTo($manageTeachers);

        Role::firstOrCreate(['name' => 'user']);
        Role::firstOrCreate(['name' => 'student']);
        Role::firstOrCreate(['name' => 'parent']);
    }
}
