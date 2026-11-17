"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, ArrowUpRight, Loader2, MessageSquarePlus, Sparkles, Trash2, X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAiAvailable } from "@/hooks/use-ai-draft";
import { apiFetch, ApiError } from "@/lib/api";
import type { AssistantConversationType, AssistantMessageType } from "@/types/generated";
import { flattenSections, useNavSections, type NavItem } from "@/components/app-nav";
import { useIsMac } from "@/components/command-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AssistantActionCard } from "./action-card";
import { AssistantText } from "./assistant-text";
import { OPEN_ASSISTANT_EVENT, type OpenAssistantDetail } from "./open-assistant";
import { starterKeys } from "./starters";

const MAX_MESSAGE = 2000;

interface Conversation {
  id: number | null;
  messages: AssistantMessageType[];
  /** The school lets the assistant look up its data (phase 5). */
  readsData: boolean;
}

const EMPTY: Conversation = { id: null, messages: [], readsData: false };

/** A fresh chat, keeping what the server said about reading data. */
const fresh = (prev?: Conversation): Conversation => ({ ...EMPTY, readsData: prev?.readsData ?? false });

/**
 * The assistant (docs/ai-assistant-plan.md, phases 4–5): ✦ in the top bar
 * or Ctrl/⌘ J opens a side sheet — full screen on phones — that answers
 * "how do I…" questions, and questions about the school's data when the
 * school allows it, with links to the user's own pages. It stays open
 * while the user follows the steps on the page behind it. Hidden when AI
 * isn't available at this school.
 */
export function AssistantPanel() {
  const available = useAiAvailable();
  if (!available) return null;

  return <Assistant />;
}

