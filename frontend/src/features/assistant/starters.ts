/**
 * Suggested first questions (Assistant.starters.*): the current page's
 * first, then the role's. Only pages the user can open are listed in the
 * nav, so a page's starters only show to people who can use that page.
 */
const PAGE_STARTERS: [path: string, keys: string[]][] = [
  ["/classrooms", ["addClassroom", "classroomTeachers"]],
  ["/stages", ["stagesGrades"]],
  ["/grades", ["addGrade", "stagesGrades"]],
  ["/subjects", ["assignSubjects"]],
  ["/academic-years", ["newYear"]],
  ["/attendance", ["takeAttendance", "holidayAttendance"]],
  ["/my-classrooms", ["takeAttendance"]],
  ["/exams", ["createExam", "publishExam"]],
  ["/fees", ["chargeAll", "recordPayment"]],
  ["/students", ["addStudent", "addSibling", "promote"]],
  ["/promotions", ["promote", "undoPromotion"]],
  ["/graduations", ["undoPromotion"]],
  ["/teachers", ["teacherLogin", "assignSubjects"]],
  ["/teacher-subjects", ["assignSubjects"]],
  ["/meetings", ["connectZoom"]],
  ["/library", ["addResource"]],
  ["/admin/settings", ["changeLogo", "schoolDays"]],
];

const ROLE_STARTERS: Record<string, string[]> = {
  admin: ["setUp", "addStudent", "takeAttendance", "addEvent"],
  teacher: ["takeAttendance", "createExam", "connectZoom"],
  student: ["myExams", "myAttendance"],
  parent: ["childAttendance", "changePassword"],
};

export function starterKeys(pathname: string, roles: string[], max = 3): string[] {
  const page = PAGE_STARTERS.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? [];
  const role = roles.flatMap((r) => ROLE_STARTERS[r] ?? []);

  return [...new Set([...page, ...role])].slice(0, max);
}
