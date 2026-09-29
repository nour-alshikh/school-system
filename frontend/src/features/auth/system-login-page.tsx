"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth, type TwoFactorChallenge } from "@/contexts/auth-context";
import { applyServerErrors } from "@/lib/form-errors";
import { createLoginSchema, type LoginFormValues } from "@/lib/schemas";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * The system admin's own login, not tied to a school
 * (docs/central-dashboard-plan.md, phase 1): email and password, then a
 * code from an authenticator app. The first time, the admin sets the app
 * up here, and afterwards gets recovery codes to keep.
 */
export function SystemLoginPage() {
  const router = useRouter();
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  function signedIn(codes: string[] | null) {
    if (codes) {
      setRecoveryCodes(codes);
      return;
    }
    goToPlatform();
  }

  function goToPlatform() {
    setRedirecting(true);
    router.replace("/platform");
    router.refresh();
  }

  let content;
  if (redirecting) {
    content = <Loader2 className="size-6 animate-spin text-muted-foreground" />;
  } else if (recoveryCodes) {
    content = <RecoveryCodes codes={recoveryCodes} onDone={goToPlatform} />;
  } else if (challenge) {
    content = (
      <CodeStep
        challenge={challenge}
        onSignedIn={signedIn}
        onRestart={() => setChallenge(null)}
      />
    );
  } else {
    content = <PasswordStep onChallenge={setChallenge} />;
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      {content}
    </main>
  );
}

function PasswordStep({
  onChallenge,
}: {
  onChallenge: (challenge: TwoFactorChallenge) => void;
}) {
  const t = useTranslations("SystemLoginPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const { startSystemLogin } = useAuth();

  const schema = useMemo(() => createLoginSchema(tValidation), [tValidation]);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      onChallenge(await startSystemLogin(values.email, values.password));
    } catch (err) {
      const message = applyServerErrors(
        form,
        err,
        ["email", "password"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("subheading")}</p>
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("emailLabel")}</FormLabel>
              <FormControl>
                <Input type="email" dir="ltr" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("passwordLabel")}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("continuing") : t("continue")}
        </Button>
      </form>
    </Form>
  );
}

const codeSchema = z.object({ code: z.string() });
type CodeValues = z.infer<typeof codeSchema>;

function CodeStep({
  challenge,
  onSignedIn,
  onRestart,
}: {
  challenge: TwoFactorChallenge;
  onSignedIn: (recoveryCodes: string[] | null) => void;
  onRestart: () => void;
}) {
  const t = useTranslations("SystemLoginPage");
  const tErrors = useTranslations("Errors");
  const { completeSystemLogin } = useAuth();
  // A recovery code instead of an app code (only once 2FA is set up).
  const [useRecovery, setUseRecovery] = useState(false);
  const isSetup = challenge.two_factor === "setup";

  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  async function onSubmit({ code }: CodeValues) {
    try {
      onSignedIn(
        await completeSystemLogin(
          challenge.challenge_id,
          useRecovery ? { recovery_code: code.trim() } : { code: code.trim() }
        )
      );
    } catch (err) {
      // The server keys a bad recovery code as recovery_code; both show on
      // the one field.
      const message = applyServerErrors(
        form,
        remapRecoveryError(err),
        ["code"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    }
  }

  // The QR code is an SVG from our own API; shown as an image, never
  // inserted as markup.
  const qrSrc = challenge.qr_svg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(challenge.qr_svg)}`
    : null;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            {isSetup ? t("setupHeading") : t("codeHeading")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSetup ? t("setupBody") : useRecovery ? t("recoveryBody") : t("codeBody")}
          </p>
        </div>

        {isSetup && qrSrc && (
          <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, nothing for next/image to optimise */}
            <img src={qrSrc} alt={t("qrAlt")} width={192} height={192} className="rounded bg-white p-2" />
            <div className="flex w-full flex-col gap-1 text-center">
              <span className="text-xs text-muted-foreground">{t("manualEntry")}</span>
              <code dir="ltr" className="break-all rounded bg-muted px-2 py-1 text-xs">
                {challenge.secret}
              </code>
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{useRecovery ? t("recoveryLabel") : t("codeLabel")}</FormLabel>
              <FormControl>
                <Input
                  dir="ltr"
                  autoComplete="one-time-code"
                  inputMode={useRecovery ? "text" : "numeric"}
                  placeholder={useRecovery ? "abcde-12345" : "123456"}
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("verifying") : t("verify")}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button type="button" className="underline" onClick={onRestart}>
            {t("startOver")}
          </button>
          {!isSetup && (
            <button
              type="button"
              className="flex items-center gap-1 underline"
              onClick={() => {
                setUseRecovery((v) => !v);
                form.reset({ code: "" });
              }}
            >
              <KeyRound className="size-3.5" />
              {useRecovery ? t("useApp") : t("useRecovery")}
            </button>
          )}
        </div>
      </form>
    </Form>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations("SystemLoginPage");

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success(t("copied"));
    } catch {
      // Clipboard blocked: the codes are on screen to copy by hand.
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("recoveryHeading")}</h1>
        <p className="text-sm text-muted-foreground">{t("recoveryIntro")}</p>
      </div>
      <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-lg border p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <Button type="button" variant="outline" onClick={copy}>
        <Copy className="size-4" />
        {t("copy")}
      </Button>
      <Button type="button" onClick={onDone}>
        {t("savedThem")}
      </Button>
    </div>
  );
}

/** A bad recovery code comes back keyed recovery_code; show it on "code". */
function remapRecoveryError(err: unknown): unknown {
  const e = err as { errors?: Record<string, string[]> };
  if (e?.errors?.recovery_code) {
    e.errors = { ...e.errors, code: e.errors.recovery_code };
    delete e.errors.recovery_code;
  }
  return err;
}
