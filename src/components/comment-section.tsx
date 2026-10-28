import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiErrorMessage, fetchComments, submitComment } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { PostComment } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

export function CommentSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetchComments(slug, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setComments(items);
        setState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(apiErrorMessage(error));
        setState("error");
      });
    return () => controller.abort();
  }, [slug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const cleanName = nickname.trim();
    const cleanContent = content.trim();
    if (!cleanName) {
      setFormError("请留下一个称呼。");
      return;
    }
    if (cleanContent.length < 2) {
      setFormError("留言至少写两个字。");
      return;
    }
    if (cleanContent.length > 800) {
      setFormError("留言请控制在 800 字以内。");
      return;
    }

    setFormError("");
    setSubmitting(true);
    try {
      const comment = await submitComment(slug, {
        nickname: cleanName,
        content: cleanContent,
        website,
      });
      setComments((previous) => [...previous, comment]);
      setNickname("");
      setContent("");
      setWebsite("");
      toast.success("留言已经贴上去了。");
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const count = comments.length;

  return (
    <section aria-labelledby="comments-title" className="mt-16 border-t border-line pt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.3em] text-ink-faint">DISCUSSION</p>
          <h2
            id="comments-title"
            className="mt-2 flex items-center gap-2 font-serif text-2xl tracking-tight text-ink"
          >
            留言
            <span className="text-sm font-sans font-normal text-ink-faint">
              {state === "ready" ? count : ""}
            </span>
          </h2>
        </div>
        <MessageCircle className="size-5 text-cinnabar/70" aria-hidden="true" />
      </div>

      {state === "loading" && (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-faint">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          正在载入留言…
        </p>
      )}

      {state === "error" && (
        <div className="mt-6 border border-line bg-paper-raised px-4 py-3 text-sm text-cinnabar">
          {loadError}
        </div>
      )}

      {state === "ready" && comments.length === 0 && (
        <p className="mt-6 border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">
          还没有留言，来做第一个说话的人。
        </p>
      )}

      {state === "ready" && comments.length > 0 && (
        <ul className="mt-6 divide-y divide-line">
          {comments.map((comment) => (
            <li key={comment.id} className="py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-serif text-base text-ink">{comment.nickname}</span>
                <time
                  dateTime={comment.created_at}
                  className="font-mono text-[10px] tracking-wide text-ink-faint"
                >
                  {formatRelative(comment.created_at)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
                {comment.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-8 border border-line bg-paper-raised/70 p-5 sm:p-6"
      >
        <p className="font-serif text-lg text-ink">留下一句</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">
          留言会公开显示，请勿写入隐私信息。称呼与内容会保存到博客数据库。
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-[12rem_1fr]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] tracking-wider text-ink-faint">称呼</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={24}
              autoComplete="nickname"
              placeholder="怎么称呼你？"
              className="h-10 border-0 border-b border-line bg-transparent px-0 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-cinnabar focus:ring-0"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-[11px] tracking-wider text-ink-faint">
              <span>留言</span>
              <span className="font-mono">{content.length} / 800</span>
            </span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={800}
              rows={4}
              placeholder="写下你的想法…"
              className="w-full resize-y border-0 border-b border-line bg-transparent px-0 py-2 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-cinnabar focus:ring-0"
            />
          </label>
        </div>

        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label>
            网站
            <input
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>

        {formError && (
          <p role="alert" className="mt-4 text-sm text-cinnabar">
            {formError}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-ink-faint">发布后立即展示，站长可以删除不合适的留言。</p>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-none bg-cinnabar px-5 text-primary-foreground hover:bg-cinnabar-deep"
          >
            {submitting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                正在发布
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden="true" />
                发布留言
              </>
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
