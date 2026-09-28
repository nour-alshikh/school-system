<?php

namespace App\Tenancy;

use App\Models\School;

/**
 * The school the current request, job or command is acting for. Bound as a
 * scoped singleton so it resets between queue jobs (and Octane requests).
 * See docs/multi-tenancy.md.
 */
class TenantContext
{
    private ?School $school = null;

    public function set(School $school): void
    {
        $this->school = $school;
    }

    public function clear(): void
    {
        $this->school = null;
    }

    public function has(): bool
    {
        return $this->school !== null;
    }

    public function school(): School
    {
        return $this->school ?? throw MissingSchoolContext::make();
    }

    public function id(): int
    {
        return $this->school()->id;
    }

    /**
     * Run $callback as $school, restoring whatever was set before — for
     * seeders, commands and anything else outside an HTTP request.
     */
    public function runAs(School $school, callable $callback): mixed
    {
        $previous = $this->school;
        $this->school = $school;

        try {
            return $callback();
        } finally {
            $this->school = $previous;
        }
    }
}
