/**
 * All mock data for the video. Mirrors the demo seed
 * (backend/database/seeders/Demo) so the video matches what demo visitors
 * see. Nothing here is fetched: the video makes no network calls.
 * Scene-specific data is added under its scene's heading below.
 */

export const school = {
  name: "School System",
  nameAr: "نظام المدرسة",
  currency: "EGP",
  /** Same shape as /api/settings rows. */
  settings: [
    { key: "currency", value: "EGP" },
    { key: "school_days", value: "0,1,2,3,4" },
    { key: "primary_color", value: "#0f766e" },
  ],
};

export const users = {
  admin: {
    id: 1,
    name: "Demo Admin",
    email: "admin@example.com",
    roles: ["admin"],
    permissions: [] as string[],
    ai_available: true,
    avatar_url: null,
  },
  teacher: { name: "Rana Adel" },
  parent: { name: "Hana Mostafa" },
};

/** Seeded student names (StudentSeeder), for rosters and lists. */
export const studentNames = [
  "Ali Hassan", "Youssef Ibrahim", "Salma Mahmoud", "Omar Khaled", "Habiba Sayed",
  "Karim Fathy", "Farida Adel", "Ziad Ahmed", "Malak Sherif", "Hassan Nabil",
  "Jana Samir", "Mostafa Ashraf", "Rana Gamal", "Adam Hany", "Lina Farouk",
  "Seif Magdy", "Yasmin Ezzat", "Tarek Anwar", "Dalia Wael", "Amir Reda",
];

/** "Today" in the video: Thursday 19 Nov 2026 (so "next Thu" is 26 Nov). */
export const today = "2026-11-19";

// Scene 2: Modules
export const attendance = {
  classroom: "Grade 5 - A",
  date: "2026-11-19",
  students: studentNames.slice(0, 4),
  /** Taps, in order: [row, new status]. Everyone else stays "present". */
  changes: [
    [1, "late"],
    [2, "absent"],
    [3, "excused"],
  ] as [number, "present" | "late" | "absent" | "excused"][],
};

export const examResults = {
  title: "Grade 8 Science Midterm",
  total: 20,
  rows: [
    { name: "Ali Hassan", score: 18, at: "2026-11-26T10:41:00" },
    { name: "Salma Mahmoud", score: 20, at: "2026-11-26T10:38:00" },
    { name: "Omar Khaled", score: 15, at: "2026-11-26T10:44:00" },
    { name: "Habiba Sayed", score: 17, at: "2026-11-26T10:40:00" },
    { name: "Karim Fathy", score: 14, at: "2026-11-26T10:45:00" },
  ],
};

export const feeCharges = {
  student: "Ali Hassan",
  rows: [
    { fee: "Tuition, Term 1", due: 12000, paid: 6000, status: "partial" as const },
    { fee: "Bus", due: 3000, paid: 3000, status: "paid" as const },
    { fee: "Books", due: 1500, paid: 1500, status: "paid" as const },
  ],
  /** The payment recorded in the video, against the first row. */
  payment: { amount: 6000, date: "2026-11-19", method: "Cash" },
};

export const calendarEvents = [
  { date: "2026-11-05", title: "Art exhibition" },
  { date: "2026-11-12", title: "Sports day" },
  { date: "2026-11-17", title: "Parents' evening" },
  { date: "2026-11-23", title: "Museum trip" },
  { date: "2026-11-26", title: "Science midterm" },
  { date: "2026-11-30", title: "Parents' meeting" },
];

export const libraryResources = [
  { title: "Cells and organelles worksheet", grade: "Grade 8", subjects: ["Science"], uploader: "Rana Adel" },
  { title: "Genetics video lesson", grade: "Grade 8", subjects: ["Science"], uploader: "Rana Adel" },
  { title: "Algebra practice set", grade: "Grade 8", subjects: ["Mathematics"], uploader: "Youssef Ibrahim" },
  { title: "Reading pack: short stories", grade: "Grade 8", subjects: ["English", "Arabic"], uploader: "Hana Mostafa" },
];

