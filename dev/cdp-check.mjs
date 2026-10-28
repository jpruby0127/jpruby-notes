// Local UI verification with headless Chrome over CDP. Never deployed.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9444;
const BASE = 'http://127.0.0.1:5173';
const OUT = new URL('./shots/', import.meta.url).pathname;
const profile = mkdtempSync(join(tmpdir(), 'blog-cdp-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let ws;
let nextId = 1;
const pending = new Map();

async function waitForChrome() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const info = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json());
      if (info.webSocketDebuggerUrl) return info;
    } catch {
      // not ready yet
    }
    await sleep(150);
  }
  throw new Error('Chrome CDP did not start');
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'evaluate failed');
  }
  return result.result.value;
}

async function waitFor(expression, label, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  const text = await evaluate('document.body.innerText.slice(0, 500)');
  throw new Error(`Timed out waiting for ${label}\n--- page ---\n${text}`);
}

async function goto(path) {
  await send('Page.navigate', { url: `${BASE}${path}` });
  await sleep(400);
  await waitFor("document.readyState === 'complete'", `load ${path}`);
}

async function clickText(text) {
  const ok = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll('button, a, [role="button"]')];
    const target = nodes.find((node) => node.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!ok) throw new Error(`Click target not found: ${text}`);
}

async function clickSelector(selector) {
  const ok = await evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!ok) throw new Error(`Click target not found: ${selector}`);
}

async function fill(selector, value) {
  const ok = await evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return false;
    const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(target, ${JSON.stringify(value)});
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`Fill target not found: ${selector}`);
}

async function screenshot(name, { full = true } = {}) {
  let params = { format: 'png' };
  if (full) {
    const metrics = await send('Page.getLayoutMetrics');
    const content = metrics.cssContentSize;
    params = {
      format: 'png',
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: Math.ceil(content.width),
        height: Math.min(Math.ceil(content.height), 5000),
        scale: 1,
      },
    };
  }
  const shot = await send('Page.captureScreenshot', params);
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
  console.log(`  screenshot ${name}.png`);
}

async function step(name, fn) {
  process.stdout.write(`• ${name} … `);
  await fn();
  console.log('ok');
}

