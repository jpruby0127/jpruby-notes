import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const components: Components = {
  a({ children, ...props }) {
    return (
      <a {...props} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
  img({ alt, ...props }) {
    return <img {...props} alt={alt ?? ""} loading="lazy" decoding="async" />;
  },
};

export function Markdown({ content, className }: { content: string; className?: string }) {
  if (!content.trim()) {
    return (
      <p className={cn("text-sm text-ink-faint", className)}>
        正文还是空的。切换到编辑模式，写下第一段文字。
      </p>
    );
  }

  return (
    <div className={cn("prose-editorial", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
