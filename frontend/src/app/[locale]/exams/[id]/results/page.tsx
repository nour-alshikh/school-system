import { ExamResultsPage } from "@/features/exams/exam-results-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExamResultsPage id={id} />;
}
