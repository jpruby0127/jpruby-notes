import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, PenLine, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/admin/status-badge";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, deleteAdminPost, fetchAdminPosts } from "@/lib/api";
import { formatCompactDate } from "@/lib/format";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { PostSummary } from "@/lib/types";

type State = "loading" | "ready" | "error";

export function AdminPostsPage() {
  useDocumentTitle("文章 · 写作台");
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetchAdminPosts(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setPosts(items);
        setState("ready");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(apiErrorMessage(err));
        setState("error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  const stats = useMemo(() => {
    const published = posts.filter((post) => post.status === "published").length;
    return {
      total: posts.length,
      published,
      drafts: posts.length - published,
      latest: posts[0]?.updated_at ?? null,
    };
  }, [posts]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return posts;
    return posts.filter((post) =>
      [post.title, post.slug, ...post.tags].join(" ").toLowerCase().includes(needle),
    );
  }, [posts, query]);

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(id);
    try {
      await deleteAdminPost(id);
      setPosts((previous) => previous.filter((post) => post.id !== id));
      setConfirming(null);
      toast.success("文章已删除，相关留言也已清理。");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.3em] text-ink-faint">CONTENT</p>
          <h1 className="mt-1.5 font-serif text-3xl tracking-tight text-ink">文章</h1>
          <p className="mt-2 text-sm text-ink-soft">
            写新文章、整理草稿，或删掉不再需要的旧文。
          </p>
        </div>
        <Button
          asChild
          className="rounded-none bg-cinnabar px-4 text-primary-foreground hover:bg-cinnabar-deep"
        >
          <Link to="/admin/posts/new">
            <Plus className="size-4" aria-hidden="true" />
            新建文章
          </Link>
        </Button>
      </div>

      <div className="mt-7 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="全部文章" value={state === "ready" ? String(stats.total) : "—"} />
        <Stat label="已发布" value={state === "ready" ? String(stats.published) : "—"} />
        <Stat label="草稿" value={state === "ready" ? String(stats.drafts) : "—"} />
        <Stat
          label="最近更新"
          value={state === "ready" ? formatCompactDate(stats.latest) : "—"}
          mono
        />
      </div>

      <div className="mt-6 border border-line bg-[#fbfaf6]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="筛选标题、标签或链接…"
              aria-label="筛选文章"
              className="h-9 w-full border border-line bg-paper px-3 pl-8 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-cinnabar"
            />
          </div>
          <span className="text-[11px] text-ink-faint">
            {state === "ready" ? `显示 ${visible.length} 篇` : "正在载入"}
          </span>
        </div>

        {state === "loading" && (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-ink-faint">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            正在读取文章…
          </div>
        )}

        {state === "error" && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-cinnabar">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-4 rounded-none border-line bg-transparent"
            >
              重新载入
            </Button>
          </div>
        )}

        {state === "ready" && posts.length === 0 && (
          <div className="px-5 py-16 text-center">
            <span className="seal mx-auto size-10 text-lg" aria-hidden="true">
              始
            </span>
            <p className="mt-4 font-serif text-xl text-ink">还没有文章</p>
            <p className="mt-2 text-sm text-ink-faint">写下第一篇，博客就有了开头。</p>
            <Button
              asChild
              className="mt-5 rounded-none bg-cinnabar px-4 text-primary-foreground hover:bg-cinnabar-deep"
            >
              <Link to="/admin/posts/new">
                <PenLine className="size-4" aria-hidden="true" />
                开始写作
              </Link>
            </Button>
          </div>
        )}

        {state === "ready" && posts.length > 0 && visible.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-ink-faint">
            没有匹配「{query.trim()}」的文章。
          </p>
        )}

        {state === "ready" && visible.length > 0 && (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_6.5rem_7rem_8.5rem] gap-4 border-b border-line px-5 py-2 text-[10px] tracking-[0.18em] text-ink-faint lg:grid">
              <span>标题</span>
              <span>状态</span>
              <span>更新</span>
              <span className="text-right">操作</span>
            </div>
            <ul className="divide-y divide-line">
              {visible.map((post) => (
                <li
                  key={post.id}
                  className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_6.5rem_7rem_8.5rem] lg:items-center lg:gap-4"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      className="block truncate font-serif text-lg text-ink transition-colors hover:text-cinnabar"
                    >
                      {post.title || "（无标题）"}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                      <span className="truncate font-mono">/{post.slug}</span>
                      {post.tags.length > 0 && <span>{post.tags.join(" · ")}</span>}
                      <span>{post.reading_minutes} 分钟</span>
                    </div>
                  </div>

                  <div>
                    <StatusBadge status={post.status} />
                  </div>

                  <div className="text-[11px] text-ink-faint lg:text-xs">
                    {formatCompactDate(post.updated_at)}
                  </div>

                  <div className="flex items-center gap-1 lg:justify-end">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="rounded-none px-2.5 text-xs text-ink-soft hover:bg-paper-deep hover:text-cinnabar"
                    >
                      <Link to={`/admin/posts/${post.id}/edit`}>编辑</Link>
                    </Button>
                    {confirming === post.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleting === post.id}
                          onClick={() => handleDelete(post.id)}
                          className="rounded-none px-2 text-xs text-destructive hover:bg-destructive/10"
                        >
                          {deleting === post.id ? "删除中…" : "确认删除"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirming(null)}
                          className="rounded-none px-2 text-xs text-ink-faint"
                        >
                          取消
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirming(post.id)}
                        aria-label={`删除《${post.title}》`}
                        className="rounded-none px-2 text-ink-faint hover:bg-paper-deep hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
        删除文章会同时删除它下面的全部留言，操作无法撤销。
      </p>
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-[#fbfaf6] px-5 py-4">
      <p className="text-[10px] tracking-[0.2em] text-ink-faint">{label}</p>
      <p className={`mt-1.5 text-2xl text-ink ${mono ? "font-mono text-lg" : "font-serif"}`}>
        {value}
      </p>
    </div>
  );
}
