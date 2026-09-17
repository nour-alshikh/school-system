<?php

namespace App\Http\Controllers;

use App\Http\Requests\Student\StoreStudentRequest;
use App\Http\Requests\Student\UpdateStudentRequest;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use App\Services\StudentService;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function __construct(private readonly StudentService $studentService) {}

    public function index(Request $request)
    {
        $query = Student::with([
            'user', 'parentUser', 'father', 'mother', 'stage', 'grade', 'classroom', 'academicYear',
            'nationality', 'governorate', 'bloodType', 'media',
        ])->orderBy('id');

        if ($search = $request->query('search')) {
            $escaped = addcslashes($search, '%_\\');
            $query->where(function ($q) use ($escaped) {
                $q->where('name->en', 'like', "%{$escaped}%")
                    ->orWhere('name->ar', 'like', "%{$escaped}%")
                    ->orWhereHas('user', function ($userQuery) use ($escaped) {
                        $userQuery->where('email', 'like', "%{$escaped}%");
                    });
            });
        }

        if ($stageId = $request->query('stage_id')) {
            $query->where('stage_id', $stageId);
        }

        if ($gradeId = $request->query('grade_id')) {
            $query->where('grade_id', $gradeId);
        }

        if ($classroomId = $request->query('classroom_id')) {
            $query->where('classroom_id', $classroomId);
        }

        if ($academicYearId = $request->query('academic_year_id')) {
            $query->where('academic_year_id', $academicYearId);
        }

        if (! $request->has('page')) {
            return response()->json([
                'students' => StudentResource::collection($query->get()),
            ]);
        }

        $students = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'students' => StudentResource::collection($students),
            'meta' => [
                'current_page' => $students->currentPage(),
                'last_page' => $students->lastPage(),
                'per_page' => $students->perPage(),
                'total' => $students->total(),
            ],
        ]);
    }

    public function store(StoreStudentRequest $request)
    {
        $student = $this->studentService->register($request);

        return response()->json(['student' => new StudentResource($student)], 201);
    }

    public function show(Student $student)
    {
        $student->load([
            'user', 'parentUser', 'father', 'mother', 'stage', 'grade', 'classroom', 'academicYear',
            'nationality', 'governorate', 'bloodType', 'media',
        ]);

        return response()->json(['student' => new StudentResource($student)]);
    }

    public function update(UpdateStudentRequest $request, Student $student)
    {
        $student = $this->studentService->update($student, $request);

        return response()->json(['student' => new StudentResource($student)]);
    }

    public function destroy(Student $student)
    {
        $this->studentService->delete($student);

        return response()->noContent();
    }
}
