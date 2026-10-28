import { useState } from "react";
import { LogOut, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { PasswordForm, useAdminSession } from "@/admin/admin-gate";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, logoutAdmin } from "@/lib/api";

export function AdminSettingsPage() {
  const context = useAdminSession();
  const username = context?.session.username ?? "";
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await logoutAdmin();
      toast.success("已退出登录。");
      context?.reload();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b border-line pb-6">
        <p className="text-[10px] tracking-[0.3em] text-cinnabar">ACCOUNT</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-ink">账号与安全</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          这里管理写作台的登录账号。密码只保存在本站的数据库里，以带盐哈希的形式存储。
        </p>
      </header>

      <section className="mt-8 border border-line bg-paper-raised p-6">
        <h2 className="font-serif text-xl text-ink">当前账号</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-faint">用户名</dt>
            <dd className="mt-1 text-ink">{username || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">登录方式</dt>
            <dd className="mt-1 text-ink">用户名 + 密码</dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-line pt-5">
          <Button
            variant="outline"
            className="rounded-none border-line bg-transparent"
            onClick={handleLogout}
            disabled={busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                正在退出
              </>
            ) : (
              <>
                <LogOut className="size-4" aria-hidden="true" />
                退出登录
              </>
            )}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            退出后需要重新输入用户名和密码才能进入写作台；已经发布的文章不受影响。
          </p>
        </div>
      </section>

      <section className="mt-6 border border-line bg-paper-raised p-6">
        <h2 className="font-serif text-xl text-ink">修改密码</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          修改后，其他设备上的登录会失效，需要重新输入新密码。建议使用至少 8 位、包含字母和数字的密码。
        </p>
        <PasswordForm onDone={() => context?.reload()} />
      </section>
    </div>
  );
}