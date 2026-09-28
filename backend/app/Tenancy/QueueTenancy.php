<?php

namespace App\Tenancy;

use App\Models\School;
use Illuminate\Queue\Events\JobExceptionOccurred;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use RuntimeException;

/**
 * Carries the current school across the queue: every job dispatched while a
 * school is set records its id in the payload, and the worker restores it
 * before running the job — so BelongsToSchool scoping and per-school roles
 * work the same inside jobs (media conversions, notifications, ...) as in
 * the request that dispatched them. See docs/multi-tenancy.md.
 */
class QueueTenancy
{
    /** @var list<School|null> Previous schools, restored after each job (sync jobs run mid-request). */
    private array $stack = [];

    public static function register(): void
    {
        Queue::createPayloadUsing(function () {
            $context = app(TenantContext::class);

            return ['school_id' => $context->has() ? $context->id() : null];
        });

        $self = new self;
        Event::listen(JobProcessing::class, fn (JobProcessing $e) => $self->enter($e->job->payload()['school_id'] ?? null));
        Event::listen(JobProcessed::class, fn () => $self->leave());
        Event::listen(JobExceptionOccurred::class, fn () => $self->leave());
    }

    private function enter(?int $schoolId): void
    {
        $context = app(TenantContext::class);
        $this->stack[] = $context->has() ? $context->school() : null;

        if ($schoolId === null) {
            $context->clear();

            return;
        }

        $context->set(School::find($schoolId) ?? throw new RuntimeException("Queued job belongs to school {$schoolId}, which no longer exists."));
    }

    private function leave(): void
    {
        $previous = array_pop($this->stack);
        $context = app(TenantContext::class);

        $previous ? $context->set($previous) : $context->clear();
    }
}
