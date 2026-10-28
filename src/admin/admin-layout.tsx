import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowUpRight, FileText, MessageSquare, PenLine, Settings } from "lucide-react";

import { useAdminSession } from "@/admin/admin-gate";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "文章", icon: FileText, end: true },
  { to: "/admin/comments", label: "留言", icon: MessageSquare, end: false },
  { to: "/admin/settings", label: "设置", icon: Settings, end: false },
];

export function AdminLayout() {
  const session = useAdminSession()?.session;
  const username = session?.username || "站长";

  return (
    <div className="min-h-dvh bg-[#f2efe7] text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-[#faf8f2]/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="flex items-center gap-2.5">
              <span className="seal size-8 text-sm" aria-hidden="true">
                记
              </span>
              <span className="font-serif text-lg tracking-wide">jpruby 手记</span>
            </Link>
            <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
            <span className="hidden text-[10px] tracking-[0.28em] text-ink-faint sm:block">
              WRITING DESK
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 px-2 py-1.5 text-xs text-ink-soft transition-colors hover:text-cinnabar sm:flex"
            >
              查看博客
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-ink text-[11px] text-paper">
                {username.slice(0, 1)}
              </span>
              <span className="hidden max-w-[8rem] truncate text-xs text-ink-soft sm:block">
                {username}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-line/70 lg:hidden">
          <nav aria-label="工作台导航" className="flex gap-1 px-4 sm:px-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "border-cinnabar text-cinnabar"
                      : "border-transparent text-ink-soft hover:text-ink",
                  )
                }
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1320px] lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-line px-4 py-8 lg:block">
          <nav aria-label="工作台导航" className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-paper-raised text-cinnabar shadow-[inset_2px_0_0_var(--cinnabar)]"
                      : "text-ink-soft hover:bg-paper-raised/70 hover:text-ink",
                  )
                }
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 border-t border-line pt-5">
            <p className="px-3 text-[10px] tracking-[0.24em] text-ink-faint">快捷入口</p>
            <Link
              to="/admin/posts/new"
              className="mt-3 flex items-center gap-2 px-3 py-2 text-xs text-ink-soft transition-colors hover:text-cinnabar"
            >
              <PenLine className="size-3.5" aria-hidden="true" />
              写一篇新文章
            </Link>
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs text-ink-soft transition-colors hover:text-cinnabar"
            >
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              在浏览器中查看
            </Link>
          </div>

          <p className="mt-10 px-3 text-[10px] leading-relaxed text-ink-faint">
            文章发布后立即出现在博客首页，并进入全文搜索索引。
          </p>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
