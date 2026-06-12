-- 001_init.sql — full schema

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scans (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id         SERIAL PRIMARY KEY,
  scan_id    TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  currency   TEXT DEFAULT 'USD',
  interval   TEXT NOT NULL CHECK (interval IN ('weekly','monthly','yearly','unknown')),
  last_seen  TEXT,
  category   TEXT DEFAULT 'other',
  is_ghost   BOOLEAN DEFAULT false,
  reason     TEXT,
  tagged_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_user          ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_scan  ON subscriptions(scan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ghost ON subscriptions(scan_id, is_ghost);
