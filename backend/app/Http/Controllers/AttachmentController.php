<?php

namespace App\Http\Controllers;

use App\Enums\MembershipRole;
use App\Models\Media;
use App\Models\Student;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Student attachments (photos of children, documents) live on the private
 * `local` disk, so the only way to see one is through here, signed in. The
 * browser gets them through the frontend BFF like any other API call; see
 * AttachmentType::$url.
 */
class AttachmentController extends Controller
{
    public function show(Request $request, Media $media, TenantContext $context, MembershipService $memberships): BinaryFileResponse
    {
        abort_unless($media->model_type === Student::class && $media->collection_name === 'attachments', 404);

        // Unscoped on purpose: a parent may be signed in at another of their
        // children's schools. Who may see it is decided just below.
        $student = Student::withoutSchoolScope()->find($media->model_id);
        $user = $request->user();

        $isStaffHere = $context->has()
            && $student?->school_id === $context->id()
            && ($user->can('manage-students') || $user->can('manage-fees'));

        $isTheStudent = $student?->user_id === $user->id;

        $isTheirParent = $student?->parent_user_id === $user->id
            && $memberships->usable($user, MembershipRole::Parent)->contains('school_id', $student->school_id);

        // 404, not 403: don't confirm that the file exists.
        abort_unless($isStaffHere || $isTheStudent || $isTheirParent, 404);

        $response = $request->boolean('download')
            ? response()->download($media->getPath(), $media->file_name)
            : response()->file($media->getPath());

        // BinaryFileResponse defaults to 'public', which would let a shared
        // cache (CDN, proxy) keep a copy of a child's photo.
        return $response->setPrivate()->setMaxAge(300);
    }
}
