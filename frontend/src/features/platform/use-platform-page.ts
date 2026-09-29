import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { isPlatformSession } from "@/lib/platform";

/**
 * Platform pages need a system admin's platform session. Anyone else goes
 * to their dashboard (a school session) or the system admin login. The API
 * is the real authority; this only avoids a page of 403s.
 */
export function usePlatformPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const allowed = isPlatformSession(user);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/login/system");
    else if (!allowed) router.replace("/dashboard");
  }, [isLoading, user, allowed, router]);

  return { ready: !isLoading && allowed };
}
