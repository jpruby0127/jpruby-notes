import { Link, NavLink } from "react-router-dom";
import { Search } from "lucide-react";

import { useSearch } from "@/components/search-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "文章", end: true },
  { to: "/about", label: "关于", end: false },
  { to: "/admin", label: "登录", end: false },
];

export function SiteHeader() {
  const { openSearch } = useSearch();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-8">
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <span className="seal size-9 shrink-0 text-lg sm:size-10 sm:text-xl" aria-hidden="true">
            记
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-serif text-lg tracking-wide text-ink transition-colors group-hover:text-cinnabar sm:text-xl">
              jpruby 手记
            </span>
            <span className="mt-1 hidden text-[9px] tracking-[0.34em] text-ink-faint sm:block">
              NOTES &amp; CODE
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="主导航" className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative px-2 py-2 text-sm transition-colors hover:text-cinnabar sm:px-3",
                    isActive ? "text-ink" : "text-ink-soft",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-x-2 -bottom-0.5 h-px bg-cinnabar transition-opacity sm:inset-x-3",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <span className="mx-1 hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
          <button
            type="button"
            onClick={openSearch}
            className="flex items-center gap-2 px-2.5 py-2 text-sm text-ink-soft transition-colors hover:text-cinnabar sm:px-3"
            aria-label="搜索文章"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">搜索</span>
          </button>
        </div>
      </div>
    </header>
  );
}
