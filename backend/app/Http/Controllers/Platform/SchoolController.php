<?php

namespace App\Http\Controllers\Platform;

use App\Enums\SchoolStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\School;
use App\Rules\SchoolSlug;
use App\Services\SchoolProvisioner;
use App\TypeScript\PlatformSchoolType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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

    public function update(Request $request, School $school)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'status' => ['sometimes', 'required', Rule::enum(SchoolStatus::class)],
        ]);

        $before = $school->only(array_keys($data));
        $school->update($data);
        $changes = $school->getChanges();

        if (isset($changes['status'])) {
            AuditLog::record($school->status === SchoolStatus::Suspended ? 'school.suspended' : 'school.reactivated', $school);
        }
        if (isset($changes['name'])) {
            AuditLog::record('school.updated', $school, ['before' => ['name' => $before['name']], 'after' => ['name' => $school->name]]);
        }

        return response()->json(['school' => PlatformSchoolType::fromModel($school)]);
    }
}
