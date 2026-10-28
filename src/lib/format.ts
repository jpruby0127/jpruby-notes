import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "未发布";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未知";
  return format(date, "yyyy 年 M 月 d 日", { locale: zhCN });
}

export function formatCompactDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "yyyy.MM.dd");
}

export function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
}

export function countWords(markdown: string): number {
  const cjk = markdown.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const words = markdown
    .replace(/[\u3400-\u9fff]/g, " ")
    .match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  return cjk + words;
}

export function readingMinutes(markdown: string): number {
  const total = countWords(markdown);
  return Math.max(1, Math.round(total / 350));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function fallbackSlug(): string {
  return `post-${Date.now().toString(36)}`;
}

export function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,，、]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 6);
}

export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*\|?[ \t:|-]+\|?[ \t]*$/gm, " ")
    .replace(/^[ \t]*(?:[-+*]|\d+\.)[ \t]+/gm, "")
    .replace(/[#>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function autoExcerpt(markdown: string, limit = 120): string {
  const text = plainText(markdown);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
