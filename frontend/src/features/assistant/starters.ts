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

/** When the school lets the assistant read its data: questions about it come first. */
const DATA_STARTERS: Record<string, string[]> = {
  admin: ["absentToday", "whoOwes"],
  teacher: ["absentMyClasses", "lastExam"],
  student: ["howAmIDoing", "whatsNext"],
  parent: ["howIsMyChild", "whatsNext"],
};

const ROLE_STARTERS: Record<string, string[]> = {
  admin: ["setUp", "addStudent", "takeAttendance", "addEvent"],
  teacher: ["takeAttendance", "createExam", "connectZoom"],
  student: ["myExams", "myAttendance"],
  parent: ["childAttendance", "changePassword"],
};

export function starterKeys(pathname: string, roles: string[], readsData = false, max = 3): string[] {
  const page = PAGE_STARTERS.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? [];
  const data = readsData ? roles.flatMap((r) => DATA_STARTERS[r] ?? []).slice(0, 2) : [];
  const role = roles.flatMap((r) => ROLE_STARTERS[r] ?? []);

  return [...new Set([...data, ...page, ...role])].slice(0, max);
}
