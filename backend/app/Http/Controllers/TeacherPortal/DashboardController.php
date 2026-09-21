<?php

namespace App\Http\Controllers\TeacherPortal;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\TypeScript\TeacherDashboardType;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DashboardController extends Controller
{
    /**
     * Everything a teacher's own dashboard needs in one fetch — their
     * classroom+subject assignments, per-classroom attendance status, and
     * their own recent exams. Same single-call shape as
     * StudentPortal\DashboardController.
     */
    public function show(Request $request)
    {
        $teacher = $this->teacher($request);

        return response()->json(['dashboard' => (array) TeacherDashboardType::build($teacher)]);
    }

    private function teacher(Request $request): Teacher
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, Response::HTTP_FORBIDDEN);

        return $teacher;
    }
}
