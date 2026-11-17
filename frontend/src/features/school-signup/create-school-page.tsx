"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Loader2, Sparkles, XCircle } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { applyServerErrors } from "@/lib/form-errors";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/page-loader";
import {
  createNewSchoolSchema,
  createSchoolSignupSchema,
  slugify,
  type SchoolSignupPayload,
} from "./schema";
import { useSlugAvailability } from "./use-slug-availability";
import { BlueprintPanel } from "@/features/school-blueprint/blueprint-panel";
import { DescribeSchoolForm } from "@/features/school-blueprint/describe-school-form";
import { toBlueprintPayload } from "@/features/school-blueprint/payload";
import { clearBlueprint, loadBlueprint, saveBlueprint } from "@/features/school-blueprint/storage";
import type { BuildBlueprintResult } from "@/features/school-blueprint/use-build-blueprint";
import type { SchoolBlueprint } from "@/features/school-blueprint/types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SCHOOL_FIELDS = ["school_name", "slug"] as const;
const ACCOUNT_FIELDS = [
  "name",
  "email",
  "password",
  "password_confirmation",
] as const;

/**
 * Self-service schools (docs/self-service-schools-plan.md). A guest fills
 * in their account and the school; a signed-in user only the school. Either
 * way they land on the dashboard as the new school's admin.
 *
 * With a blueprint from "Describe your school" (?from=blueprint, kept in
 * sessionStorage — docs/ai-assistant-plan.md, phase 2), the structure it
 * describes sits beside the form to edit, and is built with the school.
 */
export function CreateSchoolPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  // Keyed so a login/logout in another tab remounts with the right schema.
  const mode = user ? "member" : "guest";
  return <CreateSchoolForm key={mode} mode={mode} />;
}

