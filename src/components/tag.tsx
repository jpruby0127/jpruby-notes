import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Tag({
  tag,
  active = false,
  subtle = false,
  className,
}: {
  tag: string;
  active?: boolean;
  subtle?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={`/?tag=${encodeURIComponent(tag)}`}
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-[11px] leading-5 tracking-wide transition-colors",
        active
          ? "border-cinnabar bg-cinnabar text-primary-foreground"
          : subtle
            ? "border-line/80 text-ink-faint hover:border-cinnabar/50 hover:text-cinnabar"
            : "border-line text-ink-soft hover:border-cinnabar/50 hover:text-cinnabar",
        className,
      )}
    >
      {tag}
    </Link>
  );
}
