import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";

export function NotFoundPage() {
  useDocumentTitle("页面不存在");

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col items-start px-5 py-24 sm:px-8">
      <span className="seal size-12 text-xl" aria-hidden="true">
        空
      </span>
      <p className="mt-6 font-mono text-[11px] tracking-[0.3em] text-cinnabar">404</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight text-ink sm:text-5xl">
        这一页没有被写下
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
        链接可能已经改变，或者这篇文章还没有发布。回到文章列表，继续往前翻。
      </p>
      <Button asChild variant="outline" className="mt-8 rounded-none border-line bg-transparent">
        <Link to="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          回到首页
        </Link>
      </Button>
    </div>
  );
}
