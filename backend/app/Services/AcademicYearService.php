<?php

namespace App\Services;

use App\Http\Requests\AcademicYear\StoreAcademicYearRequest;
use App\Http\Requests\AcademicYear\UpdateAcademicYearRequest;
use App\Models\AcademicYear;
use Illuminate\Support\Facades\DB;

class AcademicYearService
{
    public function create(StoreAcademicYearRequest $request): AcademicYear
    {
        return DB::transaction(function () use ($request) {
            $data = $request->validated();

            if ($data['is_current'] ?? false) {
                $this->unsetCurrent();
            }

            return AcademicYear::create($data);
        });
    }

    public function update(UpdateAcademicYearRequest $request, AcademicYear $academicYear): AcademicYear
    {
        return DB::transaction(function () use ($request, $academicYear) {
            $data = $request->validated();

            if (($data['is_current'] ?? false) && ! $academicYear->is_current) {
                $this->unsetCurrent();
            }

            $academicYear->update($data);

            return $academicYear;
        });
    }

    /**
     * Only one academic year may be current at a time.
     */
    private function unsetCurrent(): void
    {
        AcademicYear::where('is_current', true)->update(['is_current' => false]);
    }
}
