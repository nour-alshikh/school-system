import { Suspense } from "react";
import { ParentPortalPage } from "@/features/parent-portal/parent-portal-page";

// ParentPortalPage reads ?student= (useSearchParams), which needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <ParentPortalPage />
    </Suspense>
  );
}
