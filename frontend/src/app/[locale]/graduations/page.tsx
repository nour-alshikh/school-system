"use client";

import { Suspense } from "react";
import { GraduationsPage } from "@/features/graduations/graduations-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GraduationsPage />
    </Suspense>
  );
}
