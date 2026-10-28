import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Feather, LoaderCircle, Search, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

import { FeaturedPost, PostRow } from "@/components/post-row";
import { Tag } from "@/components/tag";
import { useSearch } from "@/components/search-provider";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, fetchPosts, fetchTags } from "@/lib/api";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { PostSummary, TagCount } from "@/lib/types";

type Status = "loading" | "ready" | "error";

export function HomePage() {
  useDocumentTitle();
  const { openSearch } = useSearch();
  const [searchParams, setSearchParams] = useSearchParams();
  const tag = searchParams.get("tag")?.trim() ?? "";
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    setPosts([]);
    setHasMore(false);
    fetchPosts({
      tag: tag || undefined,
      offset: 0,
      limit: 12,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPosts(result.items);
        setHasMore(result.hasMore);
        setStatus("ready");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(apiErrorMessage(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, [tag, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTags(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setTags(items);
      })
      .catch(() => {
        // Tags are supplementary; the article list still works without them.
      });
    return () => controller.abort();
  }, [reloadKey]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchPosts({
        tag: tag || undefined,
        offset: posts.length,
        limit: 12,
      });
      setPosts((previous) => {
        const known = new Set(previous.map((post) => post.id));
        return [...previous, ...result.items.filter((post) => !known.has(post.id))];
      });
      setHasMore(result.hasMore);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const latest = tag ? null : posts[0];
  const listPosts = tag ? posts : posts.slice(1);

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto w-full max-w-[1180px] px-5 pb-10 pt-12 sm:px-8 md:pb-14 md:pt-16">
          <div className="grid gap-6 md:grid-cols-[3rem_minmax(0,1fr)] md:gap-8">
            <div className="hidden md:block">
              <span className="vertical-label font-mono text-[10px] text-ink-faint">
                EST. 2026 · 持续写作
              </span>
            </div>
            <div>
              <p className="flex items-center gap-3 text-[10px] tracking-[0.38em] text-cinnabar">
                <span aria-hidden="true" className="h-px w-8 bg-cinnabar" />
                NOTES · CODE · LIFE
              </p>
              <h1 className="mt-4 font-serif text-[clamp(3.1rem,9vw,6.8rem)] leading-[0.96] tracking-[-0.045em] text-ink">
                jpruby 手记
              </h1>
              <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem] md:items-end md:gap-10">
                <p className="max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
                  一个开发者的长期写作现场。记录代码背后的判断、产品里的取舍，
                  以及生活留下的边角料。慢一点写，写清楚一点。
                </p>
                <button
                  type="button"
                  onClick={openSearch}
                  className="group flex h-11 w-full items-center gap-3 border border-line bg-paper-raised/60 px-3.5 text-left text-sm text-ink-faint transition-colors hover:border-cinnabar/50 hover:text-ink"
                >
                  <Search className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">检索文章、标签与正文…</span>
                  <kbd className="hidden border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:inline">
                    ⌘ K
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-14">
          <div className="min-w-0">
            {tag ? (
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
                <div>
                  <p className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-ink-faint">
                    <TagIcon className="size-3" aria-hidden="true" />
                    TAG
                  </p>
                  <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">{tag}</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchParams({})}
                  className="rounded-none px-2 text-xs text-ink-faint hover:bg-paper-deep hover:text-cinnabar"
                >
                  清除筛选
                </Button>
              </div>
            ) : (
              latest && (
                <div className="animate-fade-up">
                  <FeaturedPost post={latest} />
                </div>
              )
            )}

            <section aria-labelledby="article-index" className="mt-10">
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id="article-index"
                  className="font-serif text-xl tracking-tight text-ink sm:text-2xl"
                >
                  {tag ? "筛选结果" : "文章索引"}
                </h2>
                <span className="text-[10px] tracking-[0.2em] text-ink-faint">按时间倒序</span>
              </div>

              {status === "loading" && <PostSkeleton />}

              {status === "error" && (
                <div className="mt-6 border border-line bg-paper-raised px-5 py-6">
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

              {status === "ready" && listPosts.length === 0 && (
                <EmptyState filtered={Boolean(tag)} tag={tag} onClear={() => setSearchParams({})} />
              )}

              {status === "ready" && listPosts.length > 0 && (
                <div>
                  {listPosts.map((post, index) => (
                    <PostRow key={post.id} post={post} index={index} />
                  ))}
                </div>
              )}

              {status === "ready" && hasMore && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-none border-line bg-transparent px-6 text-ink-soft hover:bg-paper-deep"
                  >
                    {loadingMore ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                        正在载入
                      </>
                    ) : (
                      <>
                        继续往前翻
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {status === "ready" && !hasMore && posts.length > 0 && (
                <p className="mt-8 text-center font-serif text-sm text-ink-faint">
                  已翻到最早的一篇。
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
            <AboutCard />
            {tags.length > 0 && (
              <section className="border-t border-line pt-6">
                <h2 className="text-[10px] tracking-[0.3em] text-ink-faint">标签</h2>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tags.map((item) => (
                    <Tag
                      key={item.tag}
                      tag={item.tag}
                      active={item.tag === tag}
                      subtle={item.tag !== tag}
                      className="gap-1.5"
                    />
                  ))}
                </div>
              </section>
            )}
            <section className="border border-line bg-paper-raised/60 p-5">
              <Feather className="size-4 text-cinnabar" aria-hidden="true" />
              <h2 className="mt-3 font-serif text-lg text-ink">站长入口</h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                写新文章、修改草稿，或者管理读者留言。
              </p>
              <Link
                to="/admin"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-soft transition-colors hover:text-cinnabar"
              >
                进入写作台
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function AboutCard() {
  return (
    <section className="border-t border-line pt-6">
      <div className="flex items-center gap-3">
        <span className="seal size-12 text-xl" aria-hidden="true">
          记
        </span>
        <div>
          <p className="font-serif text-lg text-ink">jpruby</p>
          <p className="text-[11px] tracking-wide text-ink-faint">全栈开发者 · 写字的人</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        白天写代码，晚上整理想法。这里没有日更承诺，只有想清楚之后才落下的字。
      </p>
      <Link
        to="/about"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-cinnabar"
      >
        关于这本手记
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

function EmptyState({
  filtered,
  tag,
  onClear,
}: {
  filtered: boolean;
  tag: string;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <div className="mt-6 border border-dashed border-line px-6 py-14 text-center">
        <p className="font-serif text-xl text-ink">「{tag}」下暂时没有文章</p>
        <p className="mt-2 text-sm text-ink-faint">换个标签看看，或者回到全部文章。</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="mt-5 rounded-none border-line bg-transparent"
        >
          查看全部文章
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 border border-dashed border-line px-6 py-16 text-center">
      <span className="seal mx-auto size-10 text-lg" aria-hidden="true">
        始
      </span>
      <p className="mt-5 font-serif text-2xl tracking-tight text-ink">第一篇还在路上</p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-faint">
        博客已经开张，稿纸也铺好了。登录写作台，写下第一篇文章，这里就会热闹起来。
      </p>
      <Button
        asChild
        variant="outline"
        className="mt-6 rounded-none border-line bg-transparent"
      >
        <Link to="/admin">
          进入写作台
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-0" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="border-b border-line py-7">
          <div className="h-2.5 w-24 bg-paper-deep" />
          <div className="mt-4 h-5 w-3/4 bg-paper-deep" />
          <div className="mt-3 h-3 w-11/12 bg-paper-deep/80" />
        </div>
      ))}
    </div>
  );
}
