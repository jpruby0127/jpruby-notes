import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, LoaderCircle, Search, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage, searchPosts } from "@/lib/api";
import { formatCompactDate } from "@/lib/format";
import type { SearchResult } from "@/lib/types";

type Status = "idle" | "loading" | "ready" | "error";

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setStatus("idle");
      setError("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setStatus("idle");
      setError("");
      return;
    }

    setStatus("loading");
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const items = await searchPosts(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        setResults(items);
        setStatus("ready");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(apiErrorMessage(err));
        setStatus("error");
      }
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[8%] max-w-2xl translate-y-0 gap-0 overflow-hidden border-line bg-paper-raised p-0 shadow-2xl sm:top-[12%]">
        <DialogHeader className="border-b border-line px-5 py-4 text-left">
          <DialogTitle className="sr-only">搜索文章</DialogTitle>
          <DialogDescription className="sr-only">
            输入关键词，搜索标题、标签和正文内容。
          </DialogDescription>
          <div className="flex items-center gap-3">
            <Search className="size-4 shrink-0 text-cinnabar" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、标签或正文…"
              aria-label="搜索文章"
              autoComplete="off"
              className="h-9 w-full border-0 bg-transparent p-0 font-serif text-lg text-ink outline-none placeholder:font-sans placeholder:text-base placeholder:text-ink-faint focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="清空搜索"
                className="rounded p-1 text-ink-faint transition-colors hover:text-cinnabar"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:inline">
                ESC
              </kbd>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[58vh] overflow-y-auto scrollbar-thin">
          {status === "idle" && (
            <p className="px-5 py-10 text-center text-sm text-ink-faint">
              输入一个关键词开始查找。
            </p>
          )}
          {status === "loading" && (
            <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-ink-faint">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              正在翻找…
            </p>
          )}
          {status === "error" && (
            <p className="px-5 py-10 text-center text-sm text-cinnabar">{error}</p>
          )}
          {status === "ready" && results.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-ink-faint">
              没有找到与「{query.trim()}」相关的文章。
            </p>
          )}
          {status === "ready" && results.length > 0 && (
            <ul className="divide-y divide-line">
              {results.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/posts/${item.slug}`}
                    onClick={() => onOpenChange(false)}
                    className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-paper-deep/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-wide text-ink-faint">
                        <span className="font-mono">{formatCompactDate(item.published_at)}</span>
                        {item.tags.map((tag) => (
                          <span key={tag} className="text-cinnabar/80">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-1.5 font-serif text-lg leading-snug text-ink group-hover:text-cinnabar">
                        <Highlight text={item.title} query={query} />
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                        <Highlight text={item.snippet} query={query} />
                      </p>
                    </div>
                    <ArrowUpRight
                      className="mt-1 size-4 shrink-0 text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cinnabar"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[11px] text-ink-faint">
          <span>搜索范围：标题、标签、正文</span>
          <span>Enter 打开 · Esc 关闭</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}
