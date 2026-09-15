<?php

namespace App\Http\Controllers;

use App\Http\Requests\Student\StoreStudentRequest;
use App\Http\Resources\StudentResource;
use App\Services\StudentService;

class StudentController extends Controller
{
    public function __construct(private readonly StudentService $studentService) {}

    public function store(StoreStudentRequest $request)
    {
        $student = $this->studentService->register($request);

        return response()->json(['student' => new StudentResource($student)], 201);
    }
}
