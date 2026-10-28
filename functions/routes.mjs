// Business routes for the blog. Local development injects an in-memory database;
// the deployed entry point uses the platform-managed database client.
const PBKDF2_ITERATIONS = 210_000;
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const textEncoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

export async function makeCredential(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return { hash, salt: bytesToBase64Url(salt), iterations: PBKDF2_ITERATIONS };
}

function equalStrings(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function application({ db, BackendError }) {
  const SUMMARY =
    'id,slug,title,excerpt,tags,status,published_at,updated_at,created_at,reading_minutes';
  const ADMIN = `${SUMMARY},content,version`;
  const MAX_BODY = 256 * 1024;
  const rateWindow = new Map();

  const fail = (code, status) => {
    throw new BackendError(code, status);
  };

  const json = (body, status = 200) => {
    const headers = new Headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    return new Response(JSON.stringify(body), { status, headers });
  };

  const data = (result) => {
    if (result?.error) throw result.error;
    return Array.isArray(result?.data) ? result.data : [];
  };

  async function input(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      fail('invalid_input', 400);
    }
    const reader = request.body?.getReader();
    if (!reader) fail('invalid_input', 400);
    let size = 0;
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BODY) {
          await reader.cancel();
          fail('invalid_input', 400);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('invalid_input', 400);
      return parsed;
    } catch (error) {
      if (error instanceof BackendError) throw error;
      fail('invalid_input', 400);
    }
  }

  function clientIp(request) {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'local'
    );
  }

  function sessionToken(request) {
    // The deployment gateway forwards custom request headers but strips
    // Authorization and Cookie, so the session token travels in this header.
    const custom = request.headers.get('x-blog-token') || '';
    if (/^[A-Za-z0-9_-]{20,200}$/.test(custom)) return custom;
    const header = request.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+([A-Za-z0-9_-]{20,200})$/i);
    return match ? match[1] : '';
  }

  const ACCOUNT = 'id,username,password_hash,password_salt,iterations,must_change';

  async function accountRow() {
    const found = data(
      await db.from('admin_account').select(ACCOUNT).eq('id', 'owner').limit(1),
    );
    return found[0] ?? null;
  }

  async function accountByUsername(username) {
    const found = data(
      await db.from('admin_account').select(ACCOUNT).eq('username', username).limit(1),
    );
    return found[0] ?? null;
  }

  async function verifyPassword(account, password) {
    if (!account || typeof password !== 'string' || !password) return false;
    const iterations = Number(account.iterations);
    if (!Number.isInteger(iterations) || iterations < 1000) return false;
    const derived = await derivePassword(
      password,
      base64UrlToBytes(account.password_salt),
      iterations,
    );
    return equalStrings(derived, account.password_hash);
  }

  async function createSession(accountId) {
    const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const now = Date.now();
    const inserted = await db
      .from('admin_session')
      .insert({
        id: crypto.randomUUID(),
        token_hash: await sha256(token),
        account_id: accountId,
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + SESSION_SECONDS * 1000).toISOString(),
      })
      .select('id');
    if (inserted?.error) fail('service_unavailable', 503);
    return token;
  }

  async function currentAccount(ctx) {
    const token = sessionToken(ctx.request);
    if (!token) return null;
    const tokenHash = await sha256(token);
    const session = data(
      await db
        .from('admin_session')
        .select('id,account_id,expires_at')
        .eq('token_hash', tokenHash)
        .limit(1),
    )[0];
    if (!session) return null;
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await db.from('admin_session').delete().eq('id', session.id).select('id');
      return null;
    }
    const account = data(
      await db
        .from('admin_account')
        .select('id,username,must_change')
        .eq('id', session.account_id)
        .limit(1),
    )[0];
    if (!account) return null;
    return { account, sessionId: session.id };
  }

  async function requireAdmin(ctx) {
    const found = await currentAccount(ctx);
    if (!found) fail('login_required', 401);
    return found.account;
  }

  function text(value, max) {
    if (typeof value !== 'string') fail('invalid_input', 400);
    const result = value.trim();
    if (!result || result.length > max) fail('invalid_input', 400);
    return result;
  }

  function normalizeTags(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) fail('invalid_input', 400);
    const tags = [];
    for (const item of value) {
      if (typeof item !== 'string') fail('invalid_input', 400);
      const tag = item.trim().replace(/\s+/g, ' ');
      if (!tag || tag.length > 20) fail('invalid_input', 400);
      if (!tags.includes(tag)) tags.push(tag);
      if (tags.length > 6) fail('invalid_input', 400);
    }
    return tags;
  }

  function plainText(markdown) {
    return String(markdown)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^[ \t]*\|?[ \t:|-]+\|?[ \t]*$/gm, ' ')
      .replace(/^[ \t]*(?:[-+*]|\d+\.)[ \t]+/gm, '')
      .replace(/[#>*_~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function countWords(markdown) {
    const source = String(markdown);
    const cjk = source.match(/[\u3400-\u9fff]/g)?.length ?? 0;
    const words = source.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g)?.length ?? 0;
    return cjk + words;
  }

  function readingMinutes(content) {
    return Math.max(1, Math.round(countWords(content) / 350));
  }

  function postInput(body) {
    const title = text(body?.title, 120);
    const rawContent = body?.content;
    if (typeof rawContent !== 'string' || rawContent.length > 120000) fail('invalid_input', 400);
    const status = body?.status === 'published' ? 'published' : 'draft';
    if (status === 'published' && !rawContent.trim()) fail('invalid_input', 400);
    let excerpt = typeof body?.excerpt === 'string' ? body.excerpt.trim() : '';
    if (excerpt.length > 200) fail('invalid_input', 400);
    if (!excerpt) {
      const plain = plainText(rawContent);
      excerpt = plain.length > 140 ? `${plain.slice(0, 140)}…` : plain || title;
    }
    const rawSlug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const slug = rawSlug || `post-${Date.now().toString(36)}`;
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) fail('invalid_input', 400);
    const tags = normalizeTags(body?.tags);
    const content = rawContent;
    return {
      title,
      slug,
      excerpt,
      content,
      tags,
      status,
      search_text: `${title}\n${excerpt}\n${tags.join(' ')}\n${content}`.slice(0, 160000),
      reading_minutes: readingMinutes(content),
    };
  }

  function summary(row) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      tags: Array.isArray(row.tags) ? row.tags : [],
      status: row.status,
      published_at: row.published_at ?? null,
      updated_at: row.updated_at,
      created_at: row.created_at,
      reading_minutes: row.reading_minutes,
    };
  }

  function adminPost(row) {
    return { ...summary(row), content: row.content, version: row.version };
  }

  function link(row) {
    return row
      ? { slug: row.slug, title: row.title, published_at: row.published_at ?? null }
      : null;
  }

  function comment(row) {
    return {
      id: row.id,
      post_id: row.post_id,
      nickname: row.nickname,
      content: row.content,
      created_at: row.created_at,
    };
  }

  function snippet(content, query, fallback = '') {
    const sources = [plainText(content), plainText(fallback)];
    for (const text of sources) {
      const index = text.toLowerCase().indexOf(query.toLowerCase());
      if (index < 0) continue;
      const start = Math.max(0, index - 40);
      const end = Math.min(text.length, index + query.length + 70);
      return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
    }
    const text = sources[0];
    return text.length > 110 ? `${text.slice(0, 110)}…` : text;
  }

  function number(value, fallback, max) {
    if (value === null || value === undefined || value === '') return fallback;
    if (!/^(0|[1-9][0-9]{0,5})$/.test(value)) fail('invalid_input', 400);
    return Math.min(Number(value), max);
  }

  function isUnique(error) {
    return Boolean(error) && (error.code === '23505' || error.status === 409);
  }

  async function publishedSummaries(limit = 500) {
    return data(
      await db
        .from('posts')
        .select(SUMMARY)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit),
    );
  }

  async function publishedPostBySlug(slug) {
    const found = data(
      await db
        .from('posts')
        .select(`${SUMMARY},content`)
        .eq('slug', slug)
        .eq('status', 'published')
        .limit(1),
    );
    return found[0] ?? null;
  }

  function rateLimit(key, limit, windowMs) {
    const now = Date.now();
    const recent = (rateWindow.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
    if (recent.length >= limit) fail('rate_limited', 429);
    recent.push(now);
    rateWindow.set(key, recent);
    if (rateWindow.size > 5000) {
      for (const [entry, stamps] of rateWindow) {
        if (stamps.every((stamp) => now - stamp >= windowMs)) rateWindow.delete(entry);
      }
    }
  }

  async function route(ctx) {
    const request = ctx.request;
    const url = new URL(request.url);
    const match = url.pathname.match(
      /^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/,
    );
    if (!match) fail('not_found', 404);
    const path = match[1] || '/';
    const method = request.method;

    if (path === '/api/health' && method === 'GET') {
      return json({ ok: true, service: 'jpruby-notes' });
    }

    if (path === '/api/admin/session' && method === 'GET') {
      const account = await accountRow();
      const found = await currentAccount(ctx);
      return json({
        initialized: Boolean(account),
        authenticated: Boolean(found),
        username: found ? found.account.username : '',
        mustChangePassword: found ? Boolean(found.account.must_change) : false,
      });
    }

    if (path === '/api/admin/login' && method === 'POST') {
      const body = await input(request);
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!username || username.length > 40 || !password || password.length > 200) {
        fail('invalid_input', 400);
      }
      rateLimit(`login:${clientIp(request)}`, 12, 300_000);
      const account = await accountByUsername(username);
      if (!(await verifyPassword(account, password))) fail('invalid_credentials', 401);
      const token = await createSession(account.id);
      return json({
        authenticated: true,
        username: account.username,
        mustChangePassword: Boolean(account.must_change),
        token,
      });
    }

    if (path === '/api/admin/logout' && method === 'POST') {
      const token = sessionToken(request);
      if (token) {
        await db
          .from('admin_session')
          .delete()
          .eq('token_hash', await sha256(token))
          .select('id');
      }
      return json({ ok: true });
    }

    if (path === '/api/admin/password' && method === 'POST') {
      const account = await requireAdmin(ctx);
      const body = await input(request);
      const current = typeof body.current === 'string' ? body.current : '';
      const next = typeof body.next === 'string' ? body.next : '';
      if (next.length < 8 || next.length > 128) fail('invalid_input', 400);
      const full = data(
        await db
          .from('admin_account')
          .select('password_hash,password_salt,iterations')
          .eq('id', account.id)
          .limit(1),
      )[0];
      if (!full || !(await verifyPassword(full, current))) fail('invalid_credentials', 401);
      const credential = await makeCredential(next);
      const updated = await db
        .from('admin_account')
        .update({
          password_hash: credential.hash,
          password_salt: credential.salt,
          iterations: credential.iterations,
          must_change: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id)
        .select('id');
      if (updated?.error) fail('service_unavailable', 503);
      const cleared = await db
        .from('admin_session')
        .delete()
        .eq('account_id', account.id)
        .select('id');
      if (cleared?.error) fail('service_unavailable', 503);
      const token = await createSession(account.id);
      return json({ ok: true, token });
    }

    if (path === '/api/posts' && method === 'GET') {
      const offset = number(url.searchParams.get('offset'), 0, 10000);
      const limit = number(url.searchParams.get('limit'), 12, 24) || 12;
      const tag = (url.searchParams.get('tag') || '').trim().slice(0, 20);
      if (tag) {
        const all = await publishedSummaries(500);
        const filtered = all.filter(
          (row) => Array.isArray(row.tags) && row.tags.includes(tag),
        );
        return json({
          items: filtered.slice(offset, offset + limit).map(summary),
          hasMore: filtered.length > offset + limit,
        });
      }
      const rows = data(
        await db
          .from('posts')
          .select(SUMMARY)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + limit),
      );
      return json({
        items: rows.slice(0, limit).map(summary),
        hasMore: rows.length > limit,
      });
    }

    if (path === '/api/tags' && method === 'GET') {
      const rows = await publishedSummaries(500);
      const counts = new Map();
      for (const row of rows) {
        const tags = Array.isArray(row.tags) ? row.tags : [];
        for (const tag of tags) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
      const items = [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hans-CN'));
      return json({ items });
    }

    if (path === '/api/search' && method === 'GET') {
      const query = (url.searchParams.get('q') || '').trim();
      if (!query) return json({ items: [] });
      if (query.length > 60) fail('invalid_input', 400);
      const rows = data(
        await db
          .from('posts')
          .select(`${SUMMARY},content`)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(500),
      );
      const needle = query.toLowerCase();
      const matches = rows
        .filter((row) => {
          const tags = Array.isArray(row.tags) ? row.tags.join(' ') : '';
          return `${row.title}\n${row.excerpt}\n${tags}\n${row.content}`
            .toLowerCase()
            .includes(needle);
        })
        .slice(0, 20);
      return json({
        items: matches.map((row) => ({
          ...summary(row),
          snippet: snippet(row.content, query, row.excerpt),
        })),
      });
    }

    const commentsPath = path.match(/^\/api\/posts\/([^/]+)\/comments$/);
    if (commentsPath) {
      let slug;
      try {
        slug = decodeURIComponent(commentsPath[1]);
      } catch {
        fail('not_found', 404);
      }
      if (!slug) fail('not_found', 404);
      if (method === 'GET') {
        const post = await publishedPostBySlug(slug);
        if (!post) fail('not_found', 404);
        const items = data(
          await db
            .from('comments')
            .select('id,post_id,nickname,content,created_at')
            .eq('post_id', post.id)
            .order('created_at', { ascending: true })
            .limit(300),
        );
        return json({ items: items.map(comment) });
      }
      if (method === 'POST') {
        const body = await input(request);
        if (typeof body.website === 'string' && body.website.trim()) {
          fail('invalid_input', 400);
        }
        const post = await publishedPostBySlug(slug);
        if (!post) fail('not_found', 404);
        const nickname = text(body.nickname, 24);
        const content = text(body.content, 800);
        rateLimit(`comment:${clientIp(request)}`, 8, 60_000);
        const row = {
          id: crypto.randomUUID(),
          post_id: post.id,
          nickname,
          content,
          created_at: new Date().toISOString(),
        };
        const inserted = await db
          .from('comments')
          .insert(row)
          .select('id,post_id,nickname,content,created_at');
        if (inserted?.error) fail('service_unavailable', 503);
        const created = data(inserted)[0];
        if (!created) fail('service_unavailable', 503);
        return json({ comment: comment(created) }, 201);
      }
      fail('not_found', 404);
    }

    const postPath = path.match(/^\/api\/posts\/([^/]+)$/);
    if (postPath && method === 'GET') {
      let slug;
      try {
        slug = decodeURIComponent(postPath[1]);
      } catch {
        fail('not_found', 404);
      }
      const post = slug ? await publishedPostBySlug(slug) : null;
      if (!post) fail('not_found', 404);
      const all = await publishedSummaries(500);
      const index = all.findIndex((row) => row.id === post.id);
      return json({
        post: {
          ...summary(post),
          content: post.content,
          prev: index >= 0 ? link(all[index + 1]) : null,
          next: index > 0 ? link(all[index - 1]) : null,
        },
      });
    }

    if (path === '/api/admin/posts' && method === 'GET') {
      await requireAdmin(ctx);
      const rows = data(
        await db
          .from('posts')
          .select(SUMMARY)
          .order('updated_at', { ascending: false })
          .limit(200),
      );
      return json({ items: rows.map(summary) });
    }

    if (path === '/api/admin/posts' && method === 'POST') {
      await requireAdmin(ctx);
      const payload = postInput(await input(request));
      const now = new Date().toISOString();
      const row = {
        id: crypto.randomUUID(),
        ...payload,
        status: payload.status,
        version: 1,
        created_at: now,
        updated_at: now,
        published_at: payload.status === 'published' ? now : null,
      };
      const inserted = await db.from('posts').insert(row).select(ADMIN);
      if (inserted?.error) {
        if (isUnique(inserted.error)) fail('slug_taken', 409);
        fail('service_unavailable', 503);
      }
      const created = data(inserted)[0];
      if (!created) fail('service_unavailable', 503);
      return json({ post: adminPost(created) }, 201);
    }

    const adminPostPath = path.match(/^\/api\/admin\/posts\/([0-9a-f-]{36})$/);
    if (adminPostPath) {
      const id = adminPostPath[1];
      if (method === 'GET') {
        await requireAdmin(ctx);
        const found = data(
          await db.from('posts').select(ADMIN).eq('id', id).limit(1),
        );
        if (!found.length) fail('not_found', 404);
        return json({ post: adminPost(found[0]) });
      }
      if (method === 'PATCH') {
        await requireAdmin(ctx);
        const body = await input(request);
        if (
          !Number.isInteger(body.version) ||
          body.version < 1 ||
          body.version >= 2147483647
        ) {
          fail('invalid_input', 400);
        }
        const existing = data(
          await db
            .from('posts')
            .select('id,status,published_at,version')
            .eq('id', id)
            .limit(1),
        )[0];
        if (!existing) fail('not_found', 404);
        if (existing.version !== body.version) fail('write_conflict', 409);
        const payload = postInput(body);
        const now = new Date().toISOString();
        const patch = {
          ...payload,
          version: existing.version + 1,
          updated_at: now,
          published_at:
            payload.status === 'published' ? existing.published_at ?? now : null,
        };
        const updatedResult = await db
          .from('posts')
          .update(patch)
          .eq('id', id)
          .eq('version', existing.version)
          .select(ADMIN);
        if (updatedResult?.error) {
          if (isUnique(updatedResult.error)) fail('slug_taken', 409);
          fail('service_unavailable', 503);
        }
        const updated = data(updatedResult)[0];
        if (!updated) fail('write_conflict', 409);
        return json({ post: adminPost(updated) });
      }
      if (method === 'DELETE') {
        await requireAdmin(ctx);
        const existing = data(
          await db.from('posts').select('id').eq('id', id).limit(1),
        );
        if (!existing.length) fail('not_found', 404);
        const cleaned = await db.from('comments').delete().eq('post_id', id).select('id');
        if (cleaned?.error) fail('service_unavailable', 503);
        const removed = await db.from('posts').delete().eq('id', id).select('id');
        if (removed?.error) fail('service_unavailable', 503);
        if (!data(removed).length) fail('not_found', 404);
        return json({ ok: true });
      }
      fail('not_found', 404);
    }

    if (path === '/api/admin/comments' && method === 'GET') {
      await requireAdmin(ctx);
      const rows = data(
        await db
          .from('comments')
          .select('id,post_id,nickname,content,created_at')
          .order('created_at', { ascending: false })
          .limit(500),
      );
      return json({ items: rows.map(comment) });
    }

    const adminCommentPath = path.match(/^\/api\/admin\/comments\/([0-9a-f-]{36})$/);
    if (adminCommentPath && method === 'DELETE') {
      await requireAdmin(ctx);
      const removed = await db
        .from('comments')
        .delete()
        .eq('id', adminCommentPath[1])
        .select('id');
      if (removed?.error) fail('service_unavailable', 503);
      if (!data(removed).length) fail('not_found', 404);
      return json({ ok: true });
    }

    fail('not_found', 404);
  }

  return async (ctx) => {
    try {
      return await route(ctx);
    } catch (error) {
      if (error instanceof BackendError) throw error;
      throw new BackendError('service_unavailable', 503);
    }
  };
}