function CreateSchoolForm({ mode }: { mode: "guest" | "member" }) {
  const t = useTranslations("CreateSchoolPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const { signUpSchool, createSchool } = useAuth();
  const router = useRouter();
  // See login/page.tsx's redirecting state for why this is needed.
  const [redirecting, setRedirecting] = useState(false);
  // Until the user edits the slug themselves, it follows the school name.
  const [slugTouched, setSlugTouched] = useState(false);
  // Only a blueprint this visit came with: an old one in storage doesn't leak in.
  const fromBlueprint = useSearchParams().get("from") === "blueprint";
  const [stored] = useState(() => (fromBlueprint ? loadBlueprint() : null));
  const [blueprint, setBlueprint] = useState<SchoolBlueprint | null>(stored?.blueprint ?? null);
  const [description, setDescription] = useState(stored?.description ?? "");
  const [describeOpen, setDescribeOpen] = useState(false);

  // Edits survive a reload of this tab.
  useEffect(() => {
    if (blueprint) saveBlueprint({ blueprint, description });
  }, [blueprint, description]);

  const isGuest = mode === "guest";

  // One form type for both modes: a member's schema just ignores the
  // account fields, which aren't rendered for them.
  const resolver = useMemo(
    () =>
      zodResolver(
        isGuest
          ? createSchoolSignupSchema(tValidation)
          : createNewSchoolSchema(tValidation)
      ) as unknown as Resolver<SchoolSignupPayload>,
    [isGuest, tValidation]
  );

  const form = useForm<SchoolSignupPayload>({
    resolver,
    defaultValues: {
      school_name: stored?.blueprint.school_name ?? "",
      slug: stored?.blueprint.slug ?? "",
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
      website: "",
    },
  });

  const slug = useWatch({ control: form.control, name: "slug" }) ?? "";
  const slugWellFormed =
    slug.length >= 3 && slug.length <= 63 && SLUG_PATTERN.test(slug);
  const availability = useSlugAvailability(slug, slugWellFormed);
  const slugUnavailable = availability.result?.available === false;

  // A first blueprint fills an empty school name (and its slug, unless typed).
  function onBuilt(result: BuildBlueprintResult, text: string) {
    setBlueprint(result.blueprint);
    setDescription(text);
    setDescribeOpen(false);
    if (result.blueprint.school_name && !form.getValues("school_name")) {
      form.setValue("school_name", result.blueprint.school_name);
      if (!slugTouched) form.setValue("slug", result.blueprint.slug ?? slugify(result.blueprint.school_name));
    }
  }

  function discardBlueprint() {
    setBlueprint(null);
    setDescription("");
    clearBlueprint();
  }

  async function onSubmit(values: SchoolSignupPayload) {
    const withBlueprint = blueprint ? { blueprint: toBlueprintPayload(blueprint) } : {};
    try {
      if (isGuest) {
        await signUpSchool({ ...values, ...withBlueprint });
      } else {
        await createSchool({
          school_name: values.school_name,
          slug: values.slug,
          ...withBlueprint,
        });
      }
      clearBlueprint();
      setRedirecting(true);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const message = applyServerErrors(
        form,
        err,
        isGuest ? [...SCHOOL_FIELDS, ...ACCOUNT_FIELDS] : [...SCHOOL_FIELDS],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    }
  }

  if (redirecting) {
    return <PageLoader />;
  }

  return (
    <main
      className={
        blueprint
          ? "mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 p-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]"
          : "flex flex-1 items-center justify-center p-6"
      }
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-md flex-col gap-6"
        >
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold">{t("heading")}</h1>
            <p className="text-sm text-muted-foreground">
              {isGuest ? t("subheading") : t("memberSubheading")}
            </p>
          </div>

          {!blueprint && (
            <div className="rounded-xl border border-dashed p-3">
              <button
                type="button"
                aria-expanded={describeOpen}
                onClick={() => setDescribeOpen((open) => !open)}
                className="flex w-full items-center gap-2 text-start text-sm font-medium"
              >
                <Sparkles className="size-4 shrink-0 text-brand-accent-strong dark:text-brand-accent" />
                <span className="flex-1">{t("describeToggle")}</span>
                <ChevronDown className={`size-4 transition-transform ${describeOpen ? "rotate-180" : ""}`} />
              </button>
              {describeOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">{t("describeHint")}</p>
                  <DescribeSchoolForm variant="compact" onBuilt={onBuilt} />
                </div>
              )}
            </div>
          )}

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 text-sm font-medium">
              {t("schoolSection")}
            </legend>

            <FormField
              control={form.control}
              name="school_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("schoolNameLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="organization"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        if (!slugTouched) {
                          form.setValue("slug", slugify(event.target.value), {
                            shouldValidate: form.formState.isSubmitted,
                          });
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("slugLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      dir="ltr"
                      placeholder="green-valley"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      {...field}
                      onChange={(event) => {
                        setSlugTouched(true);
                        field.onChange(event.target.value.toLowerCase());
                      }}
                    />
                  </FormControl>
                  {fieldState.error ? (
                    <FormMessage />
                  ) : (
                    <SlugStatus
                      wellFormed={slugWellFormed}
                      checking={availability.checking}
                      available={availability.result?.available}
                      reason={availability.result?.reason}
                    />
                  )}
                </FormItem>
              )}
            />
          </fieldset>

          {isGuest && (
            <fieldset className="relative flex flex-col gap-4">
              <legend className="mb-3 text-sm font-medium">
                {t("accountSection")}
              </legend>

              {/* Honeypot: invisible and skipped by keyboard, screen
                  readers and autofill, so only bots fill it in. Clipped
                  in place, not pushed off-screen: -left-9999px widened
                  the page in RTL. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="pointer-events-none absolute top-0 start-0 size-px overflow-hidden opacity-0 [clip-path:inset(50%)]"
                {...form.register("website")}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("nameLabel")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("emailLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        dir="ltr"
                        autoComplete="email"
                        {...field}
                      />
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
                      <PasswordInput autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password_confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("confirmPasswordLabel")}</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
          )}

          <Button
            type="submit"
            disabled={form.formState.isSubmitting || slugUnavailable}
          >
            {form.formState.isSubmitting ? t("submitting") : t("submit")}
          </Button>

          {blueprint && (
            <p className="text-xs text-muted-foreground">{t("blueprintWillBuild")}</p>
          )}

          {isGuest && (
            <p className="text-center text-sm">
              {t("haveAccount")}{" "}
              <Link
                href={`/login?redirect=${encodeURIComponent("/create-school")}`}
                className="underline"
              >
                {t("loginToAdd")}
              </Link>
            </p>
          )}
        </form>
      </Form>

      {blueprint && (
        <BlueprintPanel
          blueprint={blueprint}
          description={description}
          onChange={setBlueprint}
          onRefined={(result) => setBlueprint(result.blueprint)}
          onDiscard={discardBlueprint}
        />
      )}
    </main>
  );
}

function SlugStatus({
  wellFormed,
  checking,
  available,
  reason,
}: {
  wellFormed: boolean;
  checking: boolean;
  available?: boolean;
  reason?: string;
}) {
  const t = useTranslations("CreateSchoolPage");

  // Not checked (malformed), or the check failed — the server validates on
  // submit anyway.
  if (!wellFormed || (!checking && available === undefined)) {
    return <p className="text-xs text-muted-foreground">{t("slugHint")}</p>;
  }

  if (checking) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {t("slugChecking")}
      </p>
    );
  }

  if (available) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" />
        {t("slugAvailable")}
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-destructive">
      <XCircle className="size-3.5" />
      {reason === "reserved" ? t("slugReserved") : t("slugTaken")}
    </p>
  );
}
