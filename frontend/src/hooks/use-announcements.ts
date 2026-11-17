import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

export interface Announcement {
  id: number;
  title: string;
  body: string | null;
  level: "info" | "warning" | "critical";
  dismissible: boolean;
}

const QUERY_KEY = ["announcements"];

/**
 * Announcements from the system admin for this school and role
 * (docs/central-dashboard-plan.md, phase 8). Critical ones show as a banner
 * above every page; all of them are in the top bar's notifications menu.
 */
export function useAnnouncements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inSchool = !!user && (!!user.current_membership || !!user.acting_as);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<{ announcements: Announcement[] }>("/api/announcements").then((d) => d.announcements),
    enabled: inSchool,
    staleTime: 5 * 60 * 1000,
  });

  const dismiss = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/announcements/${id}/dismiss`, { method: "POST" }),
    onMutate: (id) =>
      queryClient.setQueryData<Announcement[]>(QUERY_KEY, (prev) => prev?.filter((a) => a.id !== id)),
  });

  return { inSchool, announcements: inSchool ? (query.data ?? []) : [], dismiss: dismiss.mutate };
}
