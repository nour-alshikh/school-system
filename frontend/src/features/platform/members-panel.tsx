"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, UserPlus } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, type PageMeta } from "@/components/pagination";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { timeAgo } from "./format";

interface Member {
  id: number;
  role: "admin" | "teacher" | "parent" | "student";
  status: "invited" | "active" | "suspended" | "left";
  last_seen_at: string | null;
  user: { id: number; name: string; email: string; last_login_at: string | null };
}

type Pending =
  | { kind: "suspend" | "reactivate" | "reset"; member: Member }
  | { kind: "remove"; member: Member };

const STATUS_CLASS: Record<Member["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  invited: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  suspended: "bg-red-500/10 text-red-700 dark:text-red-300",
  left: "bg-muted text-muted-foreground",
};

/**
 * A school's admins and members, managed from the central dashboard
 * (docs/central-dashboard-plan.md, phase 6): add an admin, remove one (never
 * the last), send a password reset, suspend or reactivate. All audited.
 */
export function MembersPanel({ schoolId }: { schoolId: number }) {
  const t = useTranslations("Platform.members");
  const tRoles = useTranslations("LoginChooserPage");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const params = new URLSearchParams({ page: String(page) });
  if (role !== "all") params.set("role", role);
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data, isLoading } = useQuery({
    queryKey: ["platform", "members", schoolId, params.toString()],
    queryFn: () => apiFetch<{ members: Member[]; meta: PageMeta }>(`/api/platform/schools/${schoolId}/members?${params}`),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "members", schoolId] });
    queryClient.invalidateQueries({ queryKey: ["platform", "school", String(schoolId)] });
    queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
  };

  const action = useMutation({
    mutationFn: ({ kind, member }: Pending) => {
      const base = `/api/platform/schools/${schoolId}`;
      if (kind === "remove") return apiFetch<void>(`${base}/admins/${member.user.id}`, { method: "DELETE" });
      if (kind === "reset") return apiFetch<void>(`${base}/members/${member.id}/password-reset`, { method: "POST" });
      return apiFetch<void>(`${base}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: kind === "suspend" ? "suspended" : "active" }),
      });
    },
    onSuccess: (_, { kind }) => {
      toast.success(t(`done_${kind}`));
      setPending(null);
      refresh();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong"));
      setPending(null);
    },
  });

  return (
    <section className="flex flex-col gap-4">
      <AddAdminForm schoolId={schoolId} onAdded={refresh} />

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="me-auto text-sm font-semibold">{t("heading")}</h2>
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t("searchPlaceholder")}
          className="h-9 w-56"
          aria-label={t("searchPlaceholder")}
        />
        <Select
          items={[{ value: "all", label: t("allRoles") }, ...(["admin", "teacher", "parent", "student"] as const).map((r) => ({ value: r, label: tRoles(r) }))]}
          value={role}
          onValueChange={(v) => { setRole(v ?? "all"); setPage(1); }}
        >
          <SelectTrigger className="h-9 w-40" aria-label={t("role")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allRoles")}</SelectItem>
            {(["admin", "teacher", "parent", "student"] as const).map((r) => (
              <SelectItem key={r} value={r}>{tRoles(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("person")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("lastSeen")}</TableHead>
              <TableHead className="w-12"><span className="sr-only">{t("actions")}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={5} />
            ) : (data?.members ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">{t("empty")}</TableCell>
              </TableRow>
            ) : (
              data!.members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    {m.user.name}
                    <div className="text-xs text-muted-foreground" dir="ltr">{m.user.email}</div>
                  </TableCell>
                  <TableCell>{tRoles(m.role)}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[m.status]}`}>{t(`status_${m.status}`)}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(m.last_seen_at, locale) ?? t("never")}</TableCell>
                  <TableCell>
                    {m.status !== "left" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 hover:bg-muted" aria-label={t("actionsFor", { name: m.user.name })}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPending({ kind: "reset", member: m })}>{t("sendReset")}</DropdownMenuItem>
                          {m.status === "suspended" ? (
                            <DropdownMenuItem onClick={() => setPending({ kind: "reactivate", member: m })}>{t("reactivate")}</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setPending({ kind: "suspend", member: m })}>{t("suspend")}</DropdownMenuItem>
                          )}
                          {m.role === "admin" && (
                            <DropdownMenuItem onClick={() => setPending({ kind: "remove", member: m })}>{t("removeAdmin")}</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {data && <Pagination meta={data.meta} onPageChange={setPage} />}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending ? t(`confirm_${pending.kind}_title`, { name: pending.member.user.name }) : ""}
        description={pending ? t(`confirm_${pending.kind}_body`, { email: pending.member.user.email }) : ""}
        confirmLabel={pending ? t(`confirm_${pending.kind}_action`) : ""}
        cancelLabel={t("cancel")}
        variant={pending && (pending.kind === "suspend" || pending.kind === "remove") ? "destructive" : "default"}
        isLoading={action.isPending}
        onConfirm={() => pending && action.mutate(pending)}
      />
    </section>
  );
}

const addSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.email(),
});
type AddValues = z.infer<typeof addSchema>;

function AddAdminForm({ schoolId, onAdded }: { schoolId: number; onAdded: () => void }) {
  const t = useTranslations("Platform.members");
  const tErrors = useTranslations("Errors");
  const form = useForm<AddValues>({ resolver: zodResolver(addSchema), defaultValues: { name: "", email: "" } });

  async function onSubmit(values: AddValues) {
    try {
      const { invited } = await apiFetch<{ invited: boolean }>(`/api/platform/schools/${schoolId}/admins`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success(invited ? t("addedInvited", { email: values.email }) : t("addedExisting", { email: values.email }));
      form.reset();
      onAdded();
    } catch (err) {
      const message = applyServerErrors(form, err, ["name", "email"], tErrors("somethingWentWrong"));
      if (message) toast.error(message);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="size-4" />
            {t("addHeading")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("addHint")}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>{t("name")}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>{t("email")}</FormLabel>
                <FormControl><Input type="email" dir="ltr" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="sm:mt-6" disabled={form.formState.isSubmitting}>
            {t("add")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
