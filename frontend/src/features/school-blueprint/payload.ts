import type { SchoolBlueprint } from "./types";

/** The part of a blueprint the API takes (SchoolBlueprint::rules()); name, slug and notes stay in the page. */
export type BlueprintPayload = Pick<SchoolBlueprint, "stages" | "subjects" | "academic_year" | "school_days" | "currency">;

export function toBlueprintPayload(blueprint: SchoolBlueprint): BlueprintPayload {
  return {
    stages: blueprint.stages,
    subjects: blueprint.subjects,
    academic_year: blueprint.academic_year,
    school_days: blueprint.school_days,
    currency: blueprint.currency,
  };
}
