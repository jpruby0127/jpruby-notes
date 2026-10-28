import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="seal size-8 text-base" aria-hidden="true">
              记
            </span>
            <span className="font-serif text-lg tracking-wide">jpruby 手记</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
            一个开发者的长期写作现场。慢一点写，写清楚一点。
          </p>
        </div>

        <nav aria-label="页脚导航" className="text-sm">
          <p className="text-[11px] tracking-[0.28em] text-ink-faint">阅读</p>
          <ul className="mt-3 space-y-2.5 text-ink-soft">
            <li>
              <Link to="/" className="link-quiet hover:text-cinnabar">
                全部文章
              </Link>
            </li>
            <li>
              <Link to="/about" className="link-quiet hover:text-cinnabar">
                关于这本手记
              </Link>
            </li>
            <li>
              <Link to="/admin" className="link-quiet hover:text-cinnabar">
                写作台
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm">
          <p className="text-[11px] tracking-[0.28em] text-ink-faint">说明</p>
          <p className="mt-3 leading-relaxed text-ink-soft">
            文章以 Markdown 写作，
            <br className="hidden sm:block" />
            评论经数据库实时保存。
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-cinnabar"
          >
            回到顶部
            <ArrowUp className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-2 px-5 py-5 text-[11px] tracking-wide text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} jpruby 手记</span>
          <span>用 React、Markdown 与一点耐心搭成</span>
        </div>
      </div>
    </footer>
  );
}
