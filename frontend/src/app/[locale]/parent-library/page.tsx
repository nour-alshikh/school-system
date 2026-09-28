import { Suspense } from "react";
import { ParentLibraryPage } from "@/features/parent-library/parent-library-page";

// ParentLibraryPage reads ?student= (useSearchParams), which needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <ParentLibraryPage />
    </Suspense>
  );
}
