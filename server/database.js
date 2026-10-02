import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function openDatabase(filename = process.env.APP_DB_PATH ?? './data/letopis.sqlite') {
  const path = resolve(filename)
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      name_key TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assessment_id TEXT NOT NULL,
      title TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0),
      total INTEGER NOT NULL CHECK (total > 0),
      grade TEXT NOT NULL CHECK (grade IN ('2', '3', '4', '5')),
      completed_at TEXT NOT NULL,
      CHECK (score <= total)
    );
    CREATE INDEX IF NOT EXISTS results_user_date ON results(user_id, completed_at DESC);
    CREATE INDEX IF NOT EXISTS results_assessment ON results(assessment_id);
  `)
  return db
}
