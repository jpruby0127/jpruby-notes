import type {
  AdminPost,
  AdminSession,
  CommentInput,
  PostComment,
  PostDetail,
  PostInput,
  PostSummary,
  SearchResult,
  TagCount,
} from "./types";

const BASE = "/functions/v1/app";
const TOKEN_KEY = "jpruby_notes_admin_token";
let memoryToken = "";

function storedToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
}

function storeToken(token: unknown): void {
  if (typeof token !== "string" || !token) return;
  memoryToken = token;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage may be unavailable; the in-memory token covers this tab
  }
}

function clearToken(): void {
  memoryToken = "";
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 0) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  let response: Response;
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const token = storedToken();
  if (token) headers["x-blog-token"] = token;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: Object.keys(headers).length ? headers : undefined,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal ?? AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("network_error", 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("invalid_response", response.status);
  }

  if (!response.ok) {
    const code =
      isRecord(payload) && typeof payload.error === "string" ? payload.error : "request_failed";
    throw new ApiError(code, response.status);
  }

  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalid(): never {
  throw new ApiError("invalid_response", 0);
}

function isSummary(value: unknown): value is PostSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.excerpt === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    (value.status === "draft" || value.status === "published") &&
    typeof value.updated_at === "string" &&
    typeof value.created_at === "string" &&
    typeof value.reading_minutes === "number" &&
    (value.published_at === null || typeof value.published_at === "string")
  );
}

function summaryList(value: unknown): PostSummary[] {
  if (!Array.isArray(value) || !value.every(isSummary)) invalid();
  return value;
}

function detail(value: unknown): PostDetail {
  if (!isSummary(value)) invalid();
  const row = value as unknown as Record<string, unknown>;
  if (typeof row.content !== "string") invalid();
  return {
    ...value,
    content: row.content,
    prev: isLink(row.prev) ? row.prev : null,
    next: isLink(row.next) ? row.next : null,
  };
}

function isLink(value: unknown): value is PostDetail["prev"] {
  return (
    isRecord(value) &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    (value.published_at === null || typeof value.published_at === "string")
  );
}

function adminPost(value: unknown): AdminPost {
  if (!isSummary(value)) invalid();
  const row = value as unknown as Record<string, unknown>;
  if (typeof row.content !== "string" || !Number.isInteger(row.version)) invalid();
  return { ...value, content: row.content, version: Number(row.version) };
}

function commentList(value: unknown): PostComment[] {
  if (!Array.isArray(value) || !value.every(isComment)) invalid();
  return value;
}

function isComment(value: unknown): value is PostComment {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.post_id === "string" &&
    typeof value.nickname === "string" &&
    typeof value.content === "string" &&
    typeof value.created_at === "string"
  );
}

