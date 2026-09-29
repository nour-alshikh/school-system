import { SchoolDetailPage } from "@/features/platform/school-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SchoolDetailPage id={id} />;
}
