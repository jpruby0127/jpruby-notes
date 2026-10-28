import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, KeyRound, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  apiErrorMessage,
  changeAdminPassword,
  fetchAdminSession,
  loginAdmin,
} from "@/lib/api";
import type { AdminSession } from "@/lib/types";

interface AdminContextValue {
  session: AdminSession;
  reload: () => void;
}

const AdminSessionContext = createContext<AdminContextValue | null>(null);

export function useAdminSession(): AdminContextValue | null {
  return useContext(AdminSessionContext);
}

type State = "loading" | "ready" | "error";

export function AdminGate() {
  const location = useLocation();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetchAdminSession(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setSession(result);
        setState("ready");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(apiErrorMessage(err));
        setState("error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  const reload = () => setReloadKey((value) => value + 1);

  if (state === "loading") {
    return (
      <AdminShell>
        <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-ink-faint">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          正在确认身份…
        </div>
      </AdminShell>
    );
  }

  if (state === "error") {
    return (
      <AdminShell>
        <div className="mx-auto mt-16 max-w-md border border-line bg-paper-raised p-8 text-center">
          <p className="font-serif text-xl text-ink">写作台暂时打不开</p>
          <p className="mt-2 text-sm text-cinnabar">{error}</p>
          <Button
            variant="outline"
            className="mt-5 rounded-none border-line bg-transparent"
            onClick={reload}
          >
            重新载入
          </Button>
        </div>
      </AdminShell>
    );
  }

  if (!session) return null;

  if (!session.initialized) {
    return (
      <AdminShell>
        <div className="mx-auto mt-10 max-w-lg border border-line bg-paper-raised p-8 sm:mt-16 sm:p-10">
          <span className="seal size-12 text-xl" aria-hidden="true">
            记
          </span>
          <p className="mt-6 text-[10px] tracking-[0.3em] text-cinnabar">WRITING DESK</p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-ink">写作台还未初始化</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            站点还没有创建站长账号，请联系站点维护者完成初始化后再来。
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-cinnabar"
          >
            先回博客看看
          </Link>
        </div>
      </AdminShell>
    );
  }

  if (!session.authenticated) {
    return (
      <AdminShell>
        <LoginPanel
          notice={location.state && (location.state as { notice?: string }).notice}
          onDone={reload}
        />
      </AdminShell>
    );
  }

  if (session.mustChangePassword) {
    return (
      <AdminShell>
        <ChangePasswordPanel forced username={session.username} onDone={reload} />
      </AdminShell>
    );
  }

  return (
    <AdminSessionContext.Provider value={{ session, reload }}>
      <Outlet />
    </AdminSessionContext.Provider>
  );
}

function LoginPanel({ notice, onDone }: { notice?: string; onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      setError("请输入用户名和密码。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await loginAdmin(username.trim(), password);
      toast.success("登录成功，欢迎回到写作台。");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-lg border border-line bg-paper-raised p-8 sm:mt-16 sm:p-10">
      <span className="seal size-12 text-xl" aria-hidden="true">
        记
      </span>
      <p className="mt-6 text-[10px] tracking-[0.3em] text-cinnabar">STATION MASTER</p>
      <h1 className="mt-2 font-serif text-3xl tracking-tight text-ink">写作台</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        这里是站长专属的写作与留言管理入口。输入站长账号登录后，即可写文章、发布或保存草稿。
      </p>
      {notice ? (
        <p className="mt-4 border border-line bg-paper-deep/50 px-4 py-3 text-xs leading-relaxed text-ink-soft">
          {notice}
        </p>
      ) : null}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-xs text-ink-faint" htmlFor="admin-username">
          用户名
          <input
            id="admin-username"
            name="username"
            autoComplete="username"
            className="mt-2 w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-cinnabar"
            placeholder="站长用户名"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="block text-xs text-ink-faint" htmlFor="admin-password">
          密码
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-2 w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-cinnabar"
            placeholder="登录密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="text-xs text-cinnabar">{error}</p> : null}
        <Button
          type="submit"
          disabled={busy}
          className="w-full rounded-none bg-cinnabar px-5 text-primary-foreground hover:bg-cinnabar-deep"
        >
          {busy ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              正在登录
            </>
          ) : (
            <>
              登录
              <LogIn className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
        登录只用于确认站长身份，读者浏览文章与留言无需登录。忘记密码需要在数据库侧重置。
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-cinnabar"
      >
        先回博客看看
      </Link>
    </div>
  );
}

export function PasswordForm({ forced = false, onDone }: { forced?: boolean; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (next.length < 8) {
      setError("新密码至少 8 位。");
      return;
    }
    if (next !== confirm) {
      setError("两次输入的新密码不一致。");
      return;
    }
    if (next === current) {
      setError("新密码不能和当前密码相同。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changeAdminPassword(current, next);
      toast.success("密码已更新。");
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <label className="block text-xs text-ink-faint" htmlFor="admin-current-password">
        当前密码
        <input
          id="admin-current-password"
          type="password"
          autoComplete="current-password"
          className="mt-2 w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-cinnabar"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </label>
      <label className="block text-xs text-ink-faint" htmlFor="admin-new-password">
        新密码（至少 8 位）
        <input
          id="admin-new-password"
          type="password"
          autoComplete="new-password"
          className="mt-2 w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-cinnabar"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
      </label>
      <label className="block text-xs text-ink-faint" htmlFor="admin-confirm-password">
        再输一次新密码
        <input
          id="admin-confirm-password"
          type="password"
          autoComplete="new-password"
          className="mt-2 w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-cinnabar"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </label>
      {error ? <p className="text-xs text-cinnabar">{error}</p> : null}
      <Button
        type="submit"
        disabled={busy}
        className="w-full rounded-none bg-cinnabar px-5 text-primary-foreground hover:bg-cinnabar-deep"
      >
        {busy ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            正在保存
          </>
        ) : (
          <>
            {forced ? "保存新密码，进入写作台" : "保存新密码"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </Button>
    </form>
  );
}

function ChangePasswordPanel({
  forced = false,
  username,
  onDone,
}: {
  forced?: boolean;
  username: string;
  onDone: () => void;
}) {
  return (
    <div className="mx-auto mt-10 max-w-lg border border-line bg-paper-raised p-8 sm:mt-16 sm:p-10">
      {forced ? (
        <ShieldCheck className="size-8 text-cinnabar" aria-hidden="true" />
      ) : (
        <KeyRound className="size-8 text-cinnabar" aria-hidden="true" />
      )}
      <p className="mt-5 text-[10px] tracking-[0.3em] text-cinnabar">
        {forced ? "FIRST SIGN-IN" : "ACCOUNT"}
      </p>
      <h1 className="mt-2 font-serif text-3xl tracking-tight text-ink">
        {forced ? "先设置你自己的密码" : "修改密码"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        {forced
          ? `当前登录账号是 ${username}，还在使用初始密码。为了安全，请先改成只有你自己知道的密码，然后就能开始写作。`
          : `当前登录账号是 ${username}，修改后其他设备上的登录会失效。`}
      </p>
      <PasswordForm forced={forced} onDone={onDone} />
      {forced ? (
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-cinnabar"
        >
          先回博客看看
        </Link>
      ) : null}
    </div>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  return <div className="paper-grain min-h-dvh px-5 py-4 sm:px-8">{children}</div>;
}