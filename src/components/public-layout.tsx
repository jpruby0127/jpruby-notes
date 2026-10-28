import { Outlet } from "react-router-dom";
import { SearchProvider } from "@/components/search-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function PublicLayout() {
  return (
    <SearchProvider>
      <div className="paper-grain flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      {import.meta.env.DEV && (
        <div className="pointer-events-none fixed bottom-3 left-3 z-50 border border-ink/20 bg-ink/90 px-2.5 py-1 font-mono text-[10px] tracking-wide text-paper">
          本地示例数据 · 不连接云端
        </div>
      )}
    </SearchProvider>
  );
}
