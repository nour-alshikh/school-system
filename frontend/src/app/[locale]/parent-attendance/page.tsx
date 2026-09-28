import { Suspense } from "react";
import { ParentAttendancePage } from "@/features/parent-attendance/parent-attendance-page";

// ParentAttendancePage reads ?student= (useSearchParams), which needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <ParentAttendancePage />
    </Suspense>
  );
}
