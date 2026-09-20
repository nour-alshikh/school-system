import { ExamResultPage } from "@/features/student-exams/exam-result-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExamResultPage id={id} />;
}
