-- src/lib/db/migrations/0016_user_status.sql
CREATE TABLE IF NOT EXISTS user_status (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'offline',
  custom_emoji      text,
  custom_text       varchar(100),
  custom_expires_at timestamptz,
  last_seen         timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_status_last_seen ON user_status(last_seen);
