import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  AlertTriangle,
  Check,
  Eye,
  LoaderCircle,
  PenLine,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/admin/status-badge";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  apiErrorMessage,
  createAdminPost,
  fetchAdminPost,
  updateAdminPost,
} from "@/lib/api";
import {
  autoExcerpt,
  countWords,
  fallbackSlug,
  formatCompactDate,
  parseTags,
  readingMinutes,
  slugify,
} from "@/lib/format";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { PostStatus } from "@/lib/types";

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  tags: string;
  content: string;
  status: PostStatus;
}

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  tags: "",
  content: "",
  status: "draft",
};

function serialize(form: FormState): string {
  return JSON.stringify([
    form.title,
    form.slug,
    form.excerpt,
    form.tags,
    form.content,
    form.status,
  ]);
}

type State = "loading" | "ready" | "error";

export function AdminEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<State>(isNew ? "ready" : "loading");
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [version, setVersion] = useState<number | null>(null);
  const [savedStatus, setSavedStatus] = useState<PostStatus>("draft");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => serialize(EMPTY_FORM));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [mode, setMode] = useState<"write" | "preview">("write");

  useDocumentTitle(isNew ? "写新文章" : form.title ? `编辑 · ${form.title}` : "编辑文章");

  useEffect(() => {
    if (!id) {
      setForm(EMPTY_FORM);
      setVersion(null);
      setSavedStatus("draft");
      setSavedAt(null);
      setSavedSnapshot(serialize(EMPTY_FORM));
      setSlugTouched(false);
      setConflict(false);
      setStatus("ready");
      setError("");
      setNotFound(false);
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setError("");
    setNotFound(false);
    setConflict(false);
    fetchAdminPost(id, controller.signal)
      .then((post) => {
        if (controller.signal.aborted) return;
        const next: FormState = {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          tags: post.tags.join(", "),
          content: post.content,
          status: post.status,
        };
        setForm(next);
        setVersion(post.version);
        setSavedStatus(post.status);
        setSavedAt(post.updated_at);
        setSavedSnapshot(serialize(next));
        setSlugTouched(true);
        setStatus("ready");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setNotFound(err instanceof ApiError && err.code === "not_found");
        setError(apiErrorMessage(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, [id, reloadKey]);

  const dirty = status === "ready" && serialize(form) !== savedSnapshot;
  const words = useMemo(() => countWords(form.content), [form.content]);
  const minutes = useMemo(() => readingMinutes(form.content), [form.content]);
  const tags = useMemo(() => parseTags(form.tags), [form.tags]);
  const downgrade = savedStatus === "published" && form.status === "draft";

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function applySaved(post: {
    title: string;
    slug: string;
    excerpt: string;
    tags: string[];
    content: string;
    status: PostStatus;
    version: number;
    updated_at: string;
  }) {
    const next: FormState = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      tags: post.tags.join(", "),
      content: post.content,
      status: post.status,
    };
    setForm(next);
    setVersion(post.version);
    setSavedStatus(post.status);
    setSavedAt(post.updated_at);
    setSavedSnapshot(serialize(next));
    setSlugTouched(true);
    setConflict(false);
  }

  async function handleSave() {
    if (saving || status !== "ready") return;
    const title = form.title.trim();
    if (!title) {
      toast.error("先给文章起一个标题。");
      return;
    }
    if (form.status === "published" && !form.content.trim()) {
      toast.error("正文还是空的，先写点内容再发布。");
      return;
    }

    const slug = form.slug.trim() || fallbackSlug();
    const excerpt = form.excerpt.trim() || autoExcerpt(form.content, 140) || title;
    const payload = {
      title,
      slug,
      excerpt,
      tags,
      content: form.content,
      status: form.status,
    };

    setSaving(true);
    setConflict(false);
    try {
      if (id) {
        if (version === null) throw new ApiError("invalid_response");
        const updated = await updateAdminPost(id, { ...payload, version });
        applySaved(updated);
        toast.success(
          updated.status === "published" ? "已保存，文章处于发布状态。" : "已保存为草稿。",
        );
      } else {
        const created = await createAdminPost(payload);
        applySaved(created);
        toast.success(
          created.status === "published" ? "文章已发布，读者现在可以看到了。" : "草稿已保存。",
        );
        navigate(`/admin/posts/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "write_conflict") {
        setConflict(true);
        toast.error("文章在别处被更新过，请先载入最新版本。");
      } else if (err instanceof ApiError && err.code === "slug_taken") {
        setSlugTouched(true);
        toast.error("这个链接地址已被其他文章使用，换一个吧。");
      } else {
        toast.error(apiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-faint">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        正在打开这篇文章…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto mt-16 max-w-md border border-line bg-[#fbfaf6] p-8 text-center">
        <p className="font-serif text-xl text-ink">{notFound ? "找不到这篇文章" : "文章打不开"}</p>
        <p className="mt-2 text-sm text-cinnabar">{error}</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          {!notFound && (
            <Button
              variant="outline"
              className="rounded-none border-line bg-transparent"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              重新载入
            </Button>
          )}
          <Button asChild variant="ghost" className="rounded-none">
            <Link to="/admin">回到文章列表</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft transition-colors hover:text-cinnabar"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            文章列表
          </Link>
          <span className="h-3 w-px bg-line" aria-hidden="true" />
          <span className="truncate text-xs text-ink-faint">
            {isNew ? "新文章" : `最后保存 ${savedAt ? formatCompactDate(savedAt) : "—"}`}
          </span>
          {dirty && (
            <span className="inline-flex items-center gap-1 text-[11px] text-cinnabar">
              <span className="size-1.5 rounded-full bg-cinnabar" aria-hidden="true" />
              未保存
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="文章状态"
            className="flex divide-x divide-line border border-line bg-[#fbfaf6]"
          >
            {(["draft", "published"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.status === value}
                onClick={() => setForm((previous) => ({ ...previous, status: value }))}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  form.status === value
                    ? "bg-ink text-paper"
                    : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                }`}
              >
                {value === "draft" ? "草稿" : "发布"}
              </button>
            ))}
          </div>

          {!isNew && savedStatus === "published" && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-none px-2.5 text-xs text-ink-soft hover:bg-paper-deep hover:text-cinnabar"
            >
              <a href={`/posts/${form.slug}`} target="_blank" rel="noreferrer">
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                查看
              </a>
            </Button>
          )}

          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-none bg-cinnabar px-4 text-primary-foreground hover:bg-cinnabar-deep"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : form.status === "published" ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {saving
              ? "保存中…"
              : form.status === "published"
                ? savedStatus === "published"
                  ? "更新发布"
                  : "发布文章"
                : downgrade
                  ? "转为草稿"
                  : "保存草稿"}
          </Button>
        </div>
      </div>

      {conflict && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-cinnabar/40 bg-cinnabar/5 px-4 py-3">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-cinnabar">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            这篇文章在别处被更新过。直接保存会覆盖对方的更改。
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadKey((value) => value + 1)}
            className="rounded-none border-cinnabar/40 bg-transparent text-cinnabar hover:bg-cinnabar/10"
          >
            载入最新版本
          </Button>
        </div>
      )}

      {downgrade && (
        <p className="mt-4 border border-line bg-paper-deep/40 px-4 py-2.5 text-xs text-ink-soft">
          保存后这篇文章会从博客首页和搜索中移除，变回草稿。
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <input
            value={form.title}
            onChange={(event) => {
              const value = event.target.value;
              setForm((previous) => ({
                ...previous,
                title: value,
                slug: slugTouched ? previous.slug : slugify(value),
              }));
            }}
            placeholder="文章标题"
            aria-label="文章标题"
            className="w-full border-0 border-b border-transparent bg-transparent px-0 pb-3 font-serif text-3xl tracking-tight text-ink outline-none placeholder:text-ink-faint/60 focus:border-line sm:text-4xl"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex border border-line bg-[#fbfaf6]">
              <button
                type="button"
                onClick={() => setMode("write")}
                aria-pressed={mode === "write"}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                  mode === "write" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                }`}
              >
                <PenLine className="size-3.5" aria-hidden="true" />
                写作
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                aria-pressed={mode === "preview"}
                className={`inline-flex items-center gap-1.5 border-l border-line px-3 py-1.5 text-xs transition-colors ${
                  mode === "preview" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                }`}
              >
                <Eye className="size-3.5" aria-hidden="true" />
                预览
              </button>
            </div>
            <span className="font-mono text-[11px] text-ink-faint">
              {words} 字 · 约 {minutes} 分钟 · Markdown
            </span>
          </div>

          {mode === "write" ? (
            <textarea
              value={form.content}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, content: event.target.value }))
              }
              placeholder={"从这里开始写。\n\n支持 Markdown：## 小标题、**加粗**、> 引用、- 列表、`代码`、```代码块```。"}
              aria-label="文章正文"
              spellCheck={false}
              className="mt-3 min-h-[58vh] w-full resize-y rounded-none border border-line bg-[#fbfaf6] px-5 py-5 font-mono text-[13px] leading-7 text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-cinnabar/50"
            />
          ) : (
            <div className="mt-3 min-h-[58vh] border border-line bg-[#fbfaf6] px-6 py-6 sm:px-8">
              <Markdown content={form.content} />
            </div>
          )}

          <p className="mt-2 text-[11px] text-ink-faint">
            快捷键：⌘/Ctrl + S 保存 · 保存前改动只留在当前浏览器。
          </p>
        </div>

        <aside className="space-y-6">
          <section className="border border-line bg-[#fbfaf6]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[10px] tracking-[0.24em] text-ink-faint">文章信息</h2>
              <StatusBadge status={form.status} />
            </div>

            <div className="space-y-5 p-4">
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-ink-soft">
                  链接地址
                </span>
                <div className="mt-1.5 flex items-center border border-line bg-paper focus-within:border-cinnabar">
                  <span className="pl-2.5 font-mono text-[11px] text-ink-faint">/posts/</span>
                  <input
                    value={form.slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setForm((previous) => ({
                        ...previous,
                        slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      }));
                    }}
                    placeholder="zi-dong-sheng-cheng"
                    aria-label="文章链接地址"
                    className="h-9 w-full min-w-0 bg-transparent pr-2.5 font-mono text-xs text-ink outline-none placeholder:text-ink-faint/60"
                  />
                </div>
                <span className="mt-1.5 block text-[10px] leading-relaxed text-ink-faint">
                  留空会自动生成；发布后修改会让旧链接失效。
                </span>
              </label>

              <label className="block">
                <span className="flex items-center justify-between text-[11px] font-medium tracking-wide text-ink-soft">
                  摘要
                  <button
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        excerpt: autoExcerpt(previous.content, 140) || previous.title,
                      }))
                    }
                    className="inline-flex items-center gap-1 text-[10px] font-normal text-cinnabar transition-opacity hover:opacity-70"
                  >
                    <Sparkles className="size-3" aria-hidden="true" />
                    从正文生成
                  </button>
                </span>
                <textarea
                  value={form.excerpt}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, excerpt: event.target.value }))
                  }
                  rows={4}
                  maxLength={200}
                  placeholder="首页和搜索结果里显示的一小段话。留空会从正文提取。"
                  aria-label="文章摘要"
                  className="mt-1.5 w-full resize-none border border-line bg-paper px-2.5 py-2 text-xs leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-cinnabar"
                />
                <span className="mt-1 block text-right font-mono text-[10px] text-ink-faint">
                  {form.excerpt.length}/200
                </span>
              </label>

              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-ink-soft">标签</span>
                <input
                  value={form.tags}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, tags: event.target.value }))
                  }
                  placeholder="代码, 产品, 生活"
                  aria-label="文章标签"
                  className="mt-1.5 h-9 w-full border border-line bg-paper px-2.5 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-cinnabar"
                />
                <span className="mt-1.5 block text-[10px] leading-relaxed text-ink-faint">
                  用逗号分隔，最多 6 个
                  {tags.length > 0 ? `，将保存为：${tags.join(" · ")}` : "。"}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-px border-t border-line bg-line">
              <div className="bg-[#fbfaf6] px-4 py-3">
                <p className="text-[10px] tracking-[0.16em] text-ink-faint">字数</p>
                <p className="mt-1 font-serif text-lg text-ink">{words}</p>
              </div>
              <div className="bg-[#fbfaf6] px-4 py-3">
                <p className="text-[10px] tracking-[0.16em] text-ink-faint">阅读</p>
                <p className="mt-1 font-serif text-lg text-ink">{minutes} 分钟</p>
              </div>
            </div>
          </section>

          <section className="border border-line bg-[#fbfaf6] p-4">
            <h2 className="text-[10px] tracking-[0.24em] text-ink-faint">Markdown 速查</h2>
            <dl className="mt-3 space-y-2 text-[11px] text-ink-soft">
              {[
                ["## 标题", "小标题"],
                ["**加粗**", "加粗"],
                ["> 引用", "引用段落"],
                ["- 项目", "无序列表"],
                ["`代码`", "行内代码"],
                ["[文字](url)", "链接"],
              ].map(([syntax, label]) => (
                <div key={syntax} className="flex items-center justify-between gap-3">
                  <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] text-ink">
                    {syntax}
                  </code>
                  <span className="text-ink-faint">{label}</span>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