// Scene 3: Draft with AI. The exam form's AI drafts multiple-choice
// questions (kind "exam_questions"); title, subject and grade are already
// picked by the teacher and sent as context.
export interface DraftQuestion {
  text: string;
  marks: string;
  options: string[];
  correct: number;
}

export const examDraft = {
  en: {
    title: "Grade 8 Science Midterm",
    subject: "Science",
    grade: "Grade 8",
    duration: "45",
    notes: "grade 8 science midterm, chapters 3–5\n3 multiple-choice questions, medium",
    questions: [
      { text: "Which organelle carries out photosynthesis in plant cells?", marks: "2", options: ["Mitochondria", "Chloroplast", "Nucleus", "Ribosome"], correct: 1 },
      { text: "A Tt × Tt cross gives what fraction of short (tt) plants?", marks: "2", options: ["1/4", "1/2", "3/4", "None"], correct: 0 },
      { text: "In a food chain, which organisms are the producers?", marks: "2", options: ["Plants", "Herbivores", "Carnivores", "Decomposers"], correct: 0 },
    ] satisfies DraftQuestion[],
  },
  ar: {
    title: "اختبار منتصف الفصل – علوم",
    subject: "العلوم",
    grade: "الصف الثامن",
    duration: "45",
    notes: "علوم الصف الثامن، الفصول ٣–٥\nسؤالان اختيار من متعدد، مستوى متوسط",
    questions: [
      { text: "ما العضية المسؤولة عن البناء الضوئي في الخلية النباتية؟", marks: "2", options: ["الميتوكوندريا", "البلاستيدات الخضراء", "النواة", "الريبوسوم"], correct: 1 },
      { text: "في السلسلة الغذائية، ما الكائنات المنتجة؟", marks: "2", options: ["النباتات", "آكلات الأعشاب", "آكلات اللحوم", "المحللات"], correct: 0 },
    ] satisfies DraftQuestion[],
  },
};

// Scene 5: Portals (and the page behind the assistant)
export const dashboards = {
  admin: {
    students: 486,
    newThisMonth: 12,
    enrollments: [8, 11, 9, 14, 10, 12],
    teachers: 34,
    classrooms: 18,
    parents: 402,
    attendanceToday: 94.6,
    attendanceChange: 1.8,
    attendanceSpark: [92, 93.5, 91, 94, 95.2, 93.8, 92.9, 94.1, 95, 93.2, 94.4, 92.8, 93.9, 94.6],
    present: 452,
    marked: 478,
    feesCollected: 184500,
    feesChange: 12.4,
    feesSpark: [120000, 142000, 98000, 151000, 164000, 184500],
    feesOutstanding: 61200,
    academicYear: "2026–2027",
  },
  teacher: { name: "Rana Adel", classrooms: 4, students: 112, marked: 3, average: 78, scoreSpark: [71, 74, 69, 77, 78] },
  student: { name: "Ali Hassan", attendance: 96, present: 48, total: 50, examsToTake: 2, average: 84, scoreSpark: [76, 81, 79, 88, 84], outstanding: 6000, totalDue: 12000 },
  parent: { name: "Hana Mostafa", child: "Ali Hassan", childGrade: "Grade 8 - A", attendance: 96, paid: 6000, totalDue: 12000 },
};

// Scene 4: Assistant
export const assistantChat = {
  q1: "How many Grade 5 students were absent today?",
  a1: "**6 of 128** Grade 5 students are absent today, and 2 of them are excused.",
  q2: "Add a parents' meeting on Monday 30 Nov at 6pm",
  a2: "Here's the event. Check it, then confirm.",
};

export const assistantEvent = {
  title: "Parents' meeting",
  date: "2026-11-30",
  description: "Monday 30 Nov at 6:00 PM in the main hall.",
};
