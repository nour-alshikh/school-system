"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Post } from "@/types/post";
import { PostForm } from "@/components/post-form";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";

export default function PostsPage() {
  const t = useTranslations("PostsPage");
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editingPost, setEditingPost] = useState<Post | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/posts");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: posts = [],
    isLoading: isLoadingPosts,
    error: postsError,
  } = useQuery({
    queryKey: ["posts"],
    queryFn: () => apiFetch<{ posts: Post[] }>("/api/posts").then((d) => d.posts),
    enabled: !isAuthLoading && !!user,
  });

  useEffect(() => {
    if (!postsError) return;

    toast.error(
      postsError instanceof ApiError ? postsError.message : t("loadError")
    );
  }, [postsError, t]);

  const deleteMutation = useMutation({
    mutationFn: (post: Post) =>
      apiFetch<void>(`/api/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: (_data, post) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(t("deleteSuccess"));
      if (editingPost?.id === post.id) setEditingPost(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">
          {editingPost ? t("editPost") : t("newPost")}
        </h1>
        <PostForm
          key={editingPost?.id ?? "new"}
          post={editingPost ?? undefined}
          onSuccess={() => setEditingPost(null)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("postsHeading")}</h2>

        {!isLoadingPosts && posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPosts")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("titleColumn")}</TableHead>
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead>{t("categoryColumn")}</TableHead>
                <TableHead>{t("authorColumn")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPosts ? (
                <TableSkeletonRows columns={5} />
              ) : (
                posts.map((post) => {
                  const isOwner = post.user.id === user.id;

                  return (
                    <TableRow key={post.id}>
                      <TableCell>
                        {post.title}
                        {post.is_featured && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ★ {t("featured")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{post.status}</TableCell>
                      <TableCell className="capitalize">{post.category}</TableCell>
                      <TableCell>{post.user.name}</TableCell>
                      <TableCell>
                        {isOwner && (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPost(post)}
                            >
                              {t("edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(post)}
                            >
                              {t("delete")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
