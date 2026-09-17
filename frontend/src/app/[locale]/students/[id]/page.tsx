import { StudentShowPage } from "@/features/students/student-show-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentShowPage id={id} />;
}
