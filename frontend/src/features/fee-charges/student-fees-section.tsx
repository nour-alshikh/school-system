"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMoney } from "@/hooks/use-money";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  History,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { FeeChargeAmountForm } from "./fee-charge-amount-form";
import { FeeChargeForm } from "./fee-charge-form";
import { FeePaymentForm } from "./fee-payment-form";
import type { FeeCharge, FeeChargeStatus } from "./types";
import type { Fee } from "@/features/fees/types";
import type { Student } from "@/features/students/types";

const statusBadgeClass: Record<FeeChargeStatus, string> = {
  unpaid: "bg-muted text-muted-foreground",
  partial: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  waived: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

// A waived charge owes nothing regardless of what's actually been paid on
// it. And an overpaid charge (only possible from data predating the
// payment-total guard) reads as "Paid", not a negative debt — clamp at 0
// rather than showing a confusing negative balance.
function chargeBalance(charge: FeeCharge): number {
  if (charge.status === "waived") return 0;
  return Math.max(0, Number(charge.amount_due) - Number(charge.amount_paid));
}

// What was excused when this charge got waived — the unpaid remainder at
// that point, not the full amount_due (a charge can carry a partial payment
// before being waived). Zero for anything not waived. Keeping this as its
// own figure (rather than folding it into balance) is what makes
// due − paid − waived = balance hold, both per row and summed in totals.
function chargeWaivedAmount(charge: FeeCharge): number {
  if (charge.status !== "waived") return 0;
  return Math.max(0, Number(charge.amount_due) - Number(charge.amount_paid));
}

function methodLabel(t: (key: string) => string, method: string): string {
  const map: Record<string, string> = {
    cash: t("methodCash"),
    bank_transfer: t("methodBankTransfer"),
    card: t("methodCard"),
    other: t("methodOther"),
  };
  return map[method] ?? method;
}

// Print-only: only shown under @media print (via Tailwind's `print:` variant
// on the wrapper below), so this never affects the normal screen layout.
// Combines every charge's ledger into one chronological history instead of
// the screen's per-charge dialog, since that's what "print the payment
// history" actually means for a paper record.
function FeesPrintReport({
  student,
  charges,
}: {
  student: Student;
  charges: FeeCharge[];
}) {
  const t = useTranslations("StudentFeesSection");
  const money = useMoney();
  const tPayment = useTranslations("FeePaymentForm");
  const locale = useLocale();

  const totals = charges.reduce(
    (acc, charge) => ({
      due: acc.due + Number(charge.amount_due),
      paid: acc.paid + Number(charge.amount_paid),
      waived: acc.waived + chargeWaivedAmount(charge),
      balance: acc.balance + chargeBalance(charge),
    }),
    { due: 0, paid: 0, waived: 0, balance: 0 }
  );

  const allPayments = charges
    .flatMap((charge) =>
      charge.payments.map((payment) => ({
        ...payment,
        feeName: locale === "ar" ? charge.fee_name_ar : charge.fee_name_en,
      }))
    )
    .sort(
      (a, b) => a.paid_at.localeCompare(b.paid_at) || a.id - b.id
    );

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div>
        <h1 className="text-lg font-semibold">{t("printTitle")}</h1>
        <p>{locale === "ar" ? student.name_ar : student.name_en}</p>
        <p className="text-muted-foreground">
          {t("printGeneratedOn", { date: new Date().toLocaleDateString(locale) })}
        </p>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">{t("printChargesHeading")}</h2>
        <table className="w-full border-collapse text-start">
          <thead>
            <tr className="border-b">
              <th className="p-1 text-start">{t("feeColumn")}</th>
              <th className="p-1 text-start">{t("dueColumn")}</th>
              <th className="p-1 text-start">{t("paidColumn")}</th>
              <th className="p-1 text-start">{t("waivedColumn")}</th>
              <th className="p-1 text-start">{t("balanceColumn")}</th>
              <th className="p-1 text-start">{t("statusColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => {
              const balance = money(chargeBalance(charge));
              const waived = money(chargeWaivedAmount(charge));
              return (
                <tr key={charge.id} className="border-b">
                  <td className="p-1">
                    {locale === "ar" ? charge.fee_name_ar : charge.fee_name_en}
                  </td>
                  <td className="p-1">{money(charge.amount_due)}</td>
                  <td className="p-1">{money(charge.amount_paid)}</td>
                  <td className="p-1">{waived}</td>
                  <td className="p-1">{balance}</td>
                  <td className="p-1">{t(`status_${charge.status}`)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="p-1">{t("printTotalsLabel")}</td>
              <td className="p-1">{money(totals.due)}</td>
              <td className="p-1">{money(totals.paid)}</td>
              <td className="p-1">{money(totals.waived)}</td>
              <td className="p-1">{money(totals.balance)}</td>
              <td className="p-1" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">{t("printPaymentsHeading")}</h2>
        {allPayments.length === 0 ? (
          <p className="text-muted-foreground">{t("noPayments")}</p>
        ) : (
          <table className="w-full border-collapse text-start">
            <thead>
              <tr className="border-b">
                <th className="p-1 text-start">{t("dateColumn")}</th>
                <th className="p-1 text-start">{t("feeColumn")}</th>
                <th className="p-1 text-start">{t("amountColumn")}</th>
                <th className="p-1 text-start">{t("methodColumn")}</th>
                <th className="p-1 text-start">{t("noteColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {allPayments.map((payment) => (
                <tr key={payment.id} className="border-b">
                  <td className="p-1">{payment.paid_at}</td>
                  <td className="p-1">{payment.feeName}</td>
                  <td className="p-1">{money(payment.amount)}</td>
                  <td className="p-1">{methodLabel(tPayment, payment.method)}</td>
                  <td className="p-1">{payment.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function StudentFeesSection({ student }: { student: Student }) {
  const t = useTranslations("StudentFeesSection");
  const money = useMoney();
  const tPayment = useTranslations("FeePaymentForm");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [addChargeOpen, setAddChargeOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<FeeCharge | null>(null);
  const [payingCharge, setPayingCharge] = useState<FeeCharge | null>(null);
  const [viewingCharge, setViewingCharge] = useState<FeeCharge | null>(null);
  const [waivingCharge, setWaivingCharge] = useState<FeeCharge | null>(null);
  const [deletingCharge, setDeletingCharge] = useState<FeeCharge | null>(null);

  const {
    data: charges = [],
    isLoading: isLoadingCharges,
    error: chargesError,
  } = useQuery({
    queryKey: ["fee-charges", student.id],
    queryFn: () =>
      apiFetch<{ fee_charges: FeeCharge[] }>(
        `/api/students/${student.id}/fee-charges`
      ).then((d) => d.fee_charges),
  });

  const { data: fees = [] } = useQuery({
    queryKey: ["fees-all", student.academic_year_id],
    queryFn: () =>
      apiFetch<{ fees: Fee[] }>(
        `/api/fees?academic_year_id=${student.academic_year_id}`
      ).then((d) => d.fees),
  });

  useEffect(() => {
    if (!chargesError) return;
    toast.error(
      chargesError instanceof ApiError ? chargesError.message : t("loadError")
    );
  }, [chargesError, t]);

  const chargedFeeIds = new Set(charges.map((c) => c.fee_id));
  // Only fees that actually apply to this student: is_for_all, or scoped to
  // their exact stage+grade. A fee scoped elsewhere never appears here — no
  // charging a Grade 5 fee to a Grade 2 student from this screen.
  const chargeableFees = fees.filter(
    (fee) =>
      fee.is_active &&
      !chargedFeeIds.has(fee.id) &&
      (fee.is_for_all ||
        (fee.stage_id === student.stage_id && fee.grade_id === student.grade_id))
  );

  const waiveMutation = useMutation({
    mutationFn: (charge: FeeCharge) =>
      apiFetch<{ fee_charge: FeeCharge }>(`/api/fee-charges/${charge.id}/waive`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-charges", student.id] });
      toast.success(t("waiveSuccess"));
      setWaivingCharge(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("waiveError"));
    },
  });

  const unwaiveMutation = useMutation({
    mutationFn: (charge: FeeCharge) =>
      apiFetch<{ fee_charge: FeeCharge }>(
        `/api/fee-charges/${charge.id}/unwaive`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-charges", student.id] });
      toast.success(t("unwaiveSuccess"));
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("unwaiveError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (charge: FeeCharge) =>
      apiFetch<void>(`/api/fee-charges/${charge.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-charges", student.id] });
      toast.success(t("deleteSuccess"));
      setDeletingCharge(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
      setDeletingCharge(null);
    },
  });

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("heading")}</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={charges.length === 0}
              onClick={() => window.print()}
            >
              <Printer className="size-4" />
              {t("print")}
            </Button>
            <Button type="button" size="sm" onClick={() => setAddChargeOpen(true)}>
              <Plus className="size-4" />
              {t("addCharge")}
            </Button>
          </div>
        </div>

        {!isLoadingCharges && charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCharges")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("feeColumn")}</TableHead>
                <TableHead>{t("dueColumn")}</TableHead>
                <TableHead>{t("paidColumn")}</TableHead>
                <TableHead>{t("balanceColumn")}</TableHead>
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingCharges ? (
                <TableSkeletonRows columns={6} />
              ) : (
                charges.map((charge) => {
                  const balance = money(chargeBalance(charge));
                  const canPay =
                    charge.status !== "paid" && charge.status !== "waived";
                  const canWaive = canPay;
                  const canUnwaive = charge.status === "waived";
                  const canDelete = charge.payments.length === 0;

                  return (
                    <TableRow key={charge.id}>
                      <TableCell>
                        {locale === "ar" ? charge.fee_name_ar : charge.fee_name_en}
                      </TableCell>
                      <TableCell>{money(charge.amount_due)}</TableCell>
                      <TableCell>{money(charge.amount_paid)}</TableCell>
                      <TableCell>{balance}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[charge.status]}`}
                        >
                          {t(`status_${charge.status}`)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={t("viewHistory")}
                            title={t("viewHistory")}
                            onClick={() => setViewingCharge(charge)}
                          >
                            <History className="size-4" />
                          </Button>
                          {canPay && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={t("recordPayment")}
                              title={t("recordPayment")}
                              onClick={() => setPayingCharge(charge)}
                            >
                              <Banknote className="size-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={t("editAmount")}
                              title={t("editAmount")}
                              onClick={() => setEditingCharge(charge)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              aria-label={t("delete")}
                              title={t("delete")}
                              disabled={
                                deleteMutation.isPending &&
                                deleteMutation.variables?.id === charge.id
                              }
                              onClick={() => setDeletingCharge(charge)}
                            >
                              {deleteMutation.isPending &&
                              deleteMutation.variables?.id === charge.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          )}
                          {canWaive && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setWaivingCharge(charge)}
                            >
                              {t("waive")}
                            </Button>
                          )}
                          {canUnwaive && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                unwaiveMutation.isPending &&
                                unwaiveMutation.variables?.id === charge.id
                              }
                              onClick={() => unwaiveMutation.mutate(charge)}
                            >
                              {unwaiveMutation.isPending &&
                              unwaiveMutation.variables?.id === charge.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                t("unwaive")
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}

        <Dialog open={addChargeOpen} onOpenChange={setAddChargeOpen}>
          <DialogContent className="max-h-[85vh] sm:max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("addCharge")}</DialogTitle>
            </DialogHeader>
            <FeeChargeForm
              studentId={student.id}
              chargeableFees={chargeableFees}
              onSuccess={() => setAddChargeOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!editingCharge}
          onOpenChange={(open) => !open && setEditingCharge(null)}
        >
          <DialogContent className="max-h-[85vh] sm:max-w-sm overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("editAmount")}</DialogTitle>
            </DialogHeader>
            {editingCharge && (
              <FeeChargeAmountForm
                studentId={student.id}
                feeCharge={editingCharge}
                onSuccess={() => setEditingCharge(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!payingCharge}
          onOpenChange={(open) => !open && setPayingCharge(null)}
        >
          <DialogContent className="max-h-[85vh] sm:max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("recordPayment")}</DialogTitle>
            </DialogHeader>
            {payingCharge && (
              <FeePaymentForm
                studentId={student.id}
                feeCharge={payingCharge}
                onSuccess={() => setPayingCharge(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!viewingCharge}
          onOpenChange={(open) => !open && setViewingCharge(null)}
        >
          <DialogContent className="max-h-[85vh] sm:max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {viewingCharge
                  ? locale === "ar"
                    ? viewingCharge.fee_name_ar
                    : viewingCharge.fee_name_en
                  : ""}
              </DialogTitle>
            </DialogHeader>
            {viewingCharge && viewingCharge.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dateColumn")}</TableHead>
                    <TableHead>{t("amountColumn")}</TableHead>
                    <TableHead>{t("methodColumn")}</TableHead>
                    <TableHead>{t("noteColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingCharge?.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.paid_at}</TableCell>
                      <TableCell>{money(payment.amount)}</TableCell>
                      <TableCell>{methodLabel(tPayment, payment.method)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.note || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!waivingCharge}
          onOpenChange={(open) => !open && setWaivingCharge(null)}
          title={t("confirmWaiveTitle")}
          description={t("confirmWaiveDescription")}
          confirmLabel={t("waive")}
          cancelLabel={t("cancel")}
          isLoading={waiveMutation.isPending}
          onConfirm={() => waivingCharge && waiveMutation.mutate(waivingCharge)}
        />

        <ConfirmDialog
          open={!!deletingCharge}
          onOpenChange={(open) => !open && setDeletingCharge(null)}
          title={t("confirmDeleteTitle")}
          description={t("confirmDeleteDescription")}
          confirmLabel={t("delete")}
          cancelLabel={t("cancel")}
          isLoading={deleteMutation.isPending}
          onConfirm={() => deletingCharge && deleteMutation.mutate(deletingCharge)}
        />
      </div>

      <div className="hidden print:block">
        <FeesPrintReport student={student} charges={charges} />
      </div>
    </>
  );
}
