import { Suspense } from "react";
import { ParentFeesPage } from "@/features/parent-fees/parent-fees-page";

// ParentFeesPage reads ?student= (useSearchParams), which needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <ParentFeesPage />
    </Suspense>
  );
}
