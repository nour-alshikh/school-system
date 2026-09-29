<?php

namespace App\Http\Controllers\Platform;

use App\Enums\SchoolStatus;
use App\Http\Controllers\Controller;
use App\Models\School;
use App\Rules\SchoolSlug;
use App\Services\SchoolProvisioner;
use App\Tenancy\TenantContext;
use App\TypeScript\PlatformSchoolType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Platform → Schools. Schools are not school-scoped themselves, so these
 * work regardless of which school the platform admin is signed in to.
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

        // Suspending the school you're signed in to would sign you out of
        // the page you're using to undo it.
        abort_if(
            ($data['status'] ?? null) === SchoolStatus::Suspended->value && app(TenantContext::class)->has() && app(TenantContext::class)->id() === $school->id,
            422,
            __('api.cannot_suspend_current_school'),
        );

        $school->update($data);

        return response()->json(['school' => PlatformSchoolType::fromModel($school)]);
    }
}
