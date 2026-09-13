"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, isLoading, can, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold">
          Your App
        </Link>

        {isLoading ? null : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 text-sm">
              <span className="h-7 w-7">
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatar_url}
                  alt=""
                  className="text-xs"
                />
              </span>
              {user.name}
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                Dashboard
              </DropdownMenuItem>

              {can("manage-users") && (
                <DropdownMenuItem
                  onClick={() => router.push("/admin/users")}
                >
                  Manage users
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleLogout}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="underline">
              Log in
            </Link>
            <Link href="/register" className="underline">
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