async function viewport(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

try {
  const info = await waitForChrome();
  const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {
    method: 'PUT',
  }).then((r) => r.json());
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await viewport(1440, 900);

  await step('首页（桌面）', async () => {
    await goto('/');
    await waitFor("document.body.innerText.includes('文章索引')", 'home index');
    const overflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth + 1');
    if (overflow) throw new Error('horizontal overflow on desktop home');
    await screenshot('check-home');
  });

  await step('导航登录入口', async () => {
    const label = await evaluate(`(() => {
      const link = document.querySelector('nav[aria-label="主导航"] a[href="/admin"]');
      return link ? link.textContent.replace(/\\s+/g, ' ').trim() : '';
    })()`);
    if (label !== '登录') throw new Error(`login entry not found: ${JSON.stringify(label)}`);
    await clickSelector('nav[aria-label="主导航"] a[href="/admin"]');
    await waitFor("location.pathname.startsWith('/admin')", 'admin route');
    await waitFor(
      "document.body.innerText.includes('新建文章') || document.querySelector('#admin-username')",
      'admin view',
    );
    await screenshot('check-header-login', { full: false });
    await goto('/');
  });

  await step('全文搜索', async () => {
    await clickSelector('button[aria-label="搜索文章"]');
    await waitFor("document.querySelector('[role=\"dialog\"]')", 'search dialog');
    await fill('[role="dialog"] input', '书房');
    await waitFor(
      "document.querySelector('[role=\"dialog\"]')?.innerText.includes('用 React 与 Markdown 搭一间自己的书房')",
      'search result',
    );
    await screenshot('check-search', { full: false });
    await clickSelector('[role="dialog"] button[data-slot="dialog-close"]');
    await waitFor("!document.querySelector('[role=\"dialog\"]')", 'dialog closed');
  });

  await step('标签筛选', async () => {
    const clicked = await evaluate(`(() => {
      const aside = document.querySelector('[role="complementary"], aside');
      const link = aside && [...aside.querySelectorAll('a')].find((node) => node.textContent.trim() === '写作');
      if (!link) return false;
      link.click();
      return true;
    })()`);
    if (!clicked) throw new Error('tag link not found');
    await waitFor('location.search.includes("tag=")', 'tag url');
    await waitFor("document.body.innerText.includes('把博客当成一件长期作品')", 'tag result');
    await screenshot('check-tag');
  });

  await step('文章详情与留言', async () => {
    await goto('/posts/a-seam-between-code-and-life');
    await waitFor("document.querySelector('h1')?.textContent.includes('在代码与生活之间')", 'post title');
    await waitFor("document.body.innerText.includes('留言')", 'comment section');
    await fill('input[placeholder="怎么称呼你？"]', '本地读者');
    await fill('textarea[placeholder="写下你的想法…"]', '验证一下留言能否实时保存。');
    await clickText('发布留言');
    await waitFor("document.body.innerText.includes('留言已经贴上去了。')", 'comment toast');
    await waitFor("document.body.innerText.includes('本地读者')", 'comment rendered');
    await screenshot('check-post');
  });

  await step('账号密码登录', async () => {
    await goto('/admin');
    await waitFor("document.querySelector('#admin-username')", 'login form');
    await fill('#admin-username', 'jpruby');
    await fill('#admin-password', 'local-dev-2026');
    await clickText('登录');
    await waitFor("document.querySelector('#admin-new-password')", 'forced password change');
    await screenshot('check-login-force-change', { full: false });
    await fill('#admin-current-password', 'local-dev-2026');
    await fill('#admin-new-password', 'local-dev-2026-new');
    await fill('#admin-confirm-password', 'local-dev-2026-new');
    await clickText('保存新密码，进入写作台');
    await waitFor("document.body.innerText.includes('新建文章')", 'admin posts');
    await screenshot('check-admin');
  });

  await step('设置页改密与退出', async () => {
    await goto('/admin/settings');
    await waitFor("document.body.innerText.includes('修改密码')", 'settings page');
    await fill('#admin-current-password', 'local-dev-2026-new');
    await fill('#admin-new-password', 'local-dev-2026-final');
    await fill('#admin-confirm-password', 'local-dev-2026-final');
    await clickText('保存新密码');
    await waitFor("document.body.innerText.includes('密码已更新。')", 'password updated');
    await screenshot('check-settings', { full: false });
    await clickText('退出登录');
    await waitFor("document.querySelector('#admin-username')", 'login form after logout');
    await fill('#admin-username', 'jpruby');
    await fill('#admin-password', 'local-dev-2026-final');
    await clickText('登录');
    await waitFor("document.querySelector('nav[aria-label=\"工作台导航\"]')", 'logged back in');
  });

  let slug = '';
  await step('新建并发布文章', async () => {
    await goto('/admin');
    await waitFor("document.body.innerText.includes('新建文章')", 'posts page');
    await clickText('新建文章');
    await waitFor("document.querySelector('input[aria-label=\"文章标题\"]')", 'editor');
    await fill('input[aria-label="文章标题"]', '在本地验证一篇新文章');
    await fill(
      'textarea[aria-label="文章正文"]',
      '## 验证清单\n\n- 写作台可以保存草稿\n- 发布后进入全文搜索\n\n> 这是本地示例数据，不会上传到云端。',
    );
    await fill('input[aria-label="文章标签"]', '验证, 本地');
    await screenshot('check-editor');
    await clickText('保存草稿');
    await waitFor("location.pathname.includes('/edit')", 'edit route');
    await waitFor("document.body.innerText.includes('草稿已保存。')", 'draft toast');
    await waitFor("document.body.innerText.includes('最后保存')", 'edit page loaded');
    await waitFor(
      "document.querySelector('input[aria-label=\"文章链接地址\"]')?.value.length > 0",
      'saved slug',
    );
    slug = await evaluate('document.querySelector(\'input[aria-label="文章链接地址"]\').value');
    if (!/^post-/.test(slug)) throw new Error(`unexpected fallback slug: ${slug}`);
    const publishTab = await evaluate(`(() => {
      const target = [...document.querySelectorAll('[aria-label="文章状态"] button')]
        .find((node) => node.textContent.trim() === '发布');
      if (!target) return false;
      target.click();
      return true;
    })()`);
    if (!publishTab) throw new Error('publish toggle not found');
    await clickText('发布文章');
    await waitFor("document.body.innerText.includes('已保存，文章处于发布状态。')", 'publish toast');
    await screenshot('check-editor-published', { full: false });
  });

  await step('发布后出现在首页与详情', async () => {
    await goto('/');
    await waitFor("document.body.innerText.includes('在本地验证一篇新文章')", 'new post on home');
    await goto(`/posts/${slug}`);
    await waitFor("document.querySelector('h1')?.textContent.includes('在本地验证一篇新文章')", 'new post page');
    await waitFor("document.querySelector('.prose-editorial')", 'markdown body');
  });

  await step('搜索新文章', async () => {
    await goto('/');
    await clickSelector('button[aria-label="搜索文章"]');
    await waitFor("document.querySelector('[role=\"dialog\"]')", 'search dialog');
    await fill('[role="dialog"] input', '验证清单');
    await waitFor(
      "document.querySelector('[role=\"dialog\"]')?.innerText.includes('在本地验证一篇新文章')",
      'new post search hit',
    );
    await screenshot('check-search-new', { full: false });
    await clickSelector('[role="dialog"] button[data-slot="dialog-close"]');
  });

  await step('留言管理', async () => {
    await goto('/admin/comments');
    await waitFor("document.body.innerText.includes('本地读者')", 'admin comments');
    await screenshot('check-admin-comments');
  });

  await step('移动端首页与文章', async () => {
    await viewport(390, 844, true);
    await goto('/');
    await waitFor("document.body.innerText.includes('文章索引')", 'mobile home');
    const overflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth + 1');
    if (overflow) {
      const culprit = await evaluate(`(() => {
        const width = window.innerWidth;
        return [...document.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > width + 1)
          .slice(0, 8)
          .map((el) => el.tagName + '.' + (el.className || '').toString().slice(0, 80) + ' @' + Math.round(el.getBoundingClientRect().right));
      })()`);
      throw new Error(`horizontal overflow on mobile home: ${JSON.stringify(culprit)}`);
    }
    await screenshot('check-home-mobile');
    await goto('/posts/blog-as-a-long-term-work');
    await waitFor("document.querySelector('h1')", 'mobile post');
    const postOverflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth + 1');
    if (postOverflow) throw new Error('horizontal overflow on mobile post');
    await screenshot('check-post-mobile');
    await viewport(1440, 900);
  });

  console.log('\nAll UI checks passed.');
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {
    // ignore
  }
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
