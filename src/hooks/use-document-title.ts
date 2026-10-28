import { useEffect } from "react";

const SITE_TITLE = "jpruby 手记 · 代码、产品与生活";

export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · jpruby 手记` : SITE_TITLE;
  }, [title]);
}