export async function fetchPosts(params: {
  tag?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<{ items: PostSummary[]; hasMore: boolean }> {
  const search = new URLSearchParams();
  if (params.tag) search.set("tag", params.tag);
  search.set("offset", String(params.offset ?? 0));
  search.set("limit", String(params.limit ?? 12));
  const data = await request(`/api/posts?${search.toString()}`, { signal: params.signal });
  if (!isRecord(data) || !Array.isArray(data.items) || typeof data.hasMore !== "boolean") invalid();
  return { items: summaryList(data.items), hasMore: data.hasMore };
}

export async function fetchPost(slug: string, signal?: AbortSignal): Promise<PostDetail> {
  const data = await request(`/api/posts/${encodeURIComponent(slug)}`, { signal });
  if (!isRecord(data)) invalid();
  return detail(data.post);
}

export async function fetchTags(signal?: AbortSignal): Promise<TagCount[]> {
  const data = await request("/api/tags", { signal });
  if (!isRecord(data) || !Array.isArray(data.items)) invalid();
  const items = data.items;
  if (!items.every((row) => isRecord(row) && typeof row.tag === "string" && typeof row.count === "number")) {
    invalid();
  }
  return items as TagCount[];
}

export async function searchPosts(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const data = await request(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!isRecord(data) || !Array.isArray(data.items)) invalid();
  return data.items.map((row) => {
    if (!isSummary(row)) invalid();
    const record = row as unknown as Record<string, unknown>;
    if (typeof record.snippet !== "string") invalid();
    return { ...row, snippet: record.snippet };
  });
}

export async function fetchComments(slug: string, signal?: AbortSignal): Promise<PostComment[]> {
  const data = await request(`/api/posts/${encodeURIComponent(slug)}/comments`, { signal });
  if (!isRecord(data)) invalid();
  return commentList(data.items);
}

export async function submitComment(slug: string, input: CommentInput): Promise<PostComment> {
  const data = await request(`/api/posts/${encodeURIComponent(slug)}/comments`, {
    method: "POST",
    body: input,
  });
  if (!isRecord(data) || !isComment(data.comment)) invalid();
  return data.comment;
}

export async function fetchAdminSession(signal?: AbortSignal): Promise<AdminSession> {
  const data = await request("/api/admin/session", { signal });
  if (
    !isRecord(data) ||
    typeof data.initialized !== "boolean" ||
    typeof data.authenticated !== "boolean" ||
    typeof data.username !== "string" ||
    typeof data.mustChangePassword !== "boolean"
  ) {
    invalid();
  }
  return data as unknown as AdminSession;
}

export async function loginAdmin(username: string, password: string): Promise<void> {
  const data = await request("/api/admin/login", { method: "POST", body: { username, password } });
  if (!isRecord(data)) invalid();
  storeToken(data.token);
}

export async function logoutAdmin(): Promise<void> {
  try {
    await request("/api/admin/logout", { method: "POST", body: {} });
  } finally {
    clearToken();
  }
}

export async function changeAdminPassword(current: string, next: string): Promise<void> {
  const data = await request("/api/admin/password", { method: "POST", body: { current, next } });
  if (isRecord(data)) storeToken(data.token);
}

export async function fetchAdminPosts(signal?: AbortSignal): Promise<PostSummary[]> {
  const data = await request("/api/admin/posts", { signal });
  if (!isRecord(data)) invalid();
  return summaryList(data.items);
}

export async function fetchAdminPost(id: string, signal?: AbortSignal): Promise<AdminPost> {
  const data = await request(`/api/admin/posts/${encodeURIComponent(id)}`, { signal });
  if (!isRecord(data)) invalid();
  return adminPost(data.post);
}

export async function createAdminPost(input: PostInput): Promise<AdminPost> {
  const data = await request("/api/admin/posts", { method: "POST", body: input });
  if (!isRecord(data)) invalid();
  return adminPost(data.post);
}

export async function updateAdminPost(
  id: string,
  input: PostInput & { version: number },
): Promise<AdminPost> {
  const data = await request(`/api/admin/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
  if (!isRecord(data)) invalid();
  return adminPost(data.post);
}

export async function deleteAdminPost(id: string): Promise<void> {
  await request(`/api/admin/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchAdminComments(signal?: AbortSignal): Promise<PostComment[]> {
  const data = await request("/api/admin/comments", { signal });
  if (!isRecord(data)) invalid();
  return commentList(data.items);
}

export async function deleteAdminComment(id: string): Promise<void> {
  await request(`/api/admin/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function apiErrorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  const messages: Record<string, string> = {
    login_required: "登录已过期，请重新登录站长账号。",
    invalid_credentials: "用户名或密码不正确。",
    not_found: "内容不存在，或已经被删除。",
    invalid_input: "输入内容不完整或格式不正确。",
    slug_taken: "这个链接地址已经被其他文章使用，请换一个。",
    write_conflict: "文章已在别处更新，请重新载入后再保存。",
    rate_limited: "操作太频繁，请稍后再试。",
    service_unavailable: "数据服务暂时不可用，请稍后重试。",
    network_error: "网络连接中断，请检查网络后重试。",
    invalid_response: "服务返回了无法识别的结果，请稍后重试。",
  };
  return messages[code] ?? "操作没有完成，请稍后重试。";
}
