import { Suspense } from "react";
import { CreateSchoolPage } from "@/features/school-signup/create-school-page";

// CreateSchoolPage reads ?from=blueprint (useSearchParams), which needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <CreateSchoolPage />
    </Suspense>
  );
}
