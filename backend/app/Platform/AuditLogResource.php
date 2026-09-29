<?php

namespace App\Platform;

use App\Models\AuditLog;

/**
 * An audit entry as the central dashboard shows it. Mirrored by
 * AuditLogEntry in frontend/src/features/platform/types.ts.
 */
final class AuditLogResource
{
    public static function from(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'action' => $log->action,
            'actor' => $log->actor?->only(['id', 'name', 'email']),
            'school' => $log->relationLoaded('school') ? $log->school?->only(['id', 'name', 'slug']) : null,
            'school_id' => $log->school_id,
            'subject_type' => $log->subject_type ? class_basename($log->subject_type) : null,
            'subject_id' => $log->subject_id,
            'details' => $log->details,
            'ip' => $log->ip,
            'created_at' => $log->created_at->toJSON(),
        ];
    }
}
