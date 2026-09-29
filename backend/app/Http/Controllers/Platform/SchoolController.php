<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\School;
use App\Rules\SchoolSlug;
use App\Services\SchoolProvisioner;
use App\TypeScript\PlatformSchoolType;
use Illuminate\Http\Request;

/**
 * Platform → Schools. Schools are not school-scoped themselves, so these
 * run with the system admin's platform token, which belongs to no school.
 */
class SchoolController extends Controller
{
    public function index()
    {
        $schools = School::withCount('memberships as members_count')->orderBy('name')->get();

        return response()->json([
            'schools' => $schools->map(fn (School $s) => PlatformSchoolType::fromModel($s)),
        ]);
    }

    public function store(Request $request, SchoolProvisioner $provisioner)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', new SchoolSlug],
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'string', 'email', 'max:255'],
        ]);

        ['school' => $school, 'invited' => $invited] = $provisioner->create(
            $data['name'], $data['slug'], $data['admin_name'], $data['admin_email'],
        );

        AuditLog::record('school.created', $school, ['name' => $school->name, 'slug' => $school->slug, 'admin_email' => $data['admin_email']]);

        return response()->json([
            'school' => PlatformSchoolType::fromModel($school),
            // true: a new account was created and sent a set-password email;
            // false: an existing account was made admin of this school.
            'admin_invited' => $invited,
        ], 201);
    }
}
