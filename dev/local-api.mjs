// Local-only fixture backend. Never published: it lives outside functions/ and dist/.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { application, makeCredential } from '../functions/routes.mjs';

const LOCAL_ADMIN = { username: 'jpruby', password: 'local-dev-2026' };

class LocalError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function plain(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function minutes(markdown) {
  const cjk = markdown.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const words = markdown.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  return Math.max(1, Math.round((cjk + words) / 350));
}

function createMemoryDb() {
  const tables = { posts: [], comments: [], blog_owner: [], admin_account: [], admin_session: [] };

  function builder(table) {
    if (!(table in tables)) throw new LocalError('service_unavailable', 503);
    const rows = tables[table];
    const filters = [];
    const orders = [];
    let selected = null;
    let mode = 'select';
    let payload = null;
    let conflictKeys = null;
    let limitCount = null;
    let range = null;

    function pick(row) {
      if (!selected || selected === '*') return structuredClone(row);
      return Object.fromEntries(
        selected.split(',').map((column) => [column.trim(), structuredClone(row[column.trim()])]),
      );
    }

    function sameRow(a, b) {
      return a.id === b.id;
    }

    function run() {
      if (mode === 'insert' || mode === 'insertIfAbsent') {
        const keys = conflictKeys?.length
          ? conflictKeys
          : table === 'posts'
            ? ['slug']
            : ['id'];
        if (
          mode === 'insertIfAbsent' &&
          rows.some((row) => keys.every((key) => row[key] === payload[key]))
        ) {
          return { data: [], error: null };
        }
        if (table === 'posts' && rows.some((row) => row.slug === payload.slug)) {
          return { data: null, error: { code: '23505', status: 409 } };
        }
        if (rows.some((row) => row.id === payload.id)) {
          return { data: null, error: { code: '23505', status: 409 } };
        }
        const row = structuredClone(payload);
        rows.push(row);
        return { data: [pick(row)], error: null };
      }

      let matched = rows.filter((row) => filters.every(([key, value]) => row[key] === value));

      if (mode === 'update') {
        if (table === 'posts' && payload.slug) {
          const clash = rows.some(
            (row) => row.slug === payload.slug && !matched.some((hit) => sameRow(hit, row)),
          );
          if (clash) return { data: null, error: { code: '23505', status: 409 } };
        }
        for (const row of matched) Object.assign(row, structuredClone(payload));
      }

      if (mode === 'delete') {
        for (const row of matched) {
          const index = rows.indexOf(row);
          if (index >= 0) rows.splice(index, 1);
        }
      }

      let result = matched;
      for (const [key, ascending] of [...orders].reverse()) {
        result = [...result].sort((a, b) => {
          const left = a[key] ?? '';
          const right = b[key] ?? '';
          if (left === right) return 0;
          return (left < right ? -1 : 1) * (ascending ? 1 : -1);
        });
      }

      if (mode === 'select') {
        if (range) {
          result = result.slice(range[0], range[1] + 1);
        } else if (limitCount !== null) {
          result = result.slice(0, limitCount);
        }
      } else if (mode === 'delete') {
        result = matched;
      }

      return { data: result.map(pick), error: null };
    }

    const query = {
      select(columns) {
        selected = columns || '*';
        return query;
      },
      eq(key, value) {
        filters.push([key, value]);
        return query;
      },
      order(key, options = {}) {
        orders.push([key, options.ascending !== false]);
        return query;
      },
      limit(value) {
        limitCount = value;
        return query;
      },
      range(from, to) {
        range = [from, to];
        return query;
      },
      insert(row) {
        mode = 'insert';
        payload = row;
        return query;
      },
      insertIfAbsent(row, options) {
        mode = 'insertIfAbsent';
        payload = row;
        conflictKeys = options?.onConflict?.split(',').filter(Boolean) ?? null;
        return query;
      },
      update(row) {
        mode = 'update';
        payload = row;
        return query;
      },
      delete() {
        mode = 'delete';
        return query;
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(run)
          .then(resolve, reject);
      },
    };

    return query;
  }

  return {
    from(table) {
      return builder(table);
    },
    tables,
  };
}

async function seed(db) {
  const now = Date.now();
  const iso = (daysAgo) => new Date(now - daysAgo * 86_400_000).toISOString();

  const entries = [
    {
      slug: 'blog-as-a-long-term-work',
      title: '把博客当成一件长期作品',
      excerpt: '与其追着热点写，不如把这里当成一间慢慢装修的书房：每一篇都是一次整理，也是留给未来自己的注脚。',
      tags: ['写作', '产品'],
      days: 1,
      content: `## 为什么重新开一个博客

信息流让人习惯“刷过就算读过”。我想留下一些可以反复读、也可以继续改的东西，于是又搭起了这个站点。

> 写作不是把想法倒出来，而是把它想清楚。

## 先做小，再做久

这个博客只有三个目标：

- 能安静地读完一篇文章
- 读者可以留下几句话
- 我自己愿意一直写下去

技术只是托底，不是主题。真正难的是在某个普通的晚上，仍然愿意打开编辑器。

## 一点具体的坚持

每周至少写一篇，哪怕只有三百字。发布前读一遍，删掉所有只是为了显得聪明的句子。

\`\`\`js
const habit = {
  cadence: 'weekly',
  minimum: 300,
  audience: '未来的自己',
};
\`\`\`

如果哪天写不动了，就回到这句话：完成比完美重要，持续比完成更重要。`,
    },
    {
      slug: 'a-seam-between-code-and-life',
      title: '在代码与生活之间，留一条缝',
      excerpt: '工程思维帮我把事情拆开，生活却提醒我，不是所有问题都需要被优化。',
      tags: ['生活', '随笔'],
      days: 4,
      content: `## 两套时钟

写代码时，我习惯了以分钟为单位衡量进展；而做饭、散步、和朋友聊天，有另一套时钟。

以前我总想把生活也“优化”一下：路线最短、效率最高、信息密度最大。后来发现，那些看起来浪费的时间，恰恰构成了生活的质地。

## 留一条缝

- 不把周末排满
- 允许一段代码暂时不够优雅
- 允许自己一天什么都不产出

> 好的系统需要余量，好的生活也是。

这不是躺平，而是承认人的节奏本来就有起伏。`,
    },
    {
      slug: 'a-study-built-with-react-and-markdown',
      title: '用 React 与 Markdown 搭一间自己的书房',
      excerpt: '从排版、配色到留言和搜索，记录这个博客背后的几个选择。',
      tags: ['代码', '产品'],
      days: 9,
      content: `## 三个技术选择

做这个博客时，我给自己定了三条规则：内容归自己、页面要快、写作要顺手。

| 部分 | 选择 | 原因 |
| --- | --- | --- |
| 前端 | React + Vite | 熟悉，迭代快 |
| 正文 | Markdown | 纯文本，不怕平台消失 |
| 数据 | 平台数据库 | 免运维，够用 |

## 关于排版

正文用了衬线字体，行高比常见的网页更松一些。长时间阅读时，密度低一点反而更舒服。

\`\`\`css
.prose-editorial {
  font-size: 1.0625rem;
  line-height: 1.95;
}
\`\`\`

## 搜索与留言

搜索在服务端完成，中文按子串匹配；留言不需要登录。技术细节不重要，重要的是它们都不打断阅读。`,
    },
    {
      slug: 'notes-on-zen-and-the-art-of-motorcycle-maintenance',
      title: '读《禅与摩托车维修艺术》',
      excerpt: '一本关于摩托车、旅行和“良质”的书，意外地适合在写代码的间隙重读。',
      tags: ['阅读'],
      days: 21,
      content: `## 旅行与修理

书里的公路旅行像一条缓慢展开的线，真正的主题却藏在一次次修理摩托车的细节里。

> 良质不是一种客观属性，也不是纯粹的主观感受，而是主客体相遇时发生的事。

## 和写代码的关系

当我把注意力真正放在手上的问题时，时间会变得不同。不是“完成这个任务”，而是“把这件事做好”。

- 先理解，再动手
- 小步验证，别一次改太多
- 保留一点对细节的耐心

这本书我读得很慢，可能还会再读一次。`,
    },
  ];

  for (const entry of entries) {
    const createdAt = iso(entry.days + 1);
    const publishedAt = iso(entry.days);
    db.tables.posts.push({
      id: randomUUID(),
      slug: entry.slug,
      title: entry.title,
      excerpt: entry.excerpt,
      content: entry.content,
      search_text: `${entry.title}\n${entry.excerpt}\n${entry.tags.join(' ')}\n${entry.content}`,
      tags: entry.tags,
      status: 'published',
      version: 1,
      reading_minutes: minutes(entry.content),
      published_at: publishedAt,
      created_at: createdAt,
      updated_at: publishedAt,
    });
  }

  db.tables.posts.push({
    id: randomUUID(),
    slug: 'three-ideas-for-the-next-chapter',
    title: '关于下一阶段的三个想法',
    excerpt: '还在草稿箱里。',
    content: `## 想法一

把博客的更新节奏固定下来。

## 想法二

整理一份自己的工具清单。

## 想法三

写一组关于小产品的复盘。`,
    search_text: '关于下一阶段的三个想法 还在草稿箱里',
    tags: ['随笔'],
    status: 'draft',
    version: 2,
    reading_minutes: 1,
    published_at: null,
    created_at: iso(2),
    updated_at: iso(0.2),
  });

  const first = db.tables.posts.find((post) => post.slug === 'blog-as-a-long-term-work');
  const second = db.tables.posts.find((post) => post.slug === 'a-seam-between-code-and-life');
  const third = db.tables.posts.find((post) => post.slug === 'a-study-built-with-react-and-markdown');

  const comments = [
    { post: first, nickname: '陈默', body: '很喜欢这篇，尤其是关于长期主义的段落。写作确实不是一次性的展示。', days: 0.6 },
    { post: first, nickname: 'Lin', body: '同感。我的博客也停更过两年，重新开始时反而更轻松了。', days: 0.3 },
    { post: second, nickname: '阿吉', body: '“好的系统需要余量，好的生活也是。” 这句话记下了。', days: 2 },
    { post: third, nickname: '小满', body: '排版看着很舒服，期待看到更多关于小产品的记录。', days: 5 },
  ];

  for (const item of comments) {
    db.tables.comments.push({
      id: randomUUID(),
      post_id: item.post.id,
      nickname: item.nickname,
      content: item.body,
      created_at: iso(item.days),
    });
  }

  const credential = await makeCredential(LOCAL_ADMIN.password);
  db.tables.admin_account.push({
    id: 'owner',
    username: LOCAL_ADMIN.username,
    password_hash: credential.hash,
    password_salt: credential.salt,
    iterations: credential.iterations,
    must_change: true,
    created_at: iso(0),
    updated_at: iso(0),
  });
}

const db = createMemoryDb();
await seed(db);

const handle = application({ db, BackendError: LocalError });

const port = Number(process.env.LOCAL_API_PORT || 8000);

const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host || `127.0.0.1:${port}`;
    const url = new URL(incoming.url || '/', `http://${host}`);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      throw new LocalError('invalid_host', 403);
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 400_000) throw new LocalError('invalid_input', 400);
      chunks.push(chunk);
    }

    const method = incoming.method || 'GET';
    const request = new Request(url, {
      method,
      headers: incoming.headers,
      ...(['GET', 'HEAD'].includes(method) ? {} : { body: Buffer.concat(chunks) }),
    });

    let response;
    try {
      response = await handle({ request });
    } catch (error) {
      const status = error instanceof LocalError ? error.status : 503;
      const code = error instanceof LocalError ? error.code : 'service_unavailable';
      response = Response.json({ error: code }, { status });
    }

    outgoing.writeHead(response.status, {
      ...Object.fromEntries(response.headers),
      'cache-control': 'no-store',
    });
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    const status = error instanceof LocalError ? error.status : 500;
    const code = error instanceof LocalError ? error.code : 'local_failure';
    outgoing.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    outgoing.end(JSON.stringify({ error: code }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local blog API: http://127.0.0.1:${port}/functions/v1/app/api/health`);
  console.log(
    `In-memory sample data. Admin login: ${LOCAL_ADMIN.username} / ${LOCAL_ADMIN.password}`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
