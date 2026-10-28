import type { PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] tracking-wide",
        status === "published"
          ? "border-cinnabar/30 bg-cinnabar/10 text-cinnabar"
          : "border-line bg-paper-deep/60 text-ink-faint",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", status === "published" ? "bg-cinnabar" : "bg-ink-faint")}
      />
      {status === "published" ? "已发布" : "草稿"}
    </span>
  );
}
