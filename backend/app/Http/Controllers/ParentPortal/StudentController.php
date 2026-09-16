<?php

namespace App\Http\Controllers\ParentPortal;

use App\Http\Controllers\Controller;
use App\Http\Requests\ParentPortal\UpdateStudentGuardiansRequest;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    private const WITH = [
        'user', 'parentUser', 'father', 'mother', 'stage', 'grade', 'classroom',
        'academicYear', 'nationality', 'governorate', 'bloodType', 'media',
    ];

    public function show(Request $request)
    {
        $student = Student::with(self::WITH)
            ->where('parent_user_id', $request->user()->id)
            ->firstOrFail();

        return response()->json(['student' => new StudentResource($student)]);
    }

    public function update(UpdateStudentGuardiansRequest $request)
    {
        $student = Student::where('parent_user_id', $request->user()->id)->firstOrFail();
        $data = $request->validated();

        if (isset($data['father'])) {
            $student->father()->update($data['father']);
        }

        if (isset($data['mother'])) {
            $student->mother()->update($data['mother']);
        }

        return response()->json([
            'student' => new StudentResource($student->fresh(self::WITH)),
        ]);
    }
}
