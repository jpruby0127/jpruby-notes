export type PostStatus = "draft" | "published";

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  status: PostStatus;
  published_at: string | null;
  updated_at: string;
  created_at: string;
  reading_minutes: number;
}

export interface PostLink {
  slug: string;
  title: string;
  published_at: string | null;
}

export interface PostDetail extends PostSummary {
  content: string;
  prev: PostLink | null;
  next: PostLink | null;
}

export interface AdminPost extends PostSummary {
  content: string;
  version: number;
}

export interface PostComment {
  id: string;
  post_id: string;
  nickname: string;
  content: string;
  created_at: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface SearchResult extends PostSummary {
  snippet: string;
}

export interface AdminSession {
  initialized: boolean;
  authenticated: boolean;
  username: string;
  mustChangePassword: boolean;
}

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  content: string;
  status: PostStatus;
}

export interface CommentInput {
  nickname: string;
  content: string;
  website: string;
}
