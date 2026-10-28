import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Tag } from "@/components/tag";
import { formatCompactDate } from "@/lib/format";
import type { PostSummary } from "@/lib/types";

export function PostRow({ post, index }: { post: PostSummary; index: number }) {
  return (
    <Link
      to={`/posts/${post.slug}`}
      className="group grid grid-cols-[2.2rem_1fr_auto] gap-3 border-b border-line py-7 transition-colors hover:bg-paper-raised/60 sm:grid-cols-[3rem_1fr_auto] sm:gap-5 sm:py-8"
    >
      <span className="pt-1.5 font-mono text-[11px] tracking-widest text-ink-faint">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-wide text-ink-faint">
          <time dateTime={post.published_at ?? undefined}>
            {formatCompactDate(post.published_at ?? post.updated_at)}
          </time>
          <span aria-hidden="true" className="h-2.5 w-px bg-line" />
          <span>{post.reading_minutes} 分钟阅读</span>
        </div>
        <h3 className="mt-2 font-serif text-xl leading-snug tracking-tight text-ink transition-colors group-hover:text-cinnabar sm:text-2xl">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {post.excerpt}
        </p>
        {post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="border border-line/80 px-2 py-0.5 text-[10px] tracking-wide text-ink-faint"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <ArrowUpRight
        className="mt-1 size-4 text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cinnabar sm:size-5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function FeaturedPost({ post }: { post: PostSummary }) {
  const date = new Date(post.published_at ?? post.updated_at);
  const day = Number.isNaN(date.getTime()) ? "—" : String(date.getDate()).padStart(2, "0");
  const month = Number.isNaN(date.getTime()) ? "—" : String(date.getMonth() + 1).padStart(2, "0");
  const year = Number.isNaN(date.getTime()) ? "—" : String(date.getFullYear());

  return (
    <Link
      to={`/posts/${post.slug}`}
      className="group grid gap-6 border-y border-line py-8 transition-colors hover:bg-paper-raised/50 md:grid-cols-[1fr_9rem] md:gap-10 md:py-10"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="h-px w-7 bg-cinnabar" aria-hidden="true" />
          <span className="text-[11px] tracking-[0.3em] text-cinnabar">最新一篇</span>
        </div>
        <h2 className="mt-4 max-w-2xl text-balance font-serif text-[clamp(1.7rem,4vw,2.6rem)] leading-[1.28] tracking-tight text-ink transition-colors group-hover:text-cinnabar">
          {post.title}
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
          {post.excerpt}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-faint">
          <span>{post.reading_minutes} 分钟阅读</span>
          <span aria-hidden="true" className="h-2.5 w-px bg-line" />
          <span className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Tag key={tag} tag={tag} subtle />
            ))}
          </span>
        </div>
      </div>

      <div className="hidden flex-col items-end justify-between border-l border-line pl-8 md:flex">
        <span className="seal size-9 text-base" aria-hidden="true">
          新
        </span>
        <div className="text-right">
          <div className="font-serif text-5xl leading-none tracking-tight text-ink">{day}</div>
          <div className="mt-2 font-mono text-[10px] tracking-[0.28em] text-ink-faint">
            {year} / {month}
          </div>
        </div>
      </div>
    </Link>
  );
}
