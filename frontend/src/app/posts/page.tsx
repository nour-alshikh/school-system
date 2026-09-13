"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function PostsPage() {
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
      postsError instanceof ApiError ? postsError.message : "Failed to load posts."
    );
  }, [postsError]);

  const deleteMutation = useMutation({
    mutationFn: (post: Post) =>
      apiFetch<void>(`/api/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: (_data, post) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post deleted.");
      if (editingPost?.id === post.id) setEditingPost(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete post.");
    },
  });

  if (isAuthLoading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">
          {editingPost ? "Edit post" : "New post"}
        </h1>
        <PostForm
          key={editingPost?.id ?? "new"}
          post={editingPost ?? undefined}
          onSuccess={() => setEditingPost(null)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Posts</h2>

        {isLoadingPosts ? (
          <p className="text-sm text-muted-foreground">Loading posts…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Author</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const isOwner = post.user.id === user.id;

                return (
                  <TableRow key={post.id}>
                    <TableCell>
                      {post.title}
                      {post.is_featured && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ★ featured
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
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(post)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
