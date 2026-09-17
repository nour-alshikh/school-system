"use client";

import { Suspense } from "react";
import { PromotionsPage } from "@/features/promotions/promotions-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PromotionsPage />
    </Suspense>
  );
}
