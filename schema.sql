CREATE TABLE app.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  search_text text NOT NULL,
  tags jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  reading_minutes integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_status_published_at_idx ON app.posts (status, published_at);
CREATE INDEX posts_updated_at_idx ON app.posts (updated_at);

CREATE TABLE app.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES app.posts (id),
  nickname text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_created_at_idx ON app.comments (post_id, created_at);
CREATE INDEX comments_created_at_idx ON app.comments (created_at);

CREATE TABLE app.admin_account (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  iterations integer NOT NULL,
  must_change boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.admin_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  account_id text NOT NULL REFERENCES app.admin_account (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX admin_session_account_idx ON app.admin_session (account_id);
CREATE INDEX admin_session_expires_at_idx ON app.admin_session (expires_at);
