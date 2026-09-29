import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export type SlugReason = "invalid" | "reserved" | "taken";

interface SlugAvailability {
  available: boolean;
  reason?: SlugReason;
}

/**
 * Asks the API whether a slug is free as the user types. Only well-formed
 * slugs are checked — the form's own validation already covers the rest.
 */
export function useSlugAvailability(slug: string, enabled: boolean) {
  const debounced = useDebouncedValue(slug.trim(), 400);
  const isCurrent = debounced === slug.trim();

  const query = useQuery({
    queryKey: ["school-slugs", debounced],
    queryFn: () =>
      apiFetch<SlugAvailability>(
        `/api/school-slugs/${encodeURIComponent(debounced)}`
      ),
    enabled: enabled && debounced.length > 0,
    staleTime: 30_000,
    retry: false,
  });

  return {
    // While the user is still typing, the last answer is for another slug.
    checking: enabled && (!isCurrent || query.isFetching),
    result: enabled && isCurrent ? query.data : undefined,
  };
}
