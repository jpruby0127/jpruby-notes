import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, PenLine, Server, Type } from "lucide-react";

import { useDocumentTitle } from "@/hooks/use-document-title";

export function AboutPage() {
  useDocumentTitle("关于");

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-12 sm:px-8 sm:py-16">
      <header className="border-b border-line pb-10">
        <p className="flex items-center gap-3 text-[10px] tracking-[0.38em] text-cinnabar">
          <span aria-hidden="true" className="h-px w-8 bg-cinnabar" />
          ABOUT THIS NOTEBOOK
        </p>
        <h1 className="mt-4 font-serif text-[clamp(2.4rem,6vw,4rem)] leading-tight tracking-[-0.035em] text-ink">
          关于这本手记
        </h1>
        <p className="mt-5 max-w-2xl font-serif text-base leading-[1.9] text-ink-soft sm:text-lg">
          「jpruby 手记」是一个开发者的长期写作现场。它不追热点，也不承诺更新频率，
          只把那些值得写清楚的事，慢慢写下来。
        </p>
      </header>

      <div className="mt-10 grid gap-10 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-12">
        <div className="flex items-start gap-4 md:flex-col md:items-start">
          <span className="seal size-16 text-2xl" aria-hidden="true">
            记
          </span>
          <div>
            <p className="font-serif text-xl text-ink">jpruby</p>
            <p className="mt-1 text-[11px] tracking-wide text-ink-faint">全栈开发者 / 写作者</p>
          </div>
        </div>

        <div className="space-y-10">
          <section>
            <SectionTitle index="01" icon={<PenLine className="size-3.5" />} title="写什么" />
            <p className="mt-3 text-sm leading-[1.95] text-ink-soft sm:text-base">
              主要是三类内容：技术笔记、产品思考和生活切片。技术笔记会尽量交代上下文，
              不只贴结论；产品思考关注一个人做产品时的判断与取舍；生活切片则是那些不适合
              放进工作文档里的部分。
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft">
              <li className="flex gap-3">
                <span className="mt-2 size-1 shrink-0 bg-cinnabar" aria-hidden="true" />
                写代码时踩过的坑，以及后来如何绕过它。
              </li>
              <li className="flex gap-3">
                <span className="mt-2 size-1 shrink-0 bg-cinnabar" aria-hidden="true" />
                做完一个产品之后，真正留下来的判断。
              </li>
              <li className="flex gap-3">
                <span className="mt-2 size-1 shrink-0 bg-cinnabar" aria-hidden="true" />
                读书、行走、整理房间，以及缓慢发生的生活。
              </li>
            </ul>
          </section>

          <section>
            <SectionTitle index="02" icon={<Server className="size-3.5" />} title="这个站点" />
            <p className="mt-3 text-sm leading-[1.95] text-ink-soft sm:text-base">
              站点使用 React 与 Markdown 搭建：文章在浏览器里的写作台完成，发布后保存到
              数据库；评论也直接写入同一个数据库，没有依赖第三方评论插件。全文搜索由
              服务端完成，中文可以直接按关键词检索。
            </p>
            <div className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-3">
              {[
                ["写作", "Markdown 编辑器 + 实时预览"],
                ["存储", "文章与评论存于站点数据库"],
                ["搜索", "标题、标签、正文全文检索"],
              ].map(([label, value]) => (
                <div key={label} className="bg-paper-raised p-4">
                  <p className="text-[10px] tracking-[0.25em] text-ink-faint">{label}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle index="03" icon={<MessageCircle className="size-3.5" />} title="联系" />
            <p className="mt-3 text-sm leading-[1.95] text-ink-soft sm:text-base">
              最直接的方式是在任意一篇文章下面留言。留言会公开显示，站长看到后会回复。
              如果是需要私下沟通的事，也请先在留言里说明，我会留下进一步的联系方式。
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-cinnabar transition-opacity hover:opacity-75"
            >
              去文章列表
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>

          <section>
            <SectionTitle index="04" icon={<Type className="size-3.5" />} title="一点坚持" />
            <blockquote className="border-l-2 border-cinnabar bg-paper-raised/70 px-5 py-4 font-serif text-base leading-[1.9] text-ink-soft">
              写作不是为了证明自己知道，而是为了发现自己到底在想什么。
            </blockquote>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  index,
  icon,
  title,
}: {
  index: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <h2 className="flex items-center gap-2 border-b border-line pb-2 font-serif text-xl tracking-tight text-ink">
      <span className="font-mono text-[10px] tracking-widest text-cinnabar">{index}</span>
      <span className="text-ink-faint" aria-hidden="true">
        {icon}
      </span>
      {title}
    </h2>
  );
}
