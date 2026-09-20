import { TakeExamPage } from "@/features/student-exams/take-exam-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TakeExamPage id={id} />;
}
