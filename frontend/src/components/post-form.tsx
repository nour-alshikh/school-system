"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import {
  createPostSchema,
  postCategoryOptions,
  postTagOptions,
  type PostFormInput,
  type PostFormValues,
} from "@/lib/schemas";
import type { Post } from "@/types/post";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { MultiSelect } from "@/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const cardLabelClass = (selected: boolean) =>
  cn(
    "flex cursor-pointer items-start gap-3 rounded-lg border border-input p-3 text-sm transition-colors hover:bg-muted",
    selected && "border-primary bg-primary/5 hover:bg-primary/5"
  );

const defaultValues: PostFormInput = {
  title: "",
  body: "",
  status: "draft",
  category: "general",
  tags: [],
  is_featured: false,
  reading_minutes: 5,
  priority: 3,
  published_at: "",
};

function valuesFromPost(post: Post): PostFormInput {
  return {
    title: post.title,
    body: post.body,
    status: post.status,
    category: post.category,
    tags: post.tags,
    is_featured: post.is_featured,
    reading_minutes: post.reading_minutes ?? 5,
    priority: post.priority,
    published_at: post.published_at ?? "",
  };
}

export function PostForm({
  post,
  onSuccess,
}: {
  post?: Post;
  onSuccess?: () => void;
}) {
  const t = useTranslations("PostForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const statusOptions = [
    {
      value: "draft" as const,
      label: t("statusDraftLabel"),
      description: t("statusDraftDescription"),
    },
    {
      value: "published" as const,
      label: t("statusPublishedLabel"),
      description: t("statusPublishedDescription"),
    },
  ];

  const categoryLabels: Record<(typeof postCategoryOptions)[number], string> = {
    general: t("categoryGeneral"),
    tutorial: t("categoryTutorial"),
    news: t("categoryNews"),
    opinion: t("categoryOpinion"),
  };

  const tagLabels: Record<(typeof postTagOptions)[number], string> = {
    laravel: t("tagLaravel"),
    nextjs: t("tagNextjs"),
    typescript: t("tagTypescript"),
    react: t("tagReact"),
    php: t("tagPhp"),
    testing: t("tagTesting"),
  };

  const schema = useMemo(() => createPostSchema(tValidation), [tValidation]);

  const form = useForm<PostFormInput, unknown, PostFormValues>({
    resolver: zodResolver(schema),
    defaultValues: post ? valuesFromPost(post) : defaultValues,
  });

  // Editing a different post (or switching from create to edit) — sync the
  // form to the new record instead of keeping stale values around.
  useEffect(() => {
    form.reset(post ? valuesFromPost(post) : defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const mutation = useMutation({
    mutationFn: (values: PostFormValues) => {
      const payload = { ...values, published_at: values.published_at || null };

      return post
        ? apiFetch<{ post: Post }>(`/api/posts/${post.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : apiFetch<{ post: Post }>("/api/posts", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(post ? t("updatedToast") : t("createdToast"));
      if (!post) form.reset(defaultValues);
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        [
          "title",
          "body",
          "status",
          "category",
          "tags",
          "is_featured",
          "reading_minutes",
          "priority",
          "published_at",
        ],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("titleLabel")}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("contentLabel")}</FormLabel>
              <FormControl>
                <Textarea rows={5} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("statusLabel")}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid grid-cols-2 gap-3"
                >
                  {statusOptions.map((option) => (
                    <label
                      key={option.value}
                      className={cardLabelClass(field.value === option.value)}
                    >
                      <RadioGroupItem value={option.value} className="mt-0.5" />
                      <span className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("categoryLabel")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("categoryPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {postCategoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {categoryLabels[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("tagsLabel")}</FormLabel>
              <FormControl>
                <MultiSelect
                  options={postTagOptions.map((tag) => ({
                    value: tag,
                    label: tagLabels[tag],
                  }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t("tagsPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_featured"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <label className={cardLabelClass(field.value)}>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{t("featuredLabel")}</span>
                    <span className="text-muted-foreground">
                      {t("featuredDescription")}
                    </span>
                  </span>
                </label>
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reading_minutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("readingMinutesLabel")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  {...field}
                  value={field.value as number | string}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("priorityLabel", { value: field.value as number })}
              </FormLabel>
              <FormControl>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[field.value as number]}
                  onValueChange={(value) =>
                    field.onChange(Array.isArray(value) ? value[0] : value)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="published_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("publishDateLabel")}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t("saving")
              : post
                ? t("saveChanges")
                : t("createPost")}
          </Button>

          {post && onSuccess && (
            <Button type="button" variant="outline" onClick={onSuccess}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