function Assistant() {
  const t = useTranslations("Assistant");
  const tStarters = useTranslations("Assistant.starters");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isMac = useIsMac();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { sections } = useNavSections();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  // The question being answered, shown while waiting.
  const [pending, setPending] = useState<string | null>(null);
  // A question from openAssistant("…"), asked once the conversation has loaded.
  const [queued, setQueued] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // One conversation per school and role: switching resets it.
  const queryKey = useMemo(() => ["assistant-conversation", user?.current_membership?.id ?? null], [user]);

  const { data: conversation = EMPTY, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch<{ conversation: AssistantConversationType | null; reads_data: boolean }>(
        "/api/assistant/conversation"
      ).then(
        ({ conversation, reads_data }): Conversation => ({
          id: conversation?.id ?? null,
          messages: conversation?.messages ?? [],
          readsData: reads_data,
        })
      ),
    enabled: open,
    staleTime: Infinity,
  });

  // The pages this user can open: what answers may link to.
  const pages = useMemo(() => {
    const byHref = new Map<string, NavItem>();
    for (const item of flattenSections(sections)) if (!byHref.has(item.href)) byHref.set(item.href, item);
    return byHref;
  }, [sections]);

  const send = useMutation({
    mutationFn: (message: string) =>
      apiFetch<{ conversation_id: number; messages: AssistantMessageType[] }>("/api/assistant/messages", {
        method: "POST",
        body: JSON.stringify({
          message,
          conversation_id: conversation.id,
          page: pathname,
          links: [...pages.values()].map((item) => ({ href: item.href, label: item.label })),
        }),
      }),
    onMutate: (message) => {
      setQueued(null);
      setPending(message);
      setInput("");
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Conversation>(queryKey, (prev = EMPTY) => ({
        ...prev,
        id: data.conversation_id,
        messages: [...prev.messages, ...data.messages],
      }));
    },
    onError: (error, message) => {
      // Nothing was saved: give the question back to try again.
      setInput((current) => current || message);
      toast.error(error instanceof ApiError ? error.message : tErrors("somethingWentWrong"));
    },
    onSettled: () => {
      setPending(null);
      inputRef.current?.focus();
    },
  });

  const clear = useMutation({
    mutationFn: () => apiFetch<void>("/api/assistant/conversations", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<Conversation>(queryKey, fresh);
      toast.success(t("cleared"));
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : tErrors("somethingWentWrong")),
  });

  // A proposal confirmed or dismissed: shown as such at once, then saved so
  // the card isn't offered again. Losing that save only means the card
  // could come back after a reload.
  const actionStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "done" | "dismissed" }) =>
      apiFetch(`/api/assistant/messages/${id}/action`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onMutate: ({ id, status }) => {
      queryClient.setQueryData<Conversation>(queryKey, (prev = EMPTY) => ({
        ...prev,
        messages: prev.messages.map((m) => (m.id === id && m.action ? { ...m, action: { ...m.action, status } } : m)),
      }));
    },
  });

  function ask(question: string) {
    const message = question.trim().slice(0, MAX_MESSAGE);
    if (!message || send.isPending) return;
    send.mutate(message);
  }

  // Ctrl/⌘ J toggles it from anywhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "j" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // openAssistant("…") from elsewhere: open, and ask once the saved
  // conversation has loaded (so its answer isn't overwritten by the load).
  useEffect(() => {
    function onOpen(event: Event) {
      const question = (event as CustomEvent<OpenAssistantDetail>).detail?.question;
      setOpen(true);
      if (question) setQueued(question);
    }
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  }, []);

  // send.mutate is stable, so this runs once per queued question; onMutate clears it.
  const { mutate } = send;
  const ready = !!queued && open && !isLoading && !send.isPending;
  useEffect(() => {
    if (ready && queued) mutate(queued.trim().slice(0, MAX_MESSAGE));
  }, [ready, queued, mutate]);

  // Keep the newest message in view.
  const count = conversation.messages.length;
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, count, pending]);

  /** The nav page a deeper path sits under: /students/12 → Students. */
  function sectionOf(href: string): NavItem | undefined {
    let best: NavItem | undefined;
    for (const [path, item] of pages) {
      if (href.startsWith(`${path}/`) && (!best || path.length > best.href.length)) best = item;
    }
    return best;
  }

  function follow(href: string) {
    router.push(href);
    // Full screen on phones: get out of the way. On wider screens it stays
    // beside the page, so the steps can be followed.
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  }

  const empty = count === 0 && !pending;
  const starters = starterKeys(pathname, user?.roles ?? [], conversation.readsData);
  const shortcut = isMac ? "⌘J" : "Ctrl J";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen} modal={false} disablePointerDismissal>
      <DialogPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("open")}
            title={`${t("open")} (${shortcut})`}
            aria-keyshortcuts={isMac ? "Meta+J" : "Control+J"}
          />
        }
      >
        <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          initialFocus={inputRef}
          className="fixed inset-0 z-40 flex flex-col bg-background text-foreground shadow-2xl outline-none transition-transform duration-200 ease-out data-ending-style:translate-x-full data-starting-style:translate-x-full sm:inset-y-0 sm:start-auto sm:end-0 sm:w-[26rem] sm:border-s rtl:data-ending-style:-translate-x-full rtl:data-starting-style:-translate-x-full print:hidden"
        >
          <header className="flex h-14 shrink-0 items-center gap-1 border-b px-3">
            <Sparkles className="ms-1 size-4 text-brand-accent-strong dark:text-brand-accent" />
            <DialogPrimitive.Title className="me-auto ms-1 text-sm font-semibold">{t("title")}</DialogPrimitive.Title>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("newChat")}
              title={t("newChat")}
              disabled={empty || send.isPending}
              onClick={() => {
                queryClient.setQueryData<Conversation>(queryKey, fresh);
                inputRef.current?.focus();
              }}
            >
              <MessageSquarePlus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("clearHistory")}
              title={t("clearHistory")}
              disabled={clear.isPending || send.isPending}
              onClick={() => clear.mutate()}
            >
              <Trash2 className="size-4" />
            </Button>
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" aria-label={t("close")} title={t("close")} />}>
              <X className="size-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {isLoading ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-4 text-sm">
                {empty && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg bg-muted/50 p-3 leading-relaxed">
                      <p>{t("intro", { name: user?.name.split(" ")[0] ?? "" })}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {conversation.readsData ? t("noteData") : t("note")}
                      </p>
                    </div>
                    {starters.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-muted-foreground">{t("suggestions")}</p>
                        <div className="flex flex-col items-start gap-2">
                          {starters.map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => ask(tStarters(key))}
                              className="rounded-full border px-3 py-1.5 text-start text-sm transition-colors hover:border-brand-accent/60 hover:bg-brand-accent/5"
                            >
                              {tStarters(key)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {conversation.messages.map((message) =>
                  message.role === "user" ? (
                    <UserBubble key={message.id} text={message.content} />
                  ) : (
                    <div key={message.id} className="flex flex-col gap-2">
                      <div className="leading-relaxed">
                        <AssistantText text={message.content} />
                      </div>
                      {message.links.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {message.links.map(({ href, label }) => {
                            // A page in this user's navigation, by its current name; else a
                            // page a lookup found (a student's) under one of their sections.
                            const page = pages.get(href) ?? sectionOf(href);
                            if (!page) return null;
                            const Icon = page.icon;
                            const name = pages.has(href) ? page.label : label;
                            if (!name) return null;
                            return (
                              <Button key={href} variant="outline" size="sm" onClick={() => follow(href)}>
                                <Icon className="size-4" />
                                <span className="max-w-56 truncate">{t("open_link", { page: name })}</span>
                                <ArrowUpRight className="size-3.5 opacity-60 rtl:-scale-x-100" />
                              </Button>
                            );
                          })}
                        </div>
                      )}
                      {message.action && (
                        <AssistantActionCard
                          action={message.action}
                          onStatus={(status) => actionStatus.mutate({ id: message.id, status })}
                          onNavigate={follow}
                        />
                      )}
                    </div>
                  )
                )}

                {pending && (
                  <>
                    <UserBubble text={pending} />
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="flex gap-1" aria-hidden>
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="size-1.5 animate-bounce rounded-full bg-current motion-reduce:animate-none"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </span>
                      <span className="text-xs">{t("thinking")}</span>
                    </div>
                  </>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <form
            className="shrink-0 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <div className="flex items-end gap-2 rounded-lg border bg-background p-1.5 focus-within:ring-3 focus-within:ring-ring/50">
              <Textarea
                ref={inputRef}
                rows={1}
                maxLength={MAX_MESSAGE}
                value={input}
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                dir="auto"
                lang={locale}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter is a new line.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                className="max-h-36 min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <Button
                type="submit"
                size="icon-sm"
                aria-label={t("send")}
                title={t("send")}
                disabled={!input.trim() || send.isPending}
                className="shrink-0"
              >
                {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ms-8 self-end whitespace-pre-wrap rounded-2xl rounded-ee-sm bg-primary px-3 py-2 text-primary-foreground" dir="auto">
      {text}
    </div>
  );
}
