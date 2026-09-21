import { Suspense } from "react";
import { MeetingsPage } from "@/features/meetings/meetings-page";

// MeetingsPage reads ?zoom=connected via useSearchParams() (see
// ZoomController::callback()'s redirect) — Next requires that behind a
// Suspense boundary for a production build, same as login/page.tsx.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <MeetingsPage />
    </Suspense>
  );
}
