import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";

import { CommentSection } from "@/components/comment-section";
import { Markdown } from "@/components/markdown";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { ApiError, apiErrorMessage, fetchPost } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { PostDetail } from "@/lib/types";

type State = "loading" | "ready" | "error";

export function PostPage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useDocumentTitle(post?.title);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setError("");
    setNotFound(false);
    fetchPost(slug, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPost(result);
        setState("ready");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setPost(null);
        setNotFound(err instanceof ApiError && err.code === "not_found");
        setError(apiErrorMessage(err));
        setState("error");
      });
    return () => controller.abort();
  }, [slug, reloadKey]);

  useEffect(() => {
    if (state !== "ready") return;
    const onScroll = () => {
      const root = document.documentElement;
      const height = root.scrollHeight - root.clientHeight;
      const ratio = height > 0 ? Math.min(1, Math.max(0, root.scrollTop / height)) : 0;
      document.documentElement.style.setProperty("--read-progress", String(ratio));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.documentElement.style.removeProperty("--read-progress");
    };
  }, [state]);

  if (state === "loading") return <ArticleSkeleton />;

  if (state === "error" || !post) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-5 py-20 sm:px-8">
        <p className="text-[10px] tracking-[0.3em] text-ink-faint">{notFound ? "404" : "ERROR"}</p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-ink">
          {notFound ? "这篇文章没有留下来" : "文章暂时打不开"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {notFound ? "它可能还没有发布，或者链接已经改变。" : error}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-none border-line bg-transparent">
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              回到文章列表
            </Link>
          </Button>
          {!notFound && (
            <Button
              variant="ghost"
              onClick={() => setReloadKey((value) => value + 1)}
              className="rounded-none"
            >
              重新载入
            </Button>
          )}
        </div>
      </div>
    );
  }

  const publishedAt = post.published_at ?? post.updated_at;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-cinnabar"
        style={{ transform: "scaleX(var(--read-progress, 0))" }}
      />

      <article className="mx-auto w-full max-w-[820px] px-5 pb-4 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-cinnabar"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          返回文章列表
        </Link>

        <header className="mt-8 border-b border-line pb-9">
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Tag key={tag} tag={tag} subtle />
              ))}
            </div>
          )}
          <h1 className="mt-4 text-balance font-serif text-[clamp(2rem,5.4vw,3.5rem)] leading-[1.22] tracking-[-0.025em] text-ink">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-5 border-l-2 border-cinnabar/70 pl-4 font-serif text-base leading-[1.9] text-ink-soft sm:text-lg">
              {post.excerpt}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-ink-faint">
            <span className="flex items-center gap-2">
              <span className="seal size-5 text-[10px]" aria-hidden="true">
                记
              </span>
              jpruby
            </span>
            <span aria-hidden="true" className="h-2.5 w-px bg-line" />
            <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
            <span aria-hidden="true" className="h-2.5 w-px bg-line" />
            <span>{post.reading_minutes} 分钟阅读</span>
          </div>
        </header>

        <Markdown content={post.content} className="pt-9" />

        <div className="mt-14 flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="seal size-7 text-xs">完</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {(post.prev || post.next) && (
          <nav aria-label="相邻文章" className="mt-12 grid gap-3 sm:grid-cols-2">
            {post.prev ? (
              <Link
                to={`/posts/${post.prev.slug}`}
                className="group border border-line p-5 transition-colors hover:border-cinnabar/40 hover:bg-paper-raised"
              >
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] text-ink-faint">
                  <ArrowLeft className="size-3" aria-hidden="true" />
                  上一篇
                </span>
                <span className="mt-2 block font-serif text-lg leading-snug text-ink transition-colors group-hover:text-cinnabar">
                  {post.prev.title}
                </span>
              </Link>
            ) : (
              <div className="hidden sm:block" />
            )}
            {post.next && (
              <Link
                to={`/posts/${post.next.slug}`}
                className="group border border-line p-5 text-right transition-colors hover:border-cinnabar/40 hover:bg-paper-raised"
              >
                <span className="flex items-center justify-end gap-1.5 text-[10px] tracking-[0.25em] text-ink-faint">
                  下一篇
                  <ArrowRight className="size-3" aria-hidden="true" />
                </span>
                <span className="mt-2 block font-serif text-lg leading-snug text-ink transition-colors group-hover:text-cinnabar">
                  {post.next.title}
                </span>
              </Link>
            )}
          </nav>
        )}

        <div className="mt-12 flex flex-col gap-4 border border-line bg-paper-raised/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className="seal size-12 shrink-0 text-xl" aria-hidden="true">
              记
            </span>
            <div>
              <p className="font-serif text-lg text-ink">jpruby</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                全栈开发者。写代码，也写代码之外的事。
              </p>
            </div>
          </div>
          <Link
            to="/about"
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft transition-colors hover:text-cinnabar"
          >
            关于这本手记
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <CommentSection slug={post.slug} />
      </article>
    </>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 py-14 sm:px-8" aria-hidden="true">
      <div className="h-3 w-28 animate-pulse bg-paper-deep" />
      <div className="mt-8 h-4 w-24 animate-pulse bg-paper-deep" />
      <div className="mt-5 h-10 w-4/5 animate-pulse bg-paper-deep" />
      <div className="mt-3 h-10 w-3/5 animate-pulse bg-paper-deep" />
      <div className="mt-7 h-4 w-full animate-pulse bg-paper-deep/80" />
      <div className="mt-2 h-4 w-11/12 animate-pulse bg-paper-deep/80" />
      <div className="mt-12 space-y-3">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="h-4 w-full animate-pulse bg-paper-deep/60" />
        ))}
      </div>
      <p className="mt-8 flex items-center gap-2 text-sm text-ink-faint">
        <LoaderCircle className="size-4 animate-spin" />
        正在展开文章…
      </p>
    </div>
  );
}
