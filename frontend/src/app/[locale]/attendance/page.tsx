import { Suspense } from "react";
import { AttendancePage } from "@/features/attendance/attendance-page";

// AttendancePage reads ?classroom= (useSearchParams), which needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <AttendancePage />
    </Suspense>
  );
}
