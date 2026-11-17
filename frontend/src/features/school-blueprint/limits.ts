// Mirrors App\Services\SchoolBlueprint's limits, so the editor stops at
// what signup would refuse. The API is the authority.
export const BLUEPRINT_LIMITS = {
  stages: 4,
  grades: 15,
  classroomsPerGrade: 6,
  subjects: 40,
  name: 100,
  section: 20,
} as const;
