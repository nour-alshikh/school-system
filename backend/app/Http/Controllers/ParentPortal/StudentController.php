<?php

namespace App\Http\Controllers\ParentPortal;

use App\Http\Controllers\Controller;
use App\Http\Requests\ParentPortal\UpdateStudentGuardiansRequest;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use App\Services\ParentChildren;
use App\Tenancy\TenantContext;
use App\TypeScript\ParentChildType;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function __construct(private readonly ParentChildren $children) {}

    /**
     * Every child of this parent, at every school they're a parent at, with
     * the headline numbers for the parent dashboard.
     */
    public function index(Request $request, TenantContext $context)
    {
        $children = $this->children->all($request->user())->map(
            fn (Student $student) => $context->runAs($student->school, fn () => ParentChildType::fromModel($student)),
        );

        return response()->json(['children' => $children->values()]);
    }

    /** ?student_id picks the child; defaults to the first one. */
    public function show(Request $request)
    {
        $student = $this->children->resolve($request->user(), $request->integer('student_id') ?: null);

        return response()->json(['student' => new StudentResource($student)]);
    }

    public function update(UpdateStudentGuardiansRequest $request)
    {
        $student = $this->children->resolve($request->user(), $request->integer('student_id') ?: null);
        $data = $request->validated();

        if (isset($data['father'])) {
            $student->father()->update($data['father']);
        }

        if (isset($data['mother'])) {
            $student->mother()->update($data['mother']);
        }

        return response()->json([
            'student' => new StudentResource($student->fresh(ParentChildren::WITH)),
        ]);
    }
}
